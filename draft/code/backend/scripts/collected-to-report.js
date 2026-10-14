// backend/scripts/collected-to-report.js  (ร่างใน draft/ — ย้ายไปไว้ที่ backend/scripts/ เมื่อพร้อมใช้)
//
// รวมคำตอบที่เก็บด้วย draft/tools/query-collector.html (ไฟล์ .txt หรือข้อความที่วางลงไฟล์) เป็นไฟล์ชุดรายงานผล "ฉบับร่าง"
// ที่ยังไม่มี label — ผู้พัฒนาต้องติด label เองทุกข้อ (ตามกติกา: ผู้ช่วย AI ไม่ติด label ชุดรายงานผล)
//
//   node scripts/collected-to-report.js คำตอบ-A.txt คำตอบ-B.txt ...
//   node scripts/collected-to-report.js *.txt --out data/eval/queries_report.json --author "เพื่อน 4 คน ผู้พัฒนาติด label"
//
// ผลลัพธ์: แต่ละข้อมี category / expected_graph_id / style เป็น "TODO" เพื่อให้ตัวตรวจ (validate-eval-queries.js)
//   ปฏิเสธจนกว่าผู้พัฒนาจะติด label ครบ — กันไม่ให้รันวัดผลทั้งที่ยังไม่ได้ติด label
// ฟิลด์ "source" (ใครเขียน/ข้อไหน) และ "hint" (ผู้ออกแบบฟอร์มตั้งใจให้เป็นแบบไหน) ไว้ช่วยตัดสินใจ ไม่ใช่เฉลย
//
// ไม่เขียนทับไฟล์ที่มีอยู่ ถ้าไม่ใส่ --force

const fs = require('node:fs');
const path = require('node:path');

function findRepoRoot(start) {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'data', 'manuals')) && fs.existsSync(path.join(dir, 'backend'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return process.cwd();
}
const ROOT = findRepoRoot(__dirname);

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes(`--${name}`);
const valueOptions = new Set(['--out', '--author']);
const files = argv.filter((a, i) => !a.startsWith('--') && !valueOptions.has(argv[i - 1]));

const evalDir = fs.existsSync(path.join(ROOT, 'data', 'eval')) ? path.join(ROOT, 'data', 'eval') : path.join(ROOT, 'draft', 'data', 'eval');
const OUT = path.resolve(opt('out', path.join(evalDir, 'queries_report.collected.json')));
const AUTHOR = opt('author', '');

if (files.length === 0) {
  console.error('ใช้: node scripts/collected-to-report.js <ไฟล์คำตอบ.txt ...> [--out path] [--author "…"] [--force]');
  process.exit(2);
}
if (fs.existsSync(OUT) && !flag('force')) {
  console.error(`มีไฟล์ ${OUT} อยู่แล้ว — ไม่เขียนทับ (ใส่ --force ถ้าแน่ใจ หรือระบุ --out อื่น)`);
  process.exit(2);
}

const HINTS = {
  '1.1': 'เขียนอิสระ: ปัญหาแอร์',
  '1.2': 'เขียนอิสระ: ปัญหาแอร์',
  '1.3': 'เขียนอิสระ: ปัญหาแอร์',
  '1.4': 'ผู้ตอบถูกขอให้ถามเรื่องเครื่องใช้ไฟฟ้าอย่างอื่น (มักเป็น other_appliance)',
  '1.5': 'ผู้ตอบถูกขอให้ถามเรื่องเครื่องใช้ไฟฟ้าอย่างอื่น (มักเป็น other_appliance)',
  '1.6': 'ผู้ตอบถูกขอให้ถามเรื่องแอร์ที่ต้องเรียกช่าง/ซื้อของ (มักเป็น ac_outside_manual)',
};
const normalize = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const seen = new Set();
const queries = [];
let skippedDup = 0;
let skippedBad = 0;
let n = 0;

for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim() || line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length < 3) { skippedBad++; continue; }
    const person = parts[0].trim();
    const code = parts[1].trim();
    const text = parts.slice(2).join(' ').replace(/\s+/g, ' ').trim();
    if (!/^[12]\.\d{1,2}$/.test(code) || text === '') { skippedBad++; continue; }
    const key = normalize(text);
    if (seen.has(key)) { skippedDup++; continue; }
    seen.add(key);
    n++;
    queries.push({
      id: `R${String(n).padStart(3, '0')}`,
      query: text,
      category: 'TODO',
      expected_graph_id: 'TODO',
      style: 'TODO',
      source: { person, item: code },
      hint: HINTS[code] ?? `การ์ดสถานการณ์ใบที่ ${code.split('.')[1]} (เขียนด้วยคำของผู้ตอบเอง)`,
    });
  }
}

const out = {
  set: 'report',
  author: AUTHOR,
  status: 'draft',
  queries,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');

const people = new Set(queries.map((q) => q.source.person));
console.log(`อ่านไฟล์ ${files.length} ไฟล์ → ${queries.length} ข้อ จาก ${people.size} คน`);
console.log(`  ข้ามเพราะซ้ำ ${skippedDup} · ข้ามเพราะรูปแบบไม่ถูก ${skippedBad}`);
console.log(`เขียน ${OUT}`);
console.log('\nขั้นต่อไป (ผู้พัฒนาทำเอง):');
console.log('  1. เปิดไฟล์นี้ แก้ category (in_scope/out_of_scope), expected_graph_id (รหัสผัง หรือ null), style/kind ทุกข้อ');
console.log('     โดยอิงคู่มือหน้า 43–44 — "อย่าดูผลค้นหาของระบบก่อนติด label"');
console.log('  2. ข้อนอกขอบเขตใช้ "kind" (other_appliance / ac_outside_manual / unrelated) แทน "style"; ลบฟิลด์ source/hint ได้ (ไม่บังคับ)');
console.log('  3. ตั้ง author ให้ตรงความจริง แล้วเปลี่ยนชื่อไฟล์เป็น data/eval/queries_report.json');
console.log('  4. node scripts/validate-eval-queries.js --strict → ต้องผ่านก่อน status: frozen');
