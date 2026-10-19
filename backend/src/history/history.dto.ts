/**
 * history.dto.ts — รูปร่างข้อมูลและตัวตรวจ input ของหน้า "ประวัติการซ่อม" (GET/DELETE/POST /history…)
 *
 * เหมือน traversal.dto.ts: ไม่ใช้ class-validator ตัวตรวจเป็นฟังก์ชันล้วนที่คืนค่าที่ผ่านการตรวจแล้ว
 * หรือโยน ApiError 400 (AllExceptionsFilter แปลงเป็น response)
 *
 * ทุกอย่างในนี้มาจากข้อมูลที่ระบบบันทึกไว้จริง (session + ผังปัจจุบัน) ห้ามเติมเอง
 * โดยเฉพาะ "สาเหตุที่เป็นไปได้" (possible_cause) ไม่ถูกส่ง เพราะไม่ได้เก็บไว้ในผัง/ฐานข้อมูล
 */

import { ApiError } from '../common/api-error';
import { isPlainObject } from '../common/helpers';
import type { DeviceCategory, NodeReference, OutcomeKind, RenderedNode, TraversalAction } from '../traversal-engine/types';
import type { ModelSelection } from '../traversal/traversal.dto';

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;
/** ความยาวสูงสุดของ comment ในการให้คะแนน (ตรวจที่นี่ ไม่ใช่ที่ชนิดคอลัมน์ — ดู migration 009) */
const MAX_FEEDBACK_COMMENT_LENGTH = 500;

/** ?page=/?pageSize= ผิดรูปแบบ → 400 INVALID_HISTORY_QUERY */
const invalidQuery = (message: string) => new ApiError(400, 'INVALID_HISTORY_QUERY', message);

/** body ของ POST /history/:id/feedback ผิดรูปแบบ → 400 INVALID_FEEDBACK */
const invalidFeedback = (message: string) => new ApiError(400, 'INVALID_FEEDBACK', message);

// ============================================================
// รายการ: GET /history  (ใหม่สุดก่อนเสมอ · แบ่งหน้าอย่างเดียว ไม่มีตัวกรอง/ค้นหา/เรียง)
// ============================================================

export interface HistoryQuery {
  page: number;
  pageSize: number;
}

/**
 * จำนวนเต็มบวกจาก query string · ไม่ส่ง = undefined
 * ส่งซ้ำ (?page=1&page=2 → array) ถือว่าผิดรูปแบบ
 */
function optionalPositiveInt(raw: unknown, name: string, max?: number): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw !== 'string') {
    throw invalidQuery(`${name} ต้องเป็นข้อความ`);
  }
  if (!/^\d+$/.test(raw)) {
    throw invalidQuery(`${name} ต้องเป็นจำนวนเต็มบวก`);
  }
  const value = Number(raw);
  if (value < 1 || (max !== undefined && value > max)) {
    throw invalidQuery(
      max === undefined ? `${name} ต้องมากกว่า 0` : `${name} ต้องอยู่ระหว่าง 1 ถึง ${max}`,
    );
  }
  return value;
}

/**
 * ?page=&pageSize=  ทั้งสองไม่บังคับ (ค่าเริ่มต้น หน้า 1 · ครั้งละ 10 รายการ)
 * query key อื่นถูกเมิน (เช่นลิงก์เก่าที่ยังมี ?status=) ไม่ตอบ 400
 */
export function parseHistoryQuery(raw: unknown): HistoryQuery {
  const source: Record<string, unknown> =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
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
  /** จำนวนรายการทั้งหมดของผู้ใช้ (ไม่ใช่เฉพาะหน้านี้) */
  total: number;
  /** หน้าที่ส่งจริง: ถ้าขอเกินหน้าสุดท้าย (เช่น เพิ่งลบแถวสุดท้ายของหน้า) ถูกดึงกลับมาหน้าสุดท้าย */
  page: number;
  pageSize: number;
  /** อย่างน้อย 1 เสมอ */
  totalPages: number;
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

/** คะแนนที่ผู้ใช้ให้ (ใช้ทั้งเป็น body ที่รับเข้า ค่าที่เก็บ และค่าที่ส่งกลับ) */
export interface HistoryFeedbackDto {
  helpful: boolean;
  /** ตัดช่องว่างหน้าหลังแล้ว · ว่าง/ไม่ส่งมา = null (เก็บเป็น NULL ในฐานข้อมูล) */
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

/**
 * body ของ POST /history/:id/feedback: { helpful: boolean, comment?: string }
 * - helpful บังคับ ต้องเป็น boolean จริง (ไม่รับ "true"/1)
 * - comment ไม่บังคับ: ไม่ส่ง / null / ข้อความว่าง / มีแต่ช่องว่าง → null · ยาวเกิน MAX_FEEDBACK_COMMENT_LENGTH → 400
 * ส่งซ้ำ = แทนที่ทั้งชุด: ไม่ส่ง comment ในครั้งหลังแปลว่าล้างข้อความเดิมออก
 */
export function parseFeedbackBody(body: unknown): HistoryFeedbackDto {
  if (!isPlainObject(body)) {
    throw invalidFeedback('body ต้องเป็น JSON object');
  }
  const obj = body;

  if (typeof obj.helpful !== 'boolean') {
    throw invalidFeedback('helpful ต้องเป็น true หรือ false');
  }

  let comment: string | null = null;
  if (obj.comment !== undefined && obj.comment !== null) {
    if (typeof obj.comment !== 'string') {
      throw invalidFeedback('comment ต้องเป็นข้อความ');
    }
    const trimmed = obj.comment.trim();
    if (trimmed.length > MAX_FEEDBACK_COMMENT_LENGTH) {
      throw invalidFeedback(`comment ยาวเกิน ${MAX_FEEDBACK_COMMENT_LENGTH} ตัวอักษร`);
    }
    comment = trimmed === '' ? null : trimmed;
  }

  return { helpful: obj.helpful, comment };
}
