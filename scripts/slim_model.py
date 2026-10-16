"""
ขั้น 1.2.2 — ตัดตารางคำศัพท์ของโมเดลค้นหาอาการให้เหลือเฉพาะไทย/อังกฤษ

อ่านโมเดลต้นฉบับจาก backend/model-cache/ (ไม่แก้ไฟล์ต้นฉบับเลย)
เขียนโมเดลที่ตัดแล้วไปที่ backend/model-slim/ โครงสร้างโฟลเดอร์เหมือนกัน

สิ่งที่ทำ:
  1. เลือก token ที่เก็บ ด้วยกฎเดียวกับ inspect_vocab.py (ไทย / ASCII / เครื่องหมาย + token พิเศษ)
  2. เรียง token ที่เก็บตาม id เดิม แล้วกำหนด id ใหม่เรียงต่อกันจาก 0
       - token พิเศษ id 0–3 (<s> <pad> </s> <unk>) อยู่ต้นสุด id จึงไม่เปลี่ยน
         (สำคัญ: กราฟของโมเดลอาจอ้าง id เหล่านี้ตรงๆ เช่น id ของ <pad>)
       - <mask> เป็น id สูงสุด จึงได้ id ใหม่ท้ายสุด (ระบบไม่ใช้ <mask>)
  3. ตัดแถวของตารางคำศัพท์ในไฟล์ ONNX ให้เหลือเฉพาะแถวที่เก็บ (น้ำหนักส่วนอื่นไม่แตะ)
  4. เขียน tokenizer.json / config.json / tokenizer_config.json ใหม่ให้ id ตรงกับตารางใหม่
  5. ตรวจตัวเอง: ทุกข้อความที่ระบบใช้ค้นหา ต้องตัดคำได้ token เหมือนเดิม และดึงแถวจากตาราง
     ใหม่ได้ค่าเหมือนตารางเดิมทุกไบต์ ถ้าไม่ผ่านสคริปต์ลบผลที่เขียนไว้ทิ้ง (กันหยิบไปใช้
     โดยไม่ตั้งใจ) แล้วจบด้วย exit code 1

ทุกครั้งที่รัน สคริปต์ลบ backend/model-slim/ ของรอบก่อนทิ้งก่อนเริ่ม ผลจึงไม่มีไฟล์ค้างจากรอบเก่า

ทำไมข้อ 5 พิสูจน์ได้ว่าผลลัพธ์ของโมเดลไม่เปลี่ยน:
  ผลลัพธ์ของโมเดลขึ้นกับ (แถวจากตารางคำศัพท์ + น้ำหนักส่วนอื่น + attention_mask + token_type_ids)
  น้ำหนักส่วนอื่นเหมือนเดิมทุกไบต์ (สคริปต์ตรวจ) แถวที่ป้อนเหมือนเดิมทุกไบต์ (ข้อ 5)
  ส่วนที่เหลือไม่ขึ้นกับ id จึงได้เวกเตอร์เท่าเดิม ขั้น 1.2.3 จะยืนยันซ้ำกับโมเดลจริงด้วย
  ตัวเลข cosine

วิธีใช้ (ยืนที่รากของ repo):
    py -3.12 scripts/slim_model.py
"""

import json
import shutil
import sys
from pathlib import Path

import numpy as np
import onnx
from onnx import numpy_helper
from tokenizers import Tokenizer

# กฎการเก็บ token และคำค้นตัวอย่าง อยู่ที่เดียวใน inspect_vocab.py ไม่ลอกมาซ้ำ
# (import ได้เพราะรันจาก scripts/ ทำให้โฟลเดอร์นี้อยู่ใน sys.path)
from inspect_vocab import SAMPLE_QUERIES, classify

REPO_ROOT = Path(__file__).parent.parent
MODEL_REL = Path("Xenova") / "paraphrase-multilingual-MiniLM-L12-v2"
SRC_DIR = REPO_ROOT / "backend" / "model-cache" / MODEL_REL
DST_DIR = REPO_ROOT / "backend" / "model-slim" / MODEL_REL
ONNX_REL = Path("onnx") / "model_quantized.onnx"
MANUAL_FILE = REPO_ROOT / "data" / "manuals" / "samsung_ac_ar70h.json"

MIB = 1024 * 1024

# id ที่ต้องคงเดิม: <s>=0 <pad>=1 </s>=2 <unk>=3
FIXED_IDS = [0, 1, 2, 3]


# ============================================================
# ตัวช่วยทั่วไป
# ============================================================

def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: dict) -> None:
    """เขียนแบบกะทัดรัด ไม่ escape ภาษาไทย — ไฟล์ tokenizer ใหญ่ ไม่มีเหตุผลต้องเว้นบรรทัด"""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def fail(message: str) -> None:
    sys.exit(f"\nหยุด: {message}")


def reset_output_dir() -> None:
    """ลบผลของรอบก่อน (ถ้ามี) — ลบเฉพาะโฟลเดอร์ปลายทาง ไม่แตะ model-cache/ ต้นฉบับ"""
    if "model-slim" not in DST_DIR.parts:  # กันพลาดถ้ามีใครแก้ค่าคงที่ด้านบนให้ชี้ที่อื่น
        fail(f"โฟลเดอร์ปลายทางต้องอยู่ใน model-slim/ แต่ได้ {DST_DIR}")
    if DST_DIR.exists():
        shutil.rmtree(DST_DIR)


def section(title: str) -> None:
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


# ============================================================
# 1–2. เลือก token ที่เก็บ และกำหนด id ใหม่
# ============================================================

def choose_kept_ids(tokenizer_json: dict) -> list[int]:
    """คืน id เดิมของ token ที่เก็บ เรียงจากน้อยไปมาก"""
    vocab = tokenizer_json["model"]["vocab"]  # รายการ [ข้อความ, คะแนน] ลำดับ = id
    special_ids = {t["id"] for t in tokenizer_json.get("added_tokens", [])}

    # สคริปต์นี้รองรับเฉพาะกรณีที่ token พิเศษทุกตัวอยู่ในรายการคำศัพท์ (โมเดลนี้เป็นแบบนั้น)
    if any(i >= len(vocab) for i in special_ids):
        fail("มี token พิเศษที่ id เกินรายการคำศัพท์ — สคริปต์นี้ยังไม่รองรับ")

    return [
        token_id
        for token_id, (piece, _score) in enumerate(vocab)
        if token_id in special_ids or classify(piece) != "removed"
    ]


# ============================================================
# 3. ตัดตารางในไฟล์ ONNX
# ============================================================

def slim_onnx(src: Path, dst: Path, vocab_size: int, kept: list[int]) -> tuple[np.ndarray, np.ndarray, str]:
    """ตัดแถวของตารางคำศัพท์ คืน (ตารางเดิม, ตารางใหม่, ชื่อตาราง)"""
    model = onnx.load(str(src))
    graph = model.graph

    # ตารางคำศัพท์ = initializer เดียวที่มิติแรกเท่ากับ vocab_size (ขั้น 1.2.1 ยืนยันว่ามีตัวเดียว)
    tables = [t for t in graph.initializer if len(t.dims) >= 1 and t.dims[0] == vocab_size]
    if len(tables) != 1:
        fail(f"คาดว่ามีตารางคำศัพท์ 1 ตัว แต่พบ {len(tables)} ตัว")
    table = tables[0]

    # ถ้ามีรูปร่างที่อ้างจำนวนคำศัพท์ในส่วนอื่นของกราฟ การตัดตารางอย่างเดียวจะไม่พอ
    for info in [*graph.input, *graph.output, *graph.value_info]:
        for dim in info.type.tensor_type.shape.dim:
            if dim.dim_value == vocab_size:
                fail(f"ขนาดคำศัพท์ {vocab_size} ไปปรากฏที่ {info.name} — ต้องแก้เพิ่ม")

    old = numpy_helper.to_array(table).copy()
    new = old[kept]  # เลือกแถวตามรายการ id เดิม แถวที่ i ของตารางใหม่ = แถว kept[i] ของตารางเดิม

    table.CopyFrom(numpy_helper.from_array(new, table.name))
    dst.parent.mkdir(parents=True, exist_ok=True)
    onnx.save(model, str(dst))
    return old, new, table.name


def check_onnx_unchanged_except_table(src: Path, dst: Path, table_name: str) -> None:
    """โหลดไฟล์ที่เขียนแล้วกลับมาเทียบ: โครงกราฟและน้ำหนักอื่นต้องเหมือนเดิมทุกไบต์"""
    a = onnx.load(str(src))
    b = onnx.load(str(dst))

    same_structure = (
        [n.op_type for n in a.graph.node] == [n.op_type for n in b.graph.node]
        and [n.name for n in a.graph.node] == [n.name for n in b.graph.node]
        and [i.name for i in a.graph.input] == [i.name for i in b.graph.input]
        and [o.name for o in a.graph.output] == [o.name for o in b.graph.output]
        and a.ir_version == b.ir_version
        and [(o.domain, o.version) for o in a.opset_import] == [(o.domain, o.version) for o in b.opset_import]
    )
    if not same_structure:
        fail("โครงกราฟของไฟล์ที่เขียนไม่ตรงกับต้นฉบับ")

    a_weights = {t.name: t.SerializeToString() for t in a.graph.initializer if t.name != table_name}
    b_weights = {t.name: t.SerializeToString() for t in b.graph.initializer if t.name != table_name}
    if a_weights != b_weights:
        fail("น้ำหนักส่วนอื่นของโมเดลไม่ตรงกับต้นฉบับ")

    print(f"โครงกราฟ ({len(a.graph.node)} node) และน้ำหนักอื่นอีก {len(a_weights)} ตัว "
          f"เหมือนต้นฉบับทุกไบต์ — ต่างกันแค่ตารางคำศัพท์")


# ============================================================
# 4. เขียนตัวตัดคำและ config ใหม่
# ============================================================

def slim_tokenizer_json(tok: dict, kept: list[int], old_to_new: dict[int, int]) -> dict:
    new = json.loads(json.dumps(tok))  # สำเนาลึก ไม่แตะของเดิม
    vocab = tok["model"]["vocab"]

    new["model"]["vocab"] = [vocab[i] for i in kept]
    new["model"]["unk_id"] = old_to_new[tok["model"]["unk_id"]]

    for added in new.get("added_tokens", []):
        added["id"] = old_to_new[added["id"]]

    # TemplateProcessing เก็บ id ของ <s> และ </s> ที่ใส่หัวท้ายประโยค
    post = new.get("post_processor") or {}
    for spec in (post.get("special_tokens") or {}).values():
        spec["ids"] = [old_to_new[i] for i in spec["ids"]]

    return new


def slim_tokenizer_config(cfg: dict, old_to_new: dict[int, int]) -> dict:
    """tokenizer_config.json บางรุ่นเก็บ id ของ token พิเศษใน added_tokens_decoder"""
    decoder = cfg.get("added_tokens_decoder")
    if decoder:
        remapped = {old_to_new[int(k)]: v for k, v in decoder.items()}
        cfg["added_tokens_decoder"] = {str(k): remapped[k] for k in sorted(remapped)}
    return cfg


# ============================================================
# 5. ตรวจตัวเอง
# ============================================================

def collect_search_texts(graphs: list[dict]) -> list[str]:
    """ข้อความที่ระบบใช้ค้นหาจริง: ข้อความตัวแทนของทุกผัง + คำค้นตัวอย่าง (ชุดเดียวกับขั้น 1.1)"""
    texts: list[str] = []
    for g in graphs:
        for text in [g.get("entry_symptom_th"), g.get("entry_symptom"), *g.get("entry_symptom_aliases", [])]:
            if text and text.strip():
                texts.append(text.strip())
    return texts + SAMPLE_QUERIES


def collect_step_texts(graphs: list[dict]) -> list[str]:
    """ข้อความในสถานะทุกตัว (คำถาม/คำสั่ง/คำเตือน) — ไม่ได้ใช้ค้นหา ใช้ดูขอบเขตเพิ่มเติมเท่านั้น"""
    texts: list[str] = []
    for g in graphs:
        for node in g["nodes"]:
            for key in ("question", "content", "prompt", "safety_warning"):
                value = node.get(key)
                if isinstance(value, str) and value.strip():
                    texts.append(value.strip())
    return texts


def compare_texts(texts, tok_old, tok_new, old_table, new_table) -> list[str]:
    """คืนรายการข้อความที่ไม่ผ่าน: token ต่างกัน หรือแถวที่ดึงจากตารางไม่เหมือนกัน"""
    bad = []
    for text in texts:
        enc_old = tok_old.encode(text)
        enc_new = tok_new.encode(text)
        same_tokens = enc_old.tokens == enc_new.tokens
        same_rows = np.array_equal(old_table[enc_old.ids], new_table[enc_new.ids])
        if not (same_tokens and same_rows):
            bad.append(text)
    return bad


# ============================================================
# main
# ============================================================

def main() -> None:
    src_onnx = SRC_DIR / ONNX_REL
    for path in (src_onnx, SRC_DIR / "tokenizer.json", SRC_DIR / "config.json", MANUAL_FILE):
        if not path.exists():
            fail(f"ไม่พบ {path}\nต้องรัน node scripts/measure-embedding.js ใน backend/ ให้สำเร็จก่อน")

    reset_output_dir()

    section("1. เลือก token ที่เก็บ")
    config = load_json(SRC_DIR / "config.json")
    tok = load_json(SRC_DIR / "tokenizer.json")
    vocab_size = config["vocab_size"]

    kept = choose_kept_ids(tok)
    old_to_new = {old: new for new, old in enumerate(kept)}
    if [old_to_new.get(i) for i in FIXED_IDS] != FIXED_IDS:
        fail("id 0–3 (<s> <pad> </s> <unk>) เปลี่ยนไป — ไม่ควรเกิดกับโมเดลนี้")
    print(f"เก็บ {len(kept):,} จาก {len(tok['model']['vocab']):,} token "
          f"(ขั้น 1.2.1 นับได้ 87,519 — ควรเท่ากัน)")
    mask_old = next(t["id"] for t in tok["added_tokens"] if t["content"] == "<mask>")
    print(f"id ของ <mask>: {mask_old:,} → {old_to_new[mask_old]:,}")

    section("2. ตัดตารางในไฟล์ ONNX")
    dst_onnx = DST_DIR / ONNX_REL
    old_table, new_table, table_name = slim_onnx(src_onnx, dst_onnx, vocab_size, kept)
    print(f"{table_name}: {list(old_table.shape)} → {list(new_table.shape)} "
          f"({old_table.nbytes / MIB:.1f} → {new_table.nbytes / MIB:.1f} MiB)")
    check_onnx_unchanged_except_table(src_onnx, dst_onnx, table_name)

    section("3. เขียนตัวตัดคำและ config ใหม่")
    write_json(DST_DIR / "tokenizer.json", slim_tokenizer_json(tok, kept, old_to_new))
    config["vocab_size"] = len(kept)
    write_json(DST_DIR / "config.json", config)
    print(f"tokenizer.json, config.json (vocab_size = {len(kept):,})")

    cfg_path = SRC_DIR / "tokenizer_config.json"
    if cfg_path.exists():
        write_json(DST_DIR / "tokenizer_config.json", slim_tokenizer_config(load_json(cfg_path), old_to_new))
        print("tokenizer_config.json")
    for name in ("special_tokens_map.json",):
        if (SRC_DIR / name).exists():
            shutil.copyfile(SRC_DIR / name, DST_DIR / name)
            print(f"{name} (คัดลอกตามเดิม)")

    copied = {p.relative_to(DST_DIR).as_posix() for p in DST_DIR.rglob("*") if p.is_file()}
    skipped = sorted(
        p.relative_to(SRC_DIR).as_posix() for p in SRC_DIR.rglob("*")
        if p.is_file() and p.relative_to(SRC_DIR).as_posix() not in copied
    )
    if skipped:
        print(f"ไม่ได้คัดลอก (ไม่จำเป็นสำหรับการแปลงข้อความ): {', '.join(skipped)}")

    section("4. ตรวจตัวเอง")
    tok_old = Tokenizer.from_file(str(SRC_DIR / "tokenizer.json"))
    tok_new = Tokenizer.from_file(str(DST_DIR / "tokenizer.json"))
    if tok_new.token_to_id("<mask>") != old_to_new[tok_old.token_to_id("<mask>")]:
        fail("id ของ <mask> ในตัวตัดคำใหม่ไม่ตรงกับที่คำนวณ")

    graphs = load_json(MANUAL_FILE)["graphs"]

    search_texts = collect_search_texts(graphs)
    bad = compare_texts(search_texts, tok_old, tok_new, old_table, new_table)
    print(f"ข้อความที่ใช้ค้นหา {len(search_texts)} ข้อความ: "
          f"token เหมือนเดิมและแถวตารางเหมือนเดิมทุกไบต์ {len(search_texts) - len(bad)} · ไม่ผ่าน {len(bad)}")

    step_texts = collect_step_texts(graphs)
    step_bad = compare_texts(step_texts, tok_old, tok_new, old_table, new_table)
    print(f"ข้อความในสถานะ {len(step_texts)} ข้อความ (ไม่ได้ใช้ค้นหา ดูขอบเขตเท่านั้น): "
          f"เหมือนเดิม {len(step_texts) - len(step_bad)} · ต่างไป {len(step_bad)}")
    if step_bad:
        print(f"  ตัวอย่างที่ต่างไป: {step_bad[0][:60]}")

    # แสดงพฤติกรรมของตัวอักษรนอกชุดให้เห็นชัดๆ (ไม่ใช่การทดสอบผ่าน/ไม่ผ่าน)
    # ต้องดู id ไม่ใช่ข้อความของ token เพราะ token ที่ไม่รู้จักจะแสดงข้อความเดิมของมันอยู่
    demo = "café 中文"
    enc_old, enc_new = tok_old.encode(demo), tok_new.encode(demo)
    unk_id = tok_new.token_to_id("<unk>")
    print(f"\nตัวอย่างข้อความที่มีอักษรนอกชุด \"{demo}\" (id {unk_id} = <unk>):")
    print(f"  ต้นฉบับ : {enc_old.ids}")
    print(f"  ตัดแล้ว : {enc_new.ids}  (เป็น <unk> {enc_new.ids.count(unk_id)} ตำแหน่ง)")
    print("  ตัวอักษรนอกชุดกลายเป็น <unk> — เป็นข้อแลกเปลี่ยนที่ยอมรับแล้ว ไม่กระทบข้อความไทย/อังกฤษ")

    if bad:
        print("\nข้อความที่ไม่ผ่าน:")
        for text in bad:
            print(f"  ✗ {text}")
        reset_output_dir()
        fail("มีข้อความค้นหาที่ผลต่างจากเดิม — ลบผลที่เขียนไว้ทิ้งแล้ว ยังไม่มี model-slim/ ให้ใช้")

    section("สรุป")
    print(f"ไฟล์ ONNX: {src_onnx.stat().st_size / MIB:.1f} → {dst_onnx.stat().st_size / MIB:.1f} MiB")
    print(f"ผลอยู่ที่: {DST_DIR}")
    print("ผ่านการตรวจตัวเองทั้งหมด — ขั้นต่อไป (1.2.3) เทียบเวกเตอร์กับโมเดลเดิมด้วย Node")


if __name__ == "__main__":
    main()