/**
 * history.dto.ts — รูปร่างข้อมูลและตัวตรวจ input ของหน้า "ประวัติการซ่อม" (GET/DELETE/POST /history…)
 *
 * เหมือน traversal.dto.ts: ไม่ใช้ class-validator ตัวตรวจเป็นฟังก์ชันล้วนที่คืนค่าที่ผ่านการตรวจแล้ว
 * หรือโยน error ให้ HistoryExceptionFilter แปลงเป็น 400
 *
 * ทุกอย่างในนี้มาจากข้อมูลที่ระบบบันทึกไว้จริง (session + ผังปัจจุบัน) ห้ามเติมเอง
 * โดยเฉพาะ "สาเหตุที่เป็นไปได้" (possible_cause) ไม่ถูกส่ง เพราะไม่ได้เก็บไว้ในผัง/ฐานข้อมูล
 */

import type {
  DeviceCategory,
  NodeReference,
  OutcomeKind,
  RenderedNode,
  TraversalAction,
} from '../traversal-engine/types';
import type { ModelSelection } from '../traversal/traversal.dto';

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;
export const MAX_SEARCH_LENGTH = 100;
export const MAX_BRAND_LENGTH = 100;
/** ความยาวสูงสุดของ comment ในการให้คะแนน (ตรวจที่นี่ ไม่ใช่ที่ชนิดคอลัมน์ — ดู migration 009) */
export const MAX_FEEDBACK_COMMENT_LENGTH = 500;

/** ค่าที่ ?category= รับได้ (ตรงกับ DeviceCategory ใน traversal-engine/types.ts) */
export const DEVICE_CATEGORIES: readonly DeviceCategory[] = [
  'Air Conditioner',
  'Microwave',
  'Refrigerator',
  'Washing Machine',
  'Television',
];

/** ค่าที่ ?status= รับได้ = outcome_kind ของโหนดสุดท้าย (ป้ายภาษาไทยอยู่ฝั่งหน้าจอ lib/labels.ts) */
export const OUTCOME_KINDS: readonly OutcomeKind[] = [
  'user_fixed',
  'handoff_informed',
  'handoff_unknown',
  'normal_behavior',
];

export class InvalidHistoryQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidFeedbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// ============================================================
// รายการ: GET /history
// ============================================================

export type HistorySort = 'newest' | 'oldest';

export interface HistoryQuery {
  q?: string;
  category?: DeviceCategory;
  brand?: string;
  status?: OutcomeKind;
  sort: HistorySort;
  page: number;
  pageSize: number;
}

/** อ่านค่าที่เป็น "ข้อความเดียว" จาก query string — ส่งซ้ำ (?a=1&a=2 → array) ถือว่าผิดรูปแบบ */
function optionalString(raw: unknown, name: string): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw !== 'string') {
    throw new InvalidHistoryQueryError(`${name} ต้องเป็นข้อความ`);
  }
  return raw;
}

function optionalPositiveInt(raw: unknown, name: string, max?: number): number | undefined {
  const text = optionalString(raw, name);
  if (text === undefined) {
    return undefined;
  }
  if (!/^\d+$/.test(text)) {
    throw new InvalidHistoryQueryError(`${name} ต้องเป็นจำนวนเต็มบวก`);
  }
  const value = Number(text);
  if (value < 1 || (max !== undefined && value > max)) {
    throw new InvalidHistoryQueryError(
      max === undefined ? `${name} ต้องมากกว่า 0` : `${name} ต้องอยู่ระหว่าง 1 ถึง ${max}`,
    );
  }
  return value;
}

/**
 * ?q=&category=&brand=&status=&sort=&page=&pageSize=  ทุกตัวไม่บังคับ
 * ค่าว่าง (?q=) ถือเหมือนไม่ส่ง เพื่อให้หน้าจอส่งฟอร์มที่ช่องว่างได้โดยไม่ต้องเลือกลบ key
 */
export function parseHistoryQuery(raw: unknown): HistoryQuery {
  const source: Record<string, unknown> =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const q = optionalString(source.q, 'q')?.trim();
  if (q !== undefined && q.length > MAX_SEARCH_LENGTH) {
    throw new InvalidHistoryQueryError(`q ยาวเกิน ${MAX_SEARCH_LENGTH} ตัวอักษร`);
  }

  const category = optionalString(source.category, 'category')?.trim();
  if (category && !(DEVICE_CATEGORIES as readonly string[]).includes(category)) {
    throw new InvalidHistoryQueryError('category ไม่รู้จัก');
  }

  const brand = optionalString(source.brand, 'brand')?.trim();
  if (brand !== undefined && brand.length > MAX_BRAND_LENGTH) {
    throw new InvalidHistoryQueryError(`brand ยาวเกิน ${MAX_BRAND_LENGTH} ตัวอักษร`);
  }

  const status = optionalString(source.status, 'status')?.trim();
  if (status && !(OUTCOME_KINDS as readonly string[]).includes(status)) {
    throw new InvalidHistoryQueryError('status ไม่รู้จัก');
  }

  const sort = optionalString(source.sort, 'sort')?.trim();
  if (sort && sort !== 'newest' && sort !== 'oldest') {
    throw new InvalidHistoryQueryError("sort ต้องเป็น 'newest' หรือ 'oldest'");
  }

  return {
    q: q || undefined,
    category: (category || undefined) as DeviceCategory | undefined,
    brand: brand || undefined,
    status: (status || undefined) as OutcomeKind | undefined,
    sort: sort === 'oldest' ? 'oldest' : 'newest',
    page: optionalPositiveInt(source.page, 'page') ?? 1,
    pageSize: optionalPositiveInt(source.pageSize, 'pageSize', MAX_PAGE_SIZE) ?? DEFAULT_PAGE_SIZE,
  };
}

/** ข้อมูลผังที่แสดงในแถว/หัวรายละเอียด (หน้าจอใช้ symptomName() และ manualTitle() ตัวเดิมได้) */
export interface HistoryGraphInfo {
  manualId: string;
  entrySymptom: string;
  entrySymptomTh?: string;
  deviceCategory: DeviceCategory;
  brand: string;
  modelPattern: string;
  /** ชื่อรุ่นที่ผู้ใช้รู้จัก ไม่มี = หน้าจอแสดง modelPattern (ห้ามเดาชื่อ) */
  displayName?: string;
}

export interface HistoryListItemDto {
  sessionId: string;
  graphId: string;
  /** เวลาเริ่มตรวจ (ISO 8601) */
  startedAt: string;
  /**
   * outcome_kind ของโหนดสุดท้าย ณ ผังปัจจุบัน
   * null = หาไม่ได้ (ผังหรือโหนดถูกเปลี่ยนไปหลัง seed ใหม่) → หน้าจอแสดงแถวแบบจำกัดข้อมูล
   */
  outcomeKind: OutcomeKind | null;
  /** null = ผังนี้ไม่มีในระบบแล้ว */
  graph: HistoryGraphInfo | null;
}

export interface HistoryListResponseDto {
  items: HistoryListItemDto[];
  /** จำนวนที่ผ่านตัวกรองทั้งหมด (ไม่ใช่เฉพาะหน้านี้) */
  total: number;
  /** หน้าที่ส่งจริง: ถ้าขอเกินหน้าสุดท้าย (เช่น เพิ่งลบแถวสุดท้ายของหน้า) ถูกดึงกลับมาหน้าสุดท้าย */
  page: number;
  pageSize: number;
  /** อย่างน้อย 1 เสมอ */
  totalPages: number;
  /** ตัวเลือกของตัวกรอง นับจากประวัติทั้งหมดของผู้ใช้ (ไม่ขึ้นกับตัวกรองที่เลือกอยู่) */
  facets: {
    categories: DeviceCategory[];
    brands: string[];
  };
}

// ============================================================
// รายละเอียด: GET /history/:id
// ============================================================

export interface HistoryStepDto {
  /** โหนดที่ผู้ใช้เคยอยู่ (render จาก engine ตรงๆ) */
  node: RenderedNode;
  /** สิ่งที่ผู้ใช้ทำที่โหนดนั้น */
  action: TraversalAction;
}

export interface HistoryFeedbackDto {
  helpful: boolean;
  comment: string | null;
}

export interface HistoryDetailDto {
  sessionId: string;
  graphId: string;
  startedAt: string;
  /** ค่าที่บันทึกไว้ตอนเริ่ม: null ส่งเป็น null ตรงๆ ห้ามแปลงเป็น 'selected' (ดู migration 007) */
  modelSelection: ModelSelection | null;
  /** คะแนนความคล้าย (ไม่ใช่ความน่าจะเป็น) null = ไม่มีคะแนน (เลือกจากรายการ หรือคำนวณไม่ได้) ห้ามแปลงเป็น 0 */
  confidence: number | null;
  graph: HistoryGraphInfo | null;
  outcomeKind: OutcomeKind | null;
  /**
   * false = ผังหรือโหนดที่เคยผ่านถูกเปลี่ยน/หายไป อ่านขั้นตอนย้อนหลังไม่ได้
   * (steps ว่าง finalNode/reference เป็น null) — ไม่ใช่ error เพื่อให้ยังลบ/ดูข้อความที่ตัวเองบันทึกได้
   */
  available: boolean;
  steps: HistoryStepDto[];
  /** โหนดสุดท้าย (ข้อความสรุปของคู่มือ รวมคำแนะนำศูนย์บริการ ถ้าโหนดนั้นมี) ใช้ข้อความนี้ตรงๆ */
  finalNode: RenderedNode | null;
  /** safetyWarning ของโหนดที่เคยผ่านและโหนดสุดท้าย ไม่ซ้ำ เรียงตามลำดับ · ว่าง = ไม่มีคำเตือน */
  safetyWarnings: string[];
  reference: NodeReference | null;
  /** ข้อความผลลัพธ์ที่ผู้ใช้บันทึกเอง (POST /traversal/sessions/:id/outcome) */
  outcome: string | null;
  feedback: HistoryFeedbackDto | null;
}

// ============================================================
// ให้คะแนน: POST /history/:id/feedback
// ============================================================

export interface FeedbackBody {
  helpful: boolean;
  /** ตัดช่องว่างหน้าหลังแล้ว · ว่าง/ไม่ส่งมา = null (เก็บเป็น NULL ในฐานข้อมูล) */
  comment: string | null;
}

/**
 * body ของ POST /history/:id/feedback: { helpful: boolean, comment?: string }
 * - helpful บังคับ ต้องเป็น boolean จริง (ไม่รับ "true"/1)
 * - comment ไม่บังคับ: ไม่ส่ง / null / ข้อความว่าง / มีแต่ช่องว่าง → null · ยาวเกิน MAX_FEEDBACK_COMMENT_LENGTH → 400
 * ส่งซ้ำ = แทนที่ทั้งชุด: ไม่ส่ง comment ในครั้งหลังแปลว่าล้างข้อความเดิมออก
 */
export function parseFeedbackBody(body: unknown): FeedbackBody {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new InvalidFeedbackError('body ต้องเป็น JSON object');
  }
  const obj = body as Record<string, unknown>;

  if (typeof obj.helpful !== 'boolean') {
    throw new InvalidFeedbackError('helpful ต้องเป็น true หรือ false');
  }

  let comment: string | null = null;
  if (obj.comment !== undefined && obj.comment !== null) {
    if (typeof obj.comment !== 'string') {
      throw new InvalidFeedbackError('comment ต้องเป็นข้อความ');
    }
    const trimmed = obj.comment.trim();
    if (trimmed.length > MAX_FEEDBACK_COMMENT_LENGTH) {
      throw new InvalidFeedbackError(`comment ยาวเกิน ${MAX_FEEDBACK_COMMENT_LENGTH} ตัวอักษร`);
    }
    comment = trimmed === '' ? null : trimmed;
  }

  return { helpful: obj.helpful, comment };
}
