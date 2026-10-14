// backend/scripts/validate-eval-queries.js
//
// ขั้น 1.9.1 — ตรวจชุดคำค้น ก่อนนำไปวัดผลการค้นหาอาการ
// (ผู้เขียนแต่ละชุดดูที่ฟิลด์ "author" ในไฟล์ — ชุดตั้งเกณฑ์ร่างโดย AI ดู docs/explained/10)
//
// วิธีรัน (ยืนที่โฟลเดอร์ backend/):
//   node scripts/validate-eval-queries.js            ตรวจ + สรุปจำนวน
//   node scripts/validate-eval-queries.js --strict   ให้ "คำเตือน" ถือเป็นข้อผิดพลาดด้วย
//
// ตรวจอะไร:
//   ข้อผิดพลาด (ทำให้ล้ม)  รูปแบบไฟล์/ฟิลด์ผิด, id ซ้ำ, ผังที่คาดหวังไม่มีจริง,
//                          คำค้นซ้ำกัน (รวมข้ามสองชุด), คำค้นเหมือนข้อความตัวแทนของผัง "ทุกตัวอักษร"
//   คำเตือน                จำนวนน้อยเกินไป, ผังไหนมีคำค้นน้อยกว่า 2, คำค้นมีข้อความตัวแทนของผังทั้งก้อนอยู่ข้างใน
//
// ทำไมต้องห้ามซ้ำกับข้อความตัวแทน: ข้อความตัวแทนเป็นสิ่งที่อยู่ในดัชนีอยู่แล้ว
// คำค้นที่เหมือนกันทุกตัวอักษรจะได้คะแนน 1.0 เสมอ ทำให้ผลวัดดูดีเกินจริง
//
// สคริปต์นี้ไม่โหลดโมเดล ไม่ต่อฐานข้อมูล ไม่ต้องติดตั้งอะไรเพิ่ม

const fs = require('node:fs');
const path = require('node:path');

// หารากโปรเจกต์: โฟลเดอร์ที่มีทั้ง data/manuals และ backend (รันได้ทั้งจาก draft/ และ backend/scripts/)
function findRepoRoot(start) {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'data', 'manuals')) && fs.existsSync(path.join(dir, 'backend'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new Error('หารากโปรเจกต์ไม่เจอ (ต้องมีโฟลเดอร์ data/manuals และ backend)');
}
const ROOT = findRepoRoot(__dirname);
const argvDir = process.argv.indexOf('--eval-dir');
const EVAL_DIR = path.resolve(
  argvDir >= 0 ? process.argv[argvDir + 1] : fs.existsSync(path.join(ROOT, 'data', 'eval')) ? path.join(ROOT, 'data', 'eval') : path.join(ROOT, 'draft', 'data', 'eval'),
);
const MANUAL_FILE = path.join(ROOT, 'data', 'manuals', 'samsung_ac_ar70h.json');

const MAX_QUERY_LENGTH = 200; // ต้องตรงกับ symptom-search.dto.ts
const FILES = [
  { file: 'queries_tuning.json', set: 'tuning' },
  { file: 'queries_report.json', set: 'report' },
];

const CATEGORIES = ['in_scope', 'out_of_scope'];
const STYLES_IN = ['colloquial', 'formal', 'english', 'typo_or_abbrev', 'vague'];
const KINDS_OUT = ['other_appliance', 'ac_outside_manual', 'unrelated'];
const STATUSES = ['draft', 'frozen'];

// เกณฑ์ขั้นต่ำที่แนะนำต่อชุด (เป็นคำเตือน ไม่ใช่ข้อผิดพลาด)
const RECOMMENDED_TOTAL = 40;
const RECOMMENDED_PER_GRAPH = 2;
const RECOMMENDED_OUT_SHARE = 0.3;

const strict = process.argv.includes('--strict');

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const normalize = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------
// ข้อมูลอ้างอิงจากผังขั้นตอนจริง
// ------------------------------------------------------------
const manual = JSON.parse(fs.readFileSync(MANUAL_FILE, 'utf-8'));
const graphIds = new Set(manual.graphs.map((g) => g.graph_id));

// ข้อความตัวแทนที่อยู่ในดัชนี (ไทย → อังกฤษ → คำพ้อง) ตามที่ buildSymptomTexts สร้าง
const representative = new Map(); // ข้อความที่ทำให้เป็นมาตรฐานแล้ว → graph_id
for (const g of manual.graphs) {
  for (const t of [g.entry_symptom_th, g.entry_symptom, ...(g.entry_symptom_aliases ?? [])]) {
    if (typeof t === 'string' && t.trim() !== '') representative.set(normalize(t), g.graph_id);
  }
}

// ------------------------------------------------------------
// อ่านและตรวจแต่ละชุด
// ------------------------------------------------------------
const seenIds = new Map(); // id → "ชุด"
const seenQueries = new Map(); // คำค้นที่ทำให้เป็นมาตรฐานแล้ว → "ชุด/id"
const summaries = [];

for (const { file, set } of FILES) {
  const full = path.join(EVAL_DIR, file);
  if (!fs.existsSync(full)) {
    err(`${file}: ไม่พบไฟล์`);
    continue;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(full, 'utf-8'));
  } catch (e) {
    err(`${file}: JSON ผิดไวยากรณ์ — ${e.message}`);
    continue;
  }

  if (data.set !== set) err(`${file}: ฟิลด์ "set" ต้องเป็น "${set}" (พบ ${JSON.stringify(data.set)})`);
  if (typeof data.author !== 'string' || data.author.trim() === '') {
    warn(`${file}: ยังไม่ได้กรอก "author" (ชื่อผู้เขียนคำค้น — ต้องระบุตรงๆ ว่าใครเป็นคนเขียน)`);
  }
  if (!STATUSES.includes(data.status)) err(`${file}: "status" ต้องเป็น ${STATUSES.join(' หรือ ')}`);
  if (!Array.isArray(data.queries)) {
    err(`${file}: "queries" ต้องเป็นรายการ`);
    continue;
  }

  const perGraph = new Map([...graphIds].map((id) => [id, 0]));
  const perCategory = { in_scope: 0, out_of_scope: 0 };
  const perStyle = {};

  data.queries.forEach((q, i) => {
    const where = `${file} #${i + 1}${q && q.id ? ` (${q.id})` : ''}`;
    if (typeof q !== 'object' || q === null) return err(`${where}: ต้องเป็น object`);

    // id
    if (typeof q.id !== 'string' || q.id.trim() === '') err(`${where}: ต้องมี "id"`);
    else if (seenIds.has(q.id)) err(`${where}: id ซ้ำกับชุด ${seenIds.get(q.id)}`);
    else seenIds.set(q.id, set);

    // query
    if (typeof q.query !== 'string' || q.query.trim() === '') {
      err(`${where}: "query" ต้องเป็นข้อความที่ไม่ว่าง`);
    } else {
      if (q.query !== q.query.trim()) warn(`${where}: "query" มีช่องว่างหน้าหลัง (ระบบจะตัดให้ตอนค้นจริง)`);
      if (q.query.trim().length > MAX_QUERY_LENGTH) err(`${where}: "query" ยาวเกิน ${MAX_QUERY_LENGTH} ตัวอักษร`);

      const key = normalize(q.query);
      if (seenQueries.has(key)) err(`${where}: คำค้นซ้ำกับ ${seenQueries.get(key)}`);
      else seenQueries.set(key, `${set}/${q.id}`);

      if (representative.has(key)) {
        err(`${where}: คำค้นเหมือนข้อความตัวแทนของผัง "${representative.get(key)}" ทุกตัวอักษร (จะได้คะแนน 1.0 เสมอ ให้เขียนใหม่ด้วยภาษาของผู้ใช้)`);
      } else {
        for (const [rep, gid] of representative) {
          if (rep.length >= 6 && key.includes(rep)) {
            warn(`${where}: คำค้นมีข้อความตัวแทนของผัง "${gid}" อยู่ทั้งก้อน ("${rep}") ผลอาจดีเกินจริง`);
            break;
          }
        }
      }
    }

    // category / expected_graph_id / style-kind
    if (!CATEGORIES.includes(q.category)) {
      err(`${where}: "category" ต้องเป็น ${CATEGORIES.join(' หรือ ')}`);
      return;
    }
    perCategory[q.category]++;

    if (q.category === 'in_scope') {
      if (typeof q.expected_graph_id !== 'string' || !graphIds.has(q.expected_graph_id)) {
        err(`${where}: in_scope ต้องมี "expected_graph_id" ที่มีอยู่จริงในผังแอร์ (พบ ${JSON.stringify(q.expected_graph_id)})`);
      } else {
        perGraph.set(q.expected_graph_id, perGraph.get(q.expected_graph_id) + 1);
      }
      if (!STYLES_IN.includes(q.style)) err(`${where}: in_scope ต้องมี "style" เป็นหนึ่งใน ${STYLES_IN.join(', ')}`);
      else perStyle[q.style] = (perStyle[q.style] ?? 0) + 1;
    } else {
      if (q.expected_graph_id !== null) err(`${where}: out_of_scope ต้องมี "expected_graph_id": null`);
      if (!KINDS_OUT.includes(q.kind)) err(`${where}: out_of_scope ต้องมี "kind" เป็นหนึ่งใน ${KINDS_OUT.join(', ')}`);
      else perStyle[q.kind] = (perStyle[q.kind] ?? 0) + 1;
    }
  });

  // คำเตือนเรื่องจำนวน
  const total = data.queries.length;
  if (total < RECOMMENDED_TOTAL) warn(`${file}: มี ${total} ข้อ (แนะนำอย่างน้อย ${RECOMMENDED_TOTAL})`);
  if (total > 0 && perCategory.out_of_scope / total < RECOMMENDED_OUT_SHARE) {
    warn(`${file}: นอกขอบเขต ${perCategory.out_of_scope}/${total} (แนะนำอย่างน้อย ${Math.round(RECOMMENDED_OUT_SHARE * 100)}%)`);
  }
  for (const [id, n] of perGraph) {
    if (n < RECOMMENDED_PER_GRAPH) warn(`${file}: ผัง ${id.replace('samsung_ac_ar70h_', '')} มีคำค้น ${n} ข้อ (แนะนำอย่างน้อย ${RECOMMENDED_PER_GRAPH})`);
  }

  summaries.push({ file, status: data.status, total, perCategory, perStyle, perGraph });
}

// ------------------------------------------------------------
// สรุปผล
// ------------------------------------------------------------
console.log('ตรวจชุดคำค้นสำหรับวัดผลการค้นหาอาการ\n');
for (const s of summaries) {
  console.log(`${s.file}  (status: ${s.status})`);
  console.log(`  รวม ${s.total} ข้อ · ในขอบเขต ${s.perCategory.in_scope} · นอกขอบเขต ${s.perCategory.out_of_scope}`);
  const styles = Object.entries(s.perStyle).map(([k, v]) => `${k}=${v}`).join(', ');
  if (styles) console.log(`  ลักษณะ: ${styles}`);
  const graphs = [...s.perGraph].map(([id, n]) => `${id.replace('samsung_ac_ar70h_', '')}=${n}`).join(', ');
  console.log(`  ต่อผัง: ${graphs}\n`);
}

if (warnings.length > 0) {
  console.log(`คำเตือน ${warnings.length} รายการ${strict ? ' (โหมด --strict นับเป็นข้อผิดพลาด)' : ''}:`);
  warnings.forEach((w) => console.log(`  ⚠️  ${w}`));
  console.log('');
}
if (errors.length > 0) {
  console.log(`ข้อผิดพลาด ${errors.length} รายการ:`);
  errors.forEach((e) => console.log(`  ❌ ${e}`));
  console.log('');
}

const failed = errors.length > 0 || (strict && warnings.length > 0);
console.log(failed ? 'ผล: ยังไม่ผ่าน' : 'ผล: ผ่าน');
process.exit(failed ? 1 : 0);