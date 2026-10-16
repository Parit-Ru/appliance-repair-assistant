"""
ขั้น 1.2.1 — สำรวจตารางคำศัพท์ของโมเดลค้นหาอาการ (อ่านอย่างเดียว ไม่แก้ไฟล์ใดๆ)

คำถามที่ต้องตอบก่อนลงมือตัดคำศัพท์:
  1. ตารางคำศัพท์ (vocab table) อยู่ตรงไหนในไฟล์ ONNX เก็บเป็นชนิดไหน ใหญ่เท่าไร
  2. ส่วนไหนของโมเดลใช้ตารางนี้ (จะได้รู้ว่าตอนตัดต้องแก้ที่ไหนบ้าง)
  3. ถ้าเก็บเฉพาะ token ที่ทุกตัวอักษรเป็นไทย / ASCII / เครื่องหมาย จะเหลือกี่ token
  4. ข้อความจริงของระบบ (36 ข้อความตัวแทน + คำค้นตัวอย่าง) ใช้แต่ token ที่ถูกเก็บจริงไหม

ใช้ไฟล์โมเดลที่ measure-embedding.js ดาวน์โหลดไว้แล้วใน backend/model-cache/

วิธีใช้ (ยืนที่รากของ repo):
    pip install onnx==1.17.0
    python scripts/inspect_vocab.py
"""

import json
import sys
from pathlib import Path

import onnx
from onnx import helper
from tokenizers import Tokenizer

REPO_ROOT = Path(__file__).parent.parent
MODEL_DIR = (
    REPO_ROOT / "backend" / "model-cache" / "Xenova" / "paraphrase-multilingual-MiniLM-L12-v2"
)
ONNX_FILE = MODEL_DIR / "onnx" / "model_quantized.onnx"
TOKENIZER_FILE = MODEL_DIR / "tokenizer.json"
CONFIG_FILE = MODEL_DIR / "config.json"
MANUAL_FILE = REPO_ROOT / "data" / "manuals" / "samsung_ac_ar70h.json"

# คำค้นตัวอย่างชุดเดียวกับ measure-embedding.js
SAMPLE_QUERIES = [
    "แอร์ไม่เย็นเลย",
    "เปิดแอร์ไม่ติด",
    "กดรีโมทแล้วแอร์ไม่ตอบสนอง",
    "มีน้ำหยดจากเครื่องที่อยู่นอกบ้าน",
    "the AC is not cooling",
    "เครื่องซักผ้าน้ำไม่ไหลออก",
    "ทีวีไม่มีเสียง",
]

MIB = 1024 * 1024


# ============================================================
# กฎการเก็บ token
# ============================================================

def is_allowed_char(ch: str) -> bool:
    """
    ตัวอักษรที่ระบบต้องรองรับ — token ที่มีตัวอักษรนอกชุดนี้แม้ตัวเดียวจะถูกตัด

    ทำไมกฎนี้ไม่ทำให้ผลเปลี่ยน: ตัวตัดคำเลือกได้เฉพาะ token ที่เป็นส่วนหนึ่งของข้อความ
    ถ้าข้อความมีแต่ตัวอักษรในชุดนี้ token ที่มีตัวอักษรอื่นย่อมไม่มีทางถูกเลือก
    """
    cp = ord(ch)
    return (
        0x0020 <= cp <= 0x007E      # ASCII: อังกฤษ ตัวเลข เครื่องหมายบนแป้นพิมพ์
        or 0x0E00 <= cp <= 0x0E7F   # อักษรไทย (รวม ฿ และเลขไทย)
        or cp == 0x2581             # ▁ = เครื่องหมายขึ้นต้นคำของตัวตัดคำ (แทนช่องว่าง)
        or 0x00A0 <= cp <= 0x00BF   # สัญลักษณ์ Latin-1 เช่น ° (องศา) ± — ไม่รวมตัวอักษรมีเครื่องหมาย เช่น é
        or cp in (0x00D7, 0x00F7)   # × ÷
        or 0x2000 <= cp <= 0x206F   # เครื่องหมายวรรคตอน เช่น “ ” … – ที่มือถือพิมพ์ให้อัตโนมัติ
    )


def classify(piece: str) -> str:
    """แยก token เป็นกลุ่ม เพื่อรายงานว่าที่เก็บไว้มาจากไหน"""
    if not all(is_allowed_char(ch) for ch in piece):
        return "removed"
    if any(0x0E00 <= ord(ch) <= 0x0E7F for ch in piece):
        return "thai"
    if all(ord(ch) <= 0x7E or ord(ch) == 0x2581 for ch in piece):
        return "ascii"
    return "symbol"


# ============================================================
# ตัวช่วย
# ============================================================

def tensor_bytes(tensor: onnx.TensorProto) -> int:
    """ขนาดของ initializer เป็นไบต์ = จำนวนสมาชิก × ขนาดต่อสมาชิกของชนิดข้อมูล"""
    count = 1
    for dim in tensor.dims:
        count *= dim
    itemsize = helper.tensor_dtype_to_np_dtype(tensor.data_type).itemsize
    return count * itemsize


def dtype_name(tensor: onnx.TensorProto) -> str:
    return helper.tensor_dtype_to_np_dtype(tensor.data_type).name


def section(title: str) -> None:
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


def require(path: Path) -> None:
    if not path.exists():
        sys.exit(f"ไม่พบ {path}\nต้องรัน node scripts/measure-embedding.js ใน backend/ ให้สำเร็จก่อน")


# ============================================================
# ส่วนที่ 1: ไฟล์ ONNX
# ============================================================

def inspect_onnx(vocab_size: int) -> list[onnx.TensorProto]:
    section("1. ไฟล์ ONNX")
    print(f"ไฟล์: {ONNX_FILE.name} ({ONNX_FILE.stat().st_size / MIB:.1f} MiB)")

    model = onnx.load(str(ONNX_FILE))
    graph = model.graph
    print(f"ขาเข้า: {', '.join(i.name for i in graph.input)}")
    print(f"ขาออก: {', '.join(o.name for o in graph.output)}")

    # initializer = ค่าคงที่ที่เก็บในไฟล์ (น้ำหนักของโมเดล) — เรียงจากใหญ่ไปเล็ก
    initializers = sorted(graph.initializer, key=tensor_bytes, reverse=True)
    total = sum(tensor_bytes(t) for t in initializers)
    print(f"\ninitializer ทั้งหมด {len(initializers)} ตัว รวม {total / MIB:.1f} MiB — 8 ตัวที่ใหญ่ที่สุด:")
    for t in initializers[:8]:
        print(f"  {tensor_bytes(t) / MIB:7.1f} MiB  {dtype_name(t):8}  {list(t.dims)}  {t.name}")

    # ตารางคำศัพท์ = initializer ที่มิติแรกเท่ากับจำนวนคำศัพท์
    vocab_tables = [t for t in initializers if len(t.dims) >= 1 and t.dims[0] == vocab_size]

    # ใครใช้ตารางนี้บ้าง (ตามไปอีกหนึ่งชั้น ถ้าชั้นแรกเป็นการแปลงชนิดข้อมูล)
    consumers: dict[str, list[onnx.NodeProto]] = {}
    for node in graph.node:
        for name in node.input:
            consumers.setdefault(name, []).append(node)

    print(f"\nตารางคำศัพท์ (มิติแรก = {vocab_size:,}):")
    if not vocab_tables:
        print("  ไม่พบ — ส่งผลนี้กลับมา ต้องหาวิธีอื่น")
    for t in vocab_tables:
        print(f"  {t.name}: {dtype_name(t)} {list(t.dims)} = {tensor_bytes(t) / MIB:.1f} MiB")
        for node in consumers.get(t.name, []):
            print(f"    ใช้โดย {node.op_type} ({node.name})")
            for out in node.output:
                for nxt in consumers.get(out, []):
                    print(f"      → ต่อไปที่ {nxt.op_type} ({nxt.name})")

    return vocab_tables


# ============================================================
# ส่วนที่ 2: ตัวตัดคำ (tokenizer.json)
# ============================================================

def inspect_tokenizer() -> tuple[int, set[int]]:
    section("2. ตัวตัดคำ (tokenizer.json)")
    data = json.loads(TOKENIZER_FILE.read_text(encoding="utf-8"))
    model = data["model"]
    vocab = model["vocab"]  # รายการ [ข้อความของ token, คะแนน] ลำดับในรายการ = id
    print(f"ชนิด: {model['type']} · จำนวน token: {len(vocab):,} · unk_id: {model.get('unk_id')}")

    special_ids = {t["id"] for t in data.get("added_tokens", [])}
    print(f"token พิเศษ: {', '.join(t['content'] + '=' + str(t['id']) for t in data.get('added_tokens', []))}")

    counts = {"special": 0, "thai": 0, "ascii": 0, "symbol": 0, "removed": 0}
    kept_ids: set[int] = set()
    removed_examples: list[str] = []
    for token_id, (piece, _score) in enumerate(vocab):
        group = "special" if token_id in special_ids else classify(piece)
        counts[group] += 1
        if group == "removed":
            if len(removed_examples) < 12:
                removed_examples.append(piece)
        else:
            kept_ids.add(token_id)
    # token พิเศษบางตัว (เช่น <mask>) อาจอยู่นอกรายการ vocab ของโมเดล
    kept_ids |= special_ids

    labels = {
        "special": "token พิเศษ (<s> </s> <pad> <unk> <mask>)",
        "thai": "มีอักษรไทย",
        "ascii": "ASCII ล้วน (อังกฤษ ตัวเลข เครื่องหมาย)",
        "symbol": "มีสัญลักษณ์ที่อนุญาต เช่น ° “ ”",
        "removed": "ถูกตัด (มีตัวอักษรภาษาอื่น)",
    }
    print("\nแยกกลุ่มตามกฎ:")
    for key, label in labels.items():
        print(f"  {counts[key]:>8,}  {label}")
    print(f"\nเก็บไว้ {len(kept_ids):,} จาก {len(vocab):,} token ({len(kept_ids) / len(vocab):.1%})")
    print(f"ตัวอย่าง token ที่ถูกตัด: {' '.join(removed_examples)}")

    return len(vocab), kept_ids


# ============================================================
# ส่วนที่ 3: ข้อความจริงของระบบใช้แต่ token ที่ถูกเก็บไหม
# ============================================================

def check_real_texts(kept_ids: set[int]) -> None:
    section("3. ข้อความจริงของระบบ")
    manual = json.loads(MANUAL_FILE.read_text(encoding="utf-8"))
    texts: list[str] = []
    for g in manual["graphs"]:
        for text in [g.get("entry_symptom_th"), g.get("entry_symptom"), *g.get("entry_symptom_aliases", [])]:
            if text and text.strip():
                texts.append(text.strip())
    texts += SAMPLE_QUERIES

    tokenizer = Tokenizer.from_file(str(TOKENIZER_FILE))
    problems = 0
    for text in texts:
        encoding = tokenizer.encode(text)
        missing = [tok for tok, tid in zip(encoding.tokens, encoding.ids) if tid not in kept_ids]
        if missing:
            problems += 1
            print(f"  ✗ \"{text}\" ใช้ token ที่จะถูกตัด: {missing}")

    print(f"ตรวจ {len(texts)} ข้อความ (ข้อความตัวแทน + คำค้นตัวอย่าง): "
          f"ใช้แต่ token ที่ถูกเก็บ {len(texts) - problems} · มีปัญหา {problems}")

    sample = tokenizer.encode(SAMPLE_QUERIES[2])
    print(f"\nตัวอย่างการตัดคำ \"{SAMPLE_QUERIES[2]}\":\n  {sample.tokens}")


# ============================================================
# ส่วนที่ 4: ประมาณการ
# ============================================================

def estimate(vocab_tables: list[onnx.TensorProto], vocab_size: int, kept: int, hidden: int) -> None:
    section("4. ประมาณการ (ส่งส่วนนี้กลับมาพร้อมส่วนที่ 1–3)")
    removed = vocab_size - kept
    for t in vocab_tables:
        before = tensor_bytes(t)
        after = before * kept // vocab_size
        print(f"{t.name} ตามชนิดที่เก็บในไฟล์ ({dtype_name(t)}): "
              f"{before / MIB:.1f} → {after / MIB:.1f} MiB (ไฟล์เล็กลง ~{(before - after) / MIB:.1f} MiB)")

    fp32_before = vocab_size * hidden * 4
    fp32_after = kept * hidden * 4
    print(f"ถ้าตารางอยู่ในหน่วยความจำแบบ float32: "
          f"{fp32_before / MIB:.1f} → {fp32_after / MIB:.1f} MiB (ลด ~{(fp32_before - fp32_after) / MIB:.1f} MiB)")
    print(f"ตัด {removed:,} แถว เหลือ {kept:,} แถว")
    print("\nเทียบกับที่วัดได้ในขั้น 1.1: RSS เพิ่ม ~380 MiB ตอนโหลดโมเดล")
    print("ตัวเลขข้างบนเป็นการประมาณ ต้องวัดจริงหลังตัด (ขั้น 1.2.4)")


def main() -> None:
    for path in (ONNX_FILE, TOKENIZER_FILE, CONFIG_FILE, MANUAL_FILE):
        require(path)

    config = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    vocab_size = config["vocab_size"]
    hidden = config["hidden_size"]
    print(f"config.json: vocab_size = {vocab_size:,} · hidden_size = {hidden}")

    vocab_tables = inspect_onnx(vocab_size)
    tokenizer_vocab_size, kept_ids = inspect_tokenizer()
    if tokenizer_vocab_size != vocab_size:
        print(f"\n⚠️ จำนวน token ใน tokenizer ({tokenizer_vocab_size:,}) ไม่เท่ากับ config ({vocab_size:,})")
    check_real_texts(kept_ids)
    estimate(vocab_tables, vocab_size, len(kept_ids), hidden)


if __name__ == "__main__":
    main()