import { ApiError } from '../common/api-error';
import { isPlainObject, UUID_PATTERN } from '../common/helpers';
import type {RenderedNode,SessionStatus,TraversalAction,} from '../traversal-engine/types';
import { MAX_MANUAL_ID_LENGTH, MAX_QUERY_LENGTH } from '../symptom-search/symptom-search.dto';
const MAX_INPUT_LENGTH = 255;
const MAX_OUTCOME_LENGTH = 1000;

// error ของการตรวจ input (400) — ApiError รหัสละตัว · errorHandler (common/error-handler.ts) แปลงเป็น response
// body ผิดรูปแบบ ใช้ code เดียวกับ INVALID_ACTION เพราะผู้ใช้เห็นข้อความไทยเดียวกัน (ต่างกันแค่ "ผิดตอนไหน")
const invalidRequestBody = (message: string) => new ApiError(400, 'INVALID_ACTION', message);

/** body ของ POST /traversal/sessions/:id/outcome */
const invalidOutcome = (message: string) => new ApiError(400, 'INVALID_OUTCOME', message);

/** หัวข้อ X-Client-Id ไม่ใช่ UUID หรือไม่ได้ส่งมาในที่ที่บังคับ (หน้า "ประวัติการซ่อม") → 400 INVALID_CLIENT_ID */
const invalidClientId = (message: string) => new ApiError(400, 'INVALID_CLIENT_ID', message);

/**
 * client id จากหัวข้อ X-Client-Id (UUID ที่เบราว์เซอร์สุ่มสร้างเอง ดู migration 008)
 * ไม่ส่ง = undefined · ส่งมาแล้วต้องเป็นรูป UUID ไม่งั้น 400 (เก็บเป็นตัวพิมพ์เล็กเสมอ)
 * ใช้ตอนเริ่ม session: ไม่ส่ง = ใช้งานได้ตามปกติ แค่ไม่ปรากฏในประวัติของใคร
 *
 * ไม่ใช่การยืนยันตัวตน — ใช้กับ guest เท่านั้น ใครรู้ id ก็เห็นประวัติของ guest id นั้นได้ (ผู้ล็อกอินใช้ token แทน ดู auth/session-owner.ts)
 */
export function parseOptionalClientId(raw: unknown): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw !== 'string' || !UUID_PATTERN.test(raw.trim())) {
    throw invalidClientId('X-Client-Id ต้องเป็น UUID');
  }
  return raw.trim().toLowerCase();
}

/** เหมือน parseOptionalClientId แต่บังคับ — ใช้กับ endpoint ของหน้า "ประวัติการซ่อม" ทุกตัว */
export function parseRequiredClientId(raw: unknown): string {
  const clientId = parseOptionalClientId(raw);
  if (clientId === undefined) {
    throw invalidClientId('ต้องส่งหัวข้อ X-Client-Id');
  }
  return clientId;
}

/** ผู้ใช้ระบุรุ่นเอง (selected) หรือบอกว่าไม่ทราบรุ่นแล้วเลือกรุ่นใกล้เคียงเอง (unknown) — ดู migration 007 */
export type ModelSelection = 'selected' | 'unknown';

interface StartSessionBody {
  graphId: string;
  query?: string;
  manualId?: string;
  modelSelection?: ModelSelection;
}

function asObject(body: unknown): Record<string, unknown> {
  if (!isPlainObject(body)) {
    throw invalidRequestBody('body ต้องเป็น JSON object');
  }
  return body;
}

/**
 * manualId ที่ไม่บังคับ ใช้ทั้ง query string (GET /traversal/graphs?manualId=) และ body (POST /traversal/sessions)
 * ไม่ส่ง = undefined · ส่งแล้วต้องเป็นข้อความที่ไม่ว่างและไม่ยาวเกิน (ตัดช่องว่างหน้าหลังให้)
 * ?manualId=a&manualId=b (อาร์เรย์) ถือว่าผิดรูปแบบ
 */
export function parseOptionalManualId(raw: unknown): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw !== 'string') {
    throw invalidRequestBody('manualId ต้องเป็นข้อความ');
  }
  const manualId = raw.trim();
  if (manualId === '' || manualId.length > MAX_MANUAL_ID_LENGTH) {
    throw invalidRequestBody(
      `manualId ต้องไม่ว่างและยาวไม่เกิน ${MAX_MANUAL_ID_LENGTH} ตัวอักษร`,
    );
  }
  return manualId;
}

function parseModelSelection(raw: unknown): ModelSelection | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw !== 'selected' && raw !== 'unknown') {
    throw invalidRequestBody("modelSelection ต้องเป็น 'selected' หรือ 'unknown'");
  }
  return raw;
}

export function parseStartSessionBody(body: unknown): StartSessionBody {
  const obj = asObject(body);
  const graphId = obj.graphId;

  if (typeof graphId !== 'string' || graphId.trim() === '') {
    throw invalidRequestBody('graphId ต้องเป็นข้อความที่ไม่ว่าง');
  }

  const manualId = parseOptionalManualId(obj.manualId);
  const modelSelection = parseModelSelection(obj.modelSelection);

  if (obj.query === undefined) {
    return { graphId, manualId, modelSelection };
  }
  if (typeof obj.query !== 'string') {
    throw invalidRequestBody('query ต้องเป็นข้อความ');
  }
  const query = obj.query.trim();
  if (query === '') {
    throw invalidRequestBody('query ต้องไม่ว่าง');
  }
  if (query.length > MAX_QUERY_LENGTH) {
    throw invalidRequestBody(`query ยาวเกิน ${MAX_QUERY_LENGTH} ตัวอักษร`);
  }
  return { graphId, query, manualId, modelSelection };
}

export function parseTraversalAction(body: unknown): TraversalAction {
  const obj = asObject(body);

  switch (obj.type) {
    case 'answer': {
      const value = obj.value;
      if (value !== 'yes' && value !== 'no') {
        throw invalidRequestBody(
          "action 'answer' ต้องมี value เป็น 'yes' หรือ 'no'",
        );
      }
      return { type: 'answer', value };
    }

    case 'continue':
      return { type: 'continue' };

    case 'confirm_safety':
      return { type: 'confirm_safety' };

    case 'input': {
      const value = obj.value;
      if (typeof value !== 'string') {
        throw invalidRequestBody(
          "action 'input' ต้องมี value เป็นข้อความ",
        );
      }
      if (value.length > MAX_INPUT_LENGTH) {
        throw invalidRequestBody(
          `action 'input' ยาวเกิน ${MAX_INPUT_LENGTH} ตัวอักษร`,
        );
      }
      return { type: 'input', value };
    }

    default:
      throw invalidRequestBody(
        "type ต้องเป็น 'answer', 'continue', 'confirm_safety' หรือ 'input'",
      );
  }
}

interface OutcomeBody {
  text: string;
}


export function parseOutcomeBody(body: unknown): OutcomeBody {
  if (!isPlainObject(body)) {
    throw invalidOutcome('body ต้องเป็น JSON object');
  }

  const raw = body.text;
  if (typeof raw !== 'string') {
    throw invalidOutcome('text ต้องเป็นข้อความ');
  }

  const text = raw.trim();
  if (text === '') {
    throw invalidOutcome('text ต้องไม่ว่าง');
  }
  if (text.length > MAX_OUTCOME_LENGTH) {
    throw invalidOutcome(`text ยาวเกิน ${MAX_OUTCOME_LENGTH} ตัวอักษร`);
  }

  return { text };
}

export interface EquipmentItemDto {
  equipmentId: string;
  nameTh: string;
  purposeTh: string;
  sourcePage?: number;
  authorNote?: string;
}

export interface SessionResponseDto {
  sessionId: string;
  graphId: string;
  status: SessionStatus;
  node: RenderedNode;
  equipment: EquipmentItemDto[];
  confidence: number | null;
  outcome: string | null;
  displayText: string | null;
}