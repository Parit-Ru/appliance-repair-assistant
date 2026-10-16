"""
convert_chunks_to_graphs.py — แปลงข้อมูลคู่มือแบบข้อความแบน (flat chunks)
ให้อยู่ในรูปกราฟการแก้ปัญหาตาม schema v2

หลักการ: เป็นการแปลงแบบ deterministic ล้วน ไม่มีการเรียกใช้แบบจำลองภาษา
ผลลัพธ์ที่ได้คือ "ร่าง" ที่ต้องผ่านการตรวจสอบและแก้ไขโดยผู้พัฒนาก่อนนำไปใช้จริง

การใช้งาน:
    python scripts/convert_chunks_to_graphs.py <input.json> <output.json>
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# ค่าคงที่
# ---------------------------------------------------------------------------

# คำที่บ่งชี้ว่าอาการนั้นเป็นการทำงานปกติของเครื่อง ไม่ใช่ความเสียหาย
NORMAL_BEHAVIOR_PATTERNS = [
    r'\bthis is normal\b',
    r'\bis normal\b',
    r'\bnormal occurrence\b',
    r'\bnot a (?:defect|malfunction|problem)\b',
    r'\bno action (?:is )?(?:needed|required)\b',
    r'\bdoes not indicate a (?:problem|malfunction)\b',
]

# คำที่บ่งชี้ว่าต้องส่งต่อช่างทันที ไม่ควรให้ผู้ใช้ทำเอง
DIRECT_ESCALATION_PATTERNS = [
    r'\bcontact (?:your |an? )?(?:service|authorized|samsung)',
    r'\bcall (?:a |an )?(?:service|technician|electrician)',
    r'\bservice cent(?:er|re)\b',
]

# คำที่ไม่นับเป็นคำสำคัญตอนจับคู่ safety_warning กับขั้นตอน
STOPWORDS = {
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of',
    'in', 'on', 'at', 'for', 'and', 'or', 'if', 'it', 'this', 'that', 'with',
    'not', 'do', 'does', 'make', 'sure', 'your', 'you', 'from', 'by', 'as',
}


# ---------------------------------------------------------------------------
# ฟังก์ชันช่วยเหลือ
# ---------------------------------------------------------------------------

def slugify(text: str, max_words: int = 6) -> str:
    """แปลงข้อความอาการเป็นรหัสสำหรับใช้ตั้งชื่อ graph_id"""
    cleaned = re.sub(r'[^a-z0-9\s]', ' ', text.lower())
    words = [w for w in cleaned.split() if w and w not in STOPWORDS]
    return '_'.join(words[:max_words]) or 'unnamed'


def parse_solution_steps(solution: str) -> list[str]:
    """แยกข้อความวิธีแก้ไขออกเป็นรายการขั้นตอน

    รองรับสองรูปแบบ
    1. มีเลขกำกับ เช่น '1. ทำสิ่งนี้\n2. ทำสิ่งนั้น'
    2. ไม่มีเลขกำกับ ถือเป็นขั้นตอนเดียว
    """
    if not solution or not solution.strip():
        return []

    text = solution.strip()

    # ตรวจว่ามีขั้นตอนที่กำกับด้วยเลขหรือไม่
    if re.search(r'(?:^|\n)\s*1[.)]\s', text):
        # ตัดตรงหน้าเลขที่ขึ้นต้นบรรทัดหรือหลังจุด
        parts = re.split(r'(?:^|\n)\s*\d+[.)]\s*', text)
        steps = [p.strip() for p in parts if p.strip()]
        if steps:
            return steps

    # ไม่มีเลขกำกับ ถือเป็นขั้นตอนเดียว
    return [text]


def normalize_word_set(text: str) -> set[str]:
    """แปลงข้อความเป็นชุดคำสำคัญ ใช้เทียบความคล้าย"""
    cleaned = re.sub(r'[^a-z0-9\s]', ' ', (text or '').lower())
    return {w for w in cleaned.split() if w and w not in STOPWORDS}


def find_safety_step_index(steps: list[str], safety_warning: str) -> int | None:
    """หาว่าคำเตือนความปลอดภัยตรงกับขั้นตอนใดมากที่สุด

    ใช้การนับคำสำคัญที่ซ้อนทับกัน คืนค่า index ของขั้นตอนนั้น
    ถ้าไม่มีขั้นตอนใดใกล้เคียงพอ คืนค่า None
    """
    if not safety_warning:
        return None

    warning_words = normalize_word_set(safety_warning)
    if not warning_words:
        return None

    best_index = None
    best_overlap = 0

    for i, step in enumerate(steps):
        overlap = len(warning_words & normalize_word_set(step))
        if overlap > best_overlap:
            best_overlap = overlap
            best_index = i

    # ต้องซ้อนทับอย่างน้อย 2 คำ จึงถือว่าตรงกันจริง
    return best_index if best_overlap >= 2 else None


def is_normal_behavior(solution: str) -> bool:
    """ตรวจว่าคู่มือระบุว่าอาการนี้เป็นการทำงานปกติหรือไม่"""
    text = (solution or '').lower()
    return any(re.search(p, text) for p in NORMAL_BEHAVIOR_PATTERNS)


def is_direct_escalation(steps: list[str]) -> bool:
    """ตรวจว่าคู่มือสั่งให้ติดต่อช่างทันทีโดยไม่มีขั้นตอนให้ผู้ใช้ทำเอง"""
    if len(steps) != 1:
        return False
    text = steps[0].lower()
    return any(re.search(p, text) for p in DIRECT_ESCALATION_PATTERNS)


def clean_safety_warning(value) -> str | None:
    """ทำความสะอาดค่า safety_warning

    ข้อมูลบางไฟล์เก็บคำว่า 'None' เป็นสตริง ไม่ใช่ค่าว่างจริง
    """
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in ('none', 'null', 'n/a', '-'):
        return None
    return text


# ---------------------------------------------------------------------------
# ตัวสร้างกราฟ
# ---------------------------------------------------------------------------

def build_graph(chunk: dict, brand: str) -> dict:
    """แปลง chunk หนึ่งรายการเป็นกราฟหนึ่งกราฟ"""
    meta = chunk.get('metadata', {})
    symptom = meta.get('symptom') or chunk.get('content', '')[:80]
    solution = meta.get('solution', '')
    safety_warning = clean_safety_warning(meta.get('safety_warning'))

    steps = parse_solution_steps(solution)

    # ข้อมูลบางรายการไม่มีช่อง solution แต่มีคำอธิบายอยู่ในช่อง content
    # ส่วนใหญ่เป็นกรณีที่คู่มืออธิบายว่าอาการนั้นเป็นการทำงานปกติ
    used_content_fallback = False
    if not steps:
        fallback = (chunk.get('content') or '').strip()
        if fallback:
            steps = [fallback]
            solution = fallback
            used_content_fallback = True

    safety_index = find_safety_step_index(steps, safety_warning) if safety_warning else None

    nodes: list[dict] = []

    # --- โหนดยืนยันอาการ ---
    nodes.append({
        'node_id': 'n1',
        'type': 'checkpoint',
        'question': f'อาการที่พบตรงกับ "{symptom}" ใช่หรือไม่?',
        'safety_critical': False,
        'author_note': 'โหนดยืนยันอาการ สร้างโดยสคริปต์แปลง ไม่ได้มาจากคู่มือโดยตรง',
        'on_yes': None,   # เติมภายหลัง
        'on_no': 'n_escalate_mismatch',
    })

    # --- กรณีที่ 1: คู่มือระบุว่าเป็นอาการปกติ ---
    if is_normal_behavior(solution):
        nodes[0]['on_yes'] = 'n_normal'
        nodes.append({
            'node_id': 'n_normal',
            'type': 'resolution',
            'content': solution.strip(),
            'outcome_kind': 'normal_behavior',
        })

    # --- กรณีที่ 2: คู่มือสั่งติดต่อช่างทันที ---
    elif is_direct_escalation(steps):
        nodes[0]['on_yes'] = 'n_escalate_direct'
        nodes.append({
            'node_id': 'n_escalate_direct',
            'type': 'escalation',
            'content': steps[0],
            'outcome_kind': 'handoff_informed',
        })

    # --- กรณีที่ 4: ไม่มีข้อมูลวิธีแก้ไขเลย ส่งต่อศูนย์บริการ ---
    elif not steps:
        nodes[0]['on_yes'] = 'n_escalate_nodata'
        nodes.append({
            'node_id': 'n_escalate_nodata',
            'type': 'escalation',
            'content': (
                f'คู่มือไม่ได้ระบุขั้นตอนแก้ไขสำหรับอาการนี้ '
                f'แนะนำให้ติดต่อศูนย์บริการ {brand} พร้อมแจ้งรุ่นเครื่องและอาการที่พบ'
            ),
            'outcome_kind': 'handoff_unknown',
            'author_note': 'ข้อมูลต้นทางไม่มีทั้งช่อง solution และ content',
        })

    # --- กรณีที่ 3: มีขั้นตอนให้ผู้ใช้ทำ (กรณีทั่วไป) ---
    else:
        nodes[0]['on_yes'] = 's1'

        for i, step_text in enumerate(steps, start=1):
            is_last = (i == len(steps))

            instruction = {
                'node_id': f's{i}',
                'type': 'instruction',
                'content': step_text,
                'safety_critical': (safety_index == i - 1),
                'next': f'c{i}',
            }
            if safety_index == i - 1:
                instruction['safety_warning'] = safety_warning
                instruction['author_note'] = (
                    'safety_warning จับคู่กับขั้นตอนนี้โดยสคริปต์ '
                    'ผู้พัฒนาต้องตรวจสอบความเหมาะสมอีกครั้ง'
                )
            nodes.append(instruction)

            nodes.append({
                'node_id': f'c{i}',
                'type': 'checkpoint',
                'question': 'หลังดำเนินการขั้นตอนนี้แล้ว ปัญหาได้รับการแก้ไขหรือไม่?',
                'safety_critical': False,
                'author_note': 'โหนดตรวจผลลัพธ์ สร้างโดยสคริปต์แปลง',
                'on_yes': 'n_resolved',
                'on_no': 'n_escalate' if is_last else f's{i + 1}',
            })

        nodes.append({
            'node_id': 'n_resolved',
            'type': 'resolution',
            'content': f'ปัญหา "{symptom}" ได้รับการแก้ไขเรียบร้อยแล้ว',
            'outcome_kind': 'user_fixed',
        })

        nodes.append({
            'node_id': 'n_escalate',
            'type': 'escalation',
            'content': (
                f'ดำเนินการตามขั้นตอนในคู่มือครบทุกข้อแล้วแต่ยังไม่สามารถแก้ปัญหาได้ '
                f'แนะนำให้ติดต่อศูนย์บริการ {brand} '
                f'พร้อมแจ้งรุ่นเครื่อง อาการที่พบ และขั้นตอนที่ได้ลองทำไปแล้ว'
            ),
            'outcome_kind': 'handoff_unknown',
        })

    # --- โหนดสำหรับกรณีอาการไม่ตรงกับคู่มือ (มีทุกกราฟ) ---
    nodes.append({
        'node_id': 'n_escalate_mismatch',
        'type': 'escalation',
        'content': (
            f'อาการที่พบไม่ตรงกับหัวข้อนี้ในคู่มือ '
            f'แนะนำให้ตรวจสอบอาการอีกครั้ง หรือติดต่อศูนย์บริการ {brand} '
            f'พร้อมอธิบายอาการที่พบโดยละเอียด'
        ),
        'outcome_kind': 'handoff_unknown',
    })

    # --- ตรวจสอบทันทีว่าเส้นเชื่อมทุกเส้นชี้ไปยังโหนดที่มีอยู่จริง ---
    # ตรวจตรงนี้เพื่อให้บั๊กในตัวสร้างกราฟปรากฏทันที ไม่ไหลไปถึงไฟล์ผลลัพธ์
    node_ids = {n['node_id'] for n in nodes}
    for n in nodes:
        for key in ('on_yes', 'on_no', 'next', 'on_invalid'):
            target = n.get(key)
            if target is not None and target not in node_ids:
                raise ValueError(
                    f"กราฟของอาการ '{symptom}': โหนด {n['node_id']} "
                    f"มี {key} ชี้ไปยัง '{target}' ซึ่งไม่มีอยู่จริง"
                )

    page = chunk.get('page')
    page_range = [page, page] if isinstance(page, int) else None

    graph_notes = []
    if used_content_fallback:
        graph_notes.append(
            'ข้อมูลต้นทางไม่มีช่อง solution จึงใช้ข้อความจากช่อง content แทน '
            'ผู้พัฒนาควรตรวจสอบว่าควรแยกเป็นหลายขั้นตอนหรือไม่'
        )

    return {
        'schema_version': 2,
        'graph_id': f"{slugify(chunk.get('model', ''), 3)}_{slugify(symptom)}",
        'device_category': chunk.get('device_category'),
        'brand': chunk.get('brand'),
        'model_pattern': chunk.get('model'),
        'entry_symptom': symptom,
        'entry_symptom_th': '',   # ผู้พัฒนาต้องเติมคำแปลภาษาไทยเอง
        'source': chunk.get('source'),
        'page_range': page_range,
        'source_chunk_id': chunk.get('chunk_id'),
        'severity': meta.get('severity'),
        'difficulty': meta.get('difficulty'),
        'possible_cause': meta.get('possible_cause'),
        'generated_by': 'convert_chunks_to_graphs.py',
        'review_status': 'pending_manual_review',
        'conversion_notes': graph_notes,
        'entry_node': 'n1',
        'nodes': nodes,
    }


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def convert_file(input_path: Path, output_path: Path) -> dict:
    chunks = json.loads(input_path.read_text(encoding='utf-8'))
    if not isinstance(chunks, list) or not chunks:
        sys.exit(f'ไฟล์ {input_path.name} ไม่ใช่รายการ chunk ที่ถูกต้อง')

    first = chunks[0]
    brand = first.get('brand', 'ผู้ผลิต')

    graphs = [build_graph(c, brand) for c in chunks]

    manual = {
        'schema_version': 2,
        'manual_id': slugify(f"{first.get('brand','')} {first.get('model','')}", 4),
        'device_category': first.get('device_category'),
        'brand': brand,
        'model_pattern': first.get('model'),
        'source_manual': first.get('source'),
        'generated_by': 'convert_chunks_to_graphs.py',
        'review_status': 'pending_manual_review',
        'count': len(graphs),
        'graphs': graphs,
    }

    output_path.write_text(
        json.dumps(manual, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )

    # สรุปสถิติ
    type_counts: dict[str, int] = {}
    safety_nodes = 0
    for g in graphs:
        for n in g['nodes']:
            type_counts[n['type']] = type_counts.get(n['type'], 0) + 1
            if n.get('safety_critical'):
                safety_nodes += 1

    return {
        'manual_id': manual['manual_id'],
        'graphs': len(graphs),
        'nodes': sum(len(g['nodes']) for g in graphs),
        'types': type_counts,
        'safety_nodes': safety_nodes,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description='แปลง flat chunks เป็นกราฟการแก้ปัญหา schema v2'
    )
    parser.add_argument('input', help='ไฟล์ JSON ต้นทาง')
    parser.add_argument('output', help='ไฟล์ JSON ปลายทาง')
    args = parser.parse_args()

    stats = convert_file(Path(args.input), Path(args.output))

    print(f"[{stats['manual_id']}]")
    print(f"  กราฟ: {stats['graphs']}  โหนด: {stats['nodes']}")
    print(f"  โหนดที่มีด่านความปลอดภัย: {stats['safety_nodes']}")
    for t, c in sorted(stats['types'].items(), key=lambda x: -x[1]):
        print(f"    {t}: {c}")


if __name__ == '__main__':
    main()