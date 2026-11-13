import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../admin/admin.dto';
import { DEVICE_CATEGORIES } from '../authoring/flow-validator';
import { isPlainObject } from '../common/helpers';
import { invalidAdminQuery, invalidFlowRequest } from './flow-admin.errors';

const MAX_PAGE = 10_000;
const MAX_QUERY_LENGTH = 100;
const MAX_MANUAL_ID_LENGTH = 80;

export const FLOW_STATUS_FILTERS = ['active', 'deleted', 'all'] as const;
export type FlowStatusFilter = (typeof FLOW_STATUS_FILTERS)[number];

export interface FlowListQuery {
  q?: string;
  manualId?: string;
  deviceCategory?: string;
  status: FlowStatusFilter;
  page: number;
  pageSize: number;
}

function optionalText(raw: unknown, name: string, max: number): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') throw invalidAdminQuery(`${name} ต้องเป็นข้อความเดียว`);
  const text = raw.trim();
  if (text === '') return undefined;
  if (text.length > max) throw invalidAdminQuery(`${name} ยาวเกิน ${max} ตัวอักษร`);
  return text;
}

function optionalInt(raw: unknown, name: string, min: number, max: number): number | undefined {
  const text = optionalText(raw, name, 10);
  if (text === undefined) return undefined;
  if (!/^\d+$/.test(text)) throw invalidAdminQuery(`${name} ต้องเป็นจำนวนเต็มไม่ติดลบ`);
  const value = Number(text);
  if (value < min || value > max) throw invalidAdminQuery(`${name} ต้องอยู่ระหว่าง ${min} ถึง ${max}`);
  return value;
}

// GET /admin/flows?q=&manualId=&deviceCategory=&status=active|deleted|all&page=&pageSize=
export function parseListQuery(raw: unknown): FlowListQuery {
  const source = isPlainObject(raw) ? raw : {};

  const deviceCategory = optionalText(source.deviceCategory, 'deviceCategory', 40);
  if (deviceCategory !== undefined && !(DEVICE_CATEGORIES as readonly string[]).includes(deviceCategory)) {
    throw invalidAdminQuery(`deviceCategory ต้องเป็นหนึ่งใน ${DEVICE_CATEGORIES.join(', ')}`);
  }

  const status = optionalText(source.status, 'status', 20) ?? 'active';
  if (!(FLOW_STATUS_FILTERS as readonly string[]).includes(status)) {
    throw invalidAdminQuery(`status ต้องเป็นหนึ่งใน ${FLOW_STATUS_FILTERS.join(', ')}`);
  }

  return {
    q: optionalText(source.q, 'q', MAX_QUERY_LENGTH),
    manualId: optionalText(source.manualId, 'manualId', MAX_MANUAL_ID_LENGTH),
    deviceCategory,
    status: status as FlowStatusFilter,
    page: optionalInt(source.page, 'page', 1, MAX_PAGE) ?? 1,
    pageSize: optionalInt(source.pageSize, 'pageSize', 1, MAX_PAGE_SIZE) ?? DEFAULT_PAGE_SIZE,
  };
}

// PUT /admin/flows/:id (before-exam version): only the text of existing states can change.
// Keys match what GET returns: question (checkpoint), prompt (input), content (the others), safety_warning.
// Every other key in the body or in an item is ignored on purpose — see docs/design section 3.2.
export const MAX_STATE_TEXT_LENGTH = 2000;
const MAX_STATE_ID_LENGTH = 60;
const MAX_ITEMS = 200;
const TEXT_KEYS = ['question', 'prompt', 'content', 'safety_warning'] as const;

export interface StateEditItem {
  stateId: string;
  /** Raw values of the text keys that were sent; the key that applies is chosen from the state type stored in the DB */
  raw: Partial<Record<(typeof TEXT_KEYS)[number], unknown>>;
}

export interface UpdateFlowBody {
  expectedRevision: number;
  items: StateEditItem[];
}

export function parseUpdateBody(body: unknown): UpdateFlowBody {
  if (!isPlainObject(body)) throw invalidFlowRequest('body ต้องเป็น JSON object');

  const expected = body.expectedRevision;
  if (typeof expected !== 'number' || !Number.isInteger(expected) || expected < 0) {
    throw invalidFlowRequest('expectedRevision ต้องเป็นจำนวนเต็มไม่ติดลบ');
  }

  const states = body.states;
  if (!Array.isArray(states) || states.length === 0) throw invalidFlowRequest('states ต้องเป็นรายการที่ไม่ว่าง');
  if (states.length > MAX_ITEMS) throw invalidFlowRequest(`states มีได้ไม่เกิน ${MAX_ITEMS} รายการ`);

  const seen = new Set<string>();
  const items = states.map((entry, index): StateEditItem => {
    if (!isPlainObject(entry)) throw invalidFlowRequest(`states[${index}] ต้องเป็น object`);
    const stateId = entry.state_id;
    if (typeof stateId !== 'string' || stateId === '' || stateId.length > MAX_STATE_ID_LENGTH) {
      throw invalidFlowRequest(`states[${index}].state_id ต้องเป็นข้อความไม่ว่างและไม่เกิน ${MAX_STATE_ID_LENGTH} ตัวอักษร`);
    }
    if (seen.has(stateId)) throw invalidFlowRequest(`state_id '${stateId}' ซ้ำในรายการ`);
    seen.add(stateId);

    const raw: StateEditItem['raw'] = {};
    for (const key of TEXT_KEYS) if (key in entry) raw[key] = entry[key];
    return { stateId, raw };
  });

  return { expectedRevision: expected, items };
}

// PUT /admin/flows/:id/structure: replace initial_state + states (nodes and edges) of one flow.
// The states use the same JSON shape GET returns (and the draft editor uses). Flow-level fields never come from the request.
export interface UpdateStructureBody {
  expectedRevision: number;
  acknowledgedWarnings: boolean;
  initialState: string;
  states: Array<Record<string, unknown>>;
}

export function parseStructureBody(body: unknown): UpdateStructureBody {
  if (!isPlainObject(body)) throw invalidFlowRequest('body ต้องเป็น JSON object');

  const expected = body.expectedRevision;
  if (typeof expected !== 'number' || !Number.isInteger(expected) || expected < 0) {
    throw invalidFlowRequest('expectedRevision ต้องเป็นจำนวนเต็มไม่ติดลบ');
  }
  if (body.acknowledgedWarnings !== undefined && typeof body.acknowledgedWarnings !== 'boolean') {
    throw invalidFlowRequest('acknowledgedWarnings ต้องเป็น true/false');
  }
  if (typeof body.initial_state !== 'string' || body.initial_state === '') throw invalidFlowRequest('initial_state ต้องเป็นข้อความไม่ว่าง');

  const states = body.states;
  if (!Array.isArray(states) || states.length === 0) throw invalidFlowRequest('states ต้องเป็นรายการที่ไม่ว่าง');
  if (states.length > MAX_ITEMS) throw invalidFlowRequest(`states มีได้ไม่เกิน ${MAX_ITEMS} รายการ`);
  states.forEach((entry, index) => {
    if (!isPlainObject(entry)) throw invalidFlowRequest(`states[${index}] ต้องเป็น object`);
  });

  return {
    expectedRevision: expected,
    acknowledgedWarnings: body.acknowledgedWarnings === true,
    initialState: body.initial_state,
    states: states as Array<Record<string, unknown>>,
  };
}

export type FlowStatus = 'active' | 'deleted';

export interface FlowListItemDto {
  flowId: string;
  manualId: string;
  deviceCategory: string;
  brand: string;
  modelPattern: string;
  displayName: string | null;
  entrySymptom: string;
  entrySymptomTh: string | null;
  stateCount: number;
  status: FlowStatus;
  revision: number;
  editedAt: string | null;
  editedByName: string | null;
  deletedAt: string | null;
  deletedByName: string | null;
  sessionCount: number;
  activeSessionCount: number;
}

export interface FlowListPageDto {
  items: FlowListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * One state as the admin sees it. The text key depends on the type and matches what the user-facing
 * flow uses: question (checkpoint), prompt (input), content (instruction, resolution, escalation).
 */
export interface FlowStateDto {
  state_id: string;
  type: string;
  question?: string;
  prompt?: string;
  content?: string;
  on_yes?: string;
  on_no?: string;
  next?: string;
  on_invalid?: string;
  input_type?: string;
  pattern?: string;
  store_as?: string;
  outcome_kind?: string;
  safety_critical: boolean;
  safety_warning: string | null;
  author_note: string | null;
}

export interface FlowDetailDto {
  flowId: string;
  manualId: string;
  deviceCategory: string;
  brand: string;
  modelPattern: string;
  displayName: string | null;
  sourceManual: string;
  source: string;
  sourceChunkId: string;
  status: FlowStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  editedByName: string | null;
  deletedAt: string | null;
  deletedByName: string | null;
  flow: {
    flow_id: string;
    entry_symptom: string;
    entry_symptom_th: string | null;
    entry_symptom_aliases: string[];
    severity: string | null;
    difficulty: string | null;
    page_range: [number, number];
    initial_state: string;
    states: FlowStateDto[];
  };
  usage: {
    sessions: number;
    completed: number;
    feedback: number;
    activeByState: Record<string, number>;
  };
}
