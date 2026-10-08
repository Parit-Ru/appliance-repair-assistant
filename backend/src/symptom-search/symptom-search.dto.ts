import type { DeviceCategory } from '../traversal-engine/types';
export const MAX_QUERY_LENGTH = 200;

export class InvalidSearchQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export interface SearchBody {
  query: string;
}

export function parseSearchBody(body: unknown): SearchBody {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new InvalidSearchQueryError('body ต้องเป็น JSON object');
  }

  const raw = (body as Record<string, unknown>).query;
  if (typeof raw !== 'string') {
    throw new InvalidSearchQueryError('query ต้องเป็นข้อความ');
  }

  const query = raw.trim();
  if (query === '') {
    throw new InvalidSearchQueryError('query ต้องไม่ว่าง');
  }
  if (query.length > MAX_QUERY_LENGTH) {
    throw new InvalidSearchQueryError(
      `query ยาวเกิน ${MAX_QUERY_LENGTH} ตัวอักษร`,
    );
  }

  return { query };
}

export interface SymptomMatchDto {
  graphId: string;
  entrySymptom: string;
  entrySymptomTh?: string;
  deviceCategory: DeviceCategory;
  score: number;
  matchedText: string;
}

// POST /symptom-search 
export interface SymptomSearchResponseDto {
  query: string;
  threshold: number;
  bestScore: number | null;
  matches: SymptomMatchDto[];
}

export type SearchState = 'disabled' | 'loading' | 'ready' | 'failed';

// GET /symptom-search/status 
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