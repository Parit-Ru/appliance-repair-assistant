import { ApiError } from '../common/api-error';
import { isPlainObject } from '../common/helpers';
import { DIFFICULTIES, MAX_ALIASES, MAX_STATES_PER_FLOW, SEVERITIES } from './flow-validator';
const MAX_SLUG_LENGTH = 30;
// ชั้นอ่านผลจาก LLM ผ่อนปรน (ดู parseLlmOutput): เพดานตรงนี้กันของผิดปกติจริง ๆ เท่านั้น ส่วนกฎเข้มอยู่ที่ validator
const HARD_MAX_TEXT = 20_000;
const MAX_FLOWS_ACCEPTED = 40;
const MAX_STATES_ACCEPTED = 200;
const MAX_NOTES = 30;
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

export interface LlmParseResult {
  flows: LlmFlow[];
  /** สิ่งที่ปรับ/ข้ามระหว่างอ่านผลจาก LLM (ภาษาไทย) — ผู้เรียกต้องแสดงให้คนตรวจเห็น ห้ามปล่อยเงียบ */
  notes: string[];
}

/** หา JSON object ในคำตอบ: ลองทั้งก้อน → ในรั้ว ```json → ตั้งแต่ { แรกถึง } สุดท้าย */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(trimmed.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // ลองตัวถัดไป
    }
  }
  throw new DraftParseError(['คำตอบของ LLM ไม่ใช่ JSON']);
}

/** สถานะหนึ่งตัว: แก้ชนิดที่แก้ได้ ตัดฟิลด์แปลกทิ้ง · คืน undefined เมื่อไม่มี state_id/type (ข้ามตัวนี้) */
function lenientState(item: Obj, at: string, notes: string[]): DraftState | undefined {
  const unknown = unknownKeys(item, STATE_KEYS);
  if (unknown.length > 0) notes.push(`${at}: ตัดฟิลด์ที่ไม่รู้จักออก (${unknown.join(', ')})`);

  const clean: Record<string, string | boolean | number> = {};
  for (const key of STATE_KEYS) {
    let value = item[key];
    if (value === undefined || value === null) continue;

    if (key === 'safety_critical') {
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      if (typeof value !== 'boolean') {
        notes.push(`${at}.${key}: ไม่ใช่ true/false จึงตัดทิ้ง`);
        continue;
      }
    } else if (key === 'source_page') {
      if (typeof value === 'string' && /^\d+$/.test(value.trim())) value = Number(value.trim());
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        notes.push(`${at}.${key}: ไม่ใช่เลขหน้า จึงตัดทิ้ง`);
        continue;
      }
    } else {
      if (typeof value === 'number' || typeof value === 'boolean') value = String(value);
      if (typeof value !== 'string') {
        notes.push(`${at}.${key}: ไม่ใช่ข้อความ จึงตัดทิ้ง`);
        continue;
      }
      if (value.trim() === '') continue; // ว่าง = ไม่มีค่า (ถ้าเป็นฟิลด์บังคับ validator จะรายงานเอง)
      if (value.length > HARD_MAX_TEXT) {
        notes.push(`${at}.${key}: ยาวผิดปกติ (${value.length} ตัวอักษร) จึงตัดทิ้ง`);
        continue;
      }
    }
    clean[key] = value as string | boolean | number;
  }

  if (typeof clean.state_id !== 'string' || typeof clean.type !== 'string') {
    notes.push(`${at}: ไม่มี state_id หรือ type จึงข้ามสถานะนี้`);
    return undefined;
  }
  return clean as DraftState;
}

/** ผังหนึ่งผัง: ฟิลด์ที่ไม่บังคับที่ใช้ไม่ได้ให้ตัดทิ้ง · คืน undefined เมื่อกู้ไม่ได้ (ไม่มีอาการ/ไม่มีสถานะ) */
function lenientFlow(item: Obj, index: number, where: string, notes: string[]): LlmFlow | undefined {
  const extra = unknownKeys(item, ['slug', 'aliases', ...FLOW_CONTENT_KEYS]);
  if (extra.length > 0) notes.push(`${where}: ตัดฟิลด์ที่ไม่รู้จักออก (${extra.join(', ')})`);

  const optionalText = (key: string): string | undefined => {
    const value = item[key];
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') {
      notes.push(`${where}.${key}: ไม่ใช่ข้อความ จึงตัดทิ้ง`);
      return undefined;
    }
    if (value.trim() === '') return undefined;
    if (value.length > MAX_TEXT) {
      notes.push(`${where}.${key}: ยาวเกิน ${MAX_TEXT} ตัวอักษร จึงตัดทิ้ง`);
      return undefined;
    }
    return value;
  };
  const optionalEnum = (key: string, allowed: readonly string[]): string | undefined => {
    const value = optionalText(key)?.trim().toLowerCase();
    if (value === undefined) return undefined;
    if (!allowed.includes(value)) {
      notes.push(`${where}.${key}: '${value}' ไม่อยู่ในค่าที่กำหนด (${allowed.join('/')}) จึงตัดทิ้ง`);
      return undefined;
    }
    return value;
  };

  const rawStates = item.states;
  if (!Array.isArray(rawStates) || rawStates.length === 0) {
    notes.push(`${where}: ไม่มี states จึงข้ามผังนี้`);
    return undefined;
  }
  if (rawStates.length > MAX_STATES_ACCEPTED) {
    notes.push(`${where}: มี ${rawStates.length} สถานะ มากผิดปกติ จึงข้ามผังนี้`);
    return undefined;
  }
  const states: DraftState[] = [];
  rawStates.forEach((rawState, stateIndex) => {
    const at = `${where}.states[${stateIndex}]`;
    if (!isPlainObject(rawState)) {
      notes.push(`${at}: ไม่ใช่ object จึงข้ามสถานะนี้`);
      return;
    }
    const state = lenientState(rawState, at, notes);
    if (state) states.push(state);
  });
  if (states.length === 0) {
    notes.push(`${where}: ไม่เหลือสถานะที่ใช้ได้ จึงข้ามผังนี้`);
    return undefined;
  }

  const entrySymptomTh = optionalText('entry_symptom_th');
  const entrySymptom = optionalText('entry_symptom') ?? entrySymptomTh;
  if (entrySymptom === undefined) {
    notes.push(`${where}: ไม่มีชื่ออาการ (entry_symptom) จึงข้ามผังนี้`);
    return undefined;
  }
  if (optionalText('entry_symptom') === undefined) notes.push(`${where}: ไม่มี entry_symptom จึงใช้ชื่ออาการภาษาไทยแทน`);

  let initialState = optionalText('initial_state');
  if (initialState === undefined) {
    initialState = states[0].state_id;
    notes.push(`${where}: ไม่มี initial_state จึงใช้สถานะแรก '${initialState}'`);
  }

  let aliases: string[] | undefined;
  const rawAliases = item.aliases;
  if (rawAliases !== undefined && rawAliases !== null) {
    if (!Array.isArray(rawAliases)) {
      notes.push(`${where}.aliases: ไม่ใช่อาร์เรย์ จึงตัดทิ้ง`);
    } else {
      const usable = rawAliases.filter((a): a is string => typeof a === 'string' && a.trim() !== '' && a.length <= 120);
      if (usable.length < rawAliases.length) notes.push(`${where}.aliases: ตัดรายการที่ใช้ไม่ได้ออก ${rawAliases.length - usable.length} รายการ`);
      if (usable.length > MAX_ALIASES) notes.push(`${where}.aliases: มี ${usable.length} รายการ เก็บแค่ ${MAX_ALIASES} รายการแรก`);
      aliases = usable.slice(0, MAX_ALIASES);
      if (aliases.length === 0) aliases = undefined;
    }
  }

  // slug: แปลงเป็นรูปที่ใช้ได้แทนการปฏิเสธ (a-z 0-9 _ ยาว 3–30) · ไม่มี/ใช้ไม่ได้ → flow_N
  const rawSlug = typeof item.slug === 'string' ? item.slug : '';
  let slug = rawSlug.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, MAX_SLUG_LENGTH);
  if (slug.length < 3) slug = `flow_${index + 1}`;

  return dropUndefined({
    slug,
    entry_symptom: entrySymptom,
    entry_symptom_th: entrySymptomTh,
    entry_symptom_aliases: aliases,
    severity: optionalEnum('severity', SEVERITIES),
    difficulty: optionalEnum('difficulty', DIFFICULTIES),
    initial_state: initialState,
    states,
  });
}

/**
 * ข้อความที่ LLM ตอบ → รายการผังร่าง (ผ่อนปรน: ซ่อมสิ่งที่ซ่อมได้ ข้ามเฉพาะส่วนที่กู้ไม่ได้ ไม่ทิ้งทั้งร่าง)
 * รูปแบบที่ต้องได้: { "flows": [ { slug, entry_symptom, entry_symptom_th?, aliases?, severity?, difficulty?, initial_state, states } ] }
 * ทุกอย่างที่ปรับหรือข้ามจะอยู่ใน notes · ความถูกต้องของโครงสร้างตัดสินที่ validator และคนตรวจก่อนเผยแพร่
 * ส่งข้อยกเว้น DraftParseError เฉพาะเมื่อไม่ใช่ JSON เลย หรือไม่มี flows เป็นอาร์เรย์
 */
export function parseLlmOutput(text: string): LlmParseResult {
  const value = extractJson(text);
  if (!isPlainObject(value)) throw new DraftParseError(['คำตอบของ LLM ต้องเป็น JSON object']);
  if (!Array.isArray(value.flows)) throw new DraftParseError(["ต้องมี 'flows' เป็นอาร์เรย์"]);

  const notes: string[] = [];
  const extraTop = unknownKeys(value, ['flows']);
  if (extraTop.length > 0) notes.push(`ตัดฟิลด์ระดับบนที่ไม่รู้จักออก (${extraTop.join(', ')})`);
  if (value.flows.length > MAX_FLOWS_ACCEPTED) notes.push(`flows มี ${value.flows.length} ผัง มากผิดปกติ เก็บแค่ ${MAX_FLOWS_ACCEPTED} ผังแรก`);

  const flows: LlmFlow[] = [];
  value.flows.slice(0, MAX_FLOWS_ACCEPTED).forEach((item, index) => {
    const where = `flows[${index}]`;
    if (!isPlainObject(item)) {
      notes.push(`${where}: ไม่ใช่ object จึงข้ามรายการนี้`);
      return;
    }
    const flow = lenientFlow(item, index, where, notes);
    if (flow) flows.push(flow);
  });

  if (notes.length > MAX_NOTES) {
    const hidden = notes.length - MAX_NOTES;
    notes.length = MAX_NOTES;
    notes.push(`(และอีก ${hidden} จุดที่ปรับ/ข้าม)`);
  }
  return { flows, notes };
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
