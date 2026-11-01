import { ApiError } from '../common/api-error';
import { isPlainObject } from '../common/helpers';
import type { DeviceCategory, StateReference, OutcomeKind, RenderedState, ExecutionAction } from '../state-machine/types';
import type { ModelSelection } from '../execution/execution.dto';

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;
const MAX_FEEDBACK_COMMENT_LENGTH = 500;

// / ?page=/?pageSize= ผิดรูปแบบ → 400 INVALID_HISTORY_QUERY 
const invalidQuery = (message: string) => new ApiError(400, 'INVALID_HISTORY_QUERY', message);

/** POST /history/:id/feedback */
const invalidFeedback = (message: string) => new ApiError(400, 'INVALID_FEEDBACK', message);

export interface HistoryQuery {
  page: number;
  pageSize: number;
}


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
export interface HistoryFlowInfo {
  manualId: string;
  entrySymptom: string;
  entrySymptomTh?: string;
  deviceCategory: DeviceCategory;
  brand: string;
  modelPattern: string;
  displayName?: string;
}

export interface HistoryListItemDto {
  sessionId: string;
  flowId: string;
  startedAt: string;
  outcomeKind: OutcomeKind | null;
  flow: HistoryFlowInfo | null;
}

export interface HistoryListResponseDto {
  items: HistoryListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// รายละเอียด: GET /history/:id

export interface HistoryStepDto {
  state: RenderedState;
  action: ExecutionAction;
}

export interface HistoryFeedbackDto {
  helpful: boolean;
  comment: string | null;
}

export interface HistoryDetailDto {
  sessionId: string;
  flowId: string;
  startedAt: string;
  modelSelection: ModelSelection | null;
  confidence: number | null;
  flow: HistoryFlowInfo | null;
  outcomeKind: OutcomeKind | null;
  available: boolean;
  steps: HistoryStepDto[];
  finalState: RenderedState | null;
  safetyWarnings: string[];
  reference: StateReference | null;
  outcome: string | null;
  feedback: HistoryFeedbackDto | null;
}

// ให้คะแนน: POST /history/:id/feedback

/** body ของ POST /history/:id/feedback: { helpful: boolean, comment?: string } */
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
