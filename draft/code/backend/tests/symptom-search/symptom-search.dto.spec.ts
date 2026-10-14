// backend/src/symptom-search/symptom-search.dto.spec.ts

/**
 * เทสตัวตรวจ body ของ POST /symptom-search
 * ไฟล์ dto บริสุทธิ์ จึงเทสได้โดยไม่ต้องเปิดเซิร์ฟเวอร์หรือโหลดโมเดล
 */

import {
  InvalidSearchQueryError,
  MAX_QUERY_LENGTH,
  parseSearchBody,
} from './symptom-search.dto';

describe('parseSearchBody', () => {
  it('body ถูกต้อง → คืน { query }', () => {
    expect(parseSearchBody({ query: 'แอร์ไม่เย็น' })).toEqual({
      query: 'แอร์ไม่เย็น',
    });
  });

  it('ตัดช่องว่างหน้าหลังของ query', () => {
    expect(parseSearchBody({ query: '  แอร์ไม่เย็น \n' }).query).toBe(
      'แอร์ไม่เย็น',
    );
  });

  it('ทิ้ง field แปลกปลอม (ไม่ผ่านไปต่อ)', () => {
    const result = parseSearchBody({ query: 'แอร์ดับ', threshold: 0, admin: true });
    expect(result).toEqual({ query: 'แอร์ดับ' });
    expect(Object.keys(result)).toEqual(['query']);
  });

  it('body ไม่ใช่ object → โยน InvalidSearchQueryError', () => {
    for (const bad of [null, undefined, [], ['แอร์'], 'แอร์', 42, true]) {
      expect(() => parseSearchBody(bad)).toThrow(InvalidSearchQueryError);
    }
  });

  it('ไม่มี field query → โยน error', () => {
    expect(() => parseSearchBody({})).toThrow(InvalidSearchQueryError);
    expect(() => parseSearchBody({ q: 'แอร์' })).toThrow(InvalidSearchQueryError);
  });

  it('query ไม่ใช่ข้อความ → โยน error', () => {
    for (const bad of [123, null, true, ['แอร์'], { text: 'แอร์' }]) {
      expect(() => parseSearchBody({ query: bad })).toThrow(
        InvalidSearchQueryError,
      );
    }
  });

  it('query เป็นข้อความว่าง → โยน error', () => {
    expect(() => parseSearchBody({ query: '' })).toThrow(InvalidSearchQueryError);
  });

  it('query มีแต่ช่องว่าง → โยน error', () => {
    expect(() => parseSearchBody({ query: '  \t\n ' })).toThrow(
      InvalidSearchQueryError,
    );
  });

  it('ยาวพอดี MAX_QUERY_LENGTH → ผ่าน', () => {
    const query = 'ก'.repeat(MAX_QUERY_LENGTH);
    expect(parseSearchBody({ query }).query).toHaveLength(MAX_QUERY_LENGTH);
  });

  it('ยาวเกิน MAX_QUERY_LENGTH → โยน error (นับหลังตัดช่องว่าง)', () => {
    const tooLong = 'ก'.repeat(MAX_QUERY_LENGTH + 1);
    expect(() => parseSearchBody({ query: tooLong })).toThrow(
      InvalidSearchQueryError,
    );
    // ช่องว่างหน้าหลังไม่นับ: 200 ตัวอักษร + ช่องว่าง ยังผ่าน
    const padded = ` ${'ก'.repeat(MAX_QUERY_LENGTH)} `;
    expect(() => parseSearchBody({ query: padded })).not.toThrow();
  });
});