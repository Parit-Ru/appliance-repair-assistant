// backend/scripts/validate-graphs.js  (ร่างใน draft/ — ย้ายไปไว้ที่ backend/scripts/ เมื่อพร้อมใช้)
//
// เครื่องมือตรวจสอบความถูกต้องของผังขั้นตอน (TOR §5 ผลที่คาดว่าจะได้ ข้อ 3: "เครื่องมือตรวจสอบความถูกต้อง")
// ใช้ตรวจ "ก่อน" นำเข้า MySQL (npm run seed) โดยเฉพาะตอนแปลงคู่มือใหม่ 4 ประเภท
//
//   node scripts/validate-graphs.js                       ตรวจทุกไฟล์ใน data/manuals/*.json
//   node scripts/validate-graphs.js path/to/manual.json   ตรวจไฟล์เดียว
//   node scripts/validate-graphs.js --strict              คำเตือน (WARN) นับเป็นข้อผิดพลาดด้วย
//   node scripts/validate-graphs.js --equipment           ตรวจ data/equipment/equipment.json ด้วย
//   node scripts/validate-graphs.js --json                พิมพ์ผลเป็น JSON
//   node scripts/validate-graphs.js --self-test           ทดสอบตัวตรวจเอง (ใส่ข้อผิดพลาดจงใจแล้วดูว่าจับได้)
//
// รหัสออก: 0 = ผ่าน · 1 = พบข้อผิดพลาด (หรือ WARN เมื่อใช้ --strict) · 2 = ใช้งานผิด/อ่านไฟล์ไม่ได้
//
// ไม่ต้องติดตั้งอะไรเพิ่ม (ถ้ามี ajv ในโปรเจกต์ จะตรวจ JSON Schema v2 เพิ่มให้อัตโนมัติ)
//
// ⚠️ เครื่องมือนี้ตรวจ "โครงสร้างและความสอดคล้อง" เท่านั้น ไม่ได้ตรวจว่าเนื้อหาตรงกับคู่มือจริง
//    การเทียบกับคู่มือต้องให้ผู้พัฒนาตรวจด้วยมือ (TOR ข้อ 2: "ผู้พัฒนาตรวจสอบความถูกต้อง")

const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------- ตำแหน่งโปรเจกต์
function findRepoRoot(start) {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'data', 'manuals')) && fs.existsSync(path.join(dir, 'backend'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}
const ROOT = findRepoRoot(__dirname);

// ---------------------------------------------------------------- ค่าคงที่ของโมเดลข้อมูล (ตรง backend/src/traversal-engine/types.ts)
const NODE_TYPES = ['checkpoint', 'instruction', 'input', 'resolution', 'escalation'];
const TERMINAL_TYPES = ['resolution', 'escalation'];
const OUTCOME_KINDS = ['user_fixed', 'normal_behavior', 'handoff_informed', 'handoff_unknown'];
const INPUT_TYPES = ['error_code', 'model_number', 'number', 'text'];
const SEVERITIES = ['low', 'medium', 'high'];
/** ประเภทเครื่องตาม TOR §3 ข้อ 1 + แอร์ (ชุดข้อมูลต้นแบบ ไม่อยู่ใน 4 ประเภทเป้าหมาย) */
const TOR_CATEGORIES = ['Microwave', 'Refrigerator', 'Television', 'Washing Machine'];
const KNOWN_CATEGORIES = [...TOR_CATEGORIES, 'Air Conditioner'];
/** คำที่บ่งว่าขั้นตอนเกี่ยวกับไฟฟ้า/ความร้อน/แรงดัน — ใช้เตือนเท่านั้น ไม่ใช่ตัวตัดสิน */
const SAFETY_HINTS = [
  'เบรกเกอร์', 'ปลั๊ก', 'ถอดปลั๊ก', 'ไฟฟ้า', 'กระแสไฟ', 'ไฟช็อต', 'ไฟดูด', 'แรงดัน', 'ถอดฝา', 'เปิดฝา', 'ถอดแผ่นหลัง', 'ถอดแผงครอบ',
  'ร้อนจัด', 'ร้อนมาก', 'ความร้อนสูง', 'ผิวร้อน', 'น้ำร้อน', 'ไอน้ำ', 'แก๊ส', 'น้ำยาทำความเย็น', 'คอมเพรสเซอร์', 'ตัวเก็บประจุ',
  'แมกนีตรอน', 'สายไฟ', 'ขั้วต่อ', 'breaker', 'high voltage', 'capacitor', 'magnetron', 'refrigerant',
];
const PLACEHOLDER = /\b(TODO|TBD|FIXME|XXX)\b|ใส่ข้อความ|แก้ไขตรงนี้/i;

// ---------------------------------------------------------------- ตัวตรวจ
/**
 * @returns {{ errors: string[], warnings: string[], stats: object }}
 */
function validateManual(manual, opts = {}) {
  const errors = [];
  const warnings = [];
  const E = (m) => errors.push(m);
  const W = (m) => warnings.push(m);
  const stats = { graphs: 0, nodes: 0, safetyNodes: 0, terminals: 0 };

  if (!manual || typeof manual !== 'object') {
    E('ไฟล์ไม่ใช่ object JSON');
    return { errors, warnings, stats };
  }
  if (manual.schema_version !== 2) E(`manual: schema_version เป็น ${JSON.stringify(manual.schema_version)} ไม่ใช่ 2`);
  for (const k of ['manual_id', 'device_category', 'brand', 'model_pattern', 'source_manual']) {
    if (typeof manual[k] !== 'string' || manual[k].trim() === '') E(`manual: ขาดฟิลด์ ${k}`);
  }
  if (typeof manual.device_category === 'string' && !KNOWN_CATEGORIES.includes(manual.device_category)) {
    W(`manual: device_category '${manual.device_category}' ไม่อยู่ในรายการที่รู้จัก (${KNOWN_CATEGORIES.join(', ')})`);
  } else if (manual.device_category === 'Air Conditioner') {
    W("manual: 'Air Conditioner' เป็นชุดข้อมูลต้นแบบ ไม่อยู่ใน 4 ประเภทเป้าหมายของ TOR (Microwave, Refrigerator, Television, Washing Machine)");
  }
  if (!Array.isArray(manual.graphs) || manual.graphs.length === 0) {
    E('manual: graphs ต้องเป็น array และไม่ว่าง');
    return { errors, warnings, stats };
  }
  if (manual.count !== undefined && manual.count !== manual.graphs.length) {
    E(`manual: count = ${manual.count} แต่มี graphs ${manual.graphs.length} ผัง`);
  }

  /** ค่าข้อความที่ยังเป็น TODO/ตัวอย่าง ในฟิลด์ระดับ manual (ไม่รวม graphs) */
  const isPlaceholder = (s) => PLACEHOLDER.test(s) || /todo/i.test(s);
  const scanPlaceholders = (obj, where) => {
    for (const [k, val] of Object.entries(obj)) {
      if (k === 'graphs' || k === 'nodes') continue;
      const values = Array.isArray(val) ? val : [val];
      for (const v of values) {
        if (typeof v === 'string' && isPlaceholder(v)) E(`${where}: ฟิลด์ ${k} ยังเป็นข้อความตัวอย่าง/รอแก้ (${v.slice(0, 40)})`);
      }
    }
  };
  scanPlaceholders(manual, 'manual');

  const seenGraphIds = new Set();
  for (const g of manual.graphs) {
    stats.graphs++;
    const gid = g && g.graph_id ? g.graph_id : '(ไม่มี graph_id)';
    const G = (m) => E(`${gid}: ${m}`);
    const GW = (m) => W(`${gid}: ${m}`);

    // ---- ระดับผัง
    if (!g || typeof g !== 'object') { E(`graphs: มีสมาชิกที่ไม่ใช่ object`); continue; }
    scanPlaceholders(g, gid);
    if (typeof g.graph_id !== 'string' || !/^[a-z0-9_]+$/.test(g.graph_id)) G('graph_id ต้องเป็น a-z 0-9 _ เท่านั้น');
    if (seenGraphIds.has(g.graph_id)) G('graph_id ซ้ำในไฟล์นี้');
    seenGraphIds.add(g.graph_id);
    if (manual.manual_id && typeof g.graph_id === 'string' && !g.graph_id.startsWith(`${manual.manual_id}_`)) {
      GW(`graph_id ไม่ขึ้นต้นด้วย manual_id '${manual.manual_id}_' (ธรรมเนียมของโปรเจกต์)`);
    }
    if (g.schema_version !== undefined && g.schema_version !== manual.schema_version) G('schema_version ของผังไม่ตรงกับของไฟล์');
    for (const k of ['device_category', 'brand', 'model_pattern', 'entry_symptom', 'source', 'source_chunk_id', 'entry_node']) {
      if (typeof g[k] !== 'string' || g[k].trim() === '') G(`ขาดฟิลด์ ${k}`);
    }
    if (g.device_category !== undefined && g.device_category !== manual.device_category) G('device_category ไม่ตรงกับของไฟล์');
    if (typeof g.entry_symptom_th !== 'string' || g.entry_symptom_th.trim() === '') GW('ไม่มี entry_symptom_th (หน้าเว็บภาษาไทยจะแสดงชื่ออังกฤษ และการค้นหาภาษาไทยแม่นลดลง)');
    if (g.entry_symptom_aliases !== undefined) {
      if (!Array.isArray(g.entry_symptom_aliases) || g.entry_symptom_aliases.some((a) => typeof a !== 'string')) G('entry_symptom_aliases ต้องเป็น array ของข้อความ');
    }
    const pr = g.page_range;
    if (!Array.isArray(pr) || pr.length !== 2 || !pr.every((n) => Number.isInteger(n) && n >= 1) || pr[0] > pr[1]) {
      G('page_range ต้องเป็น [หน้าแรก, หน้าสุดท้าย] จำนวนเต็ม ≥ 1 และหน้าแรก ≤ หน้าสุดท้าย (TOR ข้อ 6: ต้องแสดงเลขหน้าอ้างอิงทุกหน้าจอ)');
    }
    if (g.severity !== undefined && !SEVERITIES.includes(g.severity)) GW(`severity '${g.severity}' ไม่อยู่ใน ${SEVERITIES.join('/')}`);

    // ---- โหนด
    if (!Array.isArray(g.nodes) || g.nodes.length === 0) { G('nodes ต้องเป็น array และไม่ว่าง'); continue; }
    const byId = new Map();
    for (const n of g.nodes) {
      stats.nodes++;
      if (!n || typeof n.node_id !== 'string' || n.node_id === '') { G('มีโหนดที่ไม่มี node_id'); continue; }
      if (byId.has(n.node_id)) G(`node_id '${n.node_id}' ซ้ำ`);
      byId.set(n.node_id, n);
    }
    if (typeof g.entry_node === 'string' && !byId.has(g.entry_node)) G(`entry_node '${g.entry_node}' ไม่มีอยู่ในผัง`);

    const edgesOf = (n) => {
      const out = [];
      for (const f of ['on_yes', 'on_no', 'next', 'on_invalid']) if (n[f] !== undefined && n[f] !== null) out.push([f, n[f]]);
      return out;
    };

    for (const n of byId.values()) {
      const at = `โหนด '${n.node_id}'`;
      if (!NODE_TYPES.includes(n.type)) { G(`${at}: type '${n.type}' ไม่รู้จัก (ใช้ ${NODE_TYPES.join('/')})`); continue; }

      // ข้อความหลักตามชนิด
      const textField = n.type === 'checkpoint' ? 'question' : n.type === 'input' ? 'prompt' : 'content';
      const text = n[textField];
      if (typeof text !== 'string' || text.trim() === '') G(`${at} (${n.type}): ขาด ${textField}`);
      else if (PLACEHOLDER.test(text)) G(`${at}: ข้อความยังเป็นข้อความตัวอย่าง/รอแก้ (${text.slice(0, 40)}…)`);

      // เส้นเชื่อมที่ต้องมี/ห้ามมี
      const need = { checkpoint: ['on_yes', 'on_no'], instruction: ['next'], input: ['next'], resolution: [], escalation: [] }[n.type];
      for (const f of need) if (typeof n[f] !== 'string' || n[f] === '') G(`${at} (${n.type}): ขาด ${f}`);
      if (TERMINAL_TYPES.includes(n.type)) {
        stats.terminals++;
        if (edgesOf(n).length > 0) G(`${at} (${n.type}): โหนดสิ้นสุดต้องไม่มีเส้นเชื่อมออก (${edgesOf(n).map(([f]) => f).join(',')})`);
        if (!OUTCOME_KINDS.includes(n.outcome_kind)) G(`${at} (${n.type}): outcome_kind '${n.outcome_kind}' ไม่ถูกต้อง (ใช้ ${OUTCOME_KINDS.join('/')})`);
        else if (n.type === 'resolution' && !['user_fixed', 'normal_behavior'].includes(n.outcome_kind)) GW(`${at}: resolution แต่ outcome_kind เป็น '${n.outcome_kind}' (ปกติ user_fixed/normal_behavior)`);
        else if (n.type === 'escalation' && !['handoff_informed', 'handoff_unknown'].includes(n.outcome_kind)) GW(`${at}: escalation แต่ outcome_kind เป็น '${n.outcome_kind}' (ปกติ handoff_*)`);
      } else if (n.outcome_kind !== undefined) {
        GW(`${at} (${n.type}): มี outcome_kind ทั้งที่ไม่ใช่โหนดสิ้นสุด`);
      }
      for (const [f, target] of edgesOf(n)) {
        if (!byId.has(target)) G(`${at}: ${f} ชี้ไป '${target}' ที่ไม่มีอยู่`);
        if (target === n.node_id) G(`${at}: ${f} ชี้กลับตัวเอง (วนไม่รู้จบ)`);
      }

      // ฟิลด์เฉพาะชนิด input
      if (n.type === 'input') {
        if (!INPUT_TYPES.includes(n.input_type)) G(`${at}: input_type '${n.input_type}' ไม่ถูกต้อง (ใช้ ${INPUT_TYPES.join('/')})`);
        if (typeof n.store_as !== 'string' || n.store_as === '') G(`${at}: input ต้องมี store_as`);
        if (n.pattern !== undefined) {
          try { new RegExp(n.pattern); } catch (e) { G(`${at}: pattern ไม่ใช่ regex ที่ถูกต้อง (${e.message})`); }
        } else if (n.input_type !== 'text') {
          GW(`${at}: input_type '${n.input_type}' ไม่มี pattern (จะรับค่าอะไรก็ได้)`);
        }
        if (n.on_invalid === undefined) GW(`${at}: ไม่มี on_invalid (ผู้ใช้กรอกผิดแล้วไม่มีทางไปต่อที่กำหนดไว้)`);
      }

      // ความปลอดภัย
      if (n.safety_critical === true) {
        stats.safetyNodes++;
        if (n.type !== 'instruction') G(`${at}: safety_critical ต้องอยู่บนโหนด instruction เท่านั้น (พบบน ${n.type})`);
        if (typeof n.safety_warning !== 'string' || n.safety_warning.trim() === '') G(`${at}: safety_critical แต่ไม่มี safety_warning (ด่านยืนยันจะไม่มีข้อความเตือนให้อ่าน)`);
      } else if (n.safety_warning !== undefined && String(n.safety_warning).trim() !== '') {
        GW(`${at}: มี safety_warning แต่ safety_critical ไม่ใช่ true (ด่านยืนยันจะไม่ทำงาน)`);
      }
      if (n.type === 'instruction' && n.safety_critical !== true && typeof text === 'string') {
        const hit = SAFETY_HINTS.find((k) => text.toLowerCase().includes(k.toLowerCase()));
        if (hit) GW(`${at}: ข้อความมีคำว่า '${hit}' แต่ไม่ได้ตั้ง safety_critical — ตรวจว่าเป็นขั้นตอนอันตรายหรือไม่ (เกณฑ์เดาจากคำ ไม่ใช่ข้อสรุป)`);
      }
    }

    // ---- การเข้าถึง / การจบ
    if (byId.has(g.entry_node)) {
      const reach = new Set();
      const stack = [g.entry_node];
      while (stack.length) {
        const id = stack.pop();
        if (reach.has(id) || !byId.has(id)) continue;
        reach.add(id);
        for (const [, t] of edgesOf(byId.get(id))) stack.push(t);
      }
      for (const id of byId.keys()) if (!reach.has(id)) GW(`โหนด '${id}' ไม่มีทางไปถึงจาก entry_node (ข้อมูลตาย)`);

      // ทุกโหนดที่ไปถึงได้ ต้องมีทางไปจบ (ย้อนกราฟจากโหนดสิ้นสุด)
      const rev = new Map();
      for (const [id, n] of byId) for (const [, t] of edgesOf(n)) { if (!rev.has(t)) rev.set(t, []); rev.get(t).push(id); }
      const canFinish = new Set();
      const q = [...byId.values()].filter((n) => TERMINAL_TYPES.includes(n.type)).map((n) => n.node_id);
      while (q.length) {
        const id = q.pop();
        if (canFinish.has(id)) continue;
        canFinish.add(id);
        for (const p of rev.get(id) ?? []) q.push(p);
      }
      for (const id of reach) if (!canFinish.has(id)) G(`โหนด '${id}' ไปถึงได้ แต่ไม่มีเส้นทางไปสถานะสิ้นสุด (ผู้ใช้ค้างอยู่ในวง)`);
      if (![...reach].some((id) => TERMINAL_TYPES.includes(byId.get(id).type))) G('ไม่มีโหนดสิ้นสุดที่ไปถึงได้จาก entry_node');
      const hasEscalation = [...reach].some((id) => byId.get(id).type === 'escalation');
      if (!hasEscalation) GW('ไม่มีโหนด escalation ที่ไปถึงได้ (TOR ข้อ 4: ข้อมูลไม่พอต้องแจ้งให้ติดต่อศูนย์บริการ ไม่คาดเดา)');
    }
  }
  return { errors, warnings, stats };
}

/** ตรวจ equipment.json: ทุกรายการอุปกรณ์ต้องมีที่มา (TOR ข้อ 6) และอ้าง equipment_id ที่มีอยู่จริง */
function validateEquipment(eq) {
  const errors = [];
  const warnings = [];
  const ids = new Set((eq.equipment ?? []).map((e) => e.equipment_id));
  if (!Array.isArray(eq.equipment) || eq.equipment.length === 0) errors.push('equipment: ไม่มีรายการ equipment');
  for (const e of eq.equipment ?? []) {
    if (!e.name_th) errors.push(`equipment '${e.equipment_id}': ไม่มี name_th`);
  }
  for (const u of eq.usage ?? []) {
    if (!KNOWN_CATEGORIES.includes(u.device_category)) warnings.push(`usage: device_category '${u.device_category}' ไม่อยู่ในรายการที่รู้จัก`);
    for (const it of u.items ?? []) {
      const at = `usage[${u.device_category}] '${it.equipment_id}'`;
      if (!ids.has(it.equipment_id)) errors.push(`${at}: equipment_id ไม่มีอยู่ในรายการ equipment`);
      if (!it.purpose_th) errors.push(`${at}: ไม่มี purpose_th`);
      const hasPage = Number.isInteger(it.source_page);
      const hasNote = typeof it.author_note === 'string' && it.author_note.trim() !== '';
      if (!hasPage && !hasNote) errors.push(`${at}: ไม่มีที่มา (ต้องมี source_page หรือ author_note — TOR ข้อ 6: ทุกรายการต้องระบุที่มา)`);
    }
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------- JSON Schema (ถ้ามี ajv)
function schemaCheck(manual) {
  if (!ROOT) return { skipped: 'ไม่พบรากโปรเจกต์' };
  const schemaFile = path.join(ROOT, 'data', 'schemas', 'troubleshooting-graph.v2.schema.json');
  if (!fs.existsSync(schemaFile)) return { skipped: 'ไม่พบ data/schemas/troubleshooting-graph.v2.schema.json' };
  let Ajv2020;
  try {
    const { createRequire } = require('node:module');
    const req = createRequire(path.join(ROOT, 'backend', 'package.json'));
    Ajv2020 = req('ajv/dist/2020');
  } catch {
    return { skipped: 'ไม่พบ ajv (ข้ามการตรวจ JSON Schema)' };
  }
  const ajv = new (Ajv2020.default ?? Ajv2020)({ allErrors: true, strict: false, validateFormats: false });
  const validate = ajv.compile(JSON.parse(fs.readFileSync(schemaFile, 'utf8')));
  const problems = [];
  for (const g of manual.graphs ?? []) {
    if (!validate(g)) {
      for (const e of validate.errors.slice(0, 5)) problems.push(`${g.graph_id}: schema ${e.instancePath || '/'} ${e.message}`);
    }
  }
  return { problems };
}

// ---------------------------------------------------------------- self-test
function selfTest(base) {
  const clone = () => JSON.parse(JSON.stringify(base));
  const firstGraph = (m) => m.graphs[0];
  const findNode = (g, type) => g.nodes.find((n) => n.type === type);
  const cases = [
    ['ข้อมูลต้นฉบับต้องผ่าน (ไม่มี error)', (m) => m, (r) => r.errors.length === 0],
    ['เส้นเชื่อมชี้ไปโหนดที่ไม่มี', (m) => { findNode(firstGraph(m), 'checkpoint').on_yes = 'n_ghost'; }, (r) => r.errors.some((e) => e.includes("ไม่มีอยู่"))],
    ['entry_node ไม่มีอยู่', (m) => { firstGraph(m).entry_node = 'n_ghost'; }, (r) => r.errors.some((e) => e.includes('entry_node'))],
    ['node_id ซ้ำ', (m) => { const g = firstGraph(m); g.nodes.push({ ...g.nodes[1] }); }, (r) => r.errors.some((e) => e.includes('ซ้ำ'))],
    ['โหนดสิ้นสุดมีเส้นเชื่อมออก', (m) => { findNode(firstGraph(m), 'resolution').next = firstGraph(m).entry_node; }, (r) => r.errors.some((e) => e.includes('โหนดสิ้นสุด'))],
    ['ขาด outcome_kind', (m) => { delete findNode(firstGraph(m), 'escalation').outcome_kind; }, (r) => r.errors.some((e) => e.includes('outcome_kind'))],
    ['checkpoint ขาด on_no', (m) => { delete findNode(firstGraph(m), 'checkpoint').on_no; }, (r) => r.errors.some((e) => e.includes('ขาด on_no'))],
    ['safety_critical แต่ไม่มี safety_warning', (m) => { const n = firstGraph(m).nodes.find((x) => x.type === 'instruction'); n.safety_critical = true; delete n.safety_warning; }, (r) => r.errors.some((e) => e.includes('safety_warning'))],
    ['safety_critical บนโหนดที่ไม่ใช่ instruction', (m) => { const n = findNode(firstGraph(m), 'checkpoint'); n.safety_critical = true; n.safety_warning = 'x'; }, (r) => r.errors.some((e) => e.includes('instruction เท่านั้น'))],
    ['ข้อความยังเป็น TODO', (m) => { findNode(firstGraph(m), 'instruction').content = 'TODO ใส่ขั้นตอน'; }, (r) => r.errors.some((e) => e.includes('ข้อความตัวอย่าง'))],
    ['วงวนไม่มีทางออก', (m) => { const g = firstGraph(m); g.nodes.push({ node_id: 'n_loop_a', type: 'instruction', content: 'a', next: 'n_loop_b' }, { node_id: 'n_loop_b', type: 'instruction', content: 'b', next: 'n_loop_a' }); findNode(g, 'checkpoint').on_no = 'n_loop_a'; }, (r) => r.errors.some((e) => e.includes('ไม่มีเส้นทางไปสถานะสิ้นสุด'))],
    ['โหนดที่ไม่มีใครชี้ถึง (WARN)', (m) => { firstGraph(m).nodes.push({ node_id: 'n_orphan', type: 'resolution', content: 'x', outcome_kind: 'user_fixed' }); }, (r) => r.warnings.some((e) => e.includes('ไม่มีทางไปถึง'))],
    ['page_range ผิด', (m) => { firstGraph(m).page_range = [5, 2]; }, (r) => r.errors.some((e) => e.includes('page_range'))],
    ['pattern ของ input เป็น regex เสีย', (m) => { for (const g of m.graphs) for (const n of g.nodes) if (n.type === 'input') n.pattern = '([a-'; }, (r) => r.errors.some((e) => e.includes('regex'))],
    ['graph_id ซ้ำ', (m) => { m.graphs.push({ ...m.graphs[0] }); m.count = m.graphs.length; }, (r) => r.errors.some((e) => e.includes('graph_id ซ้ำ'))],
    ['count ไม่ตรงจำนวนผัง', (m) => { m.count = 999; }, (r) => r.errors.some((e) => e.includes('count'))],
    ['instruction เกี่ยวกับไฟแต่ไม่ได้ตั้ง safety_critical (WARN)', (m) => { findNode(firstGraph(m), 'instruction').safety_critical = false; findNode(firstGraph(m), 'instruction').content = 'ถอดปลั๊กแล้วเปิดฝาด้านหลัง'; }, (r) => r.warnings.some((e) => e.includes('safety_critical'))],
  ];
  let failed = 0;
  for (const [name, mutate, expect] of cases) {
    const m = clone();
    const out = mutate(m) ?? m;
    const r = validateManual(out);
    const ok = expect(r);
    if (!ok) failed++;
    console.log(`${ok ? '✅' : '❌'} ${name}`);
  }
  console.log(`\nself-test: ${cases.length - failed}/${cases.length} ผ่าน`);
  return failed === 0;
}

// ---------------------------------------------------------------- CLI
function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => argv.includes(`--${n}`);
  const files = argv.filter((a) => !a.startsWith('--'));
  const strict = flag('strict');
  if (!ROOT && files.length === 0) {
    console.error('หารากโปรเจกต์ไม่เจอ (ต้องมีโฟลเดอร์ data/manuals และ backend) — ระบุไฟล์เป็นอาร์กิวเมนต์แทนได้');
    process.exit(2);
  }
  const manualFiles = files.length
    ? files.map((f) => path.resolve(f))
    : fs.readdirSync(path.join(ROOT, 'data', 'manuals')).filter((n) => n.endsWith('.json')).map((n) => path.join(ROOT, 'data', 'manuals', n));
  if (manualFiles.length === 0) { console.error('ไม่พบไฟล์คู่มือ'); process.exit(2); }

  if (flag('self-test')) {
    const base = JSON.parse(fs.readFileSync(manualFiles[0], 'utf8'));
    process.exit(selfTest(base) ? 0 : 1);
  }

  const report = [];
  let totalErr = 0;
  let totalWarn = 0;
  for (const file of manualFiles) {
    let manual;
    try { manual = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error(`อ่าน ${file} ไม่ได้: ${e.message}`); process.exit(2); }
    const r = validateManual(manual);
    const sc = schemaCheck(manual);
    if (sc.problems) r.errors.push(...sc.problems);
    totalErr += r.errors.length;
    totalWarn += r.warnings.length;
    report.push({ file: path.relative(process.cwd(), file), ...r, schema: sc.skipped ? `ข้าม: ${sc.skipped}` : 'ตรวจแล้ว' });
  }
  let eqReport = null;
  if (flag('equipment')) {
    const eqFile = path.join(ROOT, 'data', 'equipment', 'equipment.json');
    eqReport = validateEquipment(JSON.parse(fs.readFileSync(eqFile, 'utf8')));
    totalErr += eqReport.errors.length;
    totalWarn += eqReport.warnings.length;
  }

  if (flag('json')) {
    console.log(JSON.stringify({ report, equipment: eqReport, totalErr, totalWarn }, null, 2));
  } else {
    for (const r of report) {
      console.log(`\n== ${r.file}`);
      console.log(`   ผัง ${r.stats.graphs} · โหนด ${r.stats.nodes} · โหนดสิ้นสุด ${r.stats.terminals} · safety_critical ${r.stats.safetyNodes} · JSON Schema: ${r.schema}`);
      for (const e of r.errors) console.log(`   ❌ ${e}`);
      for (const w of r.warnings) console.log(`   ⚠️  ${w}`);
      if (r.errors.length === 0 && r.warnings.length === 0) console.log('   ✅ ไม่พบปัญหา');
    }
    if (eqReport) {
      console.log('\n== data/equipment/equipment.json');
      for (const e of eqReport.errors) console.log(`   ❌ ${e}`);
      for (const w of eqReport.warnings) console.log(`   ⚠️  ${w}`);
      if (eqReport.errors.length === 0 && eqReport.warnings.length === 0) console.log('   ✅ ไม่พบปัญหา');
    }
    console.log(`\nสรุป: ข้อผิดพลาด ${totalErr} · คำเตือน ${totalWarn}${strict ? ' (--strict: คำเตือนนับเป็นข้อผิดพลาด)' : ''}`);
  }
  process.exit(totalErr > 0 || (strict && totalWarn > 0) ? 1 : 0);
}

if (require.main === module) main();
module.exports = { validateManual, validateEquipment };
