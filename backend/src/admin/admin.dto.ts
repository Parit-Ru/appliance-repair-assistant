/**
 * admin.dto.ts — ตัวตรวจ query string และรูปร่าง response ของ /admin/* (อ่านอย่างเดียวทั้งหมด)
 *
 * เหมือน history.dto.ts: ไม่ใช้ class-validator ตัวตรวจเป็นฟังก์ชัน parseXxx ที่คืนค่าที่ผ่านการตรวจแล้ว
 * หรือโยน InvalidAdminQueryError ให้ AdminExceptionFilter แปลงเป็น 400 INVALID_ADMIN_QUERY
 *
 * เพดานทั้งหมดอยู่ที่นี่ที่เดียว (หน้า/จำนวนต่อหน้า/ช่วงวัน) และค่าที่ผ่านการตรวจเท่านั้นที่ไปถึง SQL
 *
 * ความเป็นส่วนตัว: ชนิด response ด้านล่างไม่มีช่องสำหรับ email, password_hash, display_name, user_id, client_id
 * (มี ownerType = 'user' | 'guest' | 'none' เท่านั้น) service ส่งเฉพาะช่องที่ประกาศไว้ ไม่ spread แถวจากฐานข้อมูล
 */

import type { DeviceCategory, OutcomeKind } from '../traversal-engine/types';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
/** เพดานเลขหน้า กัน OFFSET ใหญ่เกินจริง */
export const MAX_PAGE = 10_000;
export const DEFAULT_DAYS = 30;
export const MAX_DAYS = 90;
/** ช่วงวันที่ from..to ที่ขอได้ (รวมสองปลาย) */
export const MAX_RANGE_DAYS = 366;
export const MAX_GRAPH_ID_LENGTH = 120;
export const TOP_LIMIT = 10;

/** วันที่ของ admin นับตามเวลาไทย (UTC+7) ไม่ขึ้นกับเขตเวลาของ MySQL/เครื่อง */
export const THAI_OFFSET_SECONDS = 7 * 3600;
const DAY_SECONDS = 86_400;

export const SESSION_STATUSES = ['in_progress', 'completed'] as const;
export type AdminSessionStatus = (typeof SESSION_STATUSES)[number];

export const OWNER_TYPES = ['user', 'guest', 'none'] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

export class InvalidAdminQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// ============================================================
// ตัวช่วยอ่าน query string
// ============================================================

function asRecord(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/** ค่าที่เป็น "ข้อความเดียว" — ส่งซ้ำ (?a=1&a=2 → array) ถือว่าผิดรูปแบบ · ค่าว่างถือเหมือนไม่ส่ง */
function optionalText(raw: unknown, name: string): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') {
    throw new InvalidAdminQueryError(`${name} ต้องเป็นข้อความเดียว`);
  }
  const text = raw.trim();
  return text === '' ? undefined : text;
}

function optionalInt(raw: unknown, name: string, min: number, max: number): number | undefined {
  const text = optionalText(raw, name);
  if (text === undefined) return undefined;
  if (!/^\d+$/.test(text)) {
    throw new InvalidAdminQueryError(`${name} ต้องเป็นจำนวนเต็มไม่ติดลบ`);
  }
  const value = Number(text);
  if (value < min || value > max) {
    throw new InvalidAdminQueryError(`${name} ต้องอยู่ระหว่าง ${min} ถึง ${max}`);
  }
  return value;
}

function optionalEnum<T extends string>(raw: unknown, name: string, allowed: readonly T[]): T | undefined {
  const text = optionalText(raw, name);
  if (text === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(text)) {
    throw new InvalidAdminQueryError(`${name} ต้องเป็นหนึ่งใน ${allowed.join(', ')}`);
  }
  return text as T;
}

// ============================================================
// วันที่ (เวลาไทย) ↔ epoch
// ============================================================

/** 'YYYY-MM-DD' ที่มีอยู่จริงในปฏิทิน → เลขวันแบบ UTC (ms ของเที่ยงคืน UTC ของวันนั้น) */
function parseCalendarDay(text: string, name: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    throw new InvalidAdminQueryError(`${name} ต้องเป็นวันที่รูปแบบ YYYY-MM-DD`);
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new InvalidAdminQueryError(`${name} ไม่ใช่วันที่ที่มีอยู่จริง`);
  }
  return ms;
}

/** epoch (วินาที) ของเที่ยงคืนเวลาไทยของวันนั้น */
function thaiMidnightEpoch(utcMidnightMs: number): number {
  return utcMidnightMs / 1000 - THAI_OFFSET_SECONDS;
}

export interface EpochRange {
  /** รวมปลายนี้ */
  fromEpoch?: number;
  /** ไม่รวมปลายนี้ (= เที่ยงคืนเวลาไทยของวันถัดจาก `to`) */
  toEpoch?: number;
}

function parseDateRange(source: Record<string, unknown>): EpochRange {
  const fromText = optionalText(source.from, 'from');
  const toText = optionalText(source.to, 'to');

  const fromMs = fromText === undefined ? undefined : parseCalendarDay(fromText, 'from');
  const toMs = toText === undefined ? undefined : parseCalendarDay(toText, 'to');

  if (fromMs !== undefined && toMs !== undefined) {
    if (fromMs > toMs) {
      throw new InvalidAdminQueryError('from ต้องไม่หลัง to');
    }
    if ((toMs - fromMs) / (DAY_SECONDS * 1000) + 1 > MAX_RANGE_DAYS) {
      throw new InvalidAdminQueryError(`ช่วงวันที่ยาวเกิน ${MAX_RANGE_DAYS} วัน`);
    }
  }

  return {
    fromEpoch: fromMs === undefined ? undefined : thaiMidnightEpoch(fromMs),
    toEpoch: toMs === undefined ? undefined : thaiMidnightEpoch(toMs) + DAY_SECONDS,
  };
}

/** เลขวัน (นับจาก 1970-01-01 ตามเวลาไทย) ของเวลา epoch นั้น */
export function thaiDayIndex(epochSeconds: number): number {
  return Math.floor((epochSeconds + THAI_OFFSET_SECONDS) / DAY_SECONDS);
}

/** เลขวัน → 'YYYY-MM-DD' */
export function dayIndexToDate(dayIndex: number): string {
  return new Date(dayIndex * DAY_SECONDS * 1000).toISOString().slice(0, 10);
}

/** เลขวัน → epoch เที่ยงคืนเวลาไทยของวันนั้น */
export function dayIndexToEpoch(dayIndex: number): number {
  return dayIndex * DAY_SECONDS - THAI_OFFSET_SECONDS;
}

// ============================================================
// query ของแต่ละ endpoint
// ============================================================

export interface PageQuery {
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

/** ?helpful=true|false&from=&to=&page=&pageSize= */
export function parseFeedbackQuery(raw: unknown): FeedbackQuery {
  const source = asRecord(raw);
  const helpful = optionalEnum(source.helpful, 'helpful', ['true', 'false'] as const);
  return {
    ...parsePage(source),
    ...parseDateRange(source),
    helpful: helpful === undefined ? undefined : helpful === 'true',
  };
}

export interface SessionsQuery extends PageQuery, EpochRange {
  status?: AdminSessionStatus;
  ownerType?: OwnerType;
  graphId?: string;
}

/** ?status=&ownerType=&graphId=&from=&to=&page=&pageSize= */
export function parseSessionsQuery(raw: unknown): SessionsQuery {
  const source = asRecord(raw);

  const graphId = optionalText(source.graphId, 'graphId');
  if (graphId !== undefined && graphId.length > MAX_GRAPH_ID_LENGTH) {
    throw new InvalidAdminQueryError(`graphId ยาวเกิน ${MAX_GRAPH_ID_LENGTH} ตัวอักษร`);
  }

  return {
    ...parsePage(source),
    ...parseDateRange(source),
    status: optionalEnum(source.status, 'status', SESSION_STATUSES),
    ownerType: optionalEnum(source.ownerType, 'ownerType', OWNER_TYPES),
    graphId,
  };
}

export interface SummaryQuery {
  days: number;
}

/** ?days=1..90 (ค่าเริ่มต้น 30) — ใช้กับทุกส่วนของ summary */
export function parseSummaryQuery(raw: unknown): SummaryQuery {
  const source = asRecord(raw);
  return { days: optionalInt(source.days, 'days', 1, MAX_DAYS) ?? DEFAULT_DAYS };
}

// ============================================================
// รูปร่าง response (ไม่มีช่อง email / password_hash / displayName / user_id / client_id)
// ============================================================

export interface PagedDto<T> {
  items: T[];
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
  /** null = ผังนี้ไม่มีในระบบแล้ว */
  deviceCategory: DeviceCategory | null;
  brand: string | null;
  ownerType: OwnerType;
}

export interface AdminSessionItemDto {
  sessionId: string;
  graphId: string;
  deviceCategory: DeviceCategory | null;
  brand: string | null;
  status: AdminSessionStatus;
  /** true = เลยเวลาหมดอายุแล้ว (แถวยังค้างอยู่ในฐานข้อมูล) */
  expired: boolean;
  confidence: number | null;
  modelSelection: 'selected' | 'unknown' | null;
  /** เฉพาะ session ที่จบแล้ว · null = หาไม่ได้ (ผัง/โหนดเปลี่ยนไปหลัง seed ใหม่) */
  outcomeKind: OutcomeKind | null;
  hasFeedback: boolean;
  ownerType: OwnerType;
  createdAt: string;
}

export interface AdminSummaryDto {
  window: { days: number; from: string; to: string };
  sessions: {
    total: number;
    completed: number;
    inProgress: number;
    /** เดินค้างแล้วหมดอายุ — ไม่ใช่ "ยกเลิก" (การยกเลิกลบแถวทิ้ง นับไม่ได้) */
    expiredUnfinished: number;
    byOwner: { user: number; guest: number; none: number };
  };
  feedback: {
    total: number;
    helpful: number;
    notHelpful: number;
    /** helpful / total · null เมื่อยังไม่มีคะแนน (ไม่ใช่ 0) */
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
