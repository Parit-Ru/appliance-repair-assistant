import { isPlainObject } from '../common/helpers';

export interface ValidationIssue {
  code: string;
  message: string;
  flowId?: string;
  stateId?: string;
}

export interface ValidationReport {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  stats: { flows: number; states: number };
  validatedAt: string;
}

export const DEVICE_CATEGORIES = ['Microwave', 'Refrigerator', 'Washing Machine', 'Television'] as const;
const STATE_TYPES = ['checkpoint', 'instruction', 'input', 'resolution', 'escalation'] as const;
const OUTCOME_KINDS = ['user_fixed', 'normal_behavior', 'handoff_informed', 'handoff_unknown'] as const;
const INPUT_TYPES = ['error_code', 'model_number', 'number', 'text'] as const;
const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export const MAX_STATES_PER_FLOW = 60;
const MAX_PATH_LENGTH = 40;
const MAX_STATE_TEXT = 2000;
const MAX_SAFETY_WARNING = 1000;
const MAX_PATTERN = 200;
export const MAX_ALIASES = 10;

const EDGE_KEYS = ['on_yes', 'on_no', 'next', 'on_invalid'] as const;
const TEXT_KEYS = ['question', 'content', 'prompt'] as const;
const TERMINAL_TYPES: readonly string[] = ['resolution', 'escalation'];

type StateType = (typeof STATE_TYPES)[number];

const TYPE_DEPENDENT_KEYS = ['question', 'content', 'prompt', 'on_yes', 'on_no', 'next', 'on_invalid', 'input_type', 'pattern', 'store_as', 'outcome_kind'];
const STATE_SPEC: Record<StateType, { required: string[]; optional?: string[] }> = {
  checkpoint: { required: ['question', 'on_yes', 'on_no'] },
  instruction: { required: ['content', 'next'] },
  input: { required: ['prompt', 'input_type', 'store_as', 'next'], optional: ['on_invalid', 'pattern'] },
  resolution: { required: ['content', 'outcome_kind'] },
  escalation: { required: ['content', 'outcome_kind'] },
};

const MANUAL_KEYS = ['manual_id', 'device_category', 'brand', 'model_pattern', 'source_manual', 'count', 'display_name', 'model_aliases', 'flows'];
const FLOW_KEYS = [
  'flow_id', 'device_category', 'brand', 'model_pattern', 'entry_symptom', 'entry_symptom_th',
  'entry_symptom_aliases', 'source', 'page_range', 'source_chunk_id', 'severity', 'difficulty', 'initial_state', 'states',
];
const STATE_KEYS = [
  'state_id', 'type', 'question', 'content', 'prompt', 'on_yes', 'on_no', 'next', 'on_invalid', 'input_type', 'pattern',
  'store_as', 'outcome_kind', 'safety_critical', 'safety_warning', 'source_page',
];
const RISK_PATTERN =/\b(unplug\w*|power cord|power plug|plug(?:ged)? (?:in|out)|electric\w*|voltage|live wire|gas|flammable|boiling|hot water|refrigerant|short[- ]circuit\w*|disassembl\w*|remove the (?:rear|back|cover|panel))\b|ปลั๊ก|สายไฟ|ไฟฟ้า|ไฟดูด|ไฟรั่ว|แรงดัน|แก๊ส|ก๊าซ|ติดไฟ|ร้อนจัด|น้ำร้อน|สารทำความเย็น|ลัดวงจร|ถอดฝา|ฝาหลัง|แกะเครื่อง/i;
const ID_PATTERN = /^[a-z0-9_]+$/;
const ID_HINT = 'ใช้ได้เฉพาะ a-z 0-9 และ _';
const DRAFT_STATE_ID_PATTERN = /^n[a-z0-9_]+$/;




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

type Where = { flowId?: string; stateId?: string };

const idRule = (max: number): Rule => ({ max, re: ID_PATTERN, hint: ID_HINT });

export function validateManual(manual: unknown, pages: ReadonlyMap<number, string>): ValidationReport {
  return new Validator(pages).run(manual);
}

class Validator {
  private readonly errors: ValidationIssue[] = [];
  private readonly warnings: ValidationIssue[] = [];

  constructor(private readonly pages: ReadonlyMap<number, string>) {}

  run(manual: unknown): ValidationReport {
    let flowCount = 0;
    let stateCount = 0;
    const report = (): ValidationReport => ({ errors: this.errors, warnings: this.warnings, stats: { flows: flowCount, states: stateCount }, validatedAt: new Date().toISOString() });

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

    if (!Array.isArray(manual.flows) || manual.flows.length === 0) {
      this.error('E_NO_FLOWS', 'ต้องมีผังอย่างน้อย 1 ผัง');
      return report();
    }

    const seenFlowIds = new Set<string>();
    for (const rawFlow of manual.flows) {
      flowCount += 1;
      if (!isPlainObject(rawFlow)) {
        this.error('E_SHAPE', 'ผังแต่ละอันต้องเป็น object');
        continue;
      }
      const flowId = nonEmpty(rawFlow.flow_id);
      if (flowId !== undefined) {
        if (seenFlowIds.has(flowId)) this.error('E_DUPLICATE_FLOW', `flow_id '${flowId}' ซ้ำ`, { flowId });
        seenFlowIds.add(flowId);
      }
      stateCount += this.flow(rawFlow);
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

  private flow(flow: Obj): number {
    const flowId = nonEmpty(flow.flow_id);
    const g = { flowId };

    this.unknownKeys(flow, FLOW_KEYS, g);

    this.field(flow, 'flow_id', idRule(120), g);
    this.field(flow, 'entry_symptom', { max: 500 }, g);
    this.field(flow, 'entry_symptom_th', { max: 500, optional: true }, g);
    this.field(flow, 'source', { max: 200 }, g);
    this.field(flow, 'source_chunk_id', { max: 200 }, g);
    this.field(flow, 'severity', { oneOf: SEVERITIES, optional: true }, g);
    this.field(flow, 'difficulty', { oneOf: DIFFICULTIES, optional: true }, g);

    const aliases = flow.entry_symptom_aliases;
    if (aliases !== undefined) {
      if (!Array.isArray(aliases) || !aliases.every((a) => nonEmpty(a) !== undefined && a.length <= 120)) {
        this.error('E_SHAPE', 'entry_symptom_aliases ต้องเป็นอาร์เรย์ของข้อความที่ไม่ว่าง ยาวไม่เกิน 120', g);
      } else if (aliases.length > MAX_ALIASES) {
        this.error('E_TOO_LONG', `entry_symptom_aliases มีได้ไม่เกิน ${MAX_ALIASES} รายการ`, g);
      }
    }

    const pageRange = flow.page_range;
    let range: [number, number] | undefined;
    if (!Array.isArray(pageRange) || pageRange.length !== 2 || !isPositiveInt(pageRange[0]) || !isPositiveInt(pageRange[1])) {
      this.error('E_SHAPE', 'page_range ต้องเป็น [หน้าแรก, หน้าสุดท้าย] จำนวนเต็ม ≥ 1', g);
    } else if (pageRange[0] > pageRange[1]) {
      this.error('E_PAGE_RANGE', 'page_range: หน้าแรกต้องไม่มากกว่าหน้าสุดท้าย', g);
    } else {
      range = [pageRange[0], pageRange[1]];
    }

    this.field(flow, 'initial_state', { max: 60 }, g);

    const rawStates = flow.states;
    if (!Array.isArray(rawStates) || rawStates.length === 0) {
      this.error('E_NO_STATES', 'ผังต้องมีสถานะอย่างน้อย 1 สถานะ', g);
      return 0;
    }
    if (rawStates.length > MAX_STATES_PER_FLOW) {
      this.error('E_TOO_MANY_STATES', `ผังมีสถานะได้ไม่เกิน ${MAX_STATES_PER_FLOW} สถานะ (พบ ${rawStates.length})`, g);
      return 0; // ใหญ่เกินกำหนด หยุดตรวจผังนี้ (ผู้ตรวจต้องแบ่งผังก่อน)
    }

    // สถานะทีละตัว
    const states = new Map<string, Obj>();
    const sourcePages: number[] = [];
    for (const raw of rawStates) {
      if (!isPlainObject(raw)) {
        this.error('E_SHAPE', 'สถานะแต่ละอันต้องเป็น object', g);
        continue;
      }
      const stateId = nonEmpty(raw.state_id);
      if (stateId !== undefined) {
        if (states.has(stateId)) this.error('E_DUPLICATE_STATE', `state_id '${stateId}' ซ้ำในผังเดียวกัน`, { flowId, stateId });
        states.set(stateId, raw);
      }
      this.state(raw, flowId, sourcePages);
    }

    if (range !== undefined && sourcePages.length > 0) {
      const [first, last] = range;
      const lowest = Math.min(...sourcePages);
      const highest = Math.max(...sourcePages);
      if (lowest < first || highest > last) {
        this.error('E_PAGE_RANGE', `page_range [${first}, ${last}] ไม่ครอบคลุมหน้าที่สถานะอ้างอิง (${lowest}–${highest})`, g);
      }
    }

    this.structure(flow, states, flowId, sourcePages);
    return states.size;
  }

  private state(state: Obj, flowId: string | undefined, sourcePages: number[]): void {
    const stateId = nonEmpty(state.state_id);
    const where = { flowId, stateId };

    this.unknownKeys(state, STATE_KEYS, where);

    this.field(state, 'state_id', { max: 60, re: DRAFT_STATE_ID_PATTERN, hint: `ต้องขึ้นต้นด้วย 'n' และ${ID_HINT}` }, where);

    const type = state.type;
    if (typeof type !== 'string' || !(STATE_TYPES as readonly string[]).includes(type)) {
      this.error('E_ENUM', `type ต้องเป็นหนึ่งใน ${STATE_TYPES.join(', ')}`, where);
      return;
    }

    
    const { required, optional = [] } = STATE_SPEC[type as StateType];
    for (const key of required) {
      if (state[key] === undefined || state[key] === null || state[key] === '') this.error('E_MISSING_FIELD', `สถานะชนิด ${type} ต้องมี '${key}'`, where);
    }
    for (const key of TYPE_DEPENDENT_KEYS) {
      if (state[key] === undefined || required.includes(key) || optional.includes(key)) continue;
      
      const terminalEdge = TERMINAL_TYPES.includes(type) && (EDGE_KEYS as readonly string[]).includes(key);
      this.error(terminalEdge ? 'E_TERMINAL_EDGE' : 'E_FORBIDDEN_FIELD', `สถานะชนิด ${type} ต้องไม่มี '${key}'`, where);
    }

    for (const key of TEXT_KEYS) this.field(state, key, { max: MAX_STATE_TEXT, optional: true }, where);
    for (const key of EDGE_KEYS) {
      if (state[key] !== undefined && nonEmpty(state[key]) === undefined) this.error('E_SHAPE', `'${key}' ต้องเป็น state_id`, where);
    }
    this.field(state, 'outcome_kind', { oneOf: OUTCOME_KINDS, optional: true }, where);
    this.field(state, 'input_type', { oneOf: INPUT_TYPES, optional: true }, where);

    if (type === 'input') {
      const storeAs = nonEmpty(state.store_as);
      if (state.store_as !== undefined && (storeAs === undefined || !ID_PATTERN.test(storeAs) || storeAs.length > 60)) {
        this.error('E_ID_FORMAT', 'store_as ใช้ได้เฉพาะ a-z 0-9 และ _ (ไม่เกิน 60)', where);
      }
      if (state.pattern !== undefined) {
        if (typeof state.pattern !== 'string' || state.pattern.length > MAX_PATTERN) {
          this.error('E_TOO_LONG', `pattern ต้องเป็นข้อความไม่เกิน ${MAX_PATTERN} ตัวอักษร`, where);
        } else {
          try {
            new RegExp(state.pattern);
          } catch {
            this.error('E_BAD_REGEX', 'pattern ไม่ใช่นิพจน์ปกติ (regex) ที่ถูกต้อง', where);
          }
        }
      }
    }

    // ความปลอดภัย
    const critical = state.safety_critical;
    if (critical !== undefined && typeof critical !== 'boolean') this.error('E_SHAPE', 'safety_critical ต้องเป็น true/false', where);
    this.field(state, 'safety_warning', { max: MAX_SAFETY_WARNING, optional: true }, where);
    if (critical === true) {
      if (type !== 'instruction') this.error('E_SAFETY_PLACEMENT', `safety_critical ใช้ได้เฉพาะสถานะ instruction (พบบนสถานะ ${type})`, where);
      if (nonEmpty(state.safety_warning) === undefined) this.error('E_SAFETY_NO_WARNING', 'safety_critical ต้องมี safety_warning (ด่านความปลอดภัยจะแสดงกล่องคำเตือนว่าง)', where);
    } else if (state.safety_warning !== undefined) {
      this.error('E_SAFETY_WARNING_WITHOUT_FLAG', 'มี safety_warning แต่ไม่ได้ตั้ง safety_critical เป็น true (คำเตือนจะไม่ถูกบังคับให้ยืนยัน)', where);
    }

    // source_page
    const page = state.source_page;
    if (!isPositiveInt(page)) {
        this.error('E_SOURCE_PAGE_MISSING', 'ทุกสถานะต้องระบุ source_page (เลขหน้าในคู่มือที่สถานะนี้มาจาก)', where);
    } else if (!this.pages.has(page)) {
        this.error('E_SOURCE_PAGE_OUTSIDE', `source_page ${page} ไม่อยู่ในหน้าที่อัปโหลด/ไม่มีข้อความ`, where);
    } else {
      sourcePages.push(page);
    }
  }


  private structure(flow: Obj, states: Map<string, Obj>, flowId: string | undefined, sourcePages: number[]): void {
    const g = { flowId };
    const entry = typeof flow.initial_state === 'string' ? flow.initial_state : undefined;

    if (entry !== undefined && !states.has(entry)) this.error('E_ENTRY_MISSING', `initial_state '${entry}' ไม่มีอยู่ในผัง`, g);
    let edgesOk = true;
    for (const [id, state] of states) {
      for (const [key, to] of edgesOf(state)) {
        if (!states.has(to)) {
          edgesOk = false;
          this.error('E_EDGE_TARGET_MISSING', `${key} ชี้ไป '${to}' ที่ไม่มีอยู่`, { flowId, stateId: id });
        }
      }
    }

    const terminals = [...states.entries()].filter(([, n]) => typeof n.type === 'string' && TERMINAL_TYPES.includes(n.type)).map(([id]) => id);
    if (terminals.length === 0) this.error('E_NO_TERMINAL', 'ผังไม่มีสถานะสิ้นสุด (resolution/escalation) เลย', g);

    if (entry === undefined || !states.has(entry) || !edgesOk) return;

    const reachable = reach(entry, states);
    const canFinish = new Set<string>(terminals);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [id, state] of states) {
        if (canFinish.has(id)) continue;
        if (edgesOf(state).some(([, to]) => canFinish.has(to))) {
          canFinish.add(id);
          changed = true;
        }
      }
    }
    for (const id of [...states.keys()].sort()) {
      if (!reachable.has(id)) this.error('E_UNREACHABLE', `สถานะนี้เดินถึงไม่ได้จาก initial_state '${entry}'`, { flowId, stateId: id });
      if (!canFinish.has(id)) this.error('E_NO_EXIT', 'สถานะนี้ไปถึงสถานะสิ้นสุดไม่ได้ (อาจวนไม่รู้จบ)', { flowId, stateId: id });
    }

    // วงวน (อนุญาตได้ถ้ามีทางออก · แจ้งเป็น warning ให้ผู้ตรวจยืนยันว่าตั้งใจ) + ความยาวเส้นทาง
    const { back, longest } = analyzePaths(entry, states);
    if (back.length > 0) {
      this.warn('W_CYCLE', `มีวนกลับ ${back.map(([a, b]) => `${a} → ${b}`).join(', ')} (ตรวจว่าตั้งใจ เช่น ถามซ้ำ/ลองใหม่)`, g);
    }
    if (longest > MAX_PATH_LENGTH) {
      this.error('E_PATH_TOO_LONG', `เส้นทางที่ยาวที่สุดมี ${longest} สถานะ เกิน ${MAX_PATH_LENGTH}`, g);
    }

    // ตัวแปร {{var}} ต้องถูกเก็บโดย input state ก่อนใช้ ทุกเส้นทาง
    this.templateVariables(states, entry, flowId, reachable);

    // คำเตือน
    if (!terminals.some((id) => (states.get(id) as Obj).type === 'escalation')) {
      this.warn('W_NO_ESCALATION', 'ผังไม่มีสถานะส่งต่อช่าง (escalation) เลย — ผู้ใช้ที่แก้ไม่ได้จะไม่มีทางไปต่อ', g);
    }
    for (const [id, state] of states) {
      if (state.type === 'input' && typeof state.pattern === 'string' && state.on_invalid === undefined) {
        this.warn('W_NO_ON_INVALID', 'input มี pattern แต่ไม่มี on_invalid (ถ้าตอบผิดรูปแบบจะถามซ้ำสถานะเดิม)', { flowId, stateId: id });
      }
      if (state.type === 'instruction' && state.safety_critical !== true && RISK_PATTERN.test(textOf(state))) {
        this.warn('W_STATE_RISK', 'ข้อความของสถานะนี้พูดถึงเรื่องที่อาจอันตราย (ไฟฟ้า/ปลั๊ก/แก๊ส/ความร้อน/การรื้อเครื่อง) แต่ไม่ได้ตั้ง safety_critical', { flowId, stateId: id });
      }
    }
    const hasGate = [...states.values()].some((n) => n.safety_critical === true);
    const riskyPages = [...new Set(sourcePages)].filter((p) => RISK_PATTERN.test(this.pages.get(p) ?? '')).sort((a, b) => a - b);
    if (!hasGate && riskyPages.length > 0) {
      this.warn('W_PAGE_RISK', `หน้าต้นฉบับ ${riskyPages.join(', ')} มีคำที่บ่งชี้อันตราย แต่ผังนี้ไม่มีด่านความปลอดภัย (safety_critical) เลย — ตรวจว่า LLM ไม่ได้ข้ามคำเตือน`, g);
    }
  }

  private templateVariables(states: Map<string, Obj>, entry: string, flowId: string | undefined, reachable: Set<string>): void {
    const stored = new Set<string>();
    for (const state of states.values()) {
      if (state.type === 'input' && typeof state.store_as === 'string') stored.add(state.store_as);
    }

    const reachedWithout = new Map<string, Set<string>>();
    for (const variable of stored) {
      reachedWithout.set(variable, reach(entry, states, (state, key) => state.type === 'input' && key === 'next' && state.store_as === variable));
    }

    for (const [id, state] of states) {
      if (!reachable.has(id)) continue; // เดินไม่ถึง (รายงานแยกแล้ว)
      for (const match of textOf(state).matchAll(/\{\{(\w+)\}\}/g)) {
        const variable = match[1];
        if (!stored.has(variable)) {
          this.error('E_VAR_UNDEFINED', `ใช้ตัวแปร {{${variable}}} แต่ไม่มี input state ใดเก็บค่านี้ (store_as)`, { flowId, stateId: id });
        } else if (reachedWithout.get(variable)?.has(id)) {
          this.error('E_VAR_NOT_GUARANTEED', `ใช้ตัวแปร {{${variable}}} แต่มีเส้นทางที่มาถึงสถานะนี้โดยยังไม่ได้ถามค่านี้`, { flowId, stateId: id });
        }
      }
    }
  }
}

function edgesOf(state: Obj): Array<[key: string, to: string]> {
  const edges: Array<[string, string]> = [];
  for (const key of EDGE_KEYS) {
    const to = state[key];
    if (typeof to === 'string' && to !== '') edges.push([key, to]);
  }
  return edges;
}

function textOf(state: Obj): string {
  return TEXT_KEYS.map((key) => (typeof state[key] === 'string' ? (state[key] as string) : '')).join(' ');
}

function reach(entry: string, states: Map<string, Obj>, skip?: (state: Obj, key: string) => boolean): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const state = states.get(id) as Obj;
    for (const [key, to] of edgesOf(state)) if (!skip?.(state, key)) stack.push(to);
  }
  return seen;
}

function analyzePaths(entry: string, states: Map<string, Obj>): { back: Array<[string, string]>; longest: number } {
  const back: Array<[string, string]> = [];
  const inProgress = new Set<string>(); 
  const lengthFrom = new Map<string, number>(); 

  function longestFrom(id: string): number {
    const known = lengthFrom.get(id);
    if (known !== undefined) return known;

    inProgress.add(id);
    let longestAfter = 0;
    for (const [, next] of edgesOf(states.get(id) as Obj)) {
      if (inProgress.has(next)) back.push([id, next]);
      else longestAfter = Math.max(longestAfter, longestFrom(next));
    }
    inProgress.delete(id);

    lengthFrom.set(id, 1 + longestAfter);
    return 1 + longestAfter;
  }

  return { back, longest: longestFrom(entry) };
}
