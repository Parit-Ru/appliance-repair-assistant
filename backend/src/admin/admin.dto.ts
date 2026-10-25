import { ApiError } from '../common/api-error';
import { isPlainObject } from '../common/helpers';
import type { DeviceCategory, OutcomeKind } from '../traversal-engine/types';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
const MAX_PAGE = 10_000;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;
const MAX_RANGE_DAYS = 366;
export const TOP_LIMIT = 10;

const THAI_OFFSET_SECONDS = 7 * 3600;
const DAY_SECONDS = 86_400;

export type OwnerType = 'user' | 'guest' | 'none';

const invalid = (message: string) => new ApiError(400, 'INVALID_ADMIN_QUERY', message);

function asRecord(raw: unknown): Record<string, unknown> {
  return isPlainObject(raw) ? raw : {};
}

function optionalText(raw: unknown, name: string): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') {
    throw invalid(`${name} ต้องเป็นข้อความเดียว`);
  }
  const text = raw.trim();
  return text === '' ? undefined : text;
}

function optionalInt(raw: unknown, name: string, min: number, max: number): number | undefined {
  const text = optionalText(raw, name);
  if (text === undefined) return undefined;
  if (!/^\d+$/.test(text)) {
    throw invalid(`${name} ต้องเป็นจำนวนเต็มไม่ติดลบ`);
  }
  const value = Number(text);
  if (value < min || value > max) {
    throw invalid(`${name} ต้องอยู่ระหว่าง ${min} ถึง ${max}`);
  }
  return value;
}


function parseCalendarDay(text: string, name: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    throw invalid(`${name} ต้องเป็นวันที่รูปแบบ YYYY-MM-DD`);
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw invalid(`${name} ไม่ใช่วันที่ที่มีอยู่จริง`);
  }
  return ms;
}

function thaiMidnightEpoch(utcMidnightMs: number): number {
  return utcMidnightMs / 1000 - THAI_OFFSET_SECONDS;
}

export interface EpochRange {
  fromEpoch?: number;
  toEpoch?: number;
}

function parseDateRange(source: Record<string, unknown>): EpochRange {
  const fromText = optionalText(source.from, 'from');
  const toText = optionalText(source.to, 'to');

  const fromMs = fromText === undefined ? undefined : parseCalendarDay(fromText, 'from');
  const toMs = toText === undefined ? undefined : parseCalendarDay(toText, 'to');

  if (fromMs !== undefined && toMs !== undefined) {
    if (fromMs > toMs) {
      throw invalid('from ต้องไม่หลัง to');
    }
    if ((toMs - fromMs) / (DAY_SECONDS * 1000) + 1 > MAX_RANGE_DAYS) {
      throw invalid(`ช่วงวันที่ยาวเกิน ${MAX_RANGE_DAYS} วัน`);
    }
  }

  return {
    fromEpoch: fromMs === undefined ? undefined : thaiMidnightEpoch(fromMs),
    toEpoch: toMs === undefined ? undefined : thaiMidnightEpoch(toMs) + DAY_SECONDS,
  };
}

export function thaiDayIndex(epochSeconds: number): number {
  return Math.floor((epochSeconds + THAI_OFFSET_SECONDS) / DAY_SECONDS);
}

// เลขวัน  'YYYY-MM-DD' 
export function dayIndexToDate(dayIndex: number): string {
  return new Date(dayIndex * DAY_SECONDS * 1000).toISOString().slice(0, 10);
}

// เลขวัน → epoch เที่ยงคืนเวลาไทยของวันนั้น
export function dayIndexToEpoch(dayIndex: number): number {
  return dayIndex * DAY_SECONDS - THAI_OFFSET_SECONDS;
}
interface PageQuery {
  page: number;
  pageSize: number;
}

function parsePage(source: Record<string, unknown>): PageQuery {
  return {
    page: optionalInt(source.page, 'page', 1, MAX_PAGE) ?? 1,
    pageSize: optionalInt(source.pageSize, 'pageSize', 1, MAX_PAGE_SIZE) ?? DEFAULT_PAGE_SIZE,
  };
}

export interface FeedbackQuery extends PageQuery, EpochRange {
  helpful?: boolean;
}

// / ?helpful=true|false&from=&to=&page=&pageSize
export function parseFeedbackQuery(raw: unknown): FeedbackQuery {
  const source = asRecord(raw);
  const helpfulText = optionalText(source.helpful, 'helpful');
  if (helpfulText !== undefined && helpfulText !== 'true' && helpfulText !== 'false') {
    throw invalid('helpful ต้องเป็นหนึ่งใน true, false');
  }
  return {
    ...parsePage(source),
    ...parseDateRange(source),
    helpful: helpfulText === undefined ? undefined : helpfulText === 'true',
  };
}

export interface SummaryQuery {
  days: number;
}

// / ?days=1..90 (ค่าเริ่มต้น 30) — ใช้กับทุกส่วนของ summary 
export function parseSummaryQuery(raw: unknown): SummaryQuery {
  const source = asRecord(raw);
  return { days: optionalInt(source.days, 'days', 1, MAX_DAYS) ?? DEFAULT_DAYS };
}
export interface AdminFeedbackPageDto {
  items: AdminFeedbackItemDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminFeedbackItemDto {
  sessionId: string;
  helpful: boolean;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  graphId: string;
  deviceCategory: DeviceCategory | null;
  brand: string | null;
  ownerType: OwnerType;
}

export interface AdminSummaryDto {
  window: { days: number; from: string; to: string };
  sessions: {
    total: number;
    completed: number;
    inProgress: number;
    expiredUnfinished: number;
    byOwner: { user: number; guest: number; none: number };
  };
  feedback: {
    total: number;
    helpful: number;
    notHelpful: number;
    satisfactionRate: number | null;
  };
  confidence: { average: number | null; sampleSize: number };
  outcomes: Record<OutcomeKind | 'unknown', number>;
  topGraphs: Array<{ graphId: string; entrySymptomTh: string | null; count: number }>;
  topDevices: Array<{ deviceCategory: DeviceCategory | 'unknown'; count: number }>;
  perDay: Array<{ date: string; started: number; completed: number }>;
}

export function totalPagesOf(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
