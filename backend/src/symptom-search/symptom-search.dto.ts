import { ApiError } from '../common/api-error';
import { isPlainObject } from '../common/helpers';
import type { DeviceCategory } from '../traversal-engine/types';
export const MAX_QUERY_LENGTH = 200;
export const MAX_MANUAL_ID_LENGTH = 80;

const invalid = (message: string) => new ApiError(400, 'INVALID_QUERY', message);

interface SearchBody {
  query: string;
  manualId?: string;
}

export function parseSearchBody(body: unknown): SearchBody {
  if (!isPlainObject(body)) {
    throw invalid('body ต้องเป็น JSON object');
  }

  const raw = body.query;
  if (typeof raw !== 'string') {
    throw invalid('query ต้องเป็นข้อความ');
  }

  const query = raw.trim();
  if (query === '') {
    throw invalid('query ต้องไม่ว่าง');
  }
  if (query.length > MAX_QUERY_LENGTH) {
    throw invalid(`query ยาวเกิน ${MAX_QUERY_LENGTH} ตัวอักษร`);
  }

  const rawManual = body.manualId;
  if (rawManual === undefined) {
    return { query };
  }
  if (typeof rawManual !== 'string') {
    throw invalid('manualId ต้องเป็นข้อความ');
  }

  const manualId = rawManual.trim();
  if (manualId === '' || manualId.length > MAX_MANUAL_ID_LENGTH) {
    throw invalid(`manualId ต้องไม่ว่างและยาวไม่เกิน ${MAX_MANUAL_ID_LENGTH} ตัวอักษร`);
  }

  return { query, manualId };
}

interface SymptomMatchDto {
  graphId: string;
  entrySymptom: string;
  entrySymptomTh?: string;
  deviceCategory: DeviceCategory;
  score: number;
  matchedText: string;
}

/** POST /symptom-search */
export interface SymptomSearchResponseDto {
  query: string;
  threshold: number;
  bestScore: number | null;
  matches: SymptomMatchDto[];
}

export type SearchState = 'disabled' | 'loading' | 'ready' | 'failed';

/** GET /symptom-search/status */
export interface SearchStatusDto {
  state: SearchState;
  model: string;
  dtype: string;
  indexedTexts: number;
  indexedGraphs: number;
  loadMs: number | null;
  modelFilesFoundLocally: boolean;
  error: string | null;
  memoryRssMb: number;
}
