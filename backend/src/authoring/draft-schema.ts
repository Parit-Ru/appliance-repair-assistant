import { ApiError } from '../common/api-error';
import { isPlainObject } from '../common/helpers';
import { MAX_ALIASES, MAX_STATES_PER_FLOW } from './flow-validator';
const MAX_FLOWS_PER_CALL = 12;
const MAX_SLUG_LENGTH = 30;
const MAX_TEXT = 2000;
const MAX_PROBLEMS_REPORTED = 8;

export class DraftParseError extends ApiError {
  constructor(readonly problems: string[]) {
    super(
      400,
      'INVALID_DRAFT_REQUEST',
      `ผลจาก LLM/ข้อมูลร่างไม่ตรงรูปแบบ: ${problems.slice(0, MAX_PROBLEMS_REPORTED).join(' · ')}${problems.length > MAX_PROBLEMS_REPORTED ? ` (และอีก ${problems.length - MAX_PROBLEMS_REPORTED} จุด)` : ''}`,
    );
  }
}

type DraftState = Record<string, string | boolean | number> & { state_id: string; type: string };

export interface DraftFlow {
  flow_id: string;
  entry_symptom: string;
  entry_symptom_th?: string;
  entry_symptom_aliases?: string[];
  severity?: string;
  difficulty?: string;
  initial_state: string;
  states: DraftState[];
}

/** ผังที่ LLM ร่างมา */
export type LlmFlow = Omit<DraftFlow, 'flow_id'> & { slug: string };

const STATE_KEYS = [
  'state_id', 'type', 'question', 'content', 'prompt', 'on_yes', 'on_no', 'next', 'on_invalid', 'input_type', 'pattern',
  'store_as', 'outcome_kind', 'safety_critical', 'safety_warning', 'source_page',
];
const FLOW_CONTENT_KEYS = ['entry_symptom', 'entry_symptom_th', 'severity', 'difficulty', 'initial_state', 'states'];

type Obj = Record<string, unknown>;

function unknownKeys(obj: Obj, allowed: readonly string[]): string[] {
  return Object.keys(obj).filter((key) => !allowed.includes(key));
}

function parseStates(raw: unknown, where: string, problems: string[]): DraftState[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    problems.push(`${where}: states ต้องเป็นอาร์เรย์ที่ไม่ว่าง`);
    return [];
  }
  if (raw.length > MAX_STATES_PER_FLOW) {
    problems.push(`${where}: มี ${raw.length} สถานะ เกิน ${MAX_STATES_PER_FLOW}`);
    return [];
  }
  const states: DraftState[] = [];
  raw.forEach((item, index) => {
    const at = `${where}.states[${index}]`;
    if (!isPlainObject(item)) {
      problems.push(`${at}: ต้องเป็น object`);
      return;
    }
    const extra = unknownKeys(item, STATE_KEYS);
    if (extra.length > 0) problems.push(`${at}: ฟิลด์ที่ไม่อนุญาต ${extra.join(', ')}`);
    const clean: Record<string, string | boolean | number> = {};
    for (const key of STATE_KEYS) {
      const value = item[key];
      if (value === undefined) continue;
      const ok =
        key === 'safety_critical'
          ? typeof value === 'boolean'
          : key === 'source_page'
            ? typeof value === 'number' && Number.isInteger(value)
            : typeof value === 'string' && value.length <= MAX_TEXT;
      if (!ok) problems.push(`${at}.${key}: ชนิดหรือความยาวไม่ถูกต้อง`);
      else clean[key] = value as string | boolean | number;
    }
    if (typeof clean.state_id !== 'string' || typeof clean.type !== 'string') {
      problems.push(`${at}: ต้องมี state_id และ type เป็นข้อความ`);
      return;
    }
    states.push(clean as DraftState);
  });
  return states;
}

function parseCommon(obj: Obj, where: string, problems: string[], aliasKey: string): Omit<DraftFlow, 'flow_id'> {
  const text = (key: string, required: boolean): string | undefined => {
    const value = obj[key];
    if (value === undefined) {
      if (required) problems.push(`${where}: ต้องมี ${key}`);
      return undefined;
    }
    if (typeof value !== 'string' || value.trim() === '' || value.length > MAX_TEXT) {
      problems.push(`${where}.${key}: ต้องเป็นข้อความที่ไม่ว่าง`);
      return undefined;
    }
    return value;
  };

  const aliasesRaw = obj[aliasKey];
  let aliases: string[] | undefined;
  if (aliasesRaw !== undefined) {
    if (!Array.isArray(aliasesRaw) || aliasesRaw.length > MAX_ALIASES || !aliasesRaw.every((a) => typeof a === 'string' && a.trim() !== '' && a.length <= 120)) {
      problems.push(`${where}.${aliasKey}: ต้องเป็นอาร์เรย์ข้อความไม่เกิน ${MAX_ALIASES} รายการ`);
    } else {
      aliases = aliasesRaw as string[];
    }
  }

  return {
    entry_symptom: text('entry_symptom', true) ?? '',
    entry_symptom_th: text('entry_symptom_th', false),
    entry_symptom_aliases: aliases,
    severity: text('severity', false),
    difficulty: text('difficulty', false),
    initial_state: text('initial_state', true) ?? '',
    states: parseStates(obj.states, where, problems),
  };
}

function dropUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/**
  ข้อความที่ LLM ตอบ → รายการผังร่าง
  รูปแบบที่ต้องได้: { "flows": [ { slug, entry_symptom, entry_symptom_th?, aliases?, severity?, difficulty?, initial_state, states } ] }
 */
export function parseLlmOutput(text: string): LlmFlow[] {
  let value: unknown;
  try {
    value = JSON.parse(text.trim());
  } catch {
    throw new DraftParseError(['คำตอบของ LLM ไม่ใช่ JSON']);
  }
  const problems: string[] = [];
  if (!isPlainObject(value)) throw new DraftParseError(['คำตอบของ LLM ต้องเป็น JSON object']);
  const extraTop = unknownKeys(value, ['flows']);
  if (extraTop.length > 0) problems.push(`ฟิลด์ระดับบนที่ไม่อนุญาต ${extraTop.join(', ')}`);
  if (!Array.isArray(value.flows)) throw new DraftParseError([...problems, "ต้องมี 'flows' เป็นอาร์เรย์"]);
  if (value.flows.length > MAX_FLOWS_PER_CALL) problems.push(`flows มี ${value.flows.length} ผัง เกิน ${MAX_FLOWS_PER_CALL}`);

  const flows: LlmFlow[] = [];
  value.flows.slice(0, MAX_FLOWS_PER_CALL).forEach((item, index) => {
    const where = `flows[${index}]`;
    if (!isPlainObject(item)) {
      problems.push(`${where}: ต้องเป็น object`);
      return;
    }
    const extra = unknownKeys(item, ['slug', 'aliases', ...FLOW_CONTENT_KEYS]);
    if (extra.length > 0) problems.push(`${where}: ฟิลด์ที่ไม่อนุญาต ${extra.join(', ')}`);
    const slug = item.slug;
    if (typeof slug !== 'string' || !new RegExp(`^[a-z0-9_]{3,${MAX_SLUG_LENGTH}}$`).test(slug)) {
      problems.push(`${where}.slug: ต้องเป็น a-z 0-9 _ ยาว 3–${MAX_SLUG_LENGTH}`);
    }
    const common = parseCommon(item, where, problems, 'aliases');
    const { entry_symptom_aliases, ...rest } = common;
    flows.push(dropUndefined({ slug: String(slug), ...rest, entry_symptom_aliases }));
  });

  if (problems.length > 0) throw new DraftParseError(problems);
  return flows;
}

/**
 * ผังร่างที่เก็บ/ส่งกลับมาแก้ (จาก DB หรือ PUT /admin/drafts/:id) → DraftFlow[]
 * รูปแบบเดียวกับที่ GET ส่งออก: { flow_id, entry_symptom, entry_symptom_th?, entry_symptom_aliases?, severity?, difficulty?, initial_state, states }
 */
export function parseDraftFlows(raw: unknown): DraftFlow[] {
  const problems: string[] = [];
  if (!Array.isArray(raw)) throw new DraftParseError(['flows ต้องเป็นอาร์เรย์']);
  if (raw.length === 0) throw new DraftParseError(['ต้องมีผังอย่างน้อย 1 ผัง']);
  if (raw.length > 60) throw new DraftParseError([`flows มี ${raw.length} ผัง เกิน 60`]);

  const flows: DraftFlow[] = [];
  raw.forEach((item, index) => {
    const where = `flows[${index}]`;
    if (!isPlainObject(item)) {
      problems.push(`${where}: ต้องเป็น object`);
      return;
    }
    const extra = unknownKeys(item, ['flow_id', 'entry_symptom_aliases', ...FLOW_CONTENT_KEYS]);
    if (extra.length > 0) problems.push(`${where}: ฟิลด์ที่ไม่อนุญาต ${extra.join(', ')}`);
    const flowId = item.flow_id;
    if (typeof flowId !== 'string' || flowId === '' || flowId.length > 120) problems.push(`${where}.flow_id: ต้องเป็นข้อความไม่เกิน 120`);
    flows.push(dropUndefined({ flow_id: String(flowId), ...parseCommon(item, where, problems, 'entry_symptom_aliases') }));
  });

  if (problems.length > 0) throw new DraftParseError(problems);
  return flows;
}

/**
 * flow_id = <manual_id>_<slug> (เซิร์ฟเวอร์สร้าง) · slug ซ้ำในคู่มือเดียวกันต่อท้าย _2, _3 …
 * ผลลัพธ์ยังต้องผ่าน validator (รูปแบบ/ความยาว/ชนผังเดิม)
 */
export function assignFlowIds(manualId: string, flows: LlmFlow[], taken: ReadonlySet<string> = new Set()): DraftFlow[] {
  const used = new Set(taken);
  return flows.map(({ slug, ...rest }) => {
    let candidate = `${manualId}_${slug}`;
    for (let n = 2; used.has(candidate); n += 1) candidate = `${manualId}_${slug}_${n}`;
    used.add(candidate);
    return { flow_id: candidate, ...rest };
  });
}
