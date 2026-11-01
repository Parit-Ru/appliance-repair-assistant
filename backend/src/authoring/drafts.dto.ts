import { isPlainObject } from '../common/helpers';
import { invalidDraftRequest } from './drafts.errors';
import { DEVICE_CATEGORIES } from './flow-validator';
import type { ValidationReport } from './flow-validator';
import { MAX_RANGE_PAGES } from './pdf-text';
import type { PageText } from './pdf-text';
import type { DraftMeta } from './draft-manual';
import type { DraftFlow } from './draft-schema';

const DRAFT_STATUSES = ['drafting', 'ready', 'failed', 'rejected', 'published'] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

const MAX_NEW_MANUAL_ID_LENGTH = 60;

export interface UploadFields {
  manualId: string;
  meta: DraftMeta;
}

type Obj = Record<string, unknown>;

function asObject(body: unknown): Obj {
  return isPlainObject(body) ? body : {};
}

function text(source: Obj, key: string, max: number, required = true): string | undefined {
  const raw = source[key];
  if (raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
    if (required) throw invalidDraftRequest(`ต้องระบุ ${key}`);
    return undefined;
  }
  if (typeof raw !== 'string') throw invalidDraftRequest(`${key} ต้องเป็นข้อความ`);
  const value = raw.trim();
  if (value.length > max) throw invalidDraftRequest(`${key} ยาวเกิน ${max} ตัวอักษร`);
  return value;
}

function pageNumber(source: Obj, key: string): number {
  const raw = source[key];
  if (typeof raw !== 'string' || !/^\d{1,4}$/.test(raw.trim())) throw invalidDraftRequest(`${key} ต้องเป็นเลขหน้า (จำนวนเต็ม ≥ 1)`);
  const value = Number(raw.trim());
  if (value < 1) throw invalidDraftRequest(`${key} ต้องเป็นเลขหน้า (จำนวนเต็ม ≥ 1)`);
  return value;
}

/*
  ฟิลด์ข้อความของ multipart POST /admin/drafts:
  manualId, deviceCategory, brand, modelPattern, sourceManual, displayName? (ไม่บังคับ), pageFrom, pageTo
  manualId ใช้ได้เฉพาะ a-z 0-9 _ (ผังที่ publish ต้องเป็นคู่มือใหม่เท่านั้น: ชนของเดิมถูกปฏิเสธตอนอัปโหลด/เผยแพร่)
 */
export function parseUploadFields(body: unknown): UploadFields {
  const source = asObject(body);

  const manualId = text(source, 'manualId', MAX_NEW_MANUAL_ID_LENGTH) as string;
  if (!/^[a-z0-9_]{3,60}$/.test(manualId)) throw invalidDraftRequest('manualId ใช้ได้เฉพาะ a-z 0-9 และ _ ยาว 3–60 ตัว');

  const deviceCategory = text(source, 'deviceCategory', 40) as string;
  if (!(DEVICE_CATEGORIES as readonly string[]).includes(deviceCategory)) {
    throw invalidDraftRequest(`deviceCategory ต้องเป็นหนึ่งใน ${DEVICE_CATEGORIES.join(', ')}`);
  }

  const pageFrom = pageNumber(source, 'pageFrom');
  const pageTo = pageNumber(source, 'pageTo');
  if (pageTo < pageFrom) throw invalidDraftRequest('pageTo ต้องไม่น้อยกว่า pageFrom');
  if (pageTo - pageFrom + 1 > MAX_RANGE_PAGES) throw invalidDraftRequest(`เลือกได้ไม่เกิน ${MAX_RANGE_PAGES} หน้าต่อร่าง`);

  const displayName = text(source, 'displayName', 120, false);
  return {
    manualId,
    meta: {
      device_category: deviceCategory,
      brand: text(source, 'brand', 40) as string,
      model_pattern: text(source, 'modelPattern', 60) as string,
      source_manual: text(source, 'sourceManual', 200) as string,
      ...(displayName !== undefined ? { display_name: displayName } : {}),
      page_from: pageFrom,
      page_to: pageTo,
    },
  };
}

/** body ของ PUT /admin/drafts/:id */
export function parseUpdateBody(body: unknown): { flows: unknown } {
  const source = asObject(body);
  const extra = Object.keys(source).filter((key) => key !== 'flows');
  if (extra.length > 0) throw invalidDraftRequest(`ฟิลด์ที่ไม่อนุญาต: ${extra.join(', ')}`);
  if (source.flows === undefined) throw invalidDraftRequest('ต้องมี flows');
  return { flows: source.flows };
}

/** body ของ POST /admin/drafts/:id/publish → { acknowledgedWarnings } */
export function parsePublishBody(body: unknown): { acknowledgedWarnings: boolean } {
  const source = asObject(body);
  const extra = Object.keys(source).filter((key) => key !== 'acknowledgedWarnings');
  if (extra.length > 0) throw invalidDraftRequest(`ฟิลด์ที่ไม่อนุญาต: ${extra.join(', ')}`);
  const flag = source.acknowledgedWarnings;
  if (flag !== undefined && typeof flag !== 'boolean') throw invalidDraftRequest('acknowledgedWarnings ต้องเป็น true หรือ false');
  return { acknowledgedWarnings: flag === true };
}

/** body ของ POST /admin/drafts/:id/reject → { reason? } */
export function parseRejectBody(body: unknown): { reason?: string } {
  const source = asObject(body);
  const extra = Object.keys(source).filter((key) => key !== 'reason');
  if (extra.length > 0) throw invalidDraftRequest(`ฟิลด์ที่ไม่อนุญาต: ${extra.join(', ')}`);
  return { reason: text(source, 'reason', 300, false) };
}
export interface DraftSummaryDto {
  id: string;
  status: DraftStatus;
  manualId: string;
  brand: string;
  modelPattern: string;
  sourceManual: string;
  pageFrom: number;
  pageTo: number;
  flowCount: number | null;
  progress: { done: number; total: number };
  error: { code: string; message: string } | null;
  validationCounts: { errors: number; warnings: number } | null;
  createdAt: string;
  updatedAt: string;
}

export interface DraftDetailDto extends DraftSummaryDto {
  meta: DraftMeta;
  pages: PageText[];
  flows: DraftFlow[] | null;
  validation: ValidationReport | null;
  llm: { model: string | null; promptVersion: string | null };
  reviewedAt: string | null;
  publishedAt: string | null;
}

export interface PublishResultDto {
  id: string;
  status: 'published';
  flowIds: string[];
  searchIndex: { indexed: boolean; reason?: string };
}
