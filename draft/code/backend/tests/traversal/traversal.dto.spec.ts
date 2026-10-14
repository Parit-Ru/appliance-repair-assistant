// backend/src/traversal/traversal.dto.spec.ts

/**
 * เทสตัวตรวจ body ของ POST /traversal/sessions (ส่วนที่เพิ่ม query ไม่บังคับ ในขั้น 1.8)
 * และของ POST /traversal/sessions/:id/outcome (ผลลัพธ์ที่ผู้ใช้กรอก)
 * ฟังก์ชันบริสุทธิ์ เทสได้โดยไม่ต้องเปิดเซิร์ฟเวอร์
 */

import { MAX_QUERY_LENGTH } from '../symptom-search/symptom-search.dto';
import {
  InvalidOutcomeError,
  InvalidRequestBodyError,
  MAX_OUTCOME_LENGTH,
  parseOutcomeBody,
  parseStartSessionBody,
} from './traversal.dto';

describe('parseStartSessionBody', () => {
  it('มีแค่ graphId (เลือกจากรายการเอง) → คืน { graphId } ไม่มี field query', () => {
    const result = parseStartSessionBody({ graphId: 'g1' });
    expect(result).toEqual({ graphId: 'g1' });
    expect('query' in result).toBe(false);
  });

  it('มี query ที่ถูกต้อง → คืนทั้งสอง field และตัดช่องว่างหน้าหลังของ query', () => {
    expect(parseStartSessionBody({ graphId: 'g1', query: '  แอร์ดับ ' })).toEqual({
      graphId: 'g1',
      query: 'แอร์ดับ',
    });
  });

  it('ยังทิ้ง field แปลกปลอม (เช่น confidence ที่หน้าจอพยายามส่งมาเอง)', () => {
    const result = parseStartSessionBody({ graphId: 'g1', query: 'แอร์ดับ', confidence: 1 });
    expect(Object.keys(result).sort()).toEqual(['graphId', 'query']);
  });

  it('query ไม่ใช่ข้อความ / ว่าง / มีแต่ช่องว่าง → โยน InvalidRequestBodyError', () => {
    for (const bad of [123, null, true, ['แอร์'], '', '   ']) {
      expect(() => parseStartSessionBody({ graphId: 'g1', query: bad })).toThrow(
        InvalidRequestBodyError,
      );
    }
  });

  it('query ยาวเกิน MAX_QUERY_LENGTH → โยน error · ยาวพอดีผ่าน', () => {
    expect(() =>
      parseStartSessionBody({ graphId: 'g1', query: 'ก'.repeat(MAX_QUERY_LENGTH + 1) }),
    ).toThrow(InvalidRequestBodyError);
    expect(() =>
      parseStartSessionBody({ graphId: 'g1', query: 'ก'.repeat(MAX_QUERY_LENGTH) }),
    ).not.toThrow();
  });

  it('graphId ผิดรูปแบบยังถูกปฏิเสธเหมือนเดิม', () => {
    for (const bad of [{}, { graphId: '' }, { graphId: 5 }, null]) {
      expect(() => parseStartSessionBody(bad)).toThrow(InvalidRequestBodyError);
    }
  });
});

describe('parseOutcomeBody', () => {
  it('เพดานความยาวคือ 1,000 ตัวอักษร (ค่าที่ตกลงไว้)', () => {
    expect(MAX_OUTCOME_LENGTH).toBe(1000);
  });

  it('ข้อความปกติ → คืน { text } และตัดช่องว่าง/ขึ้นบรรทัดหน้าหลัง แต่ไม่แตะกลางข้อความ', () => {
    expect(parseOutcomeBody({ text: '  ทำตามแล้วแอร์กลับมาเย็น\n' })).toEqual({
      text: 'ทำตามแล้วแอร์กลับมาเย็น',
    });
    // ขึ้นบรรทัดใหม่และช่องว่างกลางข้อความต้องอยู่ครบ (ผู้ใช้พิมพ์หลายบรรทัดใน textarea ได้)
    expect(parseOutcomeBody({ text: 'บรรทัดแรก\n\nบรรทัดสอง  ยังไม่หาย' }).text).toBe(
      'บรรทัดแรก\n\nบรรทัดสอง  ยังไม่หาย',
    );
  });

  it('ทิ้ง field แปลกปลอม (เช่น หน้าจอพยายามส่ง outcome_at / status / confidence มาเอง)', () => {
    const result = parseOutcomeBody({ text: 'ok', outcome_at: '2020-01-01', status: 'completed', confidence: 1 });
    expect(Object.keys(result)).toEqual(['text']);
  });

  it('body ไม่ใช่ object → โยน InvalidOutcomeError', () => {
    for (const bad of [null, undefined, 'แก้ได้แล้ว', 123, true, ['แก้ได้แล้ว']]) {
      expect(() => parseOutcomeBody(bad)).toThrow(InvalidOutcomeError);
    }
  });

  it('text ไม่มี / ไม่ใช่ข้อความ → โยน InvalidOutcomeError', () => {
    for (const bad of [{}, { text: 123 }, { text: null }, { text: true }, { text: ['ก'] }, { text: {} }]) {
      expect(() => parseOutcomeBody(bad)).toThrow(InvalidOutcomeError);
    }
  });

  it('text ว่างหรือมีแต่ช่องว่าง/แท็บ/ขึ้นบรรทัด → โยน InvalidOutcomeError (ส่งมาแล้วต้องมีเนื้อหา)', () => {
    for (const bad of ['', '   ', '\t', '\n\n', ' \t\n ']) {
      expect(() => parseOutcomeBody({ text: bad })).toThrow(InvalidOutcomeError);
    }
  });

  it('ยาวพอดีเพดานผ่าน เกินหนึ่งตัวอักษรไม่ผ่าน · นับหลังตัดช่องว่างหน้าหลัง', () => {
    expect(parseOutcomeBody({ text: 'ก'.repeat(MAX_OUTCOME_LENGTH) }).text).toHaveLength(MAX_OUTCOME_LENGTH);
    expect(() => parseOutcomeBody({ text: 'ก'.repeat(MAX_OUTCOME_LENGTH + 1) })).toThrow(InvalidOutcomeError);
    // ช่องว่างหน้าหลังไม่นับ จึงไม่ทำให้ข้อความที่ยาวพอดีเพดานกลายเป็นยาวเกิน
    expect(() => parseOutcomeBody({ text: `  ${'ก'.repeat(MAX_OUTCOME_LENGTH)}  ` })).not.toThrow();
  });

  it('ไม่แก้เนื้อหา: ข้อความที่มี HTML/สคริปต์ถูกเก็บตามที่พิมพ์ (หน้าจอแสดงเป็นข้อความ ไม่ตีความเป็น HTML)', () => {
    const risky = '<script>alert(1)</script> <b>ตัวหนา</b> & "ฟันหนู"';
    expect(parseOutcomeBody({ text: risky }).text).toBe(risky);
  });

  it('error เป็นคนละชนิดกับ InvalidRequestBodyError (filter ต้องแปลงเป็นรหัสต่างกัน)', () => {
    let caught: unknown;
    try {
      parseOutcomeBody({ text: '' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(InvalidOutcomeError);
    expect(caught).not.toBeInstanceOf(InvalidRequestBodyError);
  });
});