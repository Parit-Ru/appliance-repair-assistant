#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_chunks_against_pdf.py
ตรวจว่า chunk JSON (data/chuck) มีเนื้อหาอยู่จริงใน PDF ต้นฉบับ (data/pdf) และตรงกับหน้าที่อ้างอิง

ทำไมต้องมี: chunk ถูกสร้างโดยคัดลอกข้อความจาก PDF ให้ LLM จัดรูปแบบ ไม่มี parser อัตโนมัติ
จึงเสี่ยงที่ LLM แก้ตัวเลข/รหัส error/ชื่อรุ่น ตัดข้อความ หรือเพิ่มเนื้อหาที่ PDF ไม่มี

หลักการ: เทียบแบบกำหนดได้แน่นอน (deterministic) ไม่เรียก LLM ไม่แก้ chunk หรือ PDF ใดๆ ตรวจและรายงานเท่านั้น
ต้องมี `pdftotext` (poppler) บน PATH — ไม่ต้องติดตั้งไลบรารี Python เพิ่ม

วิธีรัน (PowerShell, จากโฟลเดอร์รากของโปรเจกต์):
    python scripts\\verify_chunks_against_pdf.py
    python scripts\\verify_chunks_against_pdf.py --chunks data\\chuck --pdfs data\\pdf --threshold 0.90
    python scripts\\verify_chunks_against_pdf.py --only WT10J7 --report out.md

exit code: 0 = ไม่มี FAIL, 1 = มี FAIL หรือ chunk_id ซ้ำ, 2 = รันไม่ได้ (ไม่มี pdftotext / ไม่พบโฟลเดอร์)
(FAIL-TH ของภาษาไทยเป็นป้ายแยกและไม่ทำให้ exit code เปลี่ยน เพราะการดึงข้อความไทยจาก PDF ไม่น่าเชื่อถือ)
"""

import argparse
import bisect
import functools
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata
from collections import Counter, defaultdict

# =============================================================================
# ค่าตั้งต้น (แก้ได้ที่นี่) — ปรับจากการวัดบน chunk ภาษาอังกฤษ 539 อัน (15 ต.ค. 2569)
# =============================================================================

# ภาษาอังกฤษ: cov = สัดส่วนคำของ chunk ที่มีอยู่ในหน้าที่อ้าง
#             order = สัดส่วนคำที่อยู่ในหน้า "ตามลำดับ" (LCS แยกตาม symptom/cause/solution)
WARN_THRESHOLD = 0.90        # cov ต่ำกว่านี้ = FAIL (ตั้งผ่าน --threshold ได้)
PASS_COVERAGE = 0.97         # cov ≥ ค่านี้ และ order ≥ PASS_ORDER และไม่มีคำที่ไม่พบใน PDF เลย = PASS ; นอกนั้น = WARN
PASS_ORDER = 0.90            # order ต่ำกว่านี้ = WARN (ตารางใน PDF มักสลับคอลัมน์ จึงไม่ถึงขั้น FAIL)
NOWHERE_FAIL_TOKENS = 3      # คำที่ "ไม่พบใน PDF เลย" ตั้งแต่กี่คำขึ้นไป = FAIL

# ภาษาไทย (โหมดโครงพยัญชนะ — อ่อนกว่าภาษาอังกฤษ จึงใช้ป้ายแยก PASS-TH / WARN-TH / FAIL-TH)
TH_WARN_THRESHOLD = 0.70
TH_PASS_COVERAGE = 0.85
TH_PASS_ORDER = 0.70
TH_UNREADABLE = 0.35         # ถ้าทั้ง PDF ก็ไม่มีหน้าไหนมีคำของ chunk เกินนี้ = ดึงข้อความไทยไม่ได้ (UNVERIFIABLE ไม่ใช่ FAIL)
TH_SHARE = 0.5               # สัดส่วนตัวอักษรไทยของ chunk ที่ถือว่าเป็น chunk ภาษาไทย

# การหาหน้าจริงของ chunk
LOCATE_MIN_COVERAGE = 0.85   # ต้องมีคำอยู่ในหน้าอย่างน้อยเท่านี้จึงถือว่า "หาเจอ"
LOCATE_MIN_TOKENS = 8        # chunk ที่สั้นกว่านี้ไม่ใช้ประมาณ offset (คำทั่วไปอาจตรงหลายหน้า)
NEAR_BEST_MARGIN = 0.02      # หน้าที่คะแนนห่างจากหน้าที่ดีที่สุดไม่เกินนี้ถือว่า "ตรงเท่ากัน"
BLANK_PAGE_CHARS = 100       # หน้าที่มีตัวอักษรน้อยกว่านี้ถือว่าไม่มี text (สแกน/รูป)
GRAM = 4                     # ความยาว n-gram ของโหมดภาษาไทย
MAX_LIST = 12                # จำนวนคำสูงสุดที่แสดงต่อรายการ

# =============================================================================
# ตารางจับคู่ ไฟล์ chunk -> PDF (เขียนชัดเจน ไม่เดา)
#   None  = ไม่ทราบ PDF -> สถานะ UNMAPPED
#   ไฟล์ที่ไม่อยู่ในตารางนี้ก็เป็น UNMAPPED เช่นกัน
# =============================================================================
MAPPING = {
    "manual_samsung_Microwave_user_manual_GE83MDT.json": "GE83MDT_XST_DE68-04111E.pdf",
    "manual_samsung_Microwave_user_manual_MC32K7055.json": "MC32K7055CT_ST_DE68-04387M-03_TH_EN.pdf",
    "manual_samsung_Microwave_user_manual_ME73MD.json": "ME73MD_XST-DE68-04091Q-01_TH-EN.pdf",
    "manual_samsung_Microwave_user_manual_MG23T5018C.json": "MG23T5018CC_ST_DE68_04594R_00_TH_EN_210624.pdf",
    "manual_samsung_Microwave_user_manual_MG28H5125.json": "MG28H5125NK_ST_DE68-04246J-05_TH_EN.pdf",
    "manual_samsung_Microwave_user_manual_MS20A3010A.json": "MANUAL_TH_EN_MS20A3010A.pdf",
    "manual_samsung_Refrigerator_user_manual_DA68-02676A.json": "Drawing_DA68-02676A_1.4.pdf",
    "manual_samsung_Refrigerator_user_manual_DA68-04800B.json": "BMF_RB6000D_DA68-04800B_EN_240305.pdf",
    "manual_samsung_Refrigerator_user_manual_DA68-04817A.json": "DA68-04817A_BMF_RB5300D_EN_MES_CFR_251017.pdf",
    "manual_samsung_Refrigerator_user_manual_DA68-04852N.json": "Web_DA68-04852N-00_SBS_FSR_RS5000FC_UX_TH_0224.pdf",
    "manual_samsung_Television_user_manual_BN81-28760D.json": "BN81-28760D-160_EUG_ROPDVBAAH_ASIA_ENG_260313.0 (1).pdf",
    "manual_samsung_Television_user_manual_JZDVBADK.json": "ENG-JZDVBADK-1.1.2.pdf",
    "manual_samsung_Television_user_manual_KM2DVBADN.json": "KM2DVBADN-2.1.5_EM_Kant-M2_ASIA_ENG_220112.0.pdf",
    "manual_samsung_Television_user_manual_MUSDVBADR.json": "MUSDVBADR-4.0.5_EM_MUSE_ASIA_ENG_220111.0.pdf",
    "manual_samsung_Television_user_manual_NLDVBAS4M.json": "NLDVBAS4M-1005-ENG-IR_170511.0.pdf",
    "manual_samsung_WashingMachine_user_manual_DC68-04382A.json": "DC68-04382A-13.pdf",
    "manual_samsung_WashingMachine_user_manual_WA21A8376G.json": "DC68-04154A-01_IB_A2_WA8800A_EN_TH_MY_231005.pdf",
    "manual_samsung_WashingMachine_user_manual_WA40F10E1.json": "OID138241_IB_21WA40F_NON-WIFI_GOOD_EN_260212.pdf",
    "manual_samsung_WashingMachine_user_manual_WA5000R.json": "WA5000R_WA10R526_DC68-04088A-03_EN_TH_MY.pdf",
    "manual_samsung_WashingMachine_user_manual_WT10J7.json": "WT10J7_DC68-01942K-03_TH_20170316.pdf",
    # ยังไม่ทราบว่า PDF ของ RF service manual คืออะไร (ลอง RT7000 / DA68-02832D แล้วไม่ตรง)
    "manual_samsung_Refrigerator_RF_service_manual_user_level.json": None,
    "manual_samsung_Refrigerator_RF_service_manual_user_level (1).json": None,
}

# ข้าม (ถอดออกจากขอบเขตผลิตภัณฑ์แล้ว) — รายงานเป็น SKIPPED ไม่นับรวมในผลตรวจ
SKIP_FILES = {
    "manual_samsung_Dryer_user_manual_DV9CGC2.json",
}

# =============================================================================
# เครื่องมือ normalize ข้อความ
# =============================================================================

THAI_CHAR = re.compile(r"[\u0E00-\u0E7F]")
ZERO_WIDTH = dict.fromkeys(map(ord, "\u200b\u200c\u200d\u2060\ufeff"), None)
THAI_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")

# เลขข้อ/bullet ที่ LLM อาจจัดใหม่: "1." "2)" "•" "-" ที่ขึ้นต้นคำและตามด้วยช่องว่าง
MARKER = re.compile(r"(?:(?<=\s)|^)(?:\d{1,2}[.)]|[•●○◦▪■□▶►*–—-])(?=\s)", re.M)
WORD = re.compile(r"[^\W_]+(?:'[^\W_]+)?")


def nfkc_lower(s):
    """NFKC (รวม NFC แล้วแปลง ligature/ตัวเต็มความกว้าง) + ตัด zero-width + lowercase"""
    s = unicodedata.normalize("NFKC", s).translate(ZERO_WIDTH)
    return s.replace("\u2019", "'").replace("\u2018", "'").lower()


def spaced_norm(s):
    """ข้อความไว้ค้นตัวเลข+หน่วย: normalize แล้วยุบช่องว่างเป็นช่องเดียว (ยังเห็นขอบเขตคำ)"""
    s = nfkc_lower(s).replace("℃", "°c").replace("℉", "°f")
    return re.sub(r"\s+", " ", s)


def strip_markers(s):
    return MARKER.sub(" ", s)


def squash(s):
    """ข้อความเหลือเฉพาะตัวอักษร/ตัวเลข (ตัดช่องว่าง ขึ้นบรรทัด เครื่องหมายทั้งหมด)"""
    return "".join(ch for ch in nfkc_lower(s) if ch.isalnum())


def word_tokens(s):
    return WORD.findall(nfkc_lower(s))


def en_tokens(s):
    """คำภาษาอังกฤษ/ตัวเลขของ chunk หลังตัดเลขข้อ ตัดคำไทยและตัวอักษรเดี่ยวทิ้ง"""
    out = []
    for t in word_tokens(strip_markers(s)):
        if THAI_CHAR.search(t):
            continue
        if len(t) > 1 or t.isdigit():
            out.append(t)
    return out


def thai_share(s):
    letters = [c for c in s if c.isalpha()]
    if not letters:
        return 0.0
    return sum(1 for c in letters if THAI_CHAR.match(c)) / len(letters)


# สระบน/ล่าง วรรณยุกต์ การันต์ ที่ PDF ไทยดึงออกมาเพี้ยน (ซ้ำ/สลับลำดับ) จึงตัดทิ้งก่อนเทียบ
THAI_MARKS = re.compile(r"[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]")
PUA = re.compile(r"[\uE000-\uF8FF\uFFFD]")


def thai_skeleton(s):
    """โครงพยัญชนะ: ตัดช่องว่าง/เครื่องหมาย/PUA/สระบน-ล่าง/วรรณยุกต์ และ ำ -> า"""
    s = unicodedata.normalize("NFKC", s).translate(ZERO_WIDTH).translate(THAI_DIGITS).lower()
    s = PUA.sub("", s)
    s = THAI_MARKS.sub("", s).replace("\u0E33", "\u0E32")
    return "".join(ch for ch in s if ch.isalnum())


# =============================================================================
# token สำคัญ: ตัวเลข+หน่วย / รหัสข้อผิดพลาด / รหัสรุ่น
# =============================================================================

_UNIT_WORDS = r"°\s?[cf]|℃|℉|kg|cm|mm|ml|khz|hz|kwh|kw|rpm|db|%|bar|psi|kpa|mpa|min(?:ute)?s?|hours?|hrs?|seconds?|secs?"
UNIT_RE = re.compile(r"(?<![\w.,])(\d+(?:[.,]\d+)?)\s?(" + _UNIT_WORDS + r")(?![a-z0-9])", re.I)
UNIT_SYM_RE = re.compile(r"(?<![\w.,])(\d+(?:[.,]\d+)?)\s?([VWAL])(?![A-Za-z0-9])")  # หน่วยตัวเดียว ต้องเป็นตัวใหญ่
MIXED_RE = re.compile(r"(?<![A-Za-z0-9])(?=[A-Za-z0-9-]*\d)(?=[A-Za-z0-9-]*[A-Za-z])[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?![A-Za-z0-9])")
CODE_CTX_RE = re.compile(r"(?i:code|error|err|รหัส|แสดง|display(?:s|ed)?)\s*[:\"“'‘]?\s*([A-Z]{2,3})\b")
UPPER_RE = re.compile(r"\b[A-Z]{2,3}\b")

# หน่วยที่เขียนได้หลายแบบ: ถ้าตัวเลขกับหน่วยอยู่ในหน้าเดียวกันแต่ไม่ติดกัน (ตารางแยกคอลัมน์) ถือว่า "แยกกัน" (WARN)
UNIT_FAMILY = {"min": "minute", "mins": "minute", "minute": "minute", "minutes": "minute",
               "sec": "second", "secs": "second", "second": "second", "seconds": "second",
               "hr": "hour", "hrs": "hour", "hour": "hour", "hours": "hour"}
FAMILY_WORDS = {"minute": {"min", "mins", "minute", "minutes", "นาที"},
                "second": {"sec", "secs", "second", "seconds", "s", "วินาที"},
                "hour": {"h", "hr", "hrs", "hour", "hours", "ชั่วโมง"}}


def unit_norm(u):
    return nfkc_lower(u).replace("℃", "°c").replace("℉", "°f").replace(" ", "")


@functools.lru_cache(maxsize=4096)
def unit_regex(num, unit):
    if unit.startswith("°"):
        u = r"°\s?" + re.escape(unit[1:])
    else:
        u = re.escape(unit)
    return re.compile(r"(?<![\d.,])" + re.escape(num) + r"\s?" + u + r"(?![a-z0-9])")


def important_tokens(text):
    """คืน list ของ (ชนิด, key, ค่าที่แสดง): unit key=(เลข, หน่วย) · code key=รหัสตัวเล็ก · upper key=รหัสตัวใหญ่"""
    found = []
    seen = set()

    def add(kind, key, show):
        if (kind, key) not in seen:
            seen.add((kind, key))
            found.append((kind, key, show))

    text = text.translate(THAI_DIGITS)
    for m in list(UNIT_RE.finditer(text)) + list(UNIT_SYM_RE.finditer(text)):
        add("unit", (m.group(1), unit_norm(m.group(2))), m.group(0).strip())
    for m in MIXED_RE.finditer(text):
        add("code", m.group(0).lower(), m.group(0))
    for m in CODE_CTX_RE.finditer(text):
        add("upper", m.group(1), m.group(1))
    return found


# =============================================================================
# อ่าน PDF
# =============================================================================

def extract_pages(pdf_path):
    exe = shutil.which("pdftotext")
    r = subprocess.run([exe, "-enc", "UTF-8", pdf_path, "-"], capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.decode("utf-8", errors="replace")[:200])
    pages = r.stdout.decode("utf-8", errors="replace").split("\f")
    if pages and not pages[-1].strip():
        pages.pop()
    return pages


def load_doc(pdf_path):
    pages = extract_pages(pdf_path)
    joined = [re.sub(r"(\w)-\n(\w)", r"\1\2", p) for p in pages]  # ต่อคำที่ถูกตัดด้วยขีดท้ายบรรทัด
    doc = {
        "path": pdf_path,
        "n": len(pages),
        "raw": pages,
        "tokens": [word_tokens(p) for p in joined],
        "squash": [squash(p) for p in pages],
        "spaced": [spaced_norm(p) for p in pages],
        "upper": [set(UPPER_RE.findall(p)) for p in pages],
        "numbers": [set(re.findall(r"\d+(?:[.,]\d+)?", p.translate(THAI_DIGITS))) for p in pages],
        "skel": [None] * len(pages),
        "grams": [None] * len(pages),
    }
    # รหัสที่ PDF ดึงออกมาแยกเป็นสองท่อน (เช่น "4" + "C2" จากอักขระล่องหนกลางรหัส) จึงเก็บคำติดกันสองคำไว้ด้วย
    doc["mixed"], doc["pairs"] = [], []
    for p, toks in zip(pages, doc["tokens"]):
        doc["mixed"].append({m.group(0).lower().replace("-", "") for m in MIXED_RE.finditer(nfkc_lower(p))})
        doc["pairs"].append({toks[k] + toks[k + 1] for k in range(len(toks) - 1)})
    doc["set"] = [set(t) for t in doc["tokens"]]
    doc["blank"] = [len(s) < BLANK_PAGE_CHARS for s in doc["squash"]]
    doc["union"] = set().union(*doc["set"]) if pages else set()
    doc["text_pages"] = sum(1 for b in doc["blank"] if not b)
    doc["no_text_layer"] = doc["text_pages"] == 0
    return doc


def skeleton_of(doc, i):
    if doc["skel"][i] is None:
        sk = thai_skeleton(doc["raw"][i])
        doc["skel"][i] = sk
        doc["grams"][i] = {sk[k:k + GRAM] for k in range(len(sk) - GRAM + 1)}
    return doc["skel"][i], doc["grams"][i]


# =============================================================================
# เทียบข้อความ
# =============================================================================

def lcs_len(a, b):
    """ความยาว longest common subsequence (คำที่เรียงตามลำดับเดียวกัน แทรกคำอื่นระหว่างกลางได้)"""
    if not a or not b:
        return 0
    prev = [0] * (len(b) + 1)
    for x in a:
        cur = [0]
        for j, y in enumerate(b, 1):
            if x == y:
                cur.append(prev[j - 1] + 1)
            else:
                cur.append(prev[j] if prev[j] >= cur[j - 1] else cur[j - 1])
        prev = cur
    return prev[-1]


def chunk_fields(chunk):
    """แยกข้อความตรวจเป็นส่วนๆ (symptom/possible_cause/solution) เพราะ PDF ตารางอาจสลับลำดับคอลัมน์"""
    m = chunk.get("metadata") or {}
    parts = [m.get("symptom"), m.get("possible_cause"), m.get("solution")]
    parts = [p for p in parts if isinstance(p, str) and p.strip()]
    content = chunk.get("content") or ""
    joined = " ".join(re.sub(r"\s+", " ", p).strip() for p in parts)
    if parts and re.sub(r"\s+", " ", content).strip() == joined:
        return parts, False
    return [content], bool(parts)  # content ไม่ตรงกับ metadata -> ตรวจที่ content และแจ้งไว้


def score_en(fields, doc, page_idx):
    """(cov, order) ของ chunk กับหน้าหนึ่ง"""
    toks = [en_tokens(f) for f in fields]
    total = sum(len(t) for t in toks)
    if total == 0:
        return None, None
    page_set = doc["set"][page_idx]
    vocab = {t for f in toks for t in f}
    filt = [t for t in doc["tokens"][page_idx] if t in vocab]
    cov = sum(1 for f in toks for t in f if t in page_set) / total
    order = sum(lcs_len(f, filt) for f in toks) / total
    return cov, order


def page_coverages_en(tokens, doc):
    vocab = set(tokens)
    if not vocab:
        return []
    return [len(vocab & s) / len(vocab) for s in doc["set"]]


def thai_grams(text):
    sk = thai_skeleton(strip_markers(text))
    return [sk[k:k + GRAM] for k in range(len(sk) - GRAM + 1)]


def score_th(text, doc, page_idx):
    grams = thai_grams(text)
    if len(grams) < 6:
        return None, None
    page_sk, pgrams = skeleton_of(doc, page_idx)
    cov = sum(1 for g in grams if g in pgrams) / len(grams)
    # ลำดับ: ไล่หา gram ถัดไปหลังตำแหน่งล่าสุดที่เจอ (กำหนดได้แน่นอน ไม่ใช่ LCS เต็มรูปแบบ)
    pos = defaultdict(list)
    for k in range(len(page_sk) - GRAM + 1):
        pos[page_sk[k:k + GRAM]].append(k)
    ptr, hit = 0, 0
    for g in grams:
        lst = pos.get(g)
        if not lst:
            continue
        j = bisect.bisect_left(lst, ptr)
        if j < len(lst):
            hit += 1
            ptr = lst[j] + 1
    return cov, hit / len(grams)


def page_coverages_th(text, doc):
    grams = set(thai_grams(text))
    if len(grams) < 6:
        return []
    return [len(grams & skeleton_of(doc, i)[1]) / len(grams) for i in range(doc["n"])]


def token_match(kind, key, doc, i):
    """2 = พบตรงๆ · 1 = ตัวเลขกับหน่วยอยู่ในหน้าเดียวกันแต่ไม่ติดกัน · 0 = ไม่พบ"""
    if kind == "unit":
        num, unit = key
        if unit_regex(num, unit).search(doc["spaced"][i]):
            return 2
        family = UNIT_FAMILY.get(unit)
        words = FAMILY_WORDS.get(family, {unit})
        if num in doc["numbers"][i] and (doc["set"][i] & words):
            return 1
        return 0
    if kind == "code":
        k = key.replace("-", "")
        return 2 if (k in doc["mixed"][i] or k in doc["pairs"][i]) else 0
    # รหัสตัวอักษรล้วน: พบเป็นคำตัวใหญ่ หรือถูกแยกเป็นสองท่อนติดกัน (เช่น "P" + "C" จากอักขระล่องหนกลางรหัส)
    return 2 if (key in doc["upper"][i] or key.lower() in doc["pairs"][i]) else 0


def token_pages(kind, key, doc, exclude):
    return [i for i in range(doc["n"]) if i != exclude and token_match(kind, key, doc, i) > 0]


# =============================================================================
# ตรวจ chunk ทั้งไฟล์
# =============================================================================

def locate_chunks(chunks, doc):
    """หาหน้าที่เนื้อหาอยู่จริงของแต่ละ chunk (ทุกหน้าของ PDF) -> info ต่อ chunk"""
    infos = []
    for c in chunks:
        fields, mismatch = chunk_fields(c)
        text = " ".join(fields)
        is_th = thai_share(text) >= TH_SHARE
        if is_th:
            covs = page_coverages_th(text, doc)
            ntok = len(set(thai_grams(text)))
        else:
            toks = en_tokens(text)
            covs = page_coverages_en(toks, doc)
            ntok = len(set(toks))
        info = {"chunk": c, "fields": fields, "content_mismatch": mismatch, "is_th": is_th, "text": text, "ntok": ntok,
                "best": [], "best_cov": 0.0, "located": None}
        if covs:
            best = max(covs)
            info["best_cov"] = best
            info["best"] = [i for i, v in enumerate(covs) if v >= best - NEAR_BEST_MARGIN]
            if best >= LOCATE_MIN_COVERAGE and len(info["best"]) == 1 and ntok >= LOCATE_MIN_TOKENS:
                info["located"] = info["best"][0]
        infos.append(info)
    return infos


def file_offset(infos):
    """offset = (หน้าที่พบ) - (หน้าที่ chunk อ้าง) : คืน (mode, ตารางนับ)"""
    dist = Counter()
    for inf in infos:
        if inf["located"] is not None:
            dist[(inf["located"] + 1) - inf["chunk"]["page"]] += 1
    if not dist:
        return 0, dist
    return dist.most_common(1)[0][0], dist


def pages_text(pages):
    return ", ".join(str(p + 1) for p in pages[:6]) + (" …" if len(pages) > 6 else "")


def evaluate_chunk(inf, doc, offset, warn_t):
    """คืน dict ผลตรวจของ chunk หนึ่งอัน"""
    c = inf["chunk"]
    is_th = inf["is_th"]
    suffix = "-TH" if is_th else ""
    cited = c.get("page")
    res = {"id": c.get("chunk_id"), "page": cited, "status": None, "cov": None, "order": None, "expected": None,
           "reasons": [], "missing_elsewhere": [], "missing_nowhere": [], "tokens_split": [], "tokens_elsewhere": [],
           "tokens_nowhere": [], "lang": "TH" if is_th else "EN", "exact": False}

    if not isinstance(cited, int):
        res["status"] = "FAIL"
        res["reasons"].append("chunk ไม่มีเลขหน้า (page) ที่เป็นตัวเลข")
        return res

    e = cited - 1 + offset  # index ของหน้าที่คาดว่าเนื้อหาอยู่ (รวม offset ของไฟล์)
    res["expected"] = e + 1
    shown_page = f"{cited}{'%+d' % offset if offset else ''}"
    if e < 0 or e >= doc["n"]:
        res["status"] = "FAIL"
        res["reasons"].append(f"หน้าที่อ้าง ({shown_page}) ไม่มีใน PDF (PDF มี {doc['n']} หน้า)")
        return res
    loc = inf["located"]
    if doc["blank"][e]:
        if loc is not None and loc != e:
            res["status"] = "FAIL"
            res["reasons"].append(f"เนื้อหาอยู่หน้า {loc + 1} แต่ chunk อ้างหน้า {shown_page} (หน้านั้นไม่มีข้อความ)")
            return res
        res["status"] = "UNVERIFIABLE"
        res["reasons"].append(f"หน้า {e + 1} ของ PDF ไม่มีข้อความ (สแกน/รูป/หน้าว่าง)")
        return res

    # ---- คะแนนเนื้อหา ----
    if is_th:
        cov, order = score_th(inf["text"], doc, e)
        if cov is None:
            res["status"] = "WARN-TH"
            res["reasons"].append("ข้อความไทยสั้นเกินไปที่จะตรวจด้วยโครงพยัญชนะ")
            return res
        pass_cov, pass_ord, fail_cov = TH_PASS_COVERAGE, TH_PASS_ORDER, TH_WARN_THRESHOLD
        if cov < fail_cov and inf["best_cov"] < TH_UNREADABLE:
            res["status"] = "UNVERIFIABLE"
            res["cov"], res["order"] = cov, order
            res["reasons"].append(f"ดึงข้อความไทยของเนื้อหานี้จาก PDF ไม่ได้ (ไม่มีหน้าไหนตรงเกิน {inf['best_cov']:.2f}) "
                                  "— สงสัยว่าเป็นภาพ/encoding เพี้ยน ไม่ใช่ว่า chunk ผิด")
            return res
    else:
        cov, order = score_en(inf["fields"], doc, e)
        if cov is None:
            res["status"] = "WARN"
            res["reasons"].append("chunk ไม่มีคำให้ตรวจ")
            return res
        pass_cov, pass_ord, fail_cov = PASS_COVERAGE, PASS_ORDER, warn_t
        sq = squash(strip_markers(inf["text"]))
        res["exact"] = bool(sq) and sq in doc["squash"][e]
    res["cov"], res["order"] = cov, order

    status = "PASS"

    # ---- เลขหน้าผิด: เนื้อหาไปอยู่หน้าอื่นอย่างชัดเจน ----
    if loc is not None and loc != e:
        status = "FAIL"
        res["reasons"].append(f"เลขหน้าผิด: เนื้อหาอยู่หน้า {loc + 1} แต่ chunk อ้างหน้า {shown_page}"
                              f"{' (offset ของไฟล์ %+d)' % offset if offset else ''}")

    # ---- คำที่ไม่อยู่ในหน้าที่อ้าง: ค้นต่อทั้ง PDF ----
    if not is_th:
        vocab = sorted({t for f in inf["fields"] for t in en_tokens(f)})
        for t in vocab:
            if t not in doc["set"][e]:
                (res["missing_elsewhere"] if t in doc["union"] else res["missing_nowhere"]).append(t)

    # ---- token สำคัญ (ตัวเลข+หน่วย / รหัส error / รหัสรุ่น) ----
    for kind, key, show in important_tokens(inf["text"]):
        level = token_match(kind, key, doc, e)
        if level == 2:
            continue
        if level == 1:
            res["tokens_split"].append(show)
            continue
        elsewhere = token_pages(kind, key, doc, e)
        if elsewhere:
            res["tokens_elsewhere"].append(f"{show} (พบหน้า {pages_text(elsewhere)})")
        else:
            res["tokens_nowhere"].append(show)
    if res["tokens_nowhere"] or res["tokens_elsewhere"]:
        status = "FAIL"
        if res["tokens_nowhere"]:
            res["reasons"].append("token สำคัญ **ไม่พบใน PDF เลย**: " + ", ".join(res["tokens_nowhere"][:MAX_LIST]))
        if res["tokens_elsewhere"]:
            res["reasons"].append("token สำคัญไม่อยู่หน้าที่อ้างแต่พบหน้าอื่น: " + ", ".join(res["tokens_elsewhere"][:MAX_LIST]))
    if res["tokens_split"] and status == "PASS":
        status = "WARN"
        res["reasons"].append("ตัวเลขกับหน่วยอยู่ในหน้าแต่ไม่ติดกัน (ตรวจตาเพิ่ม): " + ", ".join(res["tokens_split"][:MAX_LIST]))

    # ---- สัดส่วนคำ / ลำดับคำ ----
    if cov < fail_cov:
        status = "FAIL"
        extra = ""
        if loc is not None and loc != e:
            extra = f" (เนื้อหาตรงกับหน้า {loc + 1})"
        elif inf["best"] and e not in inf["best"] and inf["best_cov"] >= fail_cov:
            extra = f" (เนื้อหาใกล้เคียงที่สุดอยู่หน้า {inf['best'][0] + 1})"
        res["reasons"].append(f"สัดส่วนคำที่อยู่ในหน้า {cov:.2f} < {fail_cov:.2f}{extra}")
    elif status == "PASS" and (cov < pass_cov or order < pass_ord):
        status = "WARN"
        if cov < pass_cov:
            res["reasons"].append(f"สัดส่วนคำที่อยู่ในหน้า {cov:.2f} ต่ำกว่าเกณฑ์ PASS ({pass_cov:.2f})")
        else:
            res["reasons"].append(f"คำอยู่ครบแต่ลำดับ {order:.2f} ต่ำกว่าเกณฑ์ PASS ({pass_ord:.2f}) "
                                  "— มักเป็นการสลับคอลัมน์ของตารางหรือ LLM สลับลำดับ")

    # ---- คำที่ไม่พบใน PDF เลย (ร้ายแรงกว่าคำที่พบหน้าอื่น) ----
    if res["missing_nowhere"]:
        if len(res["missing_nowhere"]) >= NOWHERE_FAIL_TOKENS:
            status = "FAIL"
        elif status == "PASS":
            status = "WARN"
        res["reasons"].append(f"คำ **ไม่พบใน PDF เลย** {len(res['missing_nowhere'])} คำ: "
                              + ", ".join(res["missing_nowhere"][:MAX_LIST]))

    res["status"] = status + suffix
    return res


def check_safety(chunk, doc, offset):
    """safety_warning: ตรวจเลขหน้า "(คู่มือหน้า N)" และตัวเลข/หน่วย — ไม่พบเป็น WARN เท่านั้น"""
    sw = (chunk.get("metadata") or {}).get("safety_warning")
    if not isinstance(sw, str) or not sw.strip():
        return None
    text = sw.translate(THAI_DIGITS)
    refs = [int(n) for n in re.findall(r"คู่มือหน้า\s*(\d+)", text)]
    body = re.sub(r"\(?คู่มือหน้า\s*\d+\)?", " ", text)
    nums = sorted(set(re.findall(r"\d+(?:[.,]\d+)?", body)))
    units = [(m.group(1), unit_norm(m.group(2))) for m in list(UNIT_RE.finditer(body)) + list(UNIT_SYM_RE.finditer(body))]
    out = {"id": chunk.get("chunk_id"), "refs": refs, "bad_refs": [], "nums_not_on_page": [], "nums_nowhere": [],
           "units_nowhere": [], "reasons": []}
    ref_idx = []
    for n in refs:
        idx = n - 1 + offset
        if 0 <= idx < doc["n"]:
            ref_idx.append(idx)
        else:
            out["bad_refs"].append(n)
    if out["bad_refs"]:
        out["reasons"].append("เลขหน้าที่อ้างไม่มีใน PDF: " + ", ".join(map(str, out["bad_refs"])))
    all_numbers = set().union(*doc["numbers"]) if doc["n"] else set()
    for n in nums:
        norm = {n, n.replace(",", "."), n.replace(".", ",")}
        if not (norm & all_numbers):
            out["nums_nowhere"].append(n)
        elif ref_idx and not any(norm & doc["numbers"][i] for i in ref_idx):
            out["nums_not_on_page"].append(n)
    for num, unit in units:
        if not any(token_match("unit", (num, unit), doc, i) > 0 for i in range(doc["n"])):
            out["units_nowhere"].append(f"{num} {unit}")
    if out["nums_nowhere"]:
        out["reasons"].append("ตัวเลขที่ **ไม่มีใน PDF เลย**: " + ", ".join(out["nums_nowhere"][:MAX_LIST]))
    if out["nums_not_on_page"]:
        out["reasons"].append("ตัวเลขไม่อยู่หน้าที่อ้าง (พบหน้าอื่น): " + ", ".join(out["nums_not_on_page"][:MAX_LIST]))
    if out["units_nowhere"]:
        out["reasons"].append("ตัวเลข+หน่วยที่ไม่มีใน PDF เลย: " + ", ".join(out["units_nowhere"][:MAX_LIST]))
    out["status"] = "WARN" if out["reasons"] else "OK"
    return out


def reverse_check(doc, infos, offset):
    """(ตัวเลือก) หน้าที่ถูกอ้างถึงแต่มีคำจำนวนมากที่ไม่ถูก chunk ใดครอบคลุม -> อาจตกหล่น"""
    cited = defaultdict(set)
    for inf in infos:
        p = inf["chunk"].get("page")
        if isinstance(p, int) and 0 <= p - 1 + offset < doc["n"]:
            cited[p - 1 + offset].update(en_tokens(inf["text"]))
    rows = []
    for i, covered in sorted(cited.items()):
        page_tokens = {t for t in doc["tokens"][i] if (len(t) > 1 or t.isdigit()) and not THAI_CHAR.search(t)}
        if len(page_tokens) < 40:
            continue
        ratio = len(page_tokens & covered) / len(page_tokens)
        if ratio < 0.25:
            rows.append((i + 1, len(page_tokens), ratio))
    return rows


# =============================================================================
# รายงาน
# =============================================================================

def md_escape(s):
    return str(s).replace("|", "\\|").replace("\n", " ")


def build_report(args, files, dups):
    L = []
    L.append("# รายงานตรวจ chunk เทียบกับ PDF ต้นฉบับ")
    L.append("")
    L.append(f"- โฟลเดอร์ chunk: `{args.chunks}` · โฟลเดอร์ PDF: `{args.pdfs}`")
    L.append(f"- เกณฑ์ (อังกฤษ): FAIL ถ้าสัดส่วนคำ < {args.threshold:.2f} · PASS ถ้า ≥ {PASS_COVERAGE:.2f} และลำดับ ≥ {PASS_ORDER:.2f} · "
             f"(ไทย โครงพยัญชนะ): FAIL < {TH_WARN_THRESHOLD:.2f} · PASS ≥ {TH_PASS_COVERAGE:.2f}")
    L.append("- ตรวจแบบกำหนดได้แน่นอน (ไม่เรียก LLM) · **PASS ไม่ได้พิสูจน์ว่าถูกต้อง 100%** อ่านข้อจำกัดในเอกสารอธิบาย")
    L.append("")

    # --- สรุปต่อไฟล์ ---
    L.append("## 1. สรุปต่อไฟล์")
    L.append("")
    L.append("| ไฟล์ chunk | PDF | chunk | PASS | WARN | FAIL | UNVERIFIABLE | UNMAPPED | ไทย (PASS/WARN/FAIL) | ตรวจไม่ได้ % |")
    L.append("|---|---|---:|---:|---:|---:|---:|---:|---|---:|")
    for f in files:
        if f["skipped"]:
            L.append(f"| {md_escape(f['name'])} | (ข้าม — นอกขอบเขต) | {f['n']} | – | – | – | – | – | – | – |")
            continue
        c, n = f["counts"], f["n"]
        nc = c["UNVERIFIABLE"] + c["UNMAPPED"]
        th = f"{c['PASS-TH']}/{c['WARN-TH']}/{c['FAIL-TH']}"
        pdf = f["pdf"] if f["pdf"] else "(ไม่ทราบ)"
        L.append(f"| {md_escape(f['name'])} | {md_escape(pdf)} | {n} | {c['PASS']} | {c['WARN']} | {c['FAIL']} | "
                 f"{c['UNVERIFIABLE']} | {c['UNMAPPED']} | {th} | {100 * nc / n:.0f}% |")
    L.append("")

    # --- offset ต่อไฟล์ ---
    L.append("## 2. ตาราง offset ต่อไฟล์ (หน้าที่พบจริง − หน้าที่ chunk อ้าง)")
    L.append("")
    L.append("| ไฟล์ chunk | chunk ที่หาหน้าได้ชัดเจน | offset ที่พบ (จำนวน chunk) | สถานะ |")
    L.append("|---|---:|---|---|")
    for f in files:
        if f["skipped"] or f["doc"] is None:
            continue
        dist = f["offset_dist"]
        if not dist:
            L.append(f"| {md_escape(f['name'])} | 0 | – | ประมาณ offset ไม่ได้ (ใช้ 0) |")
            continue
        parts = ", ".join(f"{k:+d} ({v})" for k, v in sorted(dist.items(), key=lambda kv: -kv[1]))
        if len(dist) == 1:
            k = next(iter(dist))
            state = "INFO: offset คงที่ " + (f"{k:+d}" if k else "0 (หน้าตรงกัน)")
        else:
            state = "**FAIL: offset ไม่คงที่** (chunk ที่เบี่ยงจากค่าที่พบบ่อยสุดถูกรายงานเป็น FAIL)"
        L.append(f"| {md_escape(f['name'])} | {sum(dist.values())} | {parts} | {state} |")
    L.append("")

    # --- รายการที่ไม่ PASS ---
    L.append("## 3. chunk ที่ไม่ PASS (WARN / FAIL / UNVERIFIABLE)")
    L.append("")
    L.append("`หน้า` = หน้าที่ chunk อ้าง · `คาด` = หน้าใน PDF ที่ตรวจ (รวม offset) · `cov` = สัดส่วนคำที่อยู่ในหน้า · `order` = สัดส่วนคำที่อยู่ในหน้าตามลำดับ")
    L.append("")
    any_row = False
    for f in files:
        rows = [r for r in f["results"] if r["status"] not in ("PASS", "PASS-TH")]
        if not rows:
            continue
        any_row = True
        L.append(f"### {f['name']}")
        L.append("")
        L.append("| chunk_id | หน้า | คาด | สถานะ | cov | order | รายละเอียด |")
        L.append("|---|---:|---:|---|---:|---:|---|")
        for r in rows:
            cov = f"{r['cov']:.2f}" if r["cov"] is not None else "–"
            order = f"{r['order']:.2f}" if r["order"] is not None else "–"
            detail = "; ".join(r["reasons"])
            if r["missing_elsewhere"]:
                detail += f"; คำที่พบเฉพาะหน้าอื่น: {', '.join(r['missing_elsewhere'][:MAX_LIST])}"
            L.append(f"| {md_escape(r['id'])} | {r['page']} | {r['expected'] or '–'} | {r['status']} | {cov} | {order} | {md_escape(detail)} |")
        L.append("")
    if not any_row:
        L.append("(ไม่มี)")
        L.append("")

    # --- safety_warning ---
    sw_all = [(f["name"], s) for f in files for s in f["safety"]]
    L.append("## 4. safety_warning (ตรวจเลขหน้าและตัวเลข/หน่วย — ไม่พบเป็น WARN เท่านั้น)")
    L.append("")
    warn = [x for x in sw_all if x[1]["status"] == "WARN"]
    nowhere = [x for x in sw_all if x[1]["nums_nowhere"] or x[1]["units_nowhere"]]
    L.append(f"- chunk ที่มี safety_warning และตรวจได้ (มี PDF + มี text): **{len(sw_all)}**")
    L.append(f"- เป็น WARN: **{len(warn)}**")
    L.append(f"- **ตัวเลข/หน่วยใน safety_warning ไม่มีใน PDF เลย: {len(nowhere)} chunk**")
    L.append("")
    if warn:
        L.append("| ไฟล์ | chunk_id | รายละเอียด |")
        L.append("|---|---|---|")
        for name, s in warn:
            L.append(f"| {md_escape(name)} | {md_escape(s['id'])} | {md_escape('; '.join(s['reasons']))} |")
        L.append("")

    # --- chunk_id ซ้ำ ---
    L.append("## 5. chunk_id ซ้ำ (กระทบ unique key ใน MySQL)")
    L.append("")
    if dups:
        L.append("| chunk_id | อยู่ในไฟล์ | เนื้อหา |")
        L.append("|---|---|---|")
        for cid, info in dups:
            L.append(f"| {md_escape(cid)} | {md_escape(' ; '.join(info['files']))} | {info['same']} |")
    else:
        L.append("ไม่มี chunk_id ซ้ำ")
    L.append("")

    # --- ตรวจย้อนกลับ ---
    if args.reverse:
        L.append("## 6. ตรวจย้อนกลับ: หน้าที่ถูกอ้างแต่ chunk ครอบคลุมคำน้อย (อาจตกหล่น)")
        L.append("")
        L.append("| ไฟล์ | หน้า | จำนวนคำในหน้า | สัดส่วนที่ chunk ครอบคลุม |")
        L.append("|---|---:|---:|---:|")
        for f in files:
            for page, n, ratio in f.get("reverse", []):
                L.append(f"| {md_escape(f['name'])} | {page} | {n} | {ratio:.2f} |")
        L.append("")
        L.append("หมายเหตุ: หน้าคู่มือมีเนื้อหาอื่น (ภาพ หัวข้อ ตารางข้อมูลจำเพาะ) ที่ไม่ใช่ chunk อาการ ตัวเลขต่ำจึงไม่ได้แปลว่าตกหล่นเสมอไป")
        L.append("")

    return "\n".join(L) + "\n"


# =============================================================================
# main
# =============================================================================

def setup_output():
    # คอนโซลของ Windows ใช้ WriteConsoleW (Unicode) อยู่แล้ว ส่วนตอน redirect/pipe ให้บังคับ UTF-8
    if not sys.stdout.isatty():
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass


def main():
    setup_output()
    ap = argparse.ArgumentParser(description="ตรวจว่า chunk JSON ตรงกับ PDF ต้นฉบับ (ตรวจและรายงานเท่านั้น ไม่แก้ไฟล์)")
    ap.add_argument("--chunks", default=os.path.join("data", "chuck"), help="โฟลเดอร์ chunk JSON")
    ap.add_argument("--pdfs", default=os.path.join("data", "pdf"), help="โฟลเดอร์ PDF")
    ap.add_argument("--threshold", type=float, default=WARN_THRESHOLD,
                    help=f"เกณฑ์ FAIL ของสัดส่วนคำภาษาอังกฤษ (ค่าเริ่มต้น {WARN_THRESHOLD})")
    ap.add_argument("--report", default="verification_report.md", help="ไฟล์รายงาน markdown")
    ap.add_argument("--only", default=None, help="ตรวจเฉพาะไฟล์ chunk ที่ชื่อมีข้อความนี้ (ไว้ทดลอง)")
    ap.add_argument("--reverse", action="store_true", help="ตรวจย้อนกลับว่าหน้าที่อ้างมีเนื้อหาที่ chunk ไม่ครอบคลุม")
    args = ap.parse_args()

    if shutil.which("pdftotext") is None:
        print("ไม่พบ pdftotext บน PATH — ต้องติดตั้ง poppler (ดูเอกสารอธิบาย)", file=sys.stderr)
        return 2
    for label, p in (("chunk", args.chunks), ("PDF", args.pdfs)):
        if not os.path.isdir(p):
            print(f"ไม่พบโฟลเดอร์ {label}: {p}", file=sys.stderr)
            return 2

    names = sorted(f for f in os.listdir(args.chunks) if f.lower().endswith(".json"))
    all_ids = defaultdict(list)       # chunk_id -> [(ไฟล์, content)]
    files = []
    doc_cache = {}
    status_keys = ["PASS", "WARN", "FAIL", "UNVERIFIABLE", "UNMAPPED", "PASS-TH", "WARN-TH", "FAIL-TH"]

    for name in names:
        with open(os.path.join(args.chunks, name), encoding="utf-8") as fh:
            chunks = json.load(fh)
        for c in chunks:
            all_ids[c.get("chunk_id")].append((name, c.get("content")))
        if args.only and args.only.lower() not in name.lower():
            continue

        f = {"name": name, "n": len(chunks), "pdf": MAPPING.get(name), "skipped": name in SKIP_FILES, "doc": None,
             "counts": Counter({k: 0 for k in status_keys}), "results": [], "safety": [], "offset_dist": Counter(),
             "reverse": []}
        files.append(f)

        if f["skipped"]:
            print(f"[SKIPPED]      {name}  ({len(chunks)} chunk — นอกขอบเขต)")
            continue

        pdf_name = f["pdf"]
        pdf_path = os.path.join(args.pdfs, pdf_name) if pdf_name else None
        if not pdf_name or not os.path.isfile(pdf_path):
            why = "ไม่ทราบ PDF ที่ตรงกัน" if not pdf_name else f"ไม่พบไฟล์ {pdf_name}"
            for c in chunks:
                f["results"].append({"id": c.get("chunk_id"), "page": c.get("page"), "expected": None, "status": "UNMAPPED",
                                     "cov": None, "order": None, "reasons": [why], "missing_elsewhere": []})
                f["counts"]["UNMAPPED"] += 1
            print(f"[UNMAPPED]     {name}  ({len(chunks)} chunk — {why})")
            continue

        if pdf_path not in doc_cache:
            print(f"... อ่าน PDF: {pdf_name}", flush=True)
            doc_cache[pdf_path] = load_doc(pdf_path)
        doc = doc_cache[pdf_path]
        f["doc"] = doc

        if doc["no_text_layer"]:
            max_page = max((c.get("page") for c in chunks if isinstance(c.get("page"), int)), default=0)
            why = f"PDF ไม่มี text layer ({doc['n']} หน้า ไม่มีข้อความ)"
            if max_page > doc["n"]:
                why += f" และ chunk อ้างถึงหน้า {max_page} เกินจำนวนหน้า — น่าจะไม่ใช่ไฟล์เดียวกัน"
            for c in chunks:
                f["results"].append({"id": c.get("chunk_id"), "page": c.get("page"), "expected": None,
                                     "status": "UNVERIFIABLE", "cov": None, "order": None, "reasons": [why],
                                     "missing_elsewhere": []})
                f["counts"]["UNVERIFIABLE"] += 1
            continue

        infos = locate_chunks(chunks, doc)
        offset, dist = file_offset(infos)
        f["offset_dist"] = dist
        for inf in infos:
            res = evaluate_chunk(inf, doc, offset, args.threshold)
            if inf["content_mismatch"]:
                res["reasons"].append("content ไม่ตรงกับ symptom+possible_cause+solution ใน metadata (ตรวจที่ content)")
            f["results"].append(res)
            f["counts"][res["status"]] += 1
            sw = check_safety(inf["chunk"], doc, offset)
            if sw is not None:
                f["safety"].append(sw)
        if args.reverse:
            f["reverse"] = reverse_check(doc, infos, offset)

    # ---- chunk_id ซ้ำ (ทุกไฟล์ที่อ่านได้) ----
    dups = []
    for cid, occ in all_ids.items():
        if len(occ) > 1:
            same = "เหมือนกันทุกตัวอักษร (ไฟล์ซ้ำ)" if len({c for _, c in occ}) == 1 else "**ต่างกัน — id ชนกันจริง**"
            dups.append((cid, {"files": [n for n, _ in occ], "same": same}))
    dups.sort(key=lambda x: str(x[0]))

    # ---- สรุปบน console ----
    print()
    head = f"{'ไฟล์ chunk':<46} {'chunk':>5} {'PASS':>5} {'WARN':>5} {'FAIL':>5} {'UNVER':>5} {'UNMAP':>5}  ไทย P/W/F"
    print(head)
    print("-" * len(head))
    tot = Counter()
    for f in files:
        if f["skipped"]:
            continue
        c = f["counts"]
        nm = f["name"].replace("manual_samsung_", "").replace("_user_manual", "").replace(".json", "")
        print(f"{nm[:46]:<46} {f['n']:>5} {c['PASS']:>5} {c['WARN']:>5} {c['FAIL']:>5} {c['UNVERIFIABLE']:>5} {c['UNMAPPED']:>5}  "
              f"{c['PASS-TH']}/{c['WARN-TH']}/{c['FAIL-TH']}")
        tot.update(c)
        tot["n"] += f["n"]
    print("-" * len(head))
    print(f"{'รวม':<46} {tot['n']:>5} {tot['PASS']:>5} {tot['WARN']:>5} {tot['FAIL']:>5} {tot['UNVERIFIABLE']:>5} {tot['UNMAPPED']:>5}  "
          f"{tot['PASS-TH']}/{tot['WARN-TH']}/{tot['FAIL-TH']}")
    skipped = sum(f["n"] for f in files if f["skipped"])
    if skipped:
        print(f"ข้าม (นอกขอบเขต): {skipped} chunk")
    not_checked = tot["UNVERIFIABLE"] + tot["UNMAPPED"]
    if tot["n"]:
        print(f"ตรวจไม่ได้ (UNVERIFIABLE + UNMAPPED): {not_checked} chunk ({100 * not_checked / tot['n']:.0f}%)")
    sw_total = sum(len(f["safety"]) for f in files)
    sw_warn = sum(1 for f in files for s in f["safety"] if s["status"] == "WARN")
    sw_nowhere = sum(1 for f in files for s in f["safety"] if s["nums_nowhere"] or s["units_nowhere"])
    print(f"safety_warning: ตรวจได้ {sw_total} · WARN {sw_warn} · ตัวเลข/หน่วยไม่มีใน PDF เลย {sw_nowhere} chunk")
    print(f"chunk_id ซ้ำ: {len(dups)} ตัว")

    with open(args.report, "w", encoding="utf-8-sig", newline="\n") as fh:
        fh.write(build_report(args, files, dups))
    print(f"รายงาน: {args.report}")

    return 1 if (tot["FAIL"] > 0 or dups) else 0


if __name__ == "__main__":
    sys.exit(main())
