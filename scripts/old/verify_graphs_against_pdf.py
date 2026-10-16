#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_graphs_against_pdf.py
ตรวจว่า "ผังขั้นตอน (state machine)" ใน data/manuals ยังตรงกับต้นทางหลังแปลงจากคู่มือ:
    ผัง  ->  chunk (data/chuck)  ->  PDF (data/pdf)

ตรวจอะไร (ต่อ 1 ผัง):
  C1  source_chunk_id มี chunk จริง                       ไม่มี = NO_CHUNK
  C2  ข้อมูลอ้างอิงตรงกับ chunk: แหล่งที่มา (source), ยี่ห้อ, รุ่น, หน้า (อยู่ใน page_range), หัวข้ออาการ (entry_symptom)
  P1  คำในหัวข้ออาการ (ภาษาอังกฤษ) อย่างน้อย 80% อยู่ในหน้า PDF ที่ผังอ้าง (คิด offset ของไฟล์ที่สคริปต์ตรวจ chunk ใช้)
  P2  ตัวเลขทุกตัวที่อยู่ในข้อความโหนด (question/content/safety_warning) ต้องพบใน PDF เล่มนั้น
      (ไม่นับเลขหน้าในวงเล็บ "(คู่มือหน้า N)" และเลขในรหัสโหนด)
  P3  ข้อความภาษาอังกฤษที่ author_note ยกมาจากคู่มือในเครื่องหมายคำพูด ต้องพบใน PDF

ตรวจไม่ได้ (UNVERIFIABLE ไม่นับเป็นผ่าน): ไม่มีไฟล์ chunk / ไม่ทราบ PDF / PDF ไม่มีชั้นข้อความ

ไม่ตรวจ (ทำด้วยสคริปต์ไม่ได้): ความถูกต้องของคำแปลภาษาไทยและลำดับ/โครงของขั้นตอน — ต้องให้คนสุ่มตรวจ
(ผังเป็นภาษาไทย คู่มือเป็นอังกฤษ จึงเทียบคำต่อคำไม่ได้ ตรวจได้เฉพาะ "ข้อเท็จจริงที่ไม่เปลี่ยนตามภาษา"
คือ ชื่อหัวข้อ เลขหน้า ตัวเลข รหัส และข้อความที่ยกมา)

อ่านอย่างเดียว ไม่แก้ผัง/chunk/PDF ไม่เรียก LLM ไม่ต่อฐานข้อมูล ใช้ฟังก์ชันจาก verify_chunks_against_pdf.py
ต้องมี pdftotext (poppler) บน PATH

วิธีรัน (จากโฟลเดอร์รากของโปรเจกต์):
    python scripts\\verify_graphs_against_pdf.py
    python scripts\\verify_graphs_against_pdf.py --report graphs_report.md --only wa5000r

ระดับผล: FAIL = ข้อมูลอ้างอิงไม่ตรง chunk หรือมีตัวเลขที่ไม่มีใน PDF เล่มนั้นเลย · WARN = ควรเปิดคู่มือดูด้วยตา
exit code: 0 = ไม่มี FAIL (WARN ไม่ทำให้ล้ม แต่ถูกรายงานทุกครั้ง; ข้อยกเว้นที่ตรวจสาเหตุแล้วอยู่ใน KNOWN_*)
           1 = มี FAIL  2 = รันไม่ได้
"""

import argparse
import glob
import importlib.util
import json
import os
import re
import shutil
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("vc", os.path.join(HERE, "verify_chunks_against_pdf.py"))
vc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vc)

# =============================================================================
# ข้อยกเว้นที่รู้แล้ว (ตรวจแล้วทีละรายการ — อย่าเพิ่มโดยไม่ดูสาเหตุ)
# =============================================================================
KNOWN_SYMPTOM_NOTE = {}      # (graph_id) -> เหตุผล

_PHONE = ("เบอร์ 02-689-3232 มีใน PDF ของ Samsung เล่มอื่น (เช่น WA5000R) แต่ไม่มีใน PDF ของ WT10J7 "
          "(เล่มนี้มีเฉพาะ 1800-29-3232 หน้า 1) ผังอ้างหน้า 7 ซึ่งไม่ตรง — ต้องตัดสินใจ: ตัดเบอร์ออก หรืออ้างเล่มที่มีเบอร์นี้")
_TABLE = ("ตัวเลขมาจากตารางปริมาณผ้า (หน้าพิมพ์ 6) ของ PDF ไทย ซึ่ง pdftotext ดึงตารางไม่ออก "
          "ตรวจด้วยตาจากภาพหน้า PDF แล้วว่าตัวเลขถูกต้อง (16/20/25, 22/29/35, 38/48/58)")
KNOWN_NUMBERS = {            # (graph_id, node_id, ตัวเลข) -> เหตุผล
    **{("samsung_wt10j7_um_" + g, "n_escalate", n): _PHONE
       for g in ("does_not_run", "clothes_not_rotating", "abnormal_spin", "water_not_draining",
                 "spin_not_working", "drains_continuously") for n in ("02", "689")},
    **{("samsung_wt10j7_um_clothes_not_rotating", "n1f", n): _TABLE
       for n in ("16", "20", "22", "25", "35", "48")},
}
KNOWN_QUOTES = {}            # (graph_id, node_id, ข้อความ) -> เหตุผล
KNOWN_HEADINGS = {}          # (graph_id) -> เหตุผล
HEADING_MIN_COVERAGE = 0.80  # สัดส่วนคำของหัวข้อที่ต้องอยู่ในหน้า PDF (หัวข้อเป็นประโยคที่ LLM เรียบเรียง ไม่ใช่ข้อความคัดลอกทั้งบรรทัด)            # (graph_id, node_id, ข้อความ) -> เหตุผล
# ปรับหลังตรวจผลรันแรก (ดูส่วนท้ายของไฟล์นี้เมื่อมีการเติม)

# ระดับ WARN = ควรเปิดคู่มือดูด้วยตา (หัวข้อเป็นประโยคที่ LLM เรียบเรียง / ข้อความในเครื่องหมายคำพูดอาจเป็นการสรุป)
# ระดับ FAIL = ข้อมูลอ้างอิงไม่ตรงกับ chunk หรือมีตัวเลขที่ไม่มีใน PDF เล่มนั้นเลย
WARN_CODES = {"P1-heading", "P3-quote"}

PAGE_REF = re.compile(r"\(?คู่มือหน้า[\s\d,และ\-–]+\)?")
QUOTE = re.compile(r"'([^'\n]{6,})'|\"([^\"\n]{6,})\"")
NUM = re.compile(r"\d+(?:[.,]\d+)?")


def norm_words(s):
    return re.sub(r"[^a-z0-9]+", "", vc.nfkc_lower(s or ""))


def node_text(n):
    return " ".join(str(n.get(k, "")) for k in ("question", "content", "safety_warning"))


def main():
    vc.setup_output()
    ap = argparse.ArgumentParser(description="ตรวจว่าผังขั้นตอนยังตรงกับ chunk และ PDF ต้นฉบับ (อ่านอย่างเดียว)")
    ap.add_argument("--manuals", default=os.path.join("data", "manuals"))
    ap.add_argument("--chunks", default=os.path.join("data", "chuck"))
    ap.add_argument("--pdfs", default=os.path.join("data", "pdf"))
    ap.add_argument("--report", default="graphs_verification_report.md")
    ap.add_argument("--only", default=None, help="ตรวจเฉพาะไฟล์ผังที่ชื่อมีข้อความนี้")
    args = ap.parse_args()

    if shutil.which("pdftotext") is None:
        print("ไม่พบ pdftotext บน PATH", file=sys.stderr)
        return 2
    for p in (args.manuals, args.chunks, args.pdfs):
        if not os.path.isdir(p):
            print(f"ไม่พบโฟลเดอร์ {p}", file=sys.stderr)
            return 2

    # ---- chunk ทั้งหมด + ไฟล์ที่มันอยู่ ----
    chunk_of, chunks_by_file = {}, {}
    for f in sorted(glob.glob(os.path.join(args.chunks, "*.json"))):
        name = os.path.basename(f)
        with open(f, encoding="utf-8") as fh:
            arr = json.load(fh)
        chunks_by_file[name] = arr
        for c in arr:
            chunk_of.setdefault(c["chunk_id"], (name, c))

    docs, offsets = {}, {}

    def load(pdf):
        path = os.path.join(args.pdfs, pdf)
        if path not in docs:
            print(f"... อ่าน PDF: {pdf}", flush=True)
            docs[path] = vc.load_doc(path)
        return docs[path]

    def offset_of(cname, doc):
        if cname not in offsets:
            infos = vc.locate_chunks(chunks_by_file[cname], doc)
            offsets[cname] = vc.file_offset(infos)[0]
        return offsets[cname]

    results = []   # dict ต่อผัง
    for f in sorted(glob.glob(os.path.join(args.manuals, "*.json"))):
        if args.only and args.only.lower() not in os.path.basename(f).lower():
            continue
        with open(f, encoding="utf-8") as fh:
            manual = json.load(fh)
        for g in manual["graphs"]:
            r = {"graph": g["graph_id"], "manual": manual["manual_id"], "status": "PASS", "problems": [], "warns": [], "known": [],
                 "unverifiable": None, "notes": [], "nums": 0, "quotes": 0}
            results.append(r)

            def bad(code, msg, key=None, known=None):
                if known is not None and key in known:
                    r["known"].append(f"{code} (ข้อยกเว้นที่รู้แล้ว) {msg} — {known[key]}")
                elif code in WARN_CODES:
                    r["warns"].append(f"{code} {msg}")
                else:
                    r["problems"].append(f"{code} {msg}")

            hit = chunk_of.get(g.get("source_chunk_id"))
            if not hit:
                r["status"] = "NO_CHUNK"
                r["unverifiable"] = f"ไม่มี chunk '{g.get('source_chunk_id')}' ในไฟล์ chunk"
                continue
            cname, c = hit
            md = c.get("metadata") or {}

            # ---- C2: ข้อมูลอ้างอิงตรงกับ chunk ----
            if g.get("source") != c.get("source"):
                bad("C2-source", "แหล่งที่มา (source) ไม่ตรงกับ chunk")
            if g.get("brand") != c.get("brand"):
                bad("C2-brand", f"ยี่ห้อ {g.get('brand')} ≠ {c.get('brand')}")
            if g.get("model_pattern") != c.get("model"):
                bad("C2-model", f"รุ่น {g.get('model_pattern')} ≠ {c.get('model')}")
            pr = g.get("page_range") or [0, 0]
            if not (pr[0] <= c.get("page", -1) <= pr[1]):
                bad("C2-page", f"หน้า chunk {c.get('page')} ไม่อยู่ใน page_range {pr}")
            gs, cs = norm_words(g.get("entry_symptom")), norm_words(md.get("symptom"))
            if gs != cs and not (gs and cs.startswith(gs)):
                bad("C2-symptom", f"หัวข้ออาการ '{g.get('entry_symptom')}' ≠ chunk '{md.get('symptom')}'",
                    g["graph_id"], KNOWN_SYMPTOM_NOTE)

            # ---- PDF ----
            pdf = vc.MAPPING.get(cname)
            if not pdf or not os.path.isfile(os.path.join(args.pdfs, pdf)):
                r["unverifiable"] = "ไม่ทราบ PDF ของ chunk นี้ (ชั้น P1–P3 ตรวจไม่ได้)"
                r["status"] = "NO_PDF" if not r["problems"] else "FAIL"
                continue
            doc = load(pdf)
            if doc["no_text_layer"]:
                r["unverifiable"] = "PDF ไม่มีชั้นข้อความ (ชั้น P1–P3 ตรวจไม่ได้)"
                r["status"] = "NO_TEXT" if not r["problems"] else "FAIL"
                continue

            # ---- P1: หัวข้ออาการอยู่ในหน้าที่อ้าง ----
            off = offset_of(cname, doc)
            e = c["page"] - 1 + off
            toks = vc.en_tokens(g.get("entry_symptom") or "")
            if not (0 <= e < doc["n"]):
                bad("P1-page", f"หน้า {c['page']} (+{off}) ไม่มีใน PDF ({doc['n']} หน้า)")
            elif doc["blank"][e]:
                r["notes"].append(f"หน้า {e + 1} ของ PDF ไม่มีข้อความ (ภาพ) — P1 ตรวจไม่ได้")
            elif toks:
                page_sq = doc["squash"][e]
                # pdftotext บางครั้งแทรกช่องว่างกลางคำ ("S tains", "4 C2") จึงนับคำที่เป็นส่วนหนึ่งของข้อความหน้านั้นที่ตัดช่องว่างแล้วด้วย
                hit = [t for t in toks if t in doc["set"][e] or (len(t) >= 3 and t in page_sq)]
                cov = len(hit) / len(toks)
                r["heading_cov"] = cov
                if cov < HEADING_MIN_COVERAGE:
                    miss = [t for t in toks if t not in hit]
                    bad("P1-heading", f"หัวข้อ '{g.get('entry_symptom')}' มีคำอยู่ในหน้า PDF ที่ {e + 1} เพียง {cov:.0%} "
                        f"(ไม่พบ: {', '.join(miss[:6])})", g["graph_id"], KNOWN_HEADINGS)

            # ---- P2/P3: ตัวเลขและข้อความที่ยก ----
            all_nums = set().union(*doc["numbers"])
            all_sq = "".join(doc["squash"])
            for n in g["nodes"]:
                body = PAGE_REF.sub(" ", node_text(n)).translate(vc.THAI_DIGITS)
                for num in sorted(set(NUM.findall(body))):
                    r["nums"] += 1
                    if not ({num, num.replace(",", "."), num.replace(".", ",")} & all_nums):
                        bad("P2-number", f"โหนด {n['node_id']} มีตัวเลข {num} ที่ไม่พบใน PDF",
                            (g["graph_id"], n["node_id"], num), KNOWN_NUMBERS)
                for q in QUOTE.findall(n.get("author_note") or ""):
                    qq = next(x for x in q if x)
                    if re.search(r"[A-Za-z]{3}", qq) and not vc.THAI_CHAR.search(qq):
                        r["quotes"] += 1
                        if vc.squash(qq) not in all_sq:
                            bad("P3-quote", f"โหนด {n['node_id']} ยก \"{qq}\" ซึ่งไม่พบใน PDF",
                                (g["graph_id"], n["node_id"], qq), KNOWN_QUOTES)
            if r["problems"]:
                r["status"] = "FAIL"
            elif r["warns"]:
                r["status"] = "WARN"
            elif r["known"]:
                r["status"] = "KNOWN"

    # ---------------------------------------------------------------- สรุป
    cnt = Counter(r["status"] for r in results)
    total = len(results)
    print()
    print(f"ผังทั้งหมด {total}")
    print(f"  PASS            {cnt['PASS']}")
    print(f"  KNOWN           {cnt['KNOWN']}  (มีข้อยกเว้นที่ตรวจสาเหตุแล้ว ดูใน KNOWN_* — ไม่ใช่ผ่านเต็ม)")
    print(f"  WARN            {cnt['WARN']}  (ควรเปิดคู่มือดูด้วยตา)")
    print(f"  FAIL            {cnt['FAIL']}")
    print(f"  ตรวจไม่ได้       {cnt['NO_CHUNK'] + cnt['NO_PDF'] + cnt['NO_TEXT']} "
          f"(ไม่มี chunk {cnt['NO_CHUNK']} · ไม่ทราบ PDF {cnt['NO_PDF']} · PDF ไม่มีข้อความ {cnt['NO_TEXT']})")
    print(f"  ตัวเลขที่ตรวจ {sum(r['nums'] for r in results)} ตัว · ข้อความที่ยกมาตรวจ {sum(r['quotes'] for r in results)} ข้อความ")
    known = sum(len(r["known"]) for r in results)
    if known:
        print(f"  ข้อยกเว้นที่รู้แล้ว {known} รายการ (ดูในรายงาน)")
    codes = Counter(p.split()[0] for r in results for p in r["problems"] + r["warns"])
    print("  ตามชนิด: " + " · ".join(f"{k} {v}" for k, v in sorted(codes.items())))
    for r in results:
        if r["problems"]:
            print(f"  [FAIL] {r['graph']}")
            for p in r["problems"]:
                print(f"         {p}")

    with open(args.report, "w", encoding="utf-8-sig", newline="\n") as fh:
        fh.write(build_report(results, cnt))
    print(f"รายงาน: {args.report}")
    return 1 if cnt["FAIL"] else 0


def build_report(results, cnt):
    L = ["# รายงานตรวจผังขั้นตอนเทียบ chunk และ PDF", "",
         "ตรวจ: ชื่อหัวข้อ/แหล่งที่มา/เลขหน้า (ผัง↔chunk) · หัวข้ออาการอยู่ในหน้า PDF · ตัวเลขทุกตัวพบใน PDF · ข้อความที่ยกมาพบใน PDF", "",
         "**ไม่ได้ตรวจ:** ความถูกต้องของคำแปลไทยและลำดับขั้นตอน (ต้องให้คนสุ่มตรวจ)", "",
         "## สรุป", "", "| สถานะ | จำนวน |", "|---|---:|"]
    for k, label in (("PASS", "ผ่าน"), ("KNOWN", "มีข้อยกเว้นที่ตรวจสาเหตุแล้ว"), ("WARN", "ควรเปิดคู่มือดูด้วยตา"), ("FAIL", "ไม่ผ่าน"), ("NO_CHUNK", "ตรวจไม่ได้: ไม่มี chunk"),
                     ("NO_PDF", "ตรวจไม่ได้: ไม่ทราบ PDF"), ("NO_TEXT", "ตรวจไม่ได้: PDF ไม่มีข้อความ")):
        L.append(f"| {label} | {cnt[k]} |")
    L += ["", "## ผังที่ไม่ผ่านหรือมีข้อยกเว้น", ""]
    rows = [r for r in results if r["problems"] or r["warns"] or r["known"]]
    if not rows:
        L.append("(ไม่มี)")
    for r in rows:
        L.append(f"- **{r['graph']}**")
        for p in r["problems"]:
            L.append(f"  - ✗ {p}")
        for p in r["warns"]:
            L.append(f"  - ? {p}")
        for k in r["known"]:
            L.append(f"  - ⚠ {k}")
    L += ["", "## ตรวจไม่ได้", ""]
    by = defaultdict(list)
    for r in results:
        if r["unverifiable"]:
            by[(r["status"], r["unverifiable"])].append(r["graph"])
    for (st, why), gs in sorted(by.items()):
        L.append(f"- {st}: {why} — {len(gs)} ผัง (ตัวอย่าง {gs[0]})")
    return "\n".join(L) + "\n"


if __name__ == "__main__":
    sys.exit(main())
