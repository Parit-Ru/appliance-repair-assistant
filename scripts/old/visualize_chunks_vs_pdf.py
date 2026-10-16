#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
visualize_chunks_vs_pdf.py
สร้างหน้า HTML ไฟล์เดียว แสดง chunk ของ "เครื่อง 1 รุ่น" คู่กับหน้า PDF ต้นฉบับ พร้อมไฮไลต์คำที่ตรงกัน
ให้กรรมการเห็นด้วยตาว่าข้อความใน chunk มาจากหน้าไหนของคู่มือ

  ซ้าย  chunk (อาการ / สาเหตุ / วิธีแก้) ระบายสีทีละคำ
          เขียว       = คำที่พบบนหน้า PDF ตามลำดับ
          ขีดจุด      = อยู่ในหน้าแต่คนละตำแหน่ง
          เหลือง      = อยู่หน้าอื่นของคู่มือ
          แดง         = ไม่มีในคู่มือเลย
  ขวา   ภาพหน้า PDF ที่เรนเดอร์จากไฟล์ต้นฉบับ มีกรอบเขียวบนคำที่ตรงกัน

ใช้ตรรกะตรวจเดียวกับ verify_chunks_against_pdf.py (สถานะและคะแนนจึงตรงกับรายงานของสคริปต์นั้น)
อ่านอย่างเดียว ไม่แก้ chunk/PDF ไม่เรียก LLM ไม่ต่อฐานข้อมูล ผลเป็นไฟล์ HTML ที่เปิดออฟไลน์ได้ (ฝังภาพไว้ในไฟล์)

ต้องมี: pdftotext (poppler) บน PATH และ PyMuPDF สำหรับเรนเดอร์ภาพหน้า PDF
    pip install pymupdf

วิธีรัน (จากโฟลเดอร์รากของโปรเจกต์):
    python scripts\\visualize_chunks_vs_pdf.py --only MC32K7055
    python scripts\\visualize_chunks_vs_pdf.py --only WA5000R --out wa5000r.html
--only คือข้อความที่อยู่ในชื่อไฟล์ chunk (ต้องตรงไฟล์เดียว) · ผลเริ่มต้น chunk_visual_<only>.html
ภาษาไทย: chunk ภาษาไทยแสดงสถานะ แต่ไม่ไฮไลต์ทีละคำ (PDF ไทยดึงข้อความเพี้ยน ใช้โหมดโครงพยัญชนะ)
"""

import argparse
import base64
import importlib.util
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("vc", os.path.join(HERE, "verify_chunks_against_pdf.py"))
vc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vc)


def lcs_pairs(a, b):
    """คู่ตำแหน่ง (i, j) ของ longest common subsequence — ไว้ระบุว่าคำไหนของ chunk ตรงกับคำไหนในหน้า"""
    n, m = len(a), len(b)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            dp[i][j] = dp[i + 1][j + 1] + 1 if a[i] == b[j] else max(dp[i + 1][j], dp[i][j + 1])
    i = j = 0
    out = []
    while i < n and j < m:
        if a[i] == b[j]:
            out.append((i, j)); i += 1; j += 1
        elif dp[i + 1][j] >= dp[i][j + 1]:
            i += 1
        else:
            j += 1
    return out


def field_tokens(text):
    """คำของข้อความพร้อมตำแหน่งตัวอักษร (ไม่นับเลขข้อ/bullet และคำไทย แบบเดียวกับสคริปต์ตรวจ)"""
    skip = [(m.start(), m.end()) for m in vc.MARKER.finditer(text)]
    out = []
    for m in vc.WORD.finditer(text):
        if any(a <= m.start() < b for a, b in skip):
            out.append((m.start(), m.end(), None))
            continue
        key = vc.nfkc_lower(m.group(0))
        ok = not vc.THAI_CHAR.search(key) and (len(key) > 1 or key.isdigit())
        out.append((m.start(), m.end(), key if ok else None))
    return out


def build_chunk(inf, res, doc, page, offset, pdf_name, zoom_key):
    c = inf["chunk"]
    e = res["expected"] - 1 if res.get("expected") else None
    base = {"id": c.get("chunk_id"), "status": res["status"], "cov": res["cov"], "order": res["order"],
            "cited": c.get("page"), "pdfPage": e + 1 if e is not None else None, "lang": res["lang"],
            "reasons": [re.sub(r"\*\*", "", x) for x in res["reasons"]], "fields": [], "boxes": [], "crop": None,
            "img": None, "exact": bool(res.get("exact"))}
    labels = ["อาการ", "สาเหตุ", "วิธีแก้"] if len(inf["fields"]) == 3 else ["ข้อความ"] * len(inf["fields"])
    if e is None or page is None:
        base["fields"] = [{"label": labels[i], "parts": [["", t]]} for i, t in enumerate(inf["fields"])]
        return base

    W, H = page.rect.width, page.rect.height
    base.update({"w": round(W, 1), "h": round(H, 1), "img": zoom_key})

    if inf["is_th"]:
        base["fields"] = [{"label": labels[i], "parts": [["", t]]} for i, t in enumerate(inf["fields"])]
        return base

    words = page.get_text("words")
    seq = []
    for bi, w in enumerate(words):
        for t in vc.word_tokens(w[4]):
            if not vc.THAI_CHAR.search(t) and (len(t) > 1 or t.isdigit()):
                seq.append((t, bi))
    matched = set()
    for fi, text in enumerate(inf["fields"]):
        toks = field_tokens(text)
        keys = [k for _, _, k in toks if k]
        vocab = set(keys)
        fseq = [(t, bi) for t, bi in seq if t in vocab]
        pairs = lcs_pairs(keys, [t for t, _ in fseq])
        hit = {i for i, _ in pairs}
        for _, j in pairs:
            matched.add(fseq[j][1])
        parts, pos, ki = [], 0, 0
        for a, b, k in toks:
            if a > pos:
                parts.append(["", text[pos:a]])
            if k is None:
                st = "skip"
            else:
                if ki in hit:
                    st = "match"
                elif k in doc["set"][e]:
                    st = "page"
                elif k in doc["union"]:
                    st = "elsewhere"
                else:
                    st = "nowhere"
                ki += 1
            parts.append([st, text[a:b]])
            pos = b
        if pos < len(text):
            parts.append(["", text[pos:]])
        base["fields"].append({"label": labels[fi], "parts": parts})
    base["boxes"] = [[round(words[i][0], 1), round(words[i][1], 1), round(words[i][2] - words[i][0], 1),
                      round(words[i][3] - words[i][1], 1)] for i in sorted(matched)]
    if base["boxes"]:
        bx = base["boxes"]
        x0 = max(0, min(b[0] for b in bx) - 24); y0 = max(0, min(b[1] for b in bx) - 24)
        x1 = min(W, max(b[0] + b[2] for b in bx) + 24); y1 = min(H, max(b[1] + b[3] for b in bx) + 24)
        if y1 - y0 < 160:
            pad = (160 - (y1 - y0)) / 2; y0 = max(0, y0 - pad); y1 = min(H, y1 + pad)
        base["crop"] = [round(x0, 1), round(y0, 1), round(x1 - x0, 1), round(y1 - y0, 1)]
    return base


def main():
    vc.setup_output()
    ap = argparse.ArgumentParser(description="สร้างหน้า HTML แสดง chunk ของเครื่อง 1 รุ่นคู่กับหน้า PDF พร้อมไฮไลต์ (อ่านอย่างเดียว)")
    ap.add_argument("--only", required=True, help="ข้อความในชื่อไฟล์ chunk (ต้องตรงไฟล์เดียว) เช่น MC32K7055")
    ap.add_argument("--chunks", default=os.path.join("data", "chuck"))
    ap.add_argument("--pdfs", default=os.path.join("data", "pdf"))
    ap.add_argument("--out", default=None, help="ไฟล์ HTML ผลลัพธ์ (ค่าเริ่มต้น chunk_visual_<only>.html)")
    ap.add_argument("--zoom", type=float, default=1.6, help="ความละเอียดภาพหน้า PDF (ค่าเริ่มต้น 1.6)")
    args = ap.parse_args()

    try:
        import pymupdf
    except ImportError:
        print("ไม่พบ PyMuPDF — ติดตั้งด้วย: pip install pymupdf", file=sys.stderr)
        return 2
    import shutil
    if shutil.which("pdftotext") is None:
        print("ไม่พบ pdftotext บน PATH", file=sys.stderr)
        return 2

    names = sorted(f for f in os.listdir(args.chunks) if f.lower().endswith(".json") and args.only.lower() in f.lower())
    if len(names) != 1:
        print(f"--only '{args.only}' ต้องตรงไฟล์ chunk 1 ไฟล์ แต่พบ {len(names)}: {names}", file=sys.stderr)
        return 2
    name = names[0]
    pdf_name = vc.MAPPING.get(name)
    if not pdf_name or not os.path.isfile(os.path.join(args.pdfs, pdf_name)):
        print(f"ไม่ทราบ PDF ของ {name} (UNMAPPED) — เติมในตาราง MAPPING ของ verify_chunks_against_pdf.py", file=sys.stderr)
        return 2
    with open(os.path.join(args.chunks, name), encoding="utf-8") as fh:
        chunks = json.load(fh)

    pdf_path = os.path.join(args.pdfs, pdf_name)
    print(f"อ่าน PDF: {pdf_name}", flush=True)
    doc = vc.load_doc(pdf_path)
    if doc["no_text_layer"]:
        print("PDF ไม่มีชั้นข้อความ (เป็นภาพ) — ตรวจและไฮไลต์ไม่ได้", file=sys.stderr)
        return 2
    infos = vc.locate_chunks(chunks, doc)
    offset, _ = vc.file_offset(infos)
    pdoc = pymupdf.open(pdf_path)

    images = {}   # เลขหน้า (1-based) -> data URI (เรนเดอร์ครั้งเดียวต่อหน้า)
    out_chunks = []
    for inf in infos:
        res = vc.evaluate_chunk(inf, doc, offset, vc.WARN_THRESHOLD)
        e = res["expected"] - 1 if res.get("expected") else None
        page = pdoc[e] if e is not None and 0 <= e < len(pdoc) else None
        item = build_chunk(inf, res, doc, page, offset, pdf_name, e + 1 if e is not None else None)
        if page is not None and item["img"] and e + 1 not in images:
            png = page.get_pixmap(matrix=pymupdf.Matrix(args.zoom, args.zoom)).tobytes("jpeg", jpg_quality=78)
            images[e + 1] = "data:image/jpeg;base64," + base64.b64encode(png).decode("ascii")
        c = inf["chunk"]
        item.update({"device": c.get("device_category"), "model": c.get("model")})
        out_chunks.append(item)

    counts = {}
    for it in out_chunks:
        counts[it["status"]] = counts.get(it["status"], 0) + 1
    data = {"file": name, "pdf": pdf_name, "pdfPages": len(pdoc), "offset": offset, "chunks": out_chunks,
            "images": {str(k): v for k, v in images.items()}, "counts": counts,
            "thresholds": {"fail": vc.WARN_THRESHOLD, "passCov": vc.PASS_COVERAGE, "passOrder": vc.PASS_ORDER}}
    out = args.out or f"chunk_visual_{re.sub(r'[^A-Za-z0-9]+', '_', args.only)}.html"
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(HTML.replace("/*__DATA__*/null", payload))
    print(f"chunk {len(out_chunks)} อัน: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())))
    print(f"สร้างแล้ว: {out}  ({os.path.getsize(out) // 1024} KB)")
    return 0


HTML = r"""<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>chunk เทียบหน้าคู่มือ PDF</title>
<style>
:root{--bg:#f3f5f7;--surface:#fff;--sunk:#e9edf1;--ink:#17212b;--muted:#5a6573;--rule:#d5dce3;--accent:#2456a6;
--ok:#1d7a4c;--ok-soft:#dcefe4;--warn:#a8690f;--warn-soft:#f6ead3;--bad:#b8372a;--bad-soft:#f6dfdb;--na:#6f7a87;--na-soft:#e4e8ec;--th:#6a4fa3;--th-soft:#ece6f6;
--hl:rgba(29,122,76,.26);--hl-line:#1d7a4c}
@media (prefers-color-scheme:dark){:root{--bg:#0f151b;--surface:#17202a;--sunk:#1d2833;--ink:#e5eaef;--muted:#9ba7b4;--rule:#2b3744;--accent:#86aef0;
--ok:#52c58d;--ok-soft:#173a2a;--warn:#e2b04e;--warn-soft:#3b2e14;--bad:#f07d6f;--bad-soft:#43201c;--na:#93a0ad;--na-soft:#26313c;--th:#b49cf0;--th-soft:#2e2645;
--hl:rgba(82,197,141,.30);--hl-line:#52c58d;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.65 "Leelawadee UI",Tahoma,system-ui,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:28px 16px 56px;display:grid;gap:20px}
h1{margin:0;font-size:clamp(22px,3.4vw,30px);line-height:1.3}
.mono{font-family:Consolas,ui-monospace,monospace;font-size:.88em}
.muted{color:var(--muted)}.note{font-size:13.5px;color:var(--muted)}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;padding:2px 10px;border-radius:999px;white-space:nowrap}
.pill:before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
.s-PASS{color:var(--ok);background:var(--ok-soft)}.s-WARN{color:var(--warn);background:var(--warn-soft)}.s-FAIL{color:var(--bad);background:var(--bad-soft)}
.s-UNVERIFIABLE{color:var(--na);background:var(--na-soft)}.s-PASS-TH,.s-WARN-TH,.s-FAIL-TH{color:var(--th);background:var(--th-soft)}
.sum{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
.tabs{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px}
.tab{flex:none;border:1px solid var(--rule);background:var(--surface);color:var(--ink);border-radius:8px;padding:7px 11px;font:13px inherit;cursor:pointer;display:grid;gap:3px;text-align:left;max-width:210px}
.tab small{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tab[aria-selected=true]{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ex{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:18px;align-items:start}
.card,.viewer{background:var(--surface);border:1px solid var(--rule);border-radius:10px;padding:16px;display:grid;gap:12px;min-width:0}
.viewer{position:sticky;top:12px}
dl{margin:0;display:grid;gap:5px;font-size:13.5px}dl div{display:grid;grid-template-columns:100px 1fr;gap:10px}dt{color:var(--muted)}dd{margin:0;overflow-wrap:anywhere}
.fl{font-size:12.5px;color:var(--muted);font-weight:600}
.field p{margin:2px 0 0;font-size:15px;line-height:1.9;white-space:pre-wrap;overflow-wrap:anywhere}
.t-match{background:var(--ok-soft);border-bottom:2px solid var(--ok);border-radius:2px}
.t-page{border-bottom:2px dotted var(--ok)}
.t-elsewhere{background:var(--warn-soft);border-bottom:2px solid var(--warn);border-radius:2px}
.t-nowhere{background:var(--bad-soft);color:var(--bad);font-weight:600;border-bottom:2px solid var(--bad);border-radius:2px}
.t-skip{color:var(--muted)}
.leg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;color:var(--muted)}
.reasons{margin:0;padding-left:18px;font-size:13.5px;color:var(--muted)}
.vbar{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--muted)}
.seg{display:inline-flex;border:1px solid var(--rule);border-radius:7px;overflow:hidden}
.seg button{border:0;background:transparent;color:var(--ink);padding:5px 12px;font:13px inherit;cursor:pointer}
.seg button[aria-pressed=true]{background:var(--accent);color:var(--surface)}
.paper{background:#fff;border-radius:6px;overflow:hidden;border:1px solid var(--rule)}
.paper svg{display:block;width:100%;height:auto;max-height:74vh}
.empty{padding:32px 12px;text-align:center;color:var(--muted)}
@media(max-width:860px){.ex{grid-template-columns:1fr}.viewer{position:static}dl div{grid-template-columns:1fr;gap:0}}
</style></head><body><div class="wrap">
<header style="display:grid;gap:8px"><div class="note">เทียบ chunk กับหน้าคู่มือ PDF ต้นฉบับ</div><h1 id="title"></h1>
<div class="sum" id="sum"></div><p class="note" id="meta"></p></header>
<div class="tabs" role="tablist" id="tabs"></div><div class="ex" id="ex"></div>
<p class="note">สร้างโดย scripts/visualize_chunks_vs_pdf.py ใช้ตรรกะเดียวกับ verify_chunks_against_pdf.py · PASS ไม่ได้พิสูจน์ว่าถูกต้อง 100% (เทียบระดับคำ ไม่เข้าใจความหมาย)</p>
</div><script>
const D=/*__DATA__*/null,$=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct=v=>v==null?'–':(v*100).toFixed(0)+'%';
const LABEL={PASS:'ผ่าน',WARN:'ควรดูด้วยตา',FAIL:'ไม่ผ่าน',UNVERIFIABLE:'ตรวจไม่ได้','PASS-TH':'ผ่าน (ไทย)','WARN-TH':'ควรดูด้วยตา (ไทย)','FAIL-TH':'ไม่ผ่าน (ไทย)'};
const pill=s=>`<span class="pill s-${s}">${LABEL[s]||s}</span>`;
const TOK={match:'ตรงกับหน้านี้ตามลำดับ',page:'อยู่ในหน้าแต่คนละตำแหน่ง',elsewhere:'อยู่หน้าอื่นของคู่มือ',nowhere:'ไม่มีในคู่มือเลย'};
$('#title').textContent=D.chunks[0]?.model+' · '+(D.chunks[0]?.device||'');
$('#sum').innerHTML=Object.entries(D.counts).map(([k,v])=>`${pill(k)} <b>${v}</b>`).join(' &nbsp; ')+` <span class="muted">จาก ${D.chunks.length} chunk</span>`;
$('#meta').innerHTML=`ไฟล์ chunk <span class="mono">${esc(D.file)}</span> · คู่มือ <span class="mono">${esc(D.pdf)}</span> (${D.pdfPages} หน้า) · `+(D.offset?`เลขหน้าใน chunk เลื่อน ${D.offset>0?'+':''}${D.offset} ไปเป็นลำดับหน้าในไฟล์ (คู่มือสองภาษา)`:'เลขหน้าตรงกับลำดับหน้าในไฟล์');
let cur=0,full=false;
const tabs=()=>{$('#tabs').innerHTML=D.chunks.map((x,i)=>`<button class="tab" role="tab" aria-selected="${i===cur}" data-i="${i}" type="button">${pill(x.status)}<small>${esc(x.id.replace(/^manual_Samsung_[A-Za-z]+_[A-Za-z0-9]+_/,''))}</small></button>`).join('')};
function view(){
 const x=D.chunks[cur];
 const fields=x.fields.map(f=>`<div class="field"><span class="fl">${esc(f.label)}</span><p>${f.parts.map(([s,t])=>s?`<span class="t-${s}">${esc(t)}</span>`:esc(t)).join('')}</p></div>`).join('');
 let right;
 if(x.img){
  const vb=(full||!x.crop)?[0,0,x.w,x.h]:x.crop;
  const bx=x.boxes.map(([a,b,w,h])=>`<rect x="${a-1}" y="${b-1}" width="${w+2}" height="${h+2}" rx="1.5" fill="var(--hl)" stroke="var(--hl-line)" stroke-width=".6"/>`).join('');
  right=`<div class="viewer"><div class="vbar"><span>หน้า ${x.pdfPage} ของ ${esc(D.pdf)}</span>${x.crop?`<span class="seg"><button type="button" data-z="0" aria-pressed="${!full}">ส่วนที่ตรงกัน</button><button type="button" data-z="1" aria-pressed="${full}">ทั้งหน้า</button></span>`:''}</div>
  <div class="paper"><svg viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMin meet" role="img" aria-label="ภาพหน้าคู่มือพร้อมกรอบคำที่ตรงกับ chunk"><rect width="${x.w}" height="${x.h}" fill="#fff"/><image href="${D.images[x.pdfPage]}" width="${x.w}" height="${x.h}"/>${bx}</svg></div>
  <p class="note">ภาพเรนเดอร์จากไฟล์ PDF ต้นฉบับ ${x.boxes.length?x.boxes.length+' กรอบ = คำของ chunk ที่พบบนหน้านี้ตามลำดับ':'(chunk ภาษาไทยไม่ไฮไลต์ทีละคำ)'}</p></div>`;
 }else right=`<div class="viewer"><div class="empty">ไม่มีภาพหน้าให้แสดง (ตรวจไม่ได้หรือหน้าอ้างอิงไม่มีใน PDF)</div></div>`;
 $('#ex').innerHTML=`<div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${pill(x.status)}<span class="mono">${esc(x.id)}</span></div>
 <dl><div><dt>หน้าที่อ้าง</dt><dd>หน้า ${x.cited}${x.pdfPage?` = หน้าที่ ${x.pdfPage} จาก ${D.pdfPages} ของไฟล์ PDF`:''}</dd></div>
 <div><dt>คะแนน</dt><dd>คำอยู่ในหน้า ${pct(x.cov)} · ตามลำดับ ${pct(x.order)}${x.exact?' · ข้อความต่อเนื่องตรงทุกตัวอักษร':''}</dd></div></dl>
 ${fields}<div class="leg">${Object.entries(TOK).map(([k,v])=>`<span><span class="t-${k}">คำ</span> ${v}</span>`).join('')}</div>
 ${x.reasons.length?`<div><span class="note">เหตุผลจากสคริปต์</span><ul class="reasons">${x.reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul></div>`:''}</div>${right}`;
}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('.tab');if(!b)return;cur=+b.dataset.i;full=false;tabs();view()});
$('#ex').addEventListener('click',e=>{const b=e.target.closest('[data-z]');if(!b)return;full=b.dataset.z==='1';view()});
tabs();view();
</script></body></html>
"""

if __name__ == "__main__":
    sys.exit(main())
