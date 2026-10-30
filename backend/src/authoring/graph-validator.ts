import { isPlainObject } from '../common/helpers';

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

export const DEVICE_CATEGORIES = ['Microwave', 'Refrigerator', 'Washing Machine', 'Television'] as const;
const NODE_TYPES = ['checkpoint', 'instruction', 'input', 'resolution', 'escalation'] as const;
const OUTCOME_KINDS = ['user_fixed', 'normal_behavior', 'handoff_informed', 'handoff_unknown'] as const;
const INPUT_TYPES = ['error_code', 'model_number', 'number', 'text'] as const;
const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export const MAX_NODES_PER_GRAPH = 60;
const MAX_PATH_LENGTH = 40;
const MAX_NODE_TEXT = 2000;
const MAX_SAFETY_WARNING = 1000;
const MAX_PATTERN = 200;
export const MAX_ALIASES = 10;

const EDGE_KEYS = ['on_yes', 'on_no', 'next', 'on_invalid'] as const;
const TEXT_KEYS = ['question', 'content', 'prompt'] as const;
const TERMINAL_TYPES: readonly string[] = ['resolution', 'escalation'];

type NodeType = (typeof NODE_TYPES)[number];

const TYPE_DEPENDENT_KEYS = ['question', 'content', 'prompt', 'on_yes', 'on_no', 'next', 'on_invalid', 'input_type', 'pattern', 'store_as', 'outcome_kind'];
const NODE_SPEC: Record<NodeType, { required: string[]; optional?: string[] }> = {
  checkpoint: { required: ['question', 'on_yes', 'on_no'] },
  instruction: { required: ['content', 'next'] },
  input: { required: ['prompt', 'input_type', 'store_as', 'next'], optional: ['on_invalid', 'pattern'] },
  resolution: { required: ['content', 'outcome_kind'] },
  escalation: { required: ['content', 'outcome_kind'] },
};

const MANUAL_KEYS = ['manual_id', 'device_category', 'brand', 'model_pattern', 'source_manual', 'count', 'display_name', 'model_aliases', 'graphs'];
const GRAPH_KEYS = [
  'graph_id', 'device_category', 'brand', 'model_pattern', 'entry_symptom', 'entry_symptom_th',
  'entry_symptom_aliases', 'source', 'page_range', 'source_chunk_id', 'severity', 'difficulty', 'entry_node', 'nodes',
];
const NODE_KEYS = [
  'node_id', 'type', 'question', 'content', 'prompt', 'on_yes', 'on_no', 'next', 'on_invalid', 'input_type', 'pattern',
  'store_as', 'outcome_kind', 'safety_critical', 'safety_warning', 'source_page',
];
const RISK_PATTERN =/\b(unplug\w*|power cord|power plug|plug(?:ged)? (?:in|out)|electric\w*|voltage|live wire|gas|flammable|boiling|hot water|refrigerant|short[- ]circuit\w*|disassembl\w*|remove the (?:rear|back|cover|panel))\b|ปลั๊ก|สายไฟ|ไฟฟ้า|ไฟดูด|ไฟรั่ว|แรงดัน|แก๊ส|ก๊าซ|ติดไฟ|ร้อนจัด|น้ำร้อน|สารทำความเย็น|ลัดวงจร|ถอดฝา|ฝาหลัง|แกะเครื่อง/i;
const ID_PATTERN = /^[a-z0-9_]+$/;
const ID_HINT = 'ใช้ได้เฉพาะ a-z 0-9 และ _';
const DRAFT_NODE_ID_PATTERN = /^n[a-z0-9_]+$/;




type Obj = Record<string, unknown>;

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

interface Rule {
  max?: number;
  oneOf?: readonly string[];
  re?: RegExp;
  hint?: string;
  optional?: boolean;
}

type Where = { graphId?: string; nodeId?: string };

const idRule = (max: number): Rule => ({ max, re: ID_PATTERN, hint: ID_HINT });

export function validateManual(manual: unknown, pages: ReadonlyMap<number, string>): ValidationReport {
  return new Validator(pages).run(manual);
}

class Validator {
  private readonly errors: ValidationIssue[] = [];
  private readonly warnings: ValidationIssue[] = [];

  constructor(private readonly pages: ReadonlyMap<number, string>) {}

  run(manual: unknown): ValidationReport {
    let graphCount = 0;
    let nodeCount = 0;
    const report = (): ValidationReport => ({ errors: this.errors, warnings: this.warnings, stats: { graphs: graphCount, nodes: nodeCount }, validatedAt: new Date().toISOString() });

    if (!isPlainObject(manual)) {
      this.error('E_SHAPE', 'ข้อมูลคู่มือต้องเป็น object');
      return report();
    }

    this.unknownKeys(manual, MANUAL_KEYS);

    this.field(manual, 'manual_id', idRule(80));
    this.field(manual, 'device_category', { oneOf: DEVICE_CATEGORIES });
    this.field(manual, 'brand', { max: 40 });
    this.field(manual, 'model_pattern', { max: 60 });
    this.field(manual, 'source_manual', { max: 200 });
    this.field(manual, 'display_name', { max: 120, optional: true });
    if (manual.model_aliases !== undefined && !(Array.isArray(manual.model_aliases) && manual.model_aliases.every((a) => nonEmpty(a) !== undefined))) {
      this.error('E_SHAPE', 'model_aliases ต้องเป็นอาร์เรย์ของข้อความที่ไม่ว่าง');
    }

    if (!Array.isArray(manual.graphs) || manual.graphs.length === 0) {
      this.error('E_NO_GRAPHS', 'ต้องมีผังอย่างน้อย 1 ผัง');
      return report();
    }

    const seenGraphIds = new Set<string>();
    for (const rawGraph of manual.graphs) {
      graphCount += 1;
      if (!isPlainObject(rawGraph)) {
        this.error('E_SHAPE', 'ผังแต่ละอันต้องเป็น object');
        continue;
      }
      const graphId = nonEmpty(rawGraph.graph_id);
      if (graphId !== undefined) {
        if (seenGraphIds.has(graphId)) this.error('E_DUPLICATE_GRAPH', `graph_id '${graphId}' ซ้ำ`, { graphId });
        seenGraphIds.add(graphId);
      }
      nodeCount += this.graph(rawGraph);
    }

    return report();
  }

  private error(code: string, message: string, where: Where = {}): void {
    this.errors.push({ code, message, ...where });
  }

  private warn(code: string, message: string, where: Where = {}): void {
    this.warnings.push({ code, message, ...where });
  }

  private field(obj: Obj, key: string, rule: Rule, where: Where = {}): void {
    const value = obj[key];
    if (value === undefined) {
      if (!rule.optional) this.error('E_SHAPE', `ต้องมีฟิลด์ '${key}'`, where);
      return;
    }
    const text = nonEmpty(value);
    if (rule.oneOf !== undefined) {
      if (typeof value !== 'string' || !rule.oneOf.includes(value)) this.error('E_ENUM', `'${key}' ต้องเป็นหนึ่งใน ${rule.oneOf.join(', ')}`, where);
    } else if (text === undefined) {
      this.error('E_SHAPE', `'${key}' ต้องเป็นข้อความที่ไม่ว่าง`, where);
    } else if (rule.max !== undefined && text.length > rule.max) {
      this.error('E_TOO_LONG', `'${key}' ยาวเกิน ${rule.max} ตัวอักษร`, where);
    } else if (rule.re !== undefined && !rule.re.test(text)) {
      this.error('E_ID_FORMAT', `${key} ${rule.hint}`, where);
    }
  }

  private unknownKeys(obj: Obj, allowed: readonly string[], where: Where = {}): void {
    for (const key of Object.keys(obj)) {
      if (!allowed.includes(key)) this.error('E_UNKNOWN_FIELD', `ฟิลด์ '${key}' ไม่อยู่ในรูปแบบที่อนุญาต`, where);
    }
  }

  private graph(graph: Obj): number {
    const graphId = nonEmpty(graph.graph_id);
    const g = { graphId };

    this.unknownKeys(graph, GRAPH_KEYS, g);

    this.field(graph, 'graph_id', idRule(120), g);
    this.field(graph, 'entry_symptom', { max: 500 }, g);
    this.field(graph, 'entry_symptom_th', { max: 500, optional: true }, g);
    this.field(graph, 'source', { max: 200 }, g);
    this.field(graph, 'source_chunk_id', { max: 200 }, g);
    this.field(graph, 'severity', { oneOf: SEVERITIES, optional: true }, g);
    this.field(graph, 'difficulty', { oneOf: DIFFICULTIES, optional: true }, g);

    const aliases = graph.entry_symptom_aliases;
    if (aliases !== undefined) {
      if (!Array.isArray(aliases) || !aliases.every((a) => nonEmpty(a) !== undefined && a.length <= 120)) {
        this.error('E_SHAPE', 'entry_symptom_aliases ต้องเป็นอาร์เรย์ของข้อความที่ไม่ว่าง ยาวไม่เกิน 120', g);
      } else if (aliases.length > MAX_ALIASES) {
        this.error('E_TOO_LONG', `entry_symptom_aliases มีได้ไม่เกิน ${MAX_ALIASES} รายการ`, g);
      }
    }

    const pageRange = graph.page_range;
    let range: [number, number] | undefined;
    if (!Array.isArray(pageRange) || pageRange.length !== 2 || !isPositiveInt(pageRange[0]) || !isPositiveInt(pageRange[1])) {
      this.error('E_SHAPE', 'page_range ต้องเป็น [หน้าแรก, หน้าสุดท้าย] จำนวนเต็ม ≥ 1', g);
    } else if (pageRange[0] > pageRange[1]) {
      this.error('E_PAGE_RANGE', 'page_range: หน้าแรกต้องไม่มากกว่าหน้าสุดท้าย', g);
    } else {
      range = [pageRange[0], pageRange[1]];
    }

    this.field(graph, 'entry_node', { max: 60 }, g);

    const rawNodes = graph.nodes;
    if (!Array.isArray(rawNodes) || rawNodes.length === 0) {
      this.error('E_NO_NODES', 'ผังต้องมีโหนดอย่างน้อย 1 โหนด', g);
      return 0;
    }
    if (rawNodes.length > MAX_NODES_PER_GRAPH) {
      this.error('E_TOO_MANY_NODES', `ผังมีโหนดได้ไม่เกิน ${MAX_NODES_PER_GRAPH} โหนด (พบ ${rawNodes.length})`, g);
      return 0; // ใหญ่เกินกำหนด หยุดตรวจผังนี้ (ผู้ตรวจต้องแบ่งผังก่อน)
    }

    // โหนดทีละตัว
    const nodes = new Map<string, Obj>();
    const sourcePages: number[] = [];
    for (const raw of rawNodes) {
      if (!isPlainObject(raw)) {
        this.error('E_SHAPE', 'โหนดแต่ละอันต้องเป็น object', g);
        continue;
      }
      const nodeId = nonEmpty(raw.node_id);
      if (nodeId !== undefined) {
        if (nodes.has(nodeId)) this.error('E_DUPLICATE_NODE', `node_id '${nodeId}' ซ้ำในผังเดียวกัน`, { graphId, nodeId });
        nodes.set(nodeId, raw);
      }
      this.node(raw, graphId, sourcePages);
    }

    if (range !== undefined && sourcePages.length > 0) {
      const [first, last] = range;
      const lowest = Math.min(...sourcePages);
      const highest = Math.max(...sourcePages);
      if (lowest < first || highest > last) {
        this.error('E_PAGE_RANGE', `page_range [${first}, ${last}] ไม่ครอบคลุมหน้าที่โหนดอ้างอิง (${lowest}–${highest})`, g);
      }
    }

    this.structure(graph, nodes, graphId, sourcePages);
    return nodes.size;
  }

  private node(node: Obj, graphId: string | undefined, sourcePages: number[]): void {
    const nodeId = nonEmpty(node.node_id);
    const where = { graphId, nodeId };

    this.unknownKeys(node, NODE_KEYS, where);

    this.field(node, 'node_id', { max: 60, re: DRAFT_NODE_ID_PATTERN, hint: `ต้องขึ้นต้นด้วย 'n' และ${ID_HINT}` }, where);

    const type = node.type;
    if (typeof type !== 'string' || !(NODE_TYPES as readonly string[]).includes(type)) {
      this.error('E_ENUM', `type ต้องเป็นหนึ่งใน ${NODE_TYPES.join(', ')}`, where);
      return;
    }

    
    const { required, optional = [] } = NODE_SPEC[type as NodeType];
    for (const key of required) {
      if (node[key] === undefined || node[key] === null || node[key] === '') this.error('E_MISSING_FIELD', `โหนดชนิด ${type} ต้องมี '${key}'`, where);
    }
    for (const key of TYPE_DEPENDENT_KEYS) {
      if (node[key] === undefined || required.includes(key) || optional.includes(key)) continue;
      
      const terminalEdge = TERMINAL_TYPES.includes(type) && (EDGE_KEYS as readonly string[]).includes(key);
      this.error(terminalEdge ? 'E_TERMINAL_EDGE' : 'E_FORBIDDEN_FIELD', `โหนดชนิด ${type} ต้องไม่มี '${key}'`, where);
    }

    for (const key of TEXT_KEYS) this.field(node, key, { max: MAX_NODE_TEXT, optional: true }, where);
    for (const key of EDGE_KEYS) {
      if (node[key] !== undefined && nonEmpty(node[key]) === undefined) this.error('E_SHAPE', `'${key}' ต้องเป็น node_id`, where);
    }
    this.field(node, 'outcome_kind', { oneOf: OUTCOME_KINDS, optional: true }, where);
    this.field(node, 'input_type', { oneOf: INPUT_TYPES, optional: true }, where);

    if (type === 'input') {
      const storeAs = nonEmpty(node.store_as);
      if (node.store_as !== undefined && (storeAs === undefined || !ID_PATTERN.test(storeAs) || storeAs.length > 60)) {
        this.error('E_ID_FORMAT', 'store_as ใช้ได้เฉพาะ a-z 0-9 และ _ (ไม่เกิน 60)', where);
      }
      if (node.pattern !== undefined) {
        if (typeof node.pattern !== 'string' || node.pattern.length > MAX_PATTERN) {
          this.error('E_TOO_LONG', `pattern ต้องเป็นข้อความไม่เกิน ${MAX_PATTERN} ตัวอักษร`, where);
        } else {
          try {
            new RegExp(node.pattern);
          } catch {
            this.error('E_BAD_REGEX', 'pattern ไม่ใช่นิพจน์ปกติ (regex) ที่ถูกต้อง', where);
          }
        }
      }
    }

    // ความปลอดภัย
    const critical = node.safety_critical;
    if (critical !== undefined && typeof critical !== 'boolean') this.error('E_SHAPE', 'safety_critical ต้องเป็น true/false', where);
    this.field(node, 'safety_warning', { max: MAX_SAFETY_WARNING, optional: true }, where);
    if (critical === true) {
      if (type !== 'instruction') this.error('E_SAFETY_PLACEMENT', `safety_critical ใช้ได้เฉพาะโหนด instruction (พบบนโหนด ${type})`, where);
      if (nonEmpty(node.safety_warning) === undefined) this.error('E_SAFETY_NO_WARNING', 'safety_critical ต้องมี safety_warning (ด่านความปลอดภัยจะแสดงกล่องคำเตือนว่าง)', where);
    } else if (node.safety_warning !== undefined) {
      this.error('E_SAFETY_WARNING_WITHOUT_FLAG', 'มี safety_warning แต่ไม่ได้ตั้ง safety_critical เป็น true (คำเตือนจะไม่ถูกบังคับให้ยืนยัน)', where);
    }

    // source_page
    const page = node.source_page;
    if (!isPositiveInt(page)) {
        this.error('E_SOURCE_PAGE_MISSING', 'ทุกโหนดต้องระบุ source_page (เลขหน้าในคู่มือที่โหนดนี้มาจาก)', where);
    } else if (!this.pages.has(page)) {
        this.error('E_SOURCE_PAGE_OUTSIDE', `source_page ${page} ไม่อยู่ในหน้าที่อัปโหลด/ไม่มีข้อความ`, where);
    } else {
      sourcePages.push(page);
    }
  }


  private structure(graph: Obj, nodes: Map<string, Obj>, graphId: string | undefined, sourcePages: number[]): void {
    const g = { graphId };
    const entry = typeof graph.entry_node === 'string' ? graph.entry_node : undefined;

    if (entry !== undefined && !nodes.has(entry)) this.error('E_ENTRY_MISSING', `entry_node '${entry}' ไม่มีอยู่ในผัง`, g);
    let edgesOk = true;
    for (const [id, node] of nodes) {
      for (const [key, to] of edgesOf(node)) {
        if (!nodes.has(to)) {
          edgesOk = false;
          this.error('E_EDGE_TARGET_MISSING', `${key} ชี้ไป '${to}' ที่ไม่มีอยู่`, { graphId, nodeId: id });
        }
      }
    }

    const terminals = [...nodes.entries()].filter(([, n]) => typeof n.type === 'string' && TERMINAL_TYPES.includes(n.type)).map(([id]) => id);
    if (terminals.length === 0) this.error('E_NO_TERMINAL', 'ผังไม่มีโหนดสิ้นสุด (resolution/escalation) เลย', g);

    if (entry === undefined || !nodes.has(entry) || !edgesOk) return;

    const reachable = reach(entry, nodes);
    const canFinish = new Set<string>(terminals);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [id, node] of nodes) {
        if (canFinish.has(id)) continue;
        if (edgesOf(node).some(([, to]) => canFinish.has(to))) {
          canFinish.add(id);
          changed = true;
        }
      }
    }
    for (const id of [...nodes.keys()].sort()) {
      if (!reachable.has(id)) this.error('E_UNREACHABLE', `โหนดนี้เดินถึงไม่ได้จาก entry_node '${entry}'`, { graphId, nodeId: id });
      if (!canFinish.has(id)) this.error('E_NO_EXIT', 'โหนดนี้ไปถึงโหนดสิ้นสุดไม่ได้ (อาจวนไม่รู้จบ)', { graphId, nodeId: id });
    }

    // วงวน (อนุญาตได้ถ้ามีทางออก · แจ้งเป็น warning ให้ผู้ตรวจยืนยันว่าตั้งใจ) + ความยาวเส้นทาง
    const { back, longest } = analyzePaths(entry, nodes);
    if (back.length > 0) {
      this.warn('W_CYCLE', `มีวนกลับ ${back.map(([a, b]) => `${a} → ${b}`).join(', ')} (ตรวจว่าตั้งใจ เช่น ถามซ้ำ/ลองใหม่)`, g);
    }
    if (longest > MAX_PATH_LENGTH) {
      this.error('E_PATH_TOO_LONG', `เส้นทางที่ยาวที่สุดมี ${longest} โหนด เกิน ${MAX_PATH_LENGTH}`, g);
    }

    // ตัวแปร {{var}} ต้องถูกเก็บโดย input node ก่อนใช้ ทุกเส้นทาง
    this.templateVariables(nodes, entry, graphId, reachable);

    // คำเตือน
    if (!terminals.some((id) => (nodes.get(id) as Obj).type === 'escalation')) {
      this.warn('W_NO_ESCALATION', 'ผังไม่มีโหนดส่งต่อช่าง (escalation) เลย — ผู้ใช้ที่แก้ไม่ได้จะไม่มีทางไปต่อ', g);
    }
    for (const [id, node] of nodes) {
      if (node.type === 'input' && typeof node.pattern === 'string' && node.on_invalid === undefined) {
        this.warn('W_NO_ON_INVALID', 'input มี pattern แต่ไม่มี on_invalid (ถ้าตอบผิดรูปแบบจะถามซ้ำโหนดเดิม)', { graphId, nodeId: id });
      }
      if (node.type === 'instruction' && node.safety_critical !== true && RISK_PATTERN.test(textOf(node))) {
        this.warn('W_NODE_RISK', 'ข้อความของโหนดนี้พูดถึงเรื่องที่อาจอันตราย (ไฟฟ้า/ปลั๊ก/แก๊ส/ความร้อน/การรื้อเครื่อง) แต่ไม่ได้ตั้ง safety_critical', { graphId, nodeId: id });
      }
    }
    const hasGate = [...nodes.values()].some((n) => n.safety_critical === true);
    const riskyPages = [...new Set(sourcePages)].filter((p) => RISK_PATTERN.test(this.pages.get(p) ?? '')).sort((a, b) => a - b);
    if (!hasGate && riskyPages.length > 0) {
      this.warn('W_PAGE_RISK', `หน้าต้นฉบับ ${riskyPages.join(', ')} มีคำที่บ่งชี้อันตราย แต่ผังนี้ไม่มีด่านความปลอดภัย (safety_critical) เลย — ตรวจว่า LLM ไม่ได้ข้ามคำเตือน`, g);
    }
  }

  private templateVariables(nodes: Map<string, Obj>, entry: string, graphId: string | undefined, reachable: Set<string>): void {
    const stored = new Set<string>();
    for (const node of nodes.values()) {
      if (node.type === 'input' && typeof node.store_as === 'string') stored.add(node.store_as);
    }

    const reachedWithout = new Map<string, Set<string>>();
    for (const variable of stored) {
      reachedWithout.set(variable, reach(entry, nodes, (node, key) => node.type === 'input' && key === 'next' && node.store_as === variable));
    }

    for (const [id, node] of nodes) {
      if (!reachable.has(id)) continue; // เดินไม่ถึง (รายงานแยกแล้ว)
      for (const match of textOf(node).matchAll(/\{\{(\w+)\}\}/g)) {
        const variable = match[1];
        if (!stored.has(variable)) {
          this.error('E_VAR_UNDEFINED', `ใช้ตัวแปร {{${variable}}} แต่ไม่มี input node ใดเก็บค่านี้ (store_as)`, { graphId, nodeId: id });
        } else if (reachedWithout.get(variable)?.has(id)) {
          this.error('E_VAR_NOT_GUARANTEED', `ใช้ตัวแปร {{${variable}}} แต่มีเส้นทางที่มาถึงโหนดนี้โดยยังไม่ได้ถามค่านี้`, { graphId, nodeId: id });
        }
      }
    }
  }
}

function edgesOf(node: Obj): Array<[key: string, to: string]> {
  const edges: Array<[string, string]> = [];
  for (const key of EDGE_KEYS) {
    const to = node[key];
    if (typeof to === 'string' && to !== '') edges.push([key, to]);
  }
  return edges;
}

function textOf(node: Obj): string {
  return TEXT_KEYS.map((key) => (typeof node[key] === 'string' ? (node[key] as string) : '')).join(' ');
}

function reach(entry: string, nodes: Map<string, Obj>, skip?: (node: Obj, key: string) => boolean): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = nodes.get(id) as Obj;
    for (const [key, to] of edgesOf(node)) if (!skip?.(node, key)) stack.push(to);
  }
  return seen;
}

function analyzePaths(entry: string, nodes: Map<string, Obj>): { back: Array<[string, string]>; longest: number } {
  const back: Array<[string, string]> = [];
  const inProgress = new Set<string>(); 
  const lengthFrom = new Map<string, number>(); 

  function longestFrom(id: string): number {
    const known = lengthFrom.get(id);
    if (known !== undefined) return known;

    inProgress.add(id);
    let longestAfter = 0;
    for (const [, next] of edgesOf(nodes.get(id) as Obj)) {
      if (inProgress.has(next)) back.push([id, next]);
      else longestAfter = Math.max(longestAfter, longestFrom(next));
    }
    inProgress.delete(id);

    lengthFrom.set(id, 1 + longestAfter);
    return 1 + longestAfter;
  }

  return { back, longest: longestFrom(entry) };
}
