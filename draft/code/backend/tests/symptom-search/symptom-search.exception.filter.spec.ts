// backend/src/symptom-search/symptom-search.exception.filter.spec.ts

/** เทสตารางแปลง error → HTTP response ของงานค้นหาอาการ (ฟังก์ชันล้วน ไม่ต้องเปิดเซิร์ฟเวอร์) */

import { InvalidSearchQueryError } from './symptom-search.dto';
import { toErrorBody } from './symptom-search.exception.filter';
import {
  SearchNotReadyError,
  SearchUnavailableError,
} from './symptom-search.service';

describe('toErrorBody (symptom-search)', () => {
  it('InvalidSearchQueryError → 400 INVALID_QUERY พร้อมข้อความเดิม', () => {
    expect(toErrorBody(new InvalidSearchQueryError('query ต้องไม่ว่าง'))).toEqual({
      statusCode: 400,
      code: 'INVALID_QUERY',
      message: 'query ต้องไม่ว่าง',
    });
  });

  it('SearchNotReadyError → 503 SEARCH_NOT_READY', () => {
    const body = toErrorBody(new SearchNotReadyError());
    expect(body.statusCode).toBe(503);
    expect(body.code).toBe('SEARCH_NOT_READY');
  });

  it('SearchUnavailableError → 503 SEARCH_UNAVAILABLE (คนละ code กับ NOT_READY)', () => {
    const body = toErrorBody(new SearchUnavailableError());
    expect(body.statusCode).toBe(503);
    expect(body.code).toBe('SEARCH_UNAVAILABLE');
  });

  it('error ที่ไม่รู้จัก → 500 INTERNAL_ERROR', () => {
    expect(toErrorBody(new Error('boom'))).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'boom',
    });
    expect(toErrorBody('ไม่ใช่ Error')).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'ไม่ทราบสาเหตุ',
    });
  });
});