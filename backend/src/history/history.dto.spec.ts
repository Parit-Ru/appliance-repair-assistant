import {
  DEFAULT_PAGE_SIZE,
  InvalidFeedbackError,
  InvalidHistoryQueryError,
  MAX_FEEDBACK_COMMENT_LENGTH,
  MAX_PAGE_SIZE,
  parseFeedbackBody,
  parseHistoryQuery,
} from './history.dto';
import { toHistoryErrorBody } from './history.exception.filter';
import { HistoryNotFoundError } from './history.service';
import {
  InvalidClientIdError,
  parseOptionalClientId,
  parseRequiredClientId,
} from '../traversal/traversal.dto';

describe('parseHistoryQuery', () => {
  it('ไม่ส่งอะไรเลย: ค่าเริ่มต้น ใหม่สุดก่อน หน้า 1', () => {
    expect(parseHistoryQuery({})).toEqual({
      q: undefined,
      category: undefined,
      brand: undefined,
      status: undefined,
      sort: 'newest',
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it('ค่าว่างถือเหมือนไม่ส่ง และตัดช่องว่างหน้าหลัง', () => {
    const parsed = parseHistoryQuery({ q: '  แอร์  ', category: '', brand: ' ', status: '', sort: '' });
    expect(parsed.q).toBe('แอร์');
    expect(parsed.category).toBeUndefined();
    expect(parsed.brand).toBeUndefined();
    expect(parsed.status).toBeUndefined();
    expect(parsed.sort).toBe('newest');
  });

  it('รับค่าที่ถูกต้องครบ', () => {
    const parsed = parseHistoryQuery({
      q: 'samsung',
      category: 'Refrigerator',
      brand: 'Samsung',
      status: 'handoff_unknown',
      sort: 'oldest',
      page: '3',
      pageSize: '20',
    });
    expect(parsed).toEqual({
      q: 'samsung',
      category: 'Refrigerator',
      brand: 'Samsung',
      status: 'handoff_unknown',
      sort: 'oldest',
      page: 3,
      pageSize: 20,
    });
  });

  it.each([
    ['category ไม่รู้จัก', { category: 'Toaster' }],
    ['status ไม่รู้จัก', { status: 'done' }],
    ['sort ไม่รู้จัก', { sort: 'random' }],
    ['page ไม่ใช่จำนวนเต็ม', { page: 'abc' }],
    ['page เป็น 0', { page: '0' }],
    ['page ติดลบ', { page: '-1' }],
    ['pageSize เกินเพดาน', { pageSize: String(MAX_PAGE_SIZE + 1) }],
    ['q ส่งซ้ำเป็นอาร์เรย์', { q: ['a', 'b'] }],
    ['q ยาวเกิน', { q: 'x'.repeat(101) }],
  ])('%s → InvalidHistoryQueryError', (_name, input) => {
    expect(() => parseHistoryQuery(input)).toThrow(InvalidHistoryQueryError);
  });
});

describe('parseFeedbackBody', () => {
  it('helpful เป็น boolean · comment ไม่บังคับ', () => {
    expect(parseFeedbackBody({ helpful: true })).toEqual({ helpful: true, comment: null });
    expect(parseFeedbackBody({ helpful: false, comment: '  ไม่หาย  ' })).toEqual({ helpful: false, comment: 'ไม่หาย' });
  });

  it('comment ว่าง/มีแต่ช่องว่าง/null → null', () => {
    expect(parseFeedbackBody({ helpful: true, comment: '   ' }).comment).toBeNull();
    expect(parseFeedbackBody({ helpful: true, comment: null }).comment).toBeNull();
  });

  it.each([
    ['body ไม่ใช่ object', 'yes'],
    ['body เป็น array', []],
    ['helpful ไม่ใช่ boolean', { helpful: 'true' }],
    ['ไม่มี helpful', {}],
    ['comment ไม่ใช่ข้อความ', { helpful: true, comment: 5 }],
    ['comment ยาวเกิน', { helpful: true, comment: 'x'.repeat(MAX_FEEDBACK_COMMENT_LENGTH + 1) }],
  ])('%s → InvalidFeedbackError', (_name, input) => {
    expect(() => parseFeedbackBody(input)).toThrow(InvalidFeedbackError);
  });

  it('comment ยาวพอดีเพดานผ่าน', () => {
    const comment = 'ก'.repeat(MAX_FEEDBACK_COMMENT_LENGTH);
    expect(parseFeedbackBody({ helpful: true, comment }).comment).toBe(comment);
  });

  it('เพดานคือ 500 ตัวอักษร (ค่าที่ตกลงไว้ ตรงกับที่หน้าจอใช้)', () => {
    expect(MAX_FEEDBACK_COMMENT_LENGTH).toBe(500);
    expect(parseFeedbackBody({ helpful: true, comment: 'ก'.repeat(500) }).comment).toHaveLength(500);
    expect(() => parseFeedbackBody({ helpful: true, comment: 'ก'.repeat(501) })).toThrow(InvalidFeedbackError);
  });

  it('นับความยาวหลังตัดช่องว่างหน้าหลัง (501 ตัวที่ตัดแล้วเหลือ 500 ผ่าน)', () => {
    const comment = `  ${'ก'.repeat(500)}  `;
    expect(parseFeedbackBody({ helpful: false, comment }).comment).toBe('ก'.repeat(500));
  });

  it('comment เป็นสตริงว่าง "" → null (ไม่เก็บสตริงว่างลงฐานข้อมูล) · ไม่ส่งเลย → null', () => {
    expect(parseFeedbackBody({ helpful: true, comment: '' })).toEqual({ helpful: true, comment: null });
    expect(parseFeedbackBody({ helpful: false })).toEqual({ helpful: false, comment: null });
  });

  it('ขึ้นบรรทัดใหม่ภายในข้อความคงไว้ (ตัดเฉพาะหัวท้าย)', () => {
    const newline = String.fromCharCode(10);
    const comment = ['', 'บรรทัด 1', 'บรรทัด 2', ''].join(newline);
    expect(parseFeedbackBody({ helpful: true, comment }).comment).toBe(['บรรทัด 1', 'บรรทัด 2'].join(newline));
  });
});

describe('client id', () => {
  const ID = '3F2504E0-4F89-41D3-9A0C-0305E82C3301';

  it('optional: ไม่ส่ง = undefined · ส่ง UUID = ตัวพิมพ์เล็ก', () => {
    expect(parseOptionalClientId(undefined)).toBeUndefined();
    expect(parseOptionalClientId(` ${ID} `)).toBe(ID.toLowerCase());
  });

  it('ไม่ใช่ UUID → InvalidClientIdError (รวมถึงส่งซ้ำเป็นอาร์เรย์และข้อความว่าง)', () => {
    for (const bad of ['', 'abc', '123', ['a', 'b'], 42, `${ID}x`]) {
      expect(() => parseOptionalClientId(bad)).toThrow(InvalidClientIdError);
    }
  });

  it('required: ไม่ส่ง → InvalidClientIdError', () => {
    expect(() => parseRequiredClientId(undefined)).toThrow(InvalidClientIdError);
    expect(parseRequiredClientId(ID)).toBe(ID.toLowerCase());
  });
});

describe('toHistoryErrorBody', () => {
  it('แปลง error ของหน้าประวัติเป็นรหัส HTTP', () => {
    expect(toHistoryErrorBody(new InvalidHistoryQueryError('x'))).toMatchObject({ statusCode: 400, code: 'INVALID_HISTORY_QUERY' });
    expect(toHistoryErrorBody(new InvalidFeedbackError('x'))).toMatchObject({ statusCode: 400, code: 'INVALID_FEEDBACK' });
    expect(toHistoryErrorBody(new HistoryNotFoundError('s1'))).toMatchObject({ statusCode: 404, code: 'HISTORY_NOT_FOUND' });
  });

  it('client id ผิด → 400 INVALID_CLIENT_ID (ผ่านตารางของ traversal)', () => {
    expect(toHistoryErrorBody(new InvalidClientIdError('x'))).toMatchObject({ statusCode: 400, code: 'INVALID_CLIENT_ID' });
  });

  it('error ที่ไม่รู้จัก → 500 INTERNAL_ERROR', () => {
    expect(toHistoryErrorBody(new Error('boom'))).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
  });
});
