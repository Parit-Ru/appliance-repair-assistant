import type {RenderedNode,SessionStatus,TraversalAction,} from '../traversal-engine/types';
import { MAX_MANUAL_ID_LENGTH, MAX_QUERY_LENGTH } from '../symptom-search/symptom-search.dto';
const MAX_INPUT_LENGTH = 255;
export const MAX_OUTCOME_LENGTH = 1000;

export class InvalidRequestBodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

//body ของ POST /traversal/sessions/:id/outcome
export class InvalidOutcomeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** ผู้ใช้ระบุรุ่นเอง (selected) หรือบอกว่าไม่ทราบรุ่นแล้วเลือกรุ่นใกล้เคียงเอง (unknown) — ดู migration 007 */
export type ModelSelection = 'selected' | 'unknown';

export interface StartSessionBody {
  graphId: string;
  query?: string;
  manualId?: string;
  modelSelection?: ModelSelection;
}

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new InvalidRequestBodyError('body ต้องเป็น JSON object');
  }
  return body as Record<string, unknown>;
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
    throw new InvalidRequestBodyError('manualId ต้องเป็นข้อความ');
  }
  const manualId = raw.trim();
  if (manualId === '' || manualId.length > MAX_MANUAL_ID_LENGTH) {
    throw new InvalidRequestBodyError(
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
    throw new InvalidRequestBodyError("modelSelection ต้องเป็น 'selected' หรือ 'unknown'");
  }
  return raw;
}

export function parseStartSessionBody(body: unknown): StartSessionBody {
  const obj = asObject(body);
  const graphId = obj.graphId;

  if (typeof graphId !== 'string' || graphId.trim() === '') {
    throw new InvalidRequestBodyError('graphId ต้องเป็นข้อความที่ไม่ว่าง');
  }

  const manualId = parseOptionalManualId(obj.manualId);
  const modelSelection = parseModelSelection(obj.modelSelection);

  if (obj.query === undefined) {
    return { graphId, manualId, modelSelection };
  }
  if (typeof obj.query !== 'string') {
    throw new InvalidRequestBodyError('query ต้องเป็นข้อความ');
  }
  const query = obj.query.trim();
  if (query === '') {
    throw new InvalidRequestBodyError('query ต้องไม่ว่าง');
  }
  if (query.length > MAX_QUERY_LENGTH) {
    throw new InvalidRequestBodyError(`query ยาวเกิน ${MAX_QUERY_LENGTH} ตัวอักษร`);
  }
  return { graphId, query, manualId, modelSelection };
}

export function parseTraversalAction(body: unknown): TraversalAction {
  const obj = asObject(body);

  switch (obj.type) {
    case 'answer': {
      const value = obj.value;
      if (value !== 'yes' && value !== 'no') {
        throw new InvalidRequestBodyError(
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
        throw new InvalidRequestBodyError(
          "action 'input' ต้องมี value เป็นข้อความ",
        );
      }
      if (value.length > MAX_INPUT_LENGTH) {
        throw new InvalidRequestBodyError(
          `action 'input' ยาวเกิน ${MAX_INPUT_LENGTH} ตัวอักษร`,
        );
      }
      return { type: 'input', value };
    }

    default:
      throw new InvalidRequestBodyError(
        "type ต้องเป็น 'answer', 'continue', 'confirm_safety' หรือ 'input'",
      );
  }
}

export interface OutcomeBody {
  text: string;
}


export function parseOutcomeBody(body: unknown): OutcomeBody {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new InvalidOutcomeError('body ต้องเป็น JSON object');
  }

  const raw = (body as Record<string, unknown>).text;
  if (typeof raw !== 'string') {
    throw new InvalidOutcomeError('text ต้องเป็นข้อความ');
  }

  const text = raw.trim();
  if (text === '') {
    throw new InvalidOutcomeError('text ต้องไม่ว่าง');
  }
  if (text.length > MAX_OUTCOME_LENGTH) {
    throw new InvalidOutcomeError(`text ยาวเกิน ${MAX_OUTCOME_LENGTH} ตัวอักษร`);
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