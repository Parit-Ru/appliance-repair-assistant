"""
check_chunk_pdf.py — เทียบ chunk ของคู่มือ 1 เล่มกับไฟล์ PDF แล้วสร้างหน้า HTML ให้ดูด้วยตา

วิธีใช้:
    pip install pymupdf
    python scripts/check_chunk_pdf.py data/chuck/<ไฟล์ chunk>.json data/pdf/<ไฟล์ PDF>.pdf

ผลลัพธ์: ไฟล์ HTML (ชื่อเดียวกับไฟล์ chunk) เปิดในเบราว์เซอร์ได้เลย

หลักการ (ไม่ใช้ LLM ไม่แก้ไฟล์ใดๆ):
  1. อ่านคำทุกคำในแต่ละหน้าของ PDF
  2. chunk แต่ละอันอ้างเลขหน้าไว้ หาว่าหน้านั้นคือหน้าที่เท่าไรในไฟล์ (คู่มือสองภาษาเลขหน้าเลื่อน)
  3. นับว่าคำของ chunk อยู่ในหน้านั้นกี่ % และเรียงลำดับเดียวกันกี่ %
  4. ตัดสินผล PASS / WARN / FAIL แล้ววาดกรอบเขียวบนคำที่ตรงกัน
"""

import base64
import json
import re
import sys
import unicodedata
from collections import Counter

import pymupdf

# เกณฑ์ตัดสิน
FAIL_BELOW = 0.90    # คำอยู่ในหน้าน้อยกว่านี้ = FAIL
PASS_FROM = 0.97     # คำอยู่ในหน้าตั้งแต่นี้ และเรียงลำดับตั้งแต่ ORDER_FROM = PASS
ORDER_FROM = 0.90
NOWHERE_FAIL = 3     # คำที่ไม่มีใน PDF เลยตั้งแต่กี่คำ = FAIL


# ---------------------------------------------------------------- คำ

def words_of(text):
    """แยกข้อความเป็นคำตัวพิมพ์เล็ก (ไม่เอาคำไทย และตัวอักษรเดี่ยวที่ไม่ใช่ตัวเลข)"""
    text = unicodedata.normalize("NFKC", text).replace("﻿", "").replace("’", "'").lower()
    text = re.sub(r"(?:^|(?<=\s))\d{1,2}[.)](?=\s|$)", " ", text)  # ตัดเลขข้อ "1." "2)" ที่ LLM ใส่เอง
    words = re.findall(r"[a-z0-9]+(?:'[a-z0-9]+)?", text)
    return [w for w in words if len(w) > 1 or w.isdigit()]


def is_thai(text):
    letters = [c for c in text if c.isalpha()]
    return bool(letters) and sum("฀" <= c <= "๿" for c in letters) / len(letters) > 0.5


def chunk_parts(chunk):
    """แยก chunk เป็น อาการ / สาเหตุ / วิธีแก้ (ถ้าไม่มีก็ใช้ content ทั้งก้อน)"""
    meta = chunk.get("metadata") or {}
    parts = [("อาการ", meta.get("symptom")), ("สาเหตุ", meta.get("possible_cause")), ("วิธีแก้", meta.get("solution"))]
    parts = [(label, text) for label, text in parts if text]
    return parts or [("ข้อความ", chunk.get("content") or "")]


def lcs(a, b):
    """จับคู่คำแบบเรียงลำดับ (longest common subsequence) คืนคู่ตำแหน่ง (i ใน a, j ใน b)"""
    table = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) - 1, -1, -1):
        for j in range(len(b) - 1, -1, -1):
            table[i][j] = table[i + 1][j + 1] + 1 if a[i] == b[j] else max(table[i + 1][j], table[i][j + 1])
    pairs, i, j = [], 0, 0
    while i < len(a) and j < len(b):
        if a[i] == b[j]:
            pairs.append((i, j))
            i, j = i + 1, j + 1
        elif table[i + 1][j] >= table[i][j + 1]:
            i += 1
        else:
            j += 1
    return pairs


# ---------------------------------------------------------------- PDF

def read_pdf(path):
    """คืน list ของหน้า: แต่ละหน้ามี words = [(คำ, กรอบ x,y,w,h)]"""
    pages = []
    for page in pymupdf.open(path):
        words = []
        for x0, y0, x1, y1, raw, *_ in page.get_text("words"):
            for w in words_of(raw):
                words.append((w, [round(x0, 1), round(y0, 1), round(x1 - x0, 1), round(y1 - y0, 1)]))
        pages.append({"words": words, "set": {w for w, _ in words},
                      "width": page.rect.width, "height": page.rect.height})
    return pages


def find_offset(chunks, pages):
    """หาว่าเลขหน้าใน chunk ต้องบวกเท่าไรถึงเป็นหน้าในไฟล์ PDF (ดูจากหน้าที่คำตรงมากที่สุดของแต่ละ chunk)"""
    votes = Counter()
    for chunk in chunks:
        words = set(words_of(" ".join(text for _, text in chunk_parts(chunk))))
        if len(words) < 8:
            continue
        scores = [len(words & p["set"]) / len(words) for p in pages]
        best = max(range(len(pages)), key=lambda i: scores[i])
        if scores[best] >= 0.85:
            votes[(best + 1) - chunk["page"]] += 1
    return votes.most_common(1)[0][0] if votes else 0



def check_chunk(chunk, pages, all_words, offset):
    parts = chunk_parts(chunk)
    index = chunk["page"] - 1 + offset
    result = {"id": chunk["chunk_id"], "cited": chunk["page"], "pdf_page": index + 1,
              "status": "PASS", "reasons": [], "parts": [], "boxes": [], "cov": None, "order": None}

    if is_thai(" ".join(text for _, text in parts)):
        result["status"] = "ภาษาไทย"
        result["reasons"].append("ไม่ตรวจภาษาไทย (PDF ไทยดึงข้อความเพี้ยน)")
        result["parts"] = [(label, [["", text]]) for label, text in parts]
        return result
    if not all_words:
        result["status"] = "ตรวจไม่ได้"
        result["reasons"].append("PDF ทั้งเล่มไม่มีข้อความ (เป็นภาพสแกน)")
        result["parts"] = [(label, [["", text]]) for label, text in parts]
        return result
    if not 0 <= index < len(pages):
        result["status"] = "FAIL"
        result["reasons"].append(f"หน้า {index + 1} ไม่มีใน PDF")
        result["parts"] = [(label, [["", text]]) for label, text in parts]
        return result

    page = pages[index]
    if len(page["words"]) < 20:
        result["status"] = "ตรวจไม่ได้"
        result["reasons"].append("หน้านี้ใน PDF ไม่มีข้อความ (เป็นภาพ)")
        result["parts"] = [(label, [["", text]]) for label, text in parts]
        return result

    total = in_page = in_order = 0
    nowhere = []
    for label, text in parts:
        chunk_words = words_of(text)
        page_words = [(w, box) for w, box in page["words"] if w in set(chunk_words)]
        pairs = lcs(chunk_words, [w for w, _ in page_words])
        matched = {i for i, _ in pairs}
        result["boxes"] += [page_words[j][1] for _, j in pairs]

        # ระบายสีทีละคำ
        colored, n = [], 0
        for piece in re.split(r"(\s+)", text):
            keys = words_of(piece)
            if not keys:
                colored.append(["", piece])
                continue
            states = []
            for w in keys:
                if n in matched:
                    states.append("match")
                elif w in page["set"]:
                    states.append("page")
                elif w in all_words:
                    states.append("elsewhere")
                else:
                    states.append("nowhere")
                    nowhere.append(w)
                n += 1
            worst = ["match", "page", "elsewhere", "nowhere"]
            colored.append([max(states, key=worst.index), piece])
        result["parts"].append((label, colored))

        total += len(chunk_words)
        in_page += sum(w in page["set"] for w in chunk_words)
        in_order += len(pairs)

    if total == 0:
        result["status"] = "WARN"
        result["reasons"].append("chunk ไม่มีคำให้ตรวจ")
        return result

    cov, order = in_page / total, in_order / total
    result["cov"], result["order"] = round(cov, 2), round(order, 2)
    missing_numbers = [w for w in words_of(" ".join(t for _, t in parts)) if w.isdigit() and w not in page["set"]]

    if cov < FAIL_BELOW:
        result["reasons"].append(f"คำอยู่ในหน้าเพียง {cov:.0%}")
    if missing_numbers:
        result["reasons"].append("ตัวเลขไม่อยู่ในหน้านี้: " + ", ".join(sorted(set(missing_numbers))))
    if nowhere:
        result["reasons"].append("คำที่ไม่มีใน PDF เลย: " + ", ".join(sorted(set(nowhere))))
    if cov < FAIL_BELOW or missing_numbers or len(set(nowhere)) >= NOWHERE_FAIL:
        result["status"] = "FAIL"
    elif cov < PASS_FROM or order < ORDER_FROM or nowhere:
        result["status"] = "WARN"
        if cov >= PASS_FROM and order < ORDER_FROM:
            result["reasons"].append(f"คำครบแต่เรียงลำดับตรงเพียง {order:.0%} (ตารางใน PDF มักสลับคอลัมน์)")
    return result


# ---------------------------------------------------------------- main

def main():
    if len(sys.argv) != 3:
        print("วิธีใช้: python scripts/check_chunk_pdf.py <ไฟล์ chunk .json> <ไฟล์ .pdf>")
        return 2
    chunk_path, pdf_path = sys.argv[1], sys.argv[2]

    with open(chunk_path, encoding="utf-8") as f:
        chunks = json.load(f)
    pages = read_pdf(pdf_path)
    all_words = set().union(*(p["set"] for p in pages))
    offset = find_offset(chunks, pages)
    results = [check_chunk(c, pages, all_words, offset) for c in chunks]

    # ภาพหน้า PDF ที่ถูกอ้าง (ฝังไว้ในไฟล์ HTML)
    pdf = pymupdf.open(pdf_path)
    images = {}
    for r in results:
        p = r["pdf_page"]
        if r["boxes"] and p not in images:
            jpg = pdf[p - 1].get_pixmap(matrix=pymupdf.Matrix(1.6, 1.6)).tobytes("jpeg", jpg_quality=75)
            images[p] = "data:image/jpeg;base64," + base64.b64encode(jpg).decode()
        if r["boxes"]:
            r["width"], r["height"] = pages[p - 1]["width"], pages[p - 1]["height"]

    counts = Counter(r["status"] for r in results)
    print(f"chunk {len(results)} อัน · offset หน้า {offset:+d} · " + ", ".join(f"{k} {v}" for k, v in counts.items()))
    for r in results:
        if r["status"] != "PASS":
            print(f"  {r['status']:<10} {r['id']}  {'; '.join(r['reasons'])}")

    data = {"chunk_file": chunk_path, "pdf_file": pdf_path, "results": results, "images": images}
    out = re.sub(r"\.json$", "", chunk_path.replace("\\", "/").split("/")[-1]) + ".html"
    with open(out, "w", encoding="utf-8") as f:
        f.write(HTML.replace("__DATA__", json.dumps(data, ensure_ascii=False).replace("</", "<\\/")))
    print(f"สร้างแล้ว: {out}")
    return 0


HTML = """<!doctype html><html lang="th"><head><meta charset="utf-8"><title>chunk เทียบ PDF</title>
<style>
body{margin:0;padding:24px;background:#f3f5f7;color:#17212b;font:15px/1.7 Tahoma,sans-serif}
.tabs{display:flex;gap:6px;overflow-x:auto;margin:16px 0}
.tabs button{flex:none;border:1px solid #ccd;background:#fff;border-radius:6px;padding:6px 10px;cursor:pointer}
.tabs button.on{outline:2px solid #2456a6}
.row{display:grid;grid-template-columns:2fr 3fr;gap:16px;align-items:start}
.box{background:#fff;border:1px solid #d5dce3;border-radius:8px;padding:16px}
.PASS{color:#1d7a4c}.WARN{color:#a8690f}.FAIL{color:#b8372a}
.match{background:#dcefe4;border-bottom:2px solid #1d7a4c}.page{border-bottom:2px dotted #1d7a4c}
.elsewhere{background:#f6ead3}.nowhere{background:#f6dfdb;color:#b8372a;font-weight:bold}
svg{width:100%;height:auto}
</style></head><body>
<h2 id="head"></h2><div class="tabs" id="tabs"></div><div class="row"><div class="box" id="left"></div><div class="box" id="right"></div></div>
<script>
const D = __DATA__;
document.getElementById('head').textContent = D.chunk_file + '  ↔  ' + D.pdf_file;
function show(i) {
  const r = D.results[i];
  document.querySelectorAll('.tabs button').forEach((b, k) => b.className = k === i ? 'on' : '');
  document.getElementById('left').innerHTML =
    `<b class="${r.status}">${r.status}</b> ${r.id}<br>หน้าที่อ้าง ${r.cited} = หน้า ${r.pdf_page} ของ PDF` +
    (r.cov === null ? '' : `<br>คำอยู่ในหน้า ${Math.round(r.cov * 100)}% · ตามลำดับ ${Math.round(r.order * 100)}%`) +
    r.parts.map(([label, pieces]) => `<p><b>${label}</b><br>` +
      pieces.map(([cls, text]) => `<span class="${cls}">${text.replace(/</g, '&lt;')}</span>`).join('') + '</p>').join('') +
    r.reasons.map(x => `<div>• ${x}</div>`).join('') +
    '<p><span class="match">เขียว</span> ตรงตามลำดับ · <span class="page">ขีดจุด</span> อยู่ในหน้าคนละที่ · ' +
    '<span class="elsewhere">เหลือง</span> อยู่หน้าอื่น · <span class="nowhere">แดง</span> ไม่มีใน PDF</p>';
  document.getElementById('right').innerHTML = r.boxes.length === 0 ? 'ไม่มีภาพ' :
    `<svg viewBox="0 0 ${r.width} ${r.height}"><image href="${D.images[r.pdf_page]}" width="${r.width}" height="${r.height}"/>` +
    r.boxes.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(29,122,76,.3)" stroke="#1d7a4c" stroke-width=".6"/>`).join('') + '</svg>';
}
document.getElementById('tabs').innerHTML = D.results.map((r, i) =>
  `<button onclick="show(${i})"><span class="${r.status}">●</span> ${r.id.split('_').slice(4).join(' ')}</button>`).join('');
show(0);
</script></body></html>"""

if __name__ == "__main__":
    sys.exit(main())
