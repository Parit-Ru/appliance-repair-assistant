/*
 * study-measure.js — วัดพฤติกรรมของโค้ดจริงเพื่อประกอบ docs/STUDY_GUIDE.md ส่วนที่ 3 (รันซ้ำได้ตอนสอบ)
 *
 * ใช้โค้ดที่ build แล้วใน backend/dist กับข้อมูลใน data/manuals/*.json (ต้นทางของ seed)
 *   - ไม่ต่อฐานข้อมูล · ไม่อ่าน .env · ไม่เรียกอินเทอร์เน็ต · ไม่เพิ่ม dependency
 *   - ตัวเลขที่ได้จึงมาจากไฟล์ผัง ไม่ใช่ DB สด (ผังที่ admin publish ทีหลังจะไม่อยู่ในนี้)
 *
 * เตรียม:  cd backend && npm run build        (ต้องมีโฟลเดอร์ dist/)
 *
 * วิธีรัน (จากโฟลเดอร์ backend):
 *   node scripts/study-measure.js search [--out ไฟล์.json] [คำค้น[@manualId] ...]
 *       คำนวณคะแนน cosine ด้วยโมเดล embedding จริง (ใช้เวลา ~1 นาที ส่วนใหญ่คือการแปลง ~2,000 ข้อความ)
 *       ไม่ใส่คำค้น = ใช้ชุดตัวอย่างในส่วนที่ 3 · ใส่ @manualId เพื่อกรองรุ่น เช่น  "ไมโครเวฟไม่ร้อน@samsung_ge83mdt_um_de68_04111e"
 *   node scripts/study-measure.js guard [--out ไฟล์.json]
 *       ลองส่งข้อความที่ "LLM อาจตอบ" 7 แบบ (ตัวอย่างที่แต่งขึ้นเพื่อทดสอบ) ผ่าน checkRephrase จริง
 *   node scripts/study-measure.js engine [--out ไฟล์.json]
 *       เดินผัง samsung_ge83mdt_um_not_cooked_at_all ด้วย state-machine จริง รวมกรณีที่ถูกปฏิเสธ
 *
 * หมายเหตุ Windows: คอนโซลอาจแสดงภาษาไทยเพี้ยน ให้ใส่ --out แล้วเปิดไฟล์ผลลัพธ์ (UTF-8) แทน
 */

const fs = require('fs');
const path = require('path');

const BACKEND = path.resolve(__dirname, '..');
const DIST = path.join(BACKEND, 'dist');
const MANUALS_DIR = path.resolve(BACKEND, '..', 'data', 'manuals');

const DEFAULT_MANUAL = 'samsung_ge83mdt_um_de68_04111e';
const DEFAULT_QUERIES = [
  ['ไมโครเวฟไม่ร้อน', DEFAULT_MANUAL],
  ['ไมโครเวฟไม่ร้อน', null],
  ['อาหารไม่สุก', DEFAULT_MANUAL],
  ['กดปุ่มแล้วเครื่องไม่ทำงาน', DEFAULT_MANUAL],
  ['ตู้เย็นไม่เย็น', null],
  ['วันนี้ฝนตก', DEFAULT_MANUAL],
];

// ค่าที่ระบบใช้จริงอยู่ใน symptom-search.service.ts (MATCH_THRESHOLD, MAX_RESULTS) — ไม่ได้ export จึงระบุซ้ำที่นี่
// ถ้าแก้ค่าในระบบต้องแก้ที่นี่ด้วย
const MATCH_THRESHOLD = 0.55;
const MAX_RESULTS = 3;

function requireDist(rel) {
  const file = path.join(DIST, rel);
  if (!fs.existsSync(file)) {
    console.error(`ไม่พบ ${file}\nต้อง build ก่อน: cd backend && npm run build`);
    process.exit(2);
  }
  return require(file);
}

function loadManuals() {
  return fs
    .readdirSync(MANUALS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(MANUALS_DIR, f), 'utf8')));
}

function parseArgs(argv) {
  const rest = [];
  let out;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') out = argv[(i += 1)];
    else rest.push(argv[i]);
  }
  return { rest, out };
}

function emit(text, out) {
  if (out) {
    fs.writeFileSync(out, text, 'utf8');
    console.log(`เขียนผลลง ${out}`);
  } else {
    console.log(text);
  }
}

// ---------------------------------------------------------------- search
async function runSearch(queryArgs, out) {
  const { EmbeddingService } = requireDist('embedding/embedding.service.js');
  const matcher = requireDist('symptom-search/symptom-matcher.js');

  const flows = [];
  for (const manual of loadManuals()) {
    for (const g of manual.flows) {
      flows.push({
        flow_id: g.flow_id,
        manual_id: manual.manual_id,
        entry_symptom: g.entry_symptom,
        entry_symptom_th: g.entry_symptom_th,
        entry_symptom_aliases: g.entry_symptom_aliases,
      });
    }
  }
  const manualOf = new Map(flows.map((g) => [g.flow_id, g.manual_id]));
  const nameOf = new Map(flows.map((g) => [g.flow_id, g.entry_symptom]));

  const embedding = new EmbeddingService();
  const t0 = Date.now();
  await embedding.load();
  const loadMs = Date.now() - t0;

  const texts = matcher.buildSymptomTexts(flows);
  const cache = new Map();
  const index = [];
  const t1 = Date.now();
  for (const item of texts) {
    let vector = cache.get(item.text);
    if (vector === undefined) {
      vector = await embedding.embed(item.text);
      cache.set(item.text, vector);
    }
    index.push({ ...item, vector });
  }
  const embedMs = Date.now() - t1;

  const queries = queryArgs.length > 0
    ? queryArgs.map((arg) => {
        const at = arg.lastIndexOf('@');
        return at > 0 ? [arg.slice(0, at), arg.slice(at + 1)] : [arg, null];
      })
    : DEFAULT_QUERIES;

  const sample = await embedding.embed('ตัวอย่าง');
  const results = [];
  for (const [query, manualId] of queries) {
    const vector = await embedding.embed(query);
    const candidates = manualId ? index.filter((i) => manualOf.get(i.flowId) === manualId) : index;
    const ranked = matcher.rankFlows(vector, candidates);
    results.push({
      query,
      manualId,
      candidateTexts: candidates.length,
      flowsPassingThreshold: ranked.filter((r) => r.score >= MATCH_THRESHOLD).length,
      returned: matcher.selectMatches(ranked, MATCH_THRESHOLD, MAX_RESULTS).map((r) => r.flowId),
      top5: ranked.slice(0, 5).map((r) => ({
        flowId: r.flowId,
        score: Math.round(r.score * 1000) / 1000,
        matchedText: r.matchedText,
        entrySymptom: String(nameOf.get(r.flowId)).slice(0, 60),
      })),
    });
  }

  emit(
    JSON.stringify(
      {
        note: 'คำนวณจาก data/manuals (ไม่ใช่ DB สด) ด้วยโค้ดใน backend/dist',
        threshold: MATCH_THRESHOLD,
        maxResults: MAX_RESULTS,
        vectorDimension: sample.length,
        flows: flows.length,
        symptomTexts: texts.length,
        uniqueTexts: cache.size,
        loadModelMs: loadMs,
        embedAllMs: embedMs,
        results,
      },
      null,
      2,
    ),
    out,
  );
}

// ---------------------------------------------------------------- guard
function runGuard(out) {
  const { checkRephrase } = requireDist('rephrase/rephrase-guard.js');
  const cases = [
    {
      label: 'เรียบเรียงปกติ',
      original: 'ตรวจสอบว่าตั้งเวลาทำอาหาร 10 นาที และกดปุ่ม Start แล้ว ถ้าไม่ร้อนให้ลองใหม่',
      candidate: 'เช็กว่าตั้งเวลาอาหารไว้ 10 นาที แล้วกดปุ่ม Start หรือยัง หากไม่ร้อนให้ลองอีกครั้ง',
    },
    {
      label: 'เปลี่ยนตัวเลข 10 → 20',
      original: 'ตรวจสอบว่าตั้งเวลาทำอาหาร 10 นาที และกดปุ่ม Start แล้ว ถ้าไม่ร้อนให้ลองใหม่',
      candidate: 'ตรวจสอบว่าตั้งเวลาทำอาหาร 20 นาที และกดปุ่ม Start แล้ว ถ้าไม่ร้อนให้ลองใหม่',
    },
    {
      label: 'ตัดคำว่า "ไม่" ออก',
      original: 'ตรวจสอบว่าตั้งเวลาทำอาหาร 10 นาที และกดปุ่ม Start แล้ว ถ้าไม่ร้อนให้ลองใหม่',
      candidate: 'ตรวจสอบว่าตั้งเวลาทำอาหาร 10 นาที และกดปุ่ม Start แล้ว ถ้าร้อนให้ลองใหม่',
    },
    {
      label: 'เติมคำอังกฤษ Grill',
      original: 'ตรวจสอบว่าตั้งเวลาทำอาหาร 10 นาที และกดปุ่ม Start แล้ว ถ้าไม่ร้อนให้ลองใหม่',
      candidate: 'ตรวจสอบว่าตั้งเวลาทำอาหาร 10 นาที และกดปุ่ม Start แล้ว ถ้าไม่ร้อนให้ลองโหมด Grill ใหม่',
    },
    {
      label: 'สั้นเกินไป',
      original: 'ตรวจสอบว่าตั้งเวลาทำอาหาร 10 นาที และกดปุ่ม Start แล้ว ถ้าไม่ร้อนให้ลองใหม่',
      candidate: 'ตั้งเวลา 10 นาที Start',
    },
    {
      label: 'ใส่ลิงก์',
      original: 'ตรวจสอบว่าตั้งเวลาทำอาหาร 10 นาที และกดปุ่ม Start แล้ว ถ้าไม่ร้อนให้ลองใหม่',
      candidate: 'ตรวจสอบว่าตั้งเวลาทำอาหาร 10 นาที และกดปุ่ม Start แล้ว ถ้าไม่ร้อนดู www.samsung.com',
    },
    {
      /** ช่องโหว่ที่ทราบ: กลับความหมายด้วยคำกริยา guard ไม่เห็น */
      label: 'สลับคำกริยา ถอด → เสียบ (คาดว่าผ่าน = ช่องโหว่)',
      original: 'ให้ถอดปลั๊กออกจากเต้ารับก่อนทำความสะอาดเตา',
      candidate: 'ให้เสียบปลั๊กเข้ากับเต้ารับก่อนทำความสะอาดเตา',
    },
  ];
  const rows = cases.map((c) => ({
    label: c.label,
    verdict: checkRephrase(c.original, c.candidate),
    lengthRatio: Math.round((c.candidate.length / c.original.length) * 100) / 100,
  }));
  emit(JSON.stringify(rows, null, 2), out);
}

// ---------------------------------------------------------------- engine
function runEngine(out) {
  const engine = requireDist('state-machine/state-machine.js');
  const manual = loadManuals().find((m) => m.manual_id === DEFAULT_MANUAL);
  const source = manual.flows.find((g) => g.flow_id.endsWith('not_cooked_at_all'));
  const flow = {
    ...source,
    manual_id: manual.manual_id,
    device_category: manual.device_category,
    brand: manual.brand ?? source.brand,
  };

  const log = [];
  const step = (label, fn) => {
    try {
      const r = fn();
      log.push({
        label,
        ok: true,
        state: r.state.stateId,
        type: r.state.type,
        isTerminal: r.state.isTerminal,
        outcomeKind: r.state.outcomeKind ?? null,
        requiresSafetyConfirmation: r.state.requiresSafetyConfirmation,
        status: r.session.status,
        historyLength: r.session.history.length,
      });
      return r;
    } catch (err) {
      log.push({ label, ok: false, error: err.constructor.name, message: err.message });
      return null;
    }
  };

  let s = step('เริ่ม', () => engine.startSession(flow, 0.95));
  s = step('n1: answer yes', () => engine.submitAction(s.session, flow, { type: 'answer', value: 'yes' }));
  step('n2: continue (ผิดชนิดกับ checkpoint)', () => engine.submitAction(s.session, flow, { type: 'continue' }));
  s = step('n2: answer no', () => engine.submitAction(s.session, flow, { type: 'answer', value: 'no' }));
  step('n2f (safety): continue', () => engine.submitAction(s.session, flow, { type: 'continue' }));
  step('n2f (safety): answer yes', () => engine.submitAction(s.session, flow, { type: 'answer', value: 'yes' }));
  s = step('n2f (safety): confirm_safety', () => engine.submitAction(s.session, flow, { type: 'confirm_safety' }));
  s = step('n2v: answer yes', () => engine.submitAction(s.session, flow, { type: 'answer', value: 'yes' }));
  step('หลังจบ: ส่ง action เพิ่ม', () => engine.submitAction(s.session, flow, { type: 'answer', value: 'yes' }));

  emit(JSON.stringify({ steps: log, history: s.session.history }, null, 2), out);
}

// ---------------------------------------------------------------- main
(async () => {
  const [command, ...argv] = process.argv.slice(2);
  const { rest, out } = parseArgs(argv);
  if (command === 'search') await runSearch(rest, out);
  else if (command === 'guard') runGuard(out);
  else if (command === 'engine') runEngine(out);
  else {
    console.error('วิธีใช้: node scripts/study-measure.js <search|guard|engine> [--out ไฟล์.json] ... (ดูคอมเมนต์หัวไฟล์)');
    process.exit(1);
  }
})().catch((err) => {
  console.error('ล้มเหลว:', err);
  process.exit(1);
});
