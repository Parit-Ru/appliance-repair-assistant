// backend/scripts/eval-symptom-search.js
//
// (พอร์ตจาก FixStep เข้า draft/ แล้ว: หารากโปรเจกต์เอง · EmbeddingService อยู่ที่ dist/embedding/ · เพิ่ม --eval-dir --manual)
// ขั้น 1.9.2 — วัดคุณภาพการค้นหาอาการด้วยชุดคำค้นใน data/eval/
// (ผู้เขียนแต่ละชุดดูที่ฟิลด์ "author" ในไฟล์ — ชุดตั้งเกณฑ์ร่างโดย AI ดู docs/explained/10)
//
// วิธีรัน (ยืนที่โฟลเดอร์ backend/ และต้อง build ก่อน 1 ครั้ง: npm run build):
//
//   node scripts/eval-symptom-search.js                     ชุดตั้งเกณฑ์: กวาดเกณฑ์หลายค่า ดูรายข้อที่พลาด
//   (ถ้ายังอยู่ใน draft/: node draft/code/backend/scripts/eval-symptom-search.js)
//   node scripts/eval-symptom-search.js --from 0.4 --to 0.8 --step 0.02
//   node scripts/eval-symptom-search.js --show 0.6          เลือกรายข้อที่พลาดที่เกณฑ์ 0.6 (ค่าเริ่มต้น 0.55)
//   node scripts/eval-symptom-search.js --set report --threshold 0.62
//                                                           ชุดรายงานผล: วัดที่เกณฑ์เดียวที่เลือกไว้แล้ว
//
// ใช้โค้ดชุดเดียวกับเซิร์ฟเวอร์จริง (จาก dist/): EmbeddingService, buildSymptomTexts,
// rankGraphs, selectMatches จึงวัดของจริง ไม่ใช่ตัวเลียนแบบ
// ต่างจากเซิร์ฟเวอร์ข้อเดียว: อ่านผังจากไฟล์ data/manuals/samsung_ac_ar70h.json โดยตรง
// (ข้อมูลเดียวกับที่ npm run seed นำเข้า MySQL) จึงไม่ต้องต่อฐานข้อมูล
//
// ⚠️ กติกาชุดรายงานผล (บังคับด้วยโค้ด):
//   - ต้องเป็น status "frozen" และผ่านตัวตรวจแบบ --strict ทั้งสองชุด
//   - ต้องระบุ --threshold เอง (เลือกจากชุดตั้งเกณฑ์เท่านั้น) ไม่มีการกวาดเกณฑ์บนชุดนี้
//   - ทุกครั้งที่รันจะบันทึกลง data/eval/report_runs.jsonl (จำนวนครั้งที่รันเป็นหลักฐานตรวจสอบได้)
//   - ห้ามนำรายข้อที่พลาดในชุดนี้ไปแก้ระบบ ถ้าแก้ ชุดนี้ใช้รายงานผลไม่ได้อีก

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

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
require(path.join(ROOT, 'backend', 'node_modules', 'reflect-metadata'));

// ------------------------------------------------------------
// อ่านพารามิเตอร์
// ------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback;
};

const SET = opt('set', 'tuning');
const DIST = path.resolve(opt('dist', path.join(ROOT, 'backend', 'dist')));
const MAX_RESULTS = Number(opt('max', 3)); // ต้องตรงกับ MAX_RESULTS ใน symptom-search.service.ts
const FROM = Number(opt('from', 0.3));
const TO = Number(opt('to', 0.9));
const STEP = Number(opt('step', 0.05));
const JSON_OUT = opt('json', null);
const THRESHOLD = opt('threshold', null);
const SHOW = opt('show', '0.55'); // เกณฑ์ที่ใช้เลือก "รายข้อที่ต้องดู" ในชุดตั้งเกณฑ์ (ตรง MATCH_THRESHOLD)

// ชุดคำค้นอยู่ที่ data/eval/ (หลังย้ายออกจาก draft) ถ้ายังไม่ย้ายใช้ draft/data/eval/ ; ระบุเองได้ด้วย --eval-dir
const EVAL_DIR = path.resolve(
  opt('eval-dir', fs.existsSync(path.join(ROOT, 'data', 'eval')) ? path.join(ROOT, 'data', 'eval') : path.join(ROOT, 'draft', 'data', 'eval')),
);
const MANUAL_FILE = path.resolve(opt('manual', path.join(ROOT, 'data', 'manuals', 'samsung_ac_ar70h.json')));
const VALIDATOR = path.resolve(__dirname, 'validate-eval-queries.js');
const RUN_LOG = path.join(EVAL_DIR, 'report_runs.jsonl');

function die(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

if (!['tuning', 'report'].includes(SET)) die('--set ต้องเป็น tuning หรือ report');
if (SET === 'report' && THRESHOLD === null) {
  die('ชุดรายงานผลต้องระบุ --threshold เอง (เลือกจากชุดตั้งเกณฑ์) จะไม่กวาดเกณฑ์บนชุดนี้');
}
if (THRESHOLD !== null && !(Number(THRESHOLD) > 0 && Number(THRESHOLD) <= 1)) {
  die('--threshold ต้องเป็นตัวเลขมากกว่า 0 และไม่เกิน 1');
}
if (!fs.existsSync(path.join(DIST, 'embedding', 'embedding.service.js'))) {
  die(`ไม่พบโค้ดที่ build แล้วที่ ${DIST}\nรัน npm run build ที่โฟลเดอร์ backend/ ก่อน`);
}

// ------------------------------------------------------------
// ตรวจไฟล์คำค้นก่อน (ใช้ตัวตรวจเดิม)
// ------------------------------------------------------------
{
  const args = SET === 'report' ? [VALIDATOR, '--strict', '--eval-dir', EVAL_DIR] : [VALIDATOR, '--eval-dir', EVAL_DIR];
  const r = spawnSync(process.execPath, args, { encoding: 'utf-8' });
  if (r.status !== 0) {
    console.log(r.stdout);
    die(
      SET === 'report'
        ? 'ชุดคำค้นยังไม่ผ่านตัวตรวจแบบ --strict (ต้องไม่มีทั้งข้อผิดพลาดและคำเตือน)'
        : 'ชุดคำค้นยังมีข้อผิดพลาด แก้ให้ผ่านตัวตรวจก่อน',
    );
  }
}

const file = JSON.parse(fs.readFileSync(path.join(EVAL_DIR, `queries_${SET}.json`), 'utf-8'));
if (SET === 'report' && file.status !== 'frozen') {
  die('ชุดรายงานผลต้องมี "status": "frozen" ก่อนวัด');
}
if (file.queries.length === 0) die(`queries_${SET}.json ยังไม่มีคำค้น`);

// ------------------------------------------------------------
// โหลดของจริงจาก dist/
// ------------------------------------------------------------
// โปรเจกต์นี้ย้าย EmbeddingService ไป src/embedding/ (ต้นแบบอยู่ใน symptom-search/)
const { EmbeddingService } = require(path.join(DIST, 'embedding', 'embedding.service.js'));
const { buildSymptomTexts, rankGraphs, selectMatches } = require(
  path.join(DIST, 'symptom-search', 'symptom-matcher.js'),
);

const shortId = (id) => (id ? id.replace('samsung_ac_ar70h_', '') : '-');
const f3 = (n) => n.toFixed(3);
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

async function main() {
  const manual = JSON.parse(fs.readFileSync(MANUAL_FILE, 'utf-8'));

  const embedding = new EmbeddingService();
  await embedding.load();

  // สร้างดัชนีแบบเดียวกับ SymptomSearchService.prepareIndex
  const index = [];
  for (const item of buildSymptomTexts(manual.graphs)) {
    index.push({ ...item, vector: await embedding.embed(item.text) });
  }
  console.log(`ดัชนี: ${index.length} ข้อความ จาก ${manual.graphs.length} ผัง`);
  console.log(`ชุดคำค้น: ${SET} · ${file.queries.length} ข้อ · ผู้เขียน: ${file.author || '(ไม่ระบุ)'}\n`);

  // จัดอันดับทุกคำค้น (ทั้ง 13 ผัง) ครั้งเดียว แล้วนำไปคิดทุกเกณฑ์
  const results = [];
  for (const q of file.queries) {
    const ranked = rankGraphs(await embedding.embed(q.query.trim()), index);
    const rankOfExpected = q.expected_graph_id
      ? ranked.findIndex((r) => r.graphId === q.expected_graph_id) + 1
      : null;
    results.push({
      q,
      ranked,
      best: ranked[0].score,
      margin: ranked.length > 1 ? ranked[0].score - ranked[1].score : ranked[0].score,
      rankOfExpected,
    });
  }

  const inScope = results.filter((r) => r.q.category === 'in_scope');
  const outScope = results.filter((r) => r.q.category === 'out_of_scope');

  // ----------------------------------------------------------
  // ผลที่ไม่ขึ้นกับเกณฑ์
  // ----------------------------------------------------------
  const top1 = inScope.filter((r) => r.rankOfExpected === 1);
  const top3 = inScope.filter((r) => r.rankOfExpected > 0 && r.rankOfExpected <= MAX_RESULTS);

  console.log('=== ผลที่ไม่ขึ้นกับเกณฑ์ (ในขอบเขต) ===');
  console.log(`  ผังที่ถูกอยู่อันดับ 1        : ${top1.length}/${inScope.length}`);
  console.log(`  ผังที่ถูกอยู่ใน ${MAX_RESULTS} อันดับแรก : ${top3.length}/${inScope.length}`);

  const byStyle = {};
  for (const r of inScope) {
    const s = (byStyle[r.q.style] ??= { n: 0, t1: 0, t3: 0 });
    s.n++;
    if (r.rankOfExpected === 1) s.t1++;
    if (r.rankOfExpected > 0 && r.rankOfExpected <= MAX_RESULTS) s.t3++;
  }
  console.log('  แยกตามลักษณะ (อันดับ 1 / ใน 3 อันดับ):');
  for (const [k, s] of Object.entries(byStyle)) console.log(`    ${pad(k, 16)} ${s.t1}/${s.n}  ·  ${s.t3}/${s.n}`);

  const sortedNum = (a) => [...a].sort((x, y) => x - y);
  const outBest = sortedNum(outScope.map((r) => r.best));
  const inCorrectBest = sortedNum(top1.map((r) => r.best));
  console.log('\n=== การกระจายคะแนนสูงสุด (ช่วยดูว่าเกณฑ์แยกสองกลุ่มได้ไหม) ===');
  if (outBest.length) console.log(`  นอกขอบเขต          : ต่ำสุด ${f3(outBest[0])} · สูงสุด ${f3(outBest[outBest.length - 1])}  (n=${outBest.length})`);
  if (inCorrectBest.length) console.log(`  ในขอบเขต (ผังถูก อันดับ 1): ต่ำสุด ${f3(inCorrectBest[0])} · สูงสุด ${f3(inCorrectBest[inCorrectBest.length - 1])}  (n=${inCorrectBest.length})`);
  if (outBest.length && inCorrectBest.length && outBest[outBest.length - 1] >= inCorrectBest[0]) {
    console.log('  ⚠️  สองช่วงซ้อนทับกัน: ไม่มีเกณฑ์เดียวที่แยกได้หมด (ดูตารางกวาดเกณฑ์ด้านล่าง)');
  }

  const byKind = {};
  for (const r of outScope) {
    const s = (byKind[r.q.kind] ??= []);
    s.push(r.best);
  }
  if (Object.keys(byKind).length) {
    console.log('  นอกขอบเขต แยกตามชนิด (คะแนนสูงสุดของแต่ละชนิด):');
    for (const [k, v] of Object.entries(byKind)) console.log(`    ${pad(k, 18)} สูงสุด ${f3(Math.max(...v))}  (n=${v.length})`);
  }

  // ----------------------------------------------------------
  // เกณฑ์: กวาด (ชุดตั้งเกณฑ์) หรือค่าเดียว (ชุดรายงานผล)
  // ----------------------------------------------------------
  const at = (t) => {
    const matchesOf = (r) => selectMatches(r.ranked, t, MAX_RESULTS);
    const accepted = inScope.filter((r) => matchesOf(r).length > 0);
    return {
      t,
      inN: inScope.length,
      accepted: accepted.length,
      wrongRejected: inScope.length - accepted.length,
      top1Ok: accepted.filter((r) => r.rankOfExpected === 1).length,
      hit3Ok: inScope.filter((r) => matchesOf(r).some((m) => m.graphId === r.q.expected_graph_id)).length,
      outN: outScope.length,
      outRejected: outScope.filter((r) => matchesOf(r).length === 0).length,
    };
  };

  let thresholds;
  if (THRESHOLD !== null) thresholds = [Number(THRESHOLD)];
  else {
    thresholds = [];
    for (let t = FROM; t <= TO + 1e-9; t += STEP) thresholds.push(Math.round(t * 1000) / 1000);
  }
  const rows = thresholds.map(at);

  console.log(`\n=== ${THRESHOLD !== null ? `ผลที่เกณฑ์ ${THRESHOLD}` : 'ตารางกวาดเกณฑ์'} ===`);
  console.log('  "ในขอบเขต":  ผ่านเกณฑ์ = มีผังส่งให้ผู้ใช้เลือก · ถูกปฏิเสธ = ระบบส่งต่อศูนย์บริการทั้งที่ควรมีผัง');
  console.log('  "นอกขอบเขต": ปฏิเสธถูก = ไม่มีผังผ่านเกณฑ์ (ต้องการแบบนี้)\n');
  console.log(
    `  ${pad('เกณฑ์', 7)}| ${pad('ในขอบเขต ผ่านเกณฑ์', 20)}${pad('ถูกปฏิเสธ', 11)}${pad('ผังถูกอันดับ1(ในที่ผ่าน)', 25)}${pad(`ผังถูกใน${MAX_RESULTS}อันดับ`, 16)}| ${pad('นอกขอบเขต ปฏิเสธถูก', 20)}`,
  );
  for (const x of rows) {
    console.log(
      `  ${pad(x.t.toFixed(2), 7)}| ${pad(`${x.accepted}/${x.inN}`, 20)}${pad(`${x.wrongRejected}/${x.inN}`, 11)}${pad(`${x.top1Ok}/${x.accepted}`, 25)}${pad(`${x.hit3Ok}/${x.inN}`, 16)}| ${pad(`${x.outRejected}/${x.outN}`, 20)}`,
    );
  }

  if (THRESHOLD === null && outScope.length && inScope.length) {
    const cleanOut = rows.filter((x) => x.outRejected === x.outN);
    if (cleanOut.length) {
      const x = cleanOut[0];
      console.log(
        `\n  เกณฑ์ต่ำสุดที่ไม่มีคำค้นนอกขอบเขตหลุดผ่านเลย (ในกริดนี้): ${x.t.toFixed(2)} — ในขอบเขตถูกปฏิเสธ ${x.wrongRejected}/${x.inN} ข้อ`,
      );
    } else {
      console.log('\n  ไม่มีเกณฑ์ใดในกริดนี้ที่ปฏิเสธคำค้นนอกขอบเขตได้ครบทุกข้อ');
    }
    console.log('  (ตัวเลขนี้มาจากชุดตั้งเกณฑ์เล็กๆ เป็นแนวทางเลือกเกณฑ์ ไม่ใช่ผลรายงาน)');
  }

  // ----------------------------------------------------------
  // รายข้อที่พลาด
  // ----------------------------------------------------------
  const showT = THRESHOLD !== null ? Number(THRESHOLD) : Number(SHOW);
  console.log(`\n=== รายข้อที่ต้องดู (เกณฑ์อ้างอิง ${showT.toFixed(2)}) ===`);

  const line = (r) => r.ranked.slice(0, MAX_RESULTS).map((m) => `${shortId(m.graphId)}:${f3(m.score)}`).join('  ');

  const wrongTop = inScope.filter((r) => r.rankOfExpected !== 1);
  console.log(`\n  ในขอบเขต ที่ผังถูกไม่ได้อยู่อันดับ 1 (${wrongTop.length} ข้อ)`);
  for (const r of wrongTop) {
    console.log(`    [${r.q.id}] "${r.q.query}"`);
    console.log(`        คาดหวัง ${shortId(r.q.expected_graph_id)} (อยู่อันดับ ${r.rankOfExpected}) · ห่างระหว่างอันดับ 1 กับ 2 = ${f3(r.margin)}`);
    console.log(`        ได้: ${line(r)}`);
  }

  const wrongRej = inScope.filter((r) => r.best < showT);
  console.log(`\n  ในขอบเขต ที่ถูกปฏิเสธ เพราะคะแนนสูงสุดต่ำกว่าเกณฑ์ (${wrongRej.length} ข้อ)`);
  for (const r of wrongRej) console.log(`    [${r.q.id}] "${r.q.query}"  → สูงสุด ${f3(r.best)} (${shortId(r.ranked[0].graphId)})`);

  const falseAcc = outScope.filter((r) => r.best >= showT);
  console.log(`\n  นอกขอบเขต ที่หลุดผ่านเกณฑ์ (${falseAcc.length} ข้อ)`);
  for (const r of falseAcc) console.log(`    [${r.q.id}] "${r.q.query}" (${r.q.kind})  → ${line(r)}`);

  // ----------------------------------------------------------
  // บันทึก
  // ----------------------------------------------------------
  const summary = {
    set: SET,
    at: new Date().toISOString(),
    author: file.author,
    threshold: THRESHOLD !== null ? Number(THRESHOLD) : null,
    total: file.queries.length,
    inScope: inScope.length,
    outScope: outScope.length,
    top1: top1.length,
    top3: top3.length,
    rows,
  };
  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({ summary, results: results.map((r) => ({ id: r.q.id, best: r.best, rankOfExpected: r.rankOfExpected, top: r.ranked.slice(0, 3) })) }, null, 2));
    console.log(`\nบันทึกผลละเอียดที่ ${JSON_OUT}`);
  }
  if (SET === 'report') {
    fs.appendFileSync(RUN_LOG, JSON.stringify(summary) + '\n');
    const runs = fs.readFileSync(RUN_LOG, 'utf-8').trim().split('\n').length;
    console.log(`\n⚠️  บันทึกการรันชุดรายงานผลลง ${path.relative(process.cwd(), RUN_LOG)} (ครั้งที่ ${runs})`);
    console.log('   ห้ามนำรายข้อที่พลาดข้างบนไปแก้ระบบ ถ้าแก้ ชุดนี้ใช้รายงานผลไม่ได้อีก');
    console.log('   รายงานเป็น "ถูก x จาก n ข้อ" และระบุจำนวนครั้งที่รันชุดนี้');
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});