/**
 * draft-schema.ts — แปลงข้อความที่ LLM ตอบ (และ JSON ที่ผู้ดูแลแก้) เป็นชนิดข้อมูลที่ปลอดภัย "อย่างเข้ม"
 *
 * ไม่เชื่อ JSON mode ของผู้ให้บริการ: ทุกครั้งที่ได้ข้อความจาก LLM ต้องผ่านที่นี่ก่อนถึง validator
 * - ฟิลด์ที่ไม่อยู่ในรายการ = ปฏิเสธทั้งก้อน (ไม่ตัดทิ้งเงียบๆ ไม่ซ่อม ไม่เดา)
 * - ค่าทุกค่าต้องเป็นข้อความ / true-false / จำนวนเต็ม เท่านั้น (ไม่รับ object/array ซ้อนที่ไม่คาด)
 * - LLM กำหนดได้แค่เนื้อหาของผัง (slug, อาการ, โหนด) · manual_id / ยี่ห้อ / รุ่น / source / graph_id / page_range /
 *   source_chunk_id เซิร์ฟเวอร์เป็นคนกำหนด (draft-manual.ts) LLM ใส่มาก็ถูกปฏิเสธ
 *
 * การตรวจความหมายของผัง (ลูกศร การเข้าถึง ความปลอดภัย ฯลฯ) เป็นหน้าที่ของ graph-validator.ts ไม่ใช่ไฟล์นี้
 */

import { MAX_ALIASES, MAX_NODES_PER_GRAPH } from './graph-validator';

export const MAX_GRAPHS_PER_CALL = 12;
export const MAX_SLUG_LENGTH = 30;
const MAX_TEXT = 2000;
const MAX_PROBLEMS_REPORTED = 8;

export class DraftParseError extends Error {
  constructor(readonly problems: string[]) {
    super(`ผลจาก LLM/ข้อมูลร่างไม่ตรงรูปแบบ: ${problems.slice(0, MAX_PROBLEMS_REPORTED).join(' · ')}${problems.length > MAX_PROBLEMS_REPORTED ? ` (และอีก ${problems.length - MAX_PROBLEMS_REPORTED} จุด)` : ''}`);
    this.name = this.constructor.name;
  }
}

/** โหนดในร่าง: รูปแบบเดียวกับโหนดใน data/manuals + source_page */
export type DraftNode = Record<string, string | boolean | number> & { node_id: string; type: string };

export interface DraftGraph {
  graph_id: string;
  entry_symptom: string;
  entry_symptom_th?: string;
  entry_symptom_aliases?: string[];
  severity?: string;
  difficulty?: string;
  entry_node: string;
  nodes: DraftNode[];
}

/** ผังที่ LLM ร่างมา (ยังไม่มี graph_id: เซิร์ฟเวอร์สร้างจาก slug) */
export type LlmGraph = Omit<DraftGraph, 'graph_id'> & { slug: string };

const NODE_KEYS = [
  'node_id', 'type', 'question', 'content', 'prompt', 'on_yes', 'on_no', 'next', 'on_invalid', 'input_type', 'pattern',
  'store_as', 'outcome_kind', 'safety_critical', 'safety_warning', 'source_page',
];
const GRAPH_CONTENT_KEYS = ['entry_symptom', 'entry_symptom_th', 'severity', 'difficulty', 'entry_node', 'nodes'];

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unknownKeys(obj: Obj, allowed: readonly string[]): string[] {
  return Object.keys(obj).filter((key) => !allowed.includes(key));
}

function parseNodes(raw: unknown, where: string, problems: string[]): DraftNode[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    problems.push(`${where}: nodes ต้องเป็นอาร์เรย์ที่ไม่ว่าง`);
    return [];
  }
  if (raw.length > MAX_NODES_PER_GRAPH) {
    problems.push(`${where}: มี ${raw.length} โหนด เกิน ${MAX_NODES_PER_GRAPH}`);
    return [];
  }
  const nodes: DraftNode[] = [];
  raw.forEach((item, index) => {
    const at = `${where}.nodes[${index}]`;
    if (!isObj(item)) {
      problems.push(`${at}: ต้องเป็น object`);
      return;
    }
    const extra = unknownKeys(item, NODE_KEYS);
    if (extra.length > 0) problems.push(`${at}: ฟิลด์ที่ไม่อนุญาต ${extra.join(', ')}`);
    const clean: Record<string, string | boolean | number> = {};
    for (const key of NODE_KEYS) {
      const value = item[key];
      if (value === undefined) continue;
      // ชนิดตามฟิลด์: safety_critical = true/false · source_page = จำนวนเต็ม · ที่เหลือ = ข้อความ
      const ok =
        key === 'safety_critical'
          ? typeof value === 'boolean'
          : key === 'source_page'
            ? typeof value === 'number' && Number.isInteger(value)
            : typeof value === 'string' && value.length <= MAX_TEXT;
      if (!ok) problems.push(`${at}.${key}: ชนิดหรือความยาวไม่ถูกต้อง`);
      else clean[key] = value as string | boolean | number;
    }
    if (typeof clean.node_id !== 'string' || typeof clean.type !== 'string') {
      problems.push(`${at}: ต้องมี node_id และ type เป็นข้อความ`);
      return;
    }
    nodes.push(clean as DraftNode);
  });
  return nodes;
}

function parseCommon(obj: Obj, where: string, problems: string[], aliasKey: string): Omit<DraftGraph, 'graph_id'> {
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
    entry_node: text('entry_node', true) ?? '',
    nodes: parseNodes(obj.nodes, where, problems),
  };
}

function dropUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/**
 * ข้อความที่ LLM ตอบ → รายการผังร่าง
 * รูปแบบที่ต้องได้: { "graphs": [ { slug, entry_symptom, entry_symptom_th?, aliases?, severity?, difficulty?, entry_node, nodes } ] }
 * ไม่ใช่ JSON / ไม่ตรงรูปแบบ → DraftParseError (ผู้เรียกบันทึกเป็น draft 'failed' ไม่ซ่อมเอง)
 */
export function parseLlmOutput(text: string): LlmGraph[] {
  let value: unknown;
  try {
    value = JSON.parse(text.trim());
  } catch {
    throw new DraftParseError(['คำตอบของ LLM ไม่ใช่ JSON']);
  }
  const problems: string[] = [];
  if (!isObj(value)) throw new DraftParseError(['คำตอบของ LLM ต้องเป็น JSON object']);
  const extraTop = unknownKeys(value, ['graphs']);
  if (extraTop.length > 0) problems.push(`ฟิลด์ระดับบนที่ไม่อนุญาต ${extraTop.join(', ')}`);
  if (!Array.isArray(value.graphs)) throw new DraftParseError([...problems, "ต้องมี 'graphs' เป็นอาร์เรย์"]);
  if (value.graphs.length > MAX_GRAPHS_PER_CALL) problems.push(`graphs มี ${value.graphs.length} ผัง เกิน ${MAX_GRAPHS_PER_CALL}`);

  const graphs: LlmGraph[] = [];
  value.graphs.slice(0, MAX_GRAPHS_PER_CALL).forEach((item, index) => {
    const where = `graphs[${index}]`;
    if (!isObj(item)) {
      problems.push(`${where}: ต้องเป็น object`);
      return;
    }
    const extra = unknownKeys(item, ['slug', 'aliases', ...GRAPH_CONTENT_KEYS]);
    if (extra.length > 0) problems.push(`${where}: ฟิลด์ที่ไม่อนุญาต ${extra.join(', ')}`);
    const slug = item.slug;
    if (typeof slug !== 'string' || !new RegExp(`^[a-z0-9_]{3,${MAX_SLUG_LENGTH}}$`).test(slug)) {
      problems.push(`${where}.slug: ต้องเป็น a-z 0-9 _ ยาว 3–${MAX_SLUG_LENGTH}`);
    }
    const common = parseCommon(item, where, problems, 'aliases');
    const { entry_symptom_aliases, ...rest } = common;
    graphs.push(dropUndefined({ slug: String(slug), ...rest, entry_symptom_aliases }));
  });

  if (problems.length > 0) throw new DraftParseError(problems);
  return graphs;
}

/**
 * ผังร่างที่เก็บ/ส่งกลับมาแก้ (จาก DB หรือ PUT /admin/drafts/:id) → DraftGraph[]
 * รูปแบบเดียวกับที่ GET ส่งออก: { graph_id, entry_symptom, entry_symptom_th?, entry_symptom_aliases?, severity?, difficulty?, entry_node, nodes }
 */
export function parseDraftGraphs(raw: unknown): DraftGraph[] {
  const problems: string[] = [];
  if (!Array.isArray(raw)) throw new DraftParseError(['graphs ต้องเป็นอาร์เรย์']);
  if (raw.length === 0) throw new DraftParseError(['ต้องมีผังอย่างน้อย 1 ผัง']);
  if (raw.length > 60) throw new DraftParseError([`graphs มี ${raw.length} ผัง เกิน 60`]);

  const graphs: DraftGraph[] = [];
  raw.forEach((item, index) => {
    const where = `graphs[${index}]`;
    if (!isObj(item)) {
      problems.push(`${where}: ต้องเป็น object`);
      return;
    }
    const extra = unknownKeys(item, ['graph_id', 'entry_symptom_aliases', ...GRAPH_CONTENT_KEYS]);
    if (extra.length > 0) problems.push(`${where}: ฟิลด์ที่ไม่อนุญาต ${extra.join(', ')}`);
    const graphId = item.graph_id;
    if (typeof graphId !== 'string' || graphId === '' || graphId.length > 120) problems.push(`${where}.graph_id: ต้องเป็นข้อความไม่เกิน 120`);
    graphs.push(dropUndefined({ graph_id: String(graphId), ...parseCommon(item, where, problems, 'entry_symptom_aliases') }));
  });

  if (problems.length > 0) throw new DraftParseError(problems);
  return graphs;
}

/**
 * graph_id = <manual_id>_<slug> (เซิร์ฟเวอร์สร้าง) · slug ซ้ำในคู่มือเดียวกันต่อท้าย _2, _3 …
 * ผลลัพธ์ยังต้องผ่าน validator (รูปแบบ/ความยาว/ชนผังเดิม)
 */
export function assignGraphIds(manualId: string, graphs: LlmGraph[], taken: ReadonlySet<string> = new Set()): DraftGraph[] {
  const used = new Set(taken);
  return graphs.map(({ slug, ...rest }) => {
    let candidate = `${manualId}_${slug}`;
    for (let n = 2; used.has(candidate); n += 1) candidate = `${manualId}_${slug}_${n}`;
    used.add(candidate);
    return { graph_id: candidate, ...rest };
  });
}
