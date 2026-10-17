/**
 * graph-validator.ts — ตัวตรวจผังขั้นตอน (schema v2) ด้วยโค้ดล้วน
 *
 * หลักการสำคัญของ Step 5: LLM "ร่าง" ผังได้ แต่ไม่มีอำนาจตัดสินว่าผังใช้ได้
 * ไฟล์นี้คือผู้ตัดสิน — LLM แก้ผล override ผล หรือขอข้ามกฎไม่ได้ และ publish ต้องไม่มี error เลย (ไม่มี override ของผู้ดูแล)
 *
 * เป็นการพอร์ตกฎจาก scripts/validate_graph.py (+ data/schemas/troubleshooting-graph.v2.schema.json และ
 * validateManual ใน backend/scripts/seed-graphs.js) มาเป็น TypeScript เพื่อให้ backend เรียกใช้ได้
 * ความถูกต้องของการพอร์ต: เคยรันกับผังจริง 644 ผังใน data/manuals แล้วผ่านโดยไม่มี error (เทสต์นั้นถูกลบไปแล้ว)
 * (ไฟล์ Python ยังคงไว้สำหรับงาน offline ไม่ได้แก้)
 *
 * สองโหมด:
 *   'existing' — ตรวจผังที่ใช้งานอยู่แล้ว (ไม่มี source_page, อนุญาต config / author_note / external_reference ตามข้อมูลเดิม)
 *   'draft'    — ตรวจร่างจาก LLM: เข้มกว่า — ทุกโหนดต้องมี source_page ที่อยู่ในหน้าที่อัปโหลดจริง,
 *                ห้ามมี config / external_reference / รูปภาพ / author_note (ไม่มีแหล่งอ้างอิงที่ตรวจได้)
 *
 * error  = กัน publish · warning = ผู้ตรวจต้องรับทราบ (acknowledgedWarnings) ก่อน publish
 */

export type ValidatorMode = 'existing' | 'draft';

export interface ValidationIssue {
  code: string;
  message: string;
  graphId?: string;
  nodeId?: string;
}

export interface ValidationReport {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  stats: { graphs: number; nodes: number };
  validatedAt: string;
}

export interface ValidateOptions {
  mode: ValidatorMode;
  /** หน้า → ข้อความ ของหน้าที่อัปโหลดจริง (ใช้ในโหมด draft ตรวจ source_page และคำเสี่ยงในหน้าต้นฉบับ) */
  pages?: ReadonlyMap<number, string>;
}

// ============================================================
// ค่าคงที่ (ต้องตรงกับ schema v2 และขนาดคอลัมน์ใน migration 001)
// ============================================================

export const DEVICE_CATEGORIES = ['Air Conditioner', 'Microwave', 'Refrigerator', 'Washing Machine', 'Television'] as const;
export const NODE_TYPES = ['checkpoint', 'instruction', 'input', 'resolution', 'escalation'] as const;
export const OUTCOME_KINDS = ['user_fixed', 'normal_behavior', 'handoff_informed', 'handoff_unknown'] as const;
export const INPUT_TYPES = ['error_code', 'model_number', 'number', 'text'] as const;
export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export const MAX_NODES_PER_GRAPH = 60;
export const MAX_PATH_LENGTH = 40;
export const MAX_NODE_TEXT = 2000;
export const MAX_SAFETY_WARNING = 1000;
export const MAX_PATTERN = 200;
export const MAX_ALIASES = 10;

const EDGE_KEYS = ['on_yes', 'on_no', 'next', 'on_invalid'] as const;
const TEXT_KEYS = ['question', 'content', 'prompt'] as const;
const TERMINAL_TYPES: readonly string[] = ['resolution', 'escalation'];

const MANUAL_KEYS = ['schema_version', 'manual_id', 'device_category', 'brand', 'model_pattern', 'source_manual', 'count', 'display_name', 'model_aliases', 'graphs'];
const GRAPH_KEYS = [
  'schema_version', 'graph_id', 'device_category', 'brand', 'model_pattern', 'entry_symptom', 'entry_symptom_th',
  'entry_symptom_aliases', 'source', 'page_range', 'source_chunk_id', 'severity', 'difficulty', 'entry_node', 'nodes',
];
const NODE_KEYS = [
  'node_id', 'type', 'question', 'content', 'prompt', 'on_yes', 'on_no', 'next', 'on_invalid', 'input_type', 'pattern',
  'store_as', 'outcome_kind', 'safety_critical', 'safety_warning',
];
/** ฟิลด์ที่มีในข้อมูลเดิมแต่ไม่อนุญาตในร่าง (ไม่มีแหล่งอ้างอิงที่ผู้ตรวจเทียบได้) */
const EXISTING_ONLY_GRAPH_KEYS = ['config'];
const EXISTING_ONLY_NODE_KEYS = ['author_note', 'external_reference', 'has_image', 'image_url'];
const DRAFT_ONLY_NODE_KEYS = ['source_page'];

/** คำที่บ่งชี้ว่าขั้นตอนเกี่ยวกับอันตราย (ไฟฟ้า แก๊ส ความร้อน การรื้อเครื่อง) — ใช้เตือนเมื่อไม่มีด่านความปลอดภัย */
export const RISK_PATTERN =
  /\b(unplug\w*|power cord|power plug|plug(?:ged)? (?:in|out)|electric\w*|voltage|live wire|gas|flammable|boiling|hot water|refrigerant|short[- ]circuit\w*|disassembl\w*|remove the (?:rear|back|cover|panel))\b|ปลั๊ก|สายไฟ|ไฟฟ้า|ไฟดูด|ไฟรั่ว|แรงดัน|แก๊ส|ก๊าซ|ติดไฟ|ร้อนจัด|น้ำร้อน|สารทำความเย็น|ลัดวงจร|ถอดฝา|ฝาหลัง|แกะเครื่อง/i;

const MANUAL_ID_PATTERN = /^[a-z0-9_]+$/;
const GRAPH_ID_PATTERN = /^[a-z0-9_]+$/;
/** schema v2 กำหนด ^n[a-z0-9_]+$ — ร่างต้องตามนี้ แต่ข้อมูลเดิม 13 โหนดใน samsung_rs5000fc (ผัง filter_icon, wifi_icon_blinking) ใช้ g1/f1/c1 ซึ่งไม่ตรง จึงยอมเฉพาะโหมด existing */
const DRAFT_NODE_ID_PATTERN = /^n[a-z0-9_]+$/;
const EXISTING_NODE_ID_PATTERN = /^[a-z0-9_]+$/;
const STORE_AS_PATTERN = /^[a-z0-9_]+$/;

// ============================================================
// ตัวช่วย
// ============================================================

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

class Collector {
  readonly errors: ValidationIssue[] = [];
  readonly warnings: ValidationIssue[] = [];

  error(code: string, message: string, where: { graphId?: string; nodeId?: string } = {}): void {
    this.errors.push({ code, message, ...where });
  }

  warn(code: string, message: string, where: { graphId?: string; nodeId?: string } = {}): void {
    this.warnings.push({ code, message, ...where });
  }
}

function checkString(
  c: Collector,
  obj: Obj,
  key: string,
  max: number,
  where: { graphId?: string; nodeId?: string },
  required = true,
): void {
  const value = obj[key];
  if (value === undefined) {
    if (required) c.error('E_SHAPE', `ต้องมีฟิลด์ '${key}'`, where);
    return;
  }
  if (!isNonEmptyString(value)) {
    c.error('E_SHAPE', `'${key}' ต้องเป็นข้อความที่ไม่ว่าง`, where);
  } else if (value.length > max) {
    c.error('E_TOO_LONG', `'${key}' ยาวเกิน ${max} ตัวอักษร`, where);
  }
}

function checkEnum(c: Collector, obj: Obj, key: string, allowed: readonly string[], where: { graphId?: string; nodeId?: string }, required = false): void {
  const value = obj[key];
  if (value === undefined) {
    if (required) c.error('E_SHAPE', `ต้องมีฟิลด์ '${key}'`, where);
    return;
  }
  if (typeof value !== 'string' || !allowed.includes(value)) {
    c.error('E_ENUM', `'${key}' ต้องเป็นหนึ่งใน ${allowed.join(', ')}`, where);
  }
}

function checkUnknownKeys(c: Collector, obj: Obj, allowed: readonly string[], where: { graphId?: string; nodeId?: string }): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) c.error('E_UNKNOWN_FIELD', `ฟิลด์ '${key}' ไม่อยู่ในรูปแบบที่อนุญาต`, where);
  }
}

// ============================================================
// ตัวตรวจหลัก
// ============================================================

export function validateManual(manual: unknown, options: ValidateOptions): ValidationReport {
  const c = new Collector();
  let graphCount = 0;
  let nodeCount = 0;

  if (!isObj(manual)) {
    c.error('E_SHAPE', 'ข้อมูลคู่มือต้องเป็น object');
    return finish(c, 0, 0);
  }

  checkUnknownKeys(c, manual, MANUAL_KEYS, {});
  if (manual.schema_version !== 2) c.error('E_SCHEMA_VERSION', `schema_version ต้องเป็น 2 (พบ ${JSON.stringify(manual.schema_version)})`);

  checkString(c, manual, 'manual_id', 80, {});
  if (isNonEmptyString(manual.manual_id) && !MANUAL_ID_PATTERN.test(manual.manual_id)) {
    c.error('E_ID_FORMAT', "manual_id ใช้ได้เฉพาะ a-z 0-9 และ _");
  }
  checkEnum(c, manual, 'device_category', DEVICE_CATEGORIES, {}, true);
  checkString(c, manual, 'brand', 40, {});
  checkString(c, manual, 'model_pattern', 60, {});
  checkString(c, manual, 'source_manual', 200, {});
  checkString(c, manual, 'display_name', 120, {}, false);
  if (manual.model_aliases !== undefined && !(Array.isArray(manual.model_aliases) && manual.model_aliases.every((a) => isNonEmptyString(a)))) {
    c.error('E_SHAPE', 'model_aliases ต้องเป็นอาร์เรย์ของข้อความที่ไม่ว่าง');
  }

  if (!Array.isArray(manual.graphs) || manual.graphs.length === 0) {
    c.error('E_NO_GRAPHS', 'ต้องมีผังอย่างน้อย 1 ผัง');
    return finish(c, 0, 0);
  }

  const seenGraphIds = new Set<string>();
  for (const rawGraph of manual.graphs) {
    graphCount += 1;
    if (!isObj(rawGraph)) {
      c.error('E_SHAPE', 'ผังแต่ละอันต้องเป็น object');
      continue;
    }
    const graphId = isNonEmptyString(rawGraph.graph_id) ? rawGraph.graph_id : undefined;
    if (graphId !== undefined) {
      if (seenGraphIds.has(graphId)) c.error('E_DUPLICATE_GRAPH', `graph_id '${graphId}' ซ้ำ`, { graphId });
      seenGraphIds.add(graphId);
    }
    nodeCount += validateGraph(c, rawGraph, options);
  }

  return finish(c, graphCount, nodeCount);
}

function finish(c: Collector, graphs: number, nodes: number): ValidationReport {
  return { errors: c.errors, warnings: c.warnings, stats: { graphs, nodes }, validatedAt: new Date().toISOString() };
}

function validateGraph(c: Collector, graph: Obj, options: ValidateOptions): number {
  const draft = options.mode === 'draft';
  const graphId = isNonEmptyString(graph.graph_id) ? graph.graph_id : undefined;
  const g = { graphId };

  checkUnknownKeys(c, graph, draft ? GRAPH_KEYS : [...GRAPH_KEYS, ...EXISTING_ONLY_GRAPH_KEYS], g);

  checkString(c, graph, 'graph_id', 120, g);
  if (graphId !== undefined && !GRAPH_ID_PATTERN.test(graphId)) c.error('E_ID_FORMAT', 'graph_id ใช้ได้เฉพาะ a-z 0-9 และ _', g);
  checkString(c, graph, 'entry_symptom', 500, g);
  checkString(c, graph, 'entry_symptom_th', 500, g, false);
  checkString(c, graph, 'source', 200, g);
  checkString(c, graph, 'source_chunk_id', 200, g);
  checkEnum(c, graph, 'severity', SEVERITIES, g);
  checkEnum(c, graph, 'difficulty', DIFFICULTIES, g);

  const aliases = graph.entry_symptom_aliases;
  if (aliases !== undefined) {
    if (!Array.isArray(aliases) || !aliases.every((a) => isNonEmptyString(a) && a.length <= 120)) {
      c.error('E_SHAPE', 'entry_symptom_aliases ต้องเป็นอาร์เรย์ของข้อความที่ไม่ว่าง ยาวไม่เกิน 120', g);
    } else if (aliases.length > MAX_ALIASES) {
      c.error('E_TOO_LONG', `entry_symptom_aliases มีได้ไม่เกิน ${MAX_ALIASES} รายการ`, g);
    }
  }

  const pageRange = graph.page_range;
  let rangeOk = false;
  if (!Array.isArray(pageRange) || pageRange.length !== 2 || !isPositiveInt(pageRange[0]) || !isPositiveInt(pageRange[1])) {
    c.error('E_SHAPE', 'page_range ต้องเป็น [หน้าแรก, หน้าสุดท้าย] จำนวนเต็ม ≥ 1', g);
  } else if (pageRange[0] > pageRange[1]) {
    c.error('E_PAGE_RANGE', 'page_range: หน้าแรกต้องไม่มากกว่าหน้าสุดท้าย', g);
  } else {
    rangeOk = true;
  }

  checkString(c, graph, 'entry_node', 60, g);

  const rawNodes = graph.nodes;
  if (!Array.isArray(rawNodes) || rawNodes.length === 0) {
    c.error('E_NO_NODES', 'ผังต้องมีโหนดอย่างน้อย 1 โหนด', g);
    return 0;
  }
  if (rawNodes.length > MAX_NODES_PER_GRAPH) {
    c.error('E_TOO_MANY_NODES', `ผังมีโหนดได้ไม่เกิน ${MAX_NODES_PER_GRAPH} โหนด (พบ ${rawNodes.length})`, g);
  }

  // ---- โหนดทีละตัว ----
  const nodes = new Map<string, Obj>();
  const sourcePages: number[] = [];
  for (const raw of rawNodes) {
    if (!isObj(raw)) {
      c.error('E_SHAPE', 'โหนดแต่ละอันต้องเป็น object', g);
      continue;
    }
    const nodeId = isNonEmptyString(raw.node_id) ? raw.node_id : undefined;
    if (nodeId !== undefined) {
      if (nodes.has(nodeId)) c.error('E_DUPLICATE_NODE', `node_id '${nodeId}' ซ้ำในผังเดียวกัน`, { graphId, nodeId });
      nodes.set(nodeId, raw);
    }
    validateNode(c, raw, graphId, options, sourcePages);
  }

  if (draft && rangeOk && sourcePages.length > 0) {
    const [first, last] = pageRange as [number, number];
    if (Math.min(...sourcePages) < first || Math.max(...sourcePages) > last) {
      c.error('E_PAGE_RANGE', `page_range [${first}, ${last}] ไม่ครอบคลุมหน้าที่โหนดอ้างอิง (${Math.min(...sourcePages)}–${Math.max(...sourcePages)})`, g);
    }
  }

  validateStructure(c, graph, nodes, graphId, options, sourcePages);
  return nodes.size;
}

function validateNode(c: Collector, node: Obj, graphId: string | undefined, options: ValidateOptions, sourcePages: number[]): void {
  const draft = options.mode === 'draft';
  const nodeId = isNonEmptyString(node.node_id) ? node.node_id : undefined;
  const where = { graphId, nodeId };

  checkUnknownKeys(c, node, draft ? [...NODE_KEYS, ...DRAFT_ONLY_NODE_KEYS] : [...NODE_KEYS, ...EXISTING_ONLY_NODE_KEYS], where);

  checkString(c, node, 'node_id', 60, where);
  if (nodeId !== undefined && !(draft ? DRAFT_NODE_ID_PATTERN : EXISTING_NODE_ID_PATTERN).test(nodeId)) {
    c.error('E_ID_FORMAT', draft ? "node_id ต้องขึ้นต้นด้วย 'n' และใช้ได้เฉพาะ a-z 0-9 และ _" : 'node_id ใช้ได้เฉพาะ a-z 0-9 และ _', where);
  }

  const type = node.type;
  if (typeof type !== 'string' || !(NODE_TYPES as readonly string[]).includes(type)) {
    c.error('E_ENUM', `type ต้องเป็นหนึ่งใน ${NODE_TYPES.join(', ')}`, where);
    return;
  }

  // ---- ฟิลด์ที่ต้องมี/ห้ามมี ตามชนิดโหนด (ตรงกับ allOf ใน schema v2) ----
  const spec: Record<string, { required: string[]; forbidden: string[] }> = {
    checkpoint: { required: ['question', 'on_yes', 'on_no'], forbidden: ['next', 'content', 'prompt', 'outcome_kind', 'store_as', 'on_invalid', 'input_type', 'pattern'] },
    instruction: { required: ['content', 'next'], forbidden: ['on_yes', 'on_no', 'question', 'prompt', 'outcome_kind', 'store_as', 'on_invalid', 'input_type', 'pattern'] },
    input: { required: ['prompt', 'input_type', 'store_as', 'next'], forbidden: ['on_yes', 'on_no', 'content', 'question', 'outcome_kind'] },
    resolution: { required: ['content', 'outcome_kind'], forbidden: ['on_yes', 'on_no', 'next', 'question', 'prompt', 'store_as', 'on_invalid', 'input_type', 'pattern'] },
    escalation: { required: ['content', 'outcome_kind'], forbidden: ['on_yes', 'on_no', 'next', 'question', 'prompt', 'store_as', 'on_invalid', 'input_type', 'pattern'] },
  };
  const { required, forbidden } = spec[type];
  for (const key of required) {
    if (node[key] === undefined || node[key] === null || node[key] === '') c.error('E_MISSING_FIELD', `โหนดชนิด ${type} ต้องมี '${key}'`, where);
  }
  for (const key of forbidden) {
    if (node[key] !== undefined) {
      // ปลายทาง (terminal) ห้ามมีขาออก — แยกรหัสให้อ่านรายงานง่าย
      const edge = (EDGE_KEYS as readonly string[]).includes(key);
      c.error(TERMINAL_TYPES.includes(type) && edge ? 'E_TERMINAL_EDGE' : 'E_FORBIDDEN_FIELD', `โหนดชนิด ${type} ต้องไม่มี '${key}'`, where);
    }
  }

  for (const key of TEXT_KEYS) {
    if (node[key] !== undefined) checkString(c, node, key, MAX_NODE_TEXT, where, false);
  }
  for (const key of EDGE_KEYS) {
    if (node[key] !== undefined && !isNonEmptyString(node[key])) c.error('E_SHAPE', `'${key}' ต้องเป็น node_id`, where);
  }
  checkEnum(c, node, 'outcome_kind', OUTCOME_KINDS, where);
  checkEnum(c, node, 'input_type', INPUT_TYPES, where);

  if (type === 'input') {
    if (node.store_as !== undefined && (!isNonEmptyString(node.store_as) || !STORE_AS_PATTERN.test(node.store_as) || node.store_as.length > 60)) {
      c.error('E_ID_FORMAT', 'store_as ใช้ได้เฉพาะ a-z 0-9 และ _ (ไม่เกิน 60)', where);
    }
    if (node.pattern !== undefined) {
      if (typeof node.pattern !== 'string' || node.pattern.length > MAX_PATTERN) {
        c.error('E_TOO_LONG', `pattern ต้องเป็นข้อความไม่เกิน ${MAX_PATTERN} ตัวอักษร`, where);
      } else {
        try {
          new RegExp(node.pattern);
        } catch {
          c.error('E_BAD_REGEX', 'pattern ไม่ใช่นิพจน์ปกติ (regex) ที่ถูกต้อง', where);
        }
      }
    }
  }

  // ---- ความปลอดภัย ----
  const critical = node.safety_critical;
  if (critical !== undefined && typeof critical !== 'boolean') c.error('E_SHAPE', 'safety_critical ต้องเป็น true/false', where);
  if (node.safety_warning !== undefined) checkString(c, node, 'safety_warning', MAX_SAFETY_WARNING, where, false);
  if (critical === true) {
    if (type !== 'instruction') c.error('E_SAFETY_PLACEMENT', `safety_critical ใช้ได้เฉพาะโหนด instruction (พบบนโหนด ${type})`, where);
    if (!isNonEmptyString(node.safety_warning)) c.error('E_SAFETY_NO_WARNING', 'safety_critical ต้องมี safety_warning (ด่านความปลอดภัยจะแสดงกล่องคำเตือนว่าง)', where);
  } else if (node.safety_warning !== undefined) {
    c.error('E_SAFETY_WARNING_WITHOUT_FLAG', 'มี safety_warning แต่ไม่ได้ตั้ง safety_critical เป็น true (คำเตือนจะไม่ถูกบังคับให้ยืนยัน)', where);
  }

  // ---- source_page (เฉพาะร่าง) ----
  if (options.mode === 'draft') {
    const page = node.source_page;
    if (!isPositiveInt(page)) {
      c.error('E_SOURCE_PAGE_MISSING', 'ทุกโหนดต้องระบุ source_page (เลขหน้าในคู่มือที่โหนดนี้มาจาก)', where);
    } else if (options.pages !== undefined && !options.pages.has(page)) {
      c.error('E_SOURCE_PAGE_OUTSIDE', `source_page ${page} ไม่อยู่ในหน้าที่อัปโหลด/ไม่มีข้อความ`, where);
    } else {
      sourcePages.push(page);
    }
  }
}

// ============================================================
// โครงสร้างกราฟ: ลูกศร การเข้าถึง ทางออก วงวน ตัวแปร ความยาวเส้นทาง คำเตือนความปลอดภัย
// ============================================================

function edgesOf(node: Obj): Array<{ key: string; to: string }> {
  const edges: Array<{ key: string; to: string }> = [];
  for (const key of EDGE_KEYS) {
    const to = node[key];
    if (typeof to === 'string' && to !== '') edges.push({ key, to });
  }
  return edges;
}

function textOf(node: Obj): string {
  return TEXT_KEYS.map((key) => (typeof node[key] === 'string' ? (node[key] as string) : '')).join(' ');
}

function validateStructure(
  c: Collector,
  graph: Obj,
  nodes: Map<string, Obj>,
  graphId: string | undefined,
  options: ValidateOptions,
  sourcePages: number[],
): void {
  const g = { graphId };
  const entry = typeof graph.entry_node === 'string' ? graph.entry_node : undefined;

  // ---- entry และลูกศรทุกเส้นต้องชี้โหนดที่มีอยู่ ----
  if (entry !== undefined && !nodes.has(entry)) c.error('E_ENTRY_MISSING', `entry_node '${entry}' ไม่มีอยู่ในผัง`, g);
  let edgesOk = true;
  for (const [id, node] of nodes) {
    for (const { key, to } of edgesOf(node)) {
      if (!nodes.has(to)) {
        edgesOk = false;
        c.error('E_EDGE_TARGET_MISSING', `${key} ชี้ไป '${to}' ที่ไม่มีอยู่`, { graphId, nodeId: id });
      }
    }
  }

  const terminals = [...nodes.entries()].filter(([, n]) => typeof n.type === 'string' && TERMINAL_TYPES.includes(n.type)).map(([id]) => id);
  if (terminals.length === 0) c.error('E_NO_TERMINAL', 'ผังไม่มีโหนดสิ้นสุด (resolution/escalation) เลย', g);

  if (entry === undefined || !nodes.has(entry) || !edgesOk) return; // โครงสร้างพังแล้ว ตรวจต่อไม่มีความหมาย

  // ---- ทุกโหนดเดินถึงได้จาก entry ----
  const reachable = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const { to } of edgesOf(nodes.get(id) as Obj)) stack.push(to);
  }
  for (const id of [...nodes.keys()].sort()) {
    if (!reachable.has(id)) c.error('E_UNREACHABLE', `โหนดนี้เดินถึงไม่ได้จาก entry_node '${entry}'`, { graphId, nodeId: id });
  }

  // ---- ทุกโหนดไปถึง terminal ได้ (กันวนไม่รู้จบ) ----
  const canFinish = new Set<string>(terminals);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, node] of nodes) {
      if (canFinish.has(id)) continue;
      if (edgesOf(node).some(({ to }) => canFinish.has(to))) {
        canFinish.add(id);
        changed = true;
      }
    }
  }
  for (const id of [...nodes.keys()].sort()) {
    if (!canFinish.has(id)) c.error('E_NO_EXIT', 'โหนดนี้ไปถึงโหนดสิ้นสุดไม่ได้ (อาจวนไม่รู้จบ)', { graphId, nodeId: id });
  }

  // ---- วงวน (อนุญาตได้ถ้ามีทางออก · แจ้งเป็น warning ให้ผู้ตรวจยืนยันว่าตั้งใจ) + ความยาวเส้นทาง ----
  const backEdges = findBackEdges(entry, nodes);
  if (backEdges.length > 0) {
    c.warn('W_CYCLE', `มีวนกลับ ${backEdges.map(([a, b]) => `${a} → ${b}`).join(', ')} (ตรวจว่าตั้งใจ เช่น ถามซ้ำ/ลองใหม่)`, g);
  }
  const longest = longestPath(entry, nodes, backEdges);
  if (longest > MAX_PATH_LENGTH) {
    c.error('E_PATH_TOO_LONG', `เส้นทางที่ยาวที่สุดมี ${longest} โหนด เกิน ${MAX_PATH_LENGTH}`, g);
  }

  // ---- ตัวแปร {{var}} ต้องถูกเก็บโดย input node ก่อนใช้ ทุกเส้นทาง ----
  checkTemplateVariables(c, nodes, entry, graphId);

  // ---- คำเตือน ----
  if (!terminals.some((id) => (nodes.get(id) as Obj).type === 'escalation')) {
    c.warn('W_NO_ESCALATION', 'ผังไม่มีโหนดส่งต่อช่าง (escalation) เลย — ผู้ใช้ที่แก้ไม่ได้จะไม่มีทางไปต่อ', g);
  }
  for (const [id, node] of nodes) {
    if (node.type === 'input' && typeof node.pattern === 'string' && node.on_invalid === undefined) {
      c.warn('W_NO_ON_INVALID', 'input มี pattern แต่ไม่มี on_invalid (ถ้าตอบผิดรูปแบบจะถามซ้ำโหนดเดิม)', { graphId, nodeId: id });
    }
    if (options.mode === 'draft' && node.type === 'instruction' && node.safety_critical !== true && RISK_PATTERN.test(textOf(node))) {
      c.warn('W_NODE_RISK', 'ข้อความของโหนดนี้พูดถึงเรื่องที่อาจอันตราย (ไฟฟ้า/ปลั๊ก/แก๊ส/ความร้อน/การรื้อเครื่อง) แต่ไม่ได้ตั้ง safety_critical', { graphId, nodeId: id });
    }
  }
  if (options.mode === 'draft' && options.pages !== undefined) {
    const hasGate = [...nodes.values()].some((n) => n.safety_critical === true);
    const riskyPages = [...new Set(sourcePages)].filter((p) => RISK_PATTERN.test(options.pages?.get(p) ?? '')).sort((a, b) => a - b);
    if (!hasGate && riskyPages.length > 0) {
      c.warn('W_PAGE_RISK', `หน้าต้นฉบับ ${riskyPages.join(', ')} มีคำที่บ่งชี้อันตราย แต่ผังนี้ไม่มีด่านความปลอดภัย (safety_critical) เลย — ตรวจว่า LLM ไม่ได้ข้ามคำเตือน`, g);
    }
  }
}

/** ลูกศรที่ย้อนกลับไปโหนดที่อยู่บน stack ของ DFS (ไม่ใช้ recursion เพื่อไม่ล้มกับผังใหญ่) */
function findBackEdges(entry: string, nodes: Map<string, Obj>): Array<[string, string]> {
  const state = new Map<string, 'open' | 'done'>();
  const back: Array<[string, string]> = [];
  const frames: Array<{ id: string; edges: string[]; index: number }> = [];

  const push = (id: string) => {
    state.set(id, 'open');
    frames.push({ id, edges: edgesOf(nodes.get(id) as Obj).map((e) => e.to), index: 0 });
  };
  push(entry);
  while (frames.length > 0) {
    const frame = frames[frames.length - 1];
    if (frame.index >= frame.edges.length) {
      state.set(frame.id, 'done');
      frames.pop();
      continue;
    }
    const to = frame.edges[frame.index++];
    const s = state.get(to);
    if (s === undefined) push(to);
    else if (s === 'open') back.push([frame.id, to]);
  }
  return back;
}

/** จำนวนโหนดในเส้นทางที่ยาวที่สุดจาก entry โดยไม่นับลูกศรย้อนกลับ (DP บน DAG) */
function longestPath(entry: string, nodes: Map<string, Obj>, backEdges: Array<[string, string]>): number {
  const skip = new Set(backEdges.map(([a, b]) => `${a}\u0000${b}`));
  const memo = new Map<string, number>();
  const order: string[] = [];
  const seen = new Set<string>();
  const stack: Array<{ id: string; index: number; edges: string[] }> = [];
  const open = (id: string) => {
    seen.add(id);
    stack.push({ id, index: 0, edges: edgesOf(nodes.get(id) as Obj).map((e) => e.to).filter((to) => !skip.has(`${id}\u0000${to}`)) });
  };
  open(entry);
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.index < frame.edges.length) {
      const to = frame.edges[frame.index++];
      if (!seen.has(to)) open(to);
    } else {
      order.push(frame.id);
      stack.pop();
    }
  }
  for (const id of order) {
    const next = edgesOf(nodes.get(id) as Obj).map((e) => e.to).filter((to) => !skip.has(`${id}\u0000${to}`));
    memo.set(id, 1 + Math.max(0, ...next.map((to) => memo.get(to) ?? 0)));
  }
  return memo.get(entry) ?? 0;
}

function checkTemplateVariables(c: Collector, nodes: Map<string, Obj>, entry: string, graphId: string | undefined): void {
  const stored = new Set<string>();
  for (const node of nodes.values()) {
    if (node.type === 'input' && typeof node.store_as === 'string') stored.add(node.store_as);
  }

  // ตัวแปรที่การันตีว่าถูกเก็บแล้ว ณ ทางเข้าโหนด = ส่วนร่วมของทุกเส้นทางที่เข้ามา (dataflow แบบ "must-defined")
  const defined = new Map<string, Set<string>>();
  defined.set(entry, new Set());
  const queue = [entry];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const node = nodes.get(id) as Obj;
    const incoming = defined.get(id) as Set<string>;
    for (const { key, to } of edgesOf(node)) {
      const out = new Set(incoming);
      // on_invalid = ค่าไม่ผ่านการตรวจ จึงยังไม่ถูกเก็บ · next = เก็บแล้ว
      if (node.type === 'input' && key === 'next' && typeof node.store_as === 'string') out.add(node.store_as);
      const current = defined.get(to);
      if (current === undefined) {
        defined.set(to, out);
        queue.push(to);
      } else {
        const meet = new Set([...current].filter((v) => out.has(v)));
        if (meet.size !== current.size) {
          defined.set(to, meet);
          queue.push(to);
        }
      }
    }
  }

  for (const [id, node] of nodes) {
    const guaranteed = defined.get(id);
    if (guaranteed === undefined) continue; // เดินไม่ถึง (รายงานแยกแล้ว)
    for (const match of textOf(node).matchAll(/\{\{(\w+)\}\}/g)) {
      const variable = match[1];
      if (!stored.has(variable)) {
        c.error('E_VAR_UNDEFINED', `ใช้ตัวแปร {{${variable}}} แต่ไม่มี input node ใดเก็บค่านี้ (store_as)`, { graphId, nodeId: id });
      } else if (!guaranteed.has(variable)) {
        c.error('E_VAR_NOT_GUARANTEED', `ใช้ตัวแปร {{${variable}}} แต่มีเส้นทางที่มาถึงโหนดนี้โดยยังไม่ได้ถามค่านี้`, { graphId, nodeId: id });
      }
    }
  }
}
