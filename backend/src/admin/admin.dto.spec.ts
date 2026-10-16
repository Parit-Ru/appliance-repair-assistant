import {
  DEFAULT_DAYS,
  DEFAULT_PAGE_SIZE,
  InvalidAdminQueryError,
  MAX_DAYS,
  MAX_PAGE,
  MAX_PAGE_SIZE,
  dayIndexToDate,
  parseFeedbackQuery,
  parseSessionsQuery,
  parseSummaryQuery,
  thaiDayIndex,
} from './admin.dto';

const bad = (fn: () => unknown) => expect(fn).toThrow(InvalidAdminQueryError);

describe('หน้า/จำนวนต่อหน้า (ใช้ร่วมกันทั้ง feedback และ sessions)', () => {
  it('ค่าเริ่มต้น', () => {
    expect(parseFeedbackQuery({})).toMatchObject({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
    expect(parseSessionsQuery(undefined)).toMatchObject({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it('รับค่าที่เพดานพอดี', () => {
    expect(parseFeedbackQuery({ pageSize: String(MAX_PAGE_SIZE), page: String(MAX_PAGE) })).toMatchObject({
      pageSize: MAX_PAGE_SIZE,
      page: MAX_PAGE,
    });
  });

  it.each([
    ['pageSize เกินเพดาน', { pageSize: String(MAX_PAGE_SIZE + 1) }],
    ['pageSize = 0', { pageSize: '0' }],
    ['page = 0', { page: '0' }],
    ['page เกินเพดาน', { page: String(MAX_PAGE + 1) }],
    ['page ติดลบ', { page: '-1' }],
    ['page ทศนิยม', { page: '1.5' }],
    ['page ไม่ใช่ตัวเลข', { page: 'abc' }],
    ['page ส่งซ้ำ (array)', { page: ['1', '2'] }],
    ['pageSize เป็น object', { pageSize: { a: 1 } }],
  ])('ปฏิเสธ: %s', (_name, query) => {
    bad(() => parseFeedbackQuery(query));
    bad(() => parseSessionsQuery(query));
  });

  it('ค่าว่างถือเหมือนไม่ส่ง', () => {
    expect(parseFeedbackQuery({ page: '', pageSize: '  ', helpful: '' })).toMatchObject({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      helpful: undefined,
    });
  });
});

describe('ตัวกรอง feedback', () => {
  it('helpful รับ true/false เท่านั้น', () => {
    expect(parseFeedbackQuery({ helpful: 'true' }).helpful).toBe(true);
    expect(parseFeedbackQuery({ helpful: 'false' }).helpful).toBe(false);
    bad(() => parseFeedbackQuery({ helpful: 'maybe' }));
    bad(() => parseFeedbackQuery({ helpful: '1' }));
  });
});

describe('ช่วงวันที่ (เวลาไทย)', () => {
  it('แปลงเป็น epoch: from = เที่ยงคืนไทยของวันนั้น · to = เที่ยงคืนไทยของวันถัดไป (นับรวมทั้งวัน)', () => {
    const range = parseFeedbackQuery({ from: '2026-10-01', to: '2026-10-02' });
    expect(range.fromEpoch).toBe(Date.UTC(2026, 9, 1) / 1000 - 7 * 3600);
    expect(range.toEpoch).toBe(Date.UTC(2026, 9, 3) / 1000 - 7 * 3600);
  });

  it('ส่งแค่ปลายเดียวได้', () => {
    expect(parseSessionsQuery({ from: '2026-10-01' }).toEpoch).toBeUndefined();
    expect(parseSessionsQuery({ to: '2026-10-01' }).fromEpoch).toBeUndefined();
  });

  it.each([
    ['รูปแบบผิด', { from: '01/10/2026' }],
    ['เดือนเกิน', { from: '2026-13-01' }],
    ['วันที่ไม่มีจริง (30 ก.พ.)', { to: '2026-02-30' }],
    ['29 ก.พ. ปีไม่อธิกสุรทิน', { from: '2026-02-29' }],
    ['from หลัง to', { from: '2026-10-05', to: '2026-10-01' }],
    ['ช่วงเกิน 366 วัน', { from: '2025-01-01', to: '2026-10-01' }],
    ['from ส่งซ้ำ', { from: ['2026-10-01', '2026-10-02'] }],
  ])('ปฏิเสธ: %s', (_name, query) => {
    bad(() => parseFeedbackQuery(query));
    bad(() => parseSessionsQuery(query));
  });

  it('รับ 29 ก.พ. ปีอธิกสุรทิน และช่วง 366 วันพอดี', () => {
    expect(() => parseFeedbackQuery({ from: '2028-02-29' })).not.toThrow();
    expect(() => parseFeedbackQuery({ from: '2025-10-01', to: '2026-09-30' })).not.toThrow(); // 365 วัน
    expect(() => parseFeedbackQuery({ from: '2024-01-01', to: '2024-12-31' })).not.toThrow(); // 366 วัน
  });
});

describe('ตัวกรอง sessions', () => {
  it('รับค่าที่รู้จัก', () => {
    expect(parseSessionsQuery({ status: 'completed', ownerType: 'guest', graphId: 'g-1' })).toMatchObject({
      status: 'completed',
      ownerType: 'guest',
      graphId: 'g-1',
    });
  });

  it.each([
    ['status ไม่รู้จัก', { status: 'abandoned' }],
    ['ownerType ไม่รู้จัก', { ownerType: 'admin' }],
    ['graphId ยาวเกิน', { graphId: 'x'.repeat(121) }],
    ['graphId ส่งซ้ำ', { graphId: ['a', 'b'] }],
  ])('ปฏิเสธ: %s', (_name, query) => {
    bad(() => parseSessionsQuery(query));
  });

  it('ค่าที่เป็น SQL injection ไม่ผ่านตัวกรอง enum และ graphId ผ่านเป็นข้อความธรรมดา (ส่งทางพารามิเตอร์ ?)', () => {
    bad(() => parseSessionsQuery({ status: "completed' OR '1'='1" }));
    expect(parseSessionsQuery({ graphId: "x' OR '1'='1" }).graphId).toBe("x' OR '1'='1");
  });
});

describe('summary: days', () => {
  it('ค่าเริ่มต้นและเพดาน', () => {
    expect(parseSummaryQuery({}).days).toBe(DEFAULT_DAYS);
    expect(parseSummaryQuery({ days: '1' }).days).toBe(1);
    expect(parseSummaryQuery({ days: String(MAX_DAYS) }).days).toBe(MAX_DAYS);
  });

  it.each([['0'], [String(MAX_DAYS + 1)], ['-5'], ['abc'], ['7.5'], [['7', '8']]])('ปฏิเสธ days = %j', (days) => {
    bad(() => parseSummaryQuery({ days }));
  });
});

describe('วันตามเวลาไทย', () => {
  it('23:30 UTC ของวันที่ 15 คือวันที่ 16 ในเวลาไทย', () => {
    const epoch = Date.UTC(2026, 9, 15, 23, 30) / 1000;
    expect(dayIndexToDate(thaiDayIndex(epoch))).toBe('2026-10-16');
  });

  it('16:59 UTC ยังเป็นวันเดิม · 17:00 UTC เป็นวันถัดไป (เที่ยงคืนไทย)', () => {
    expect(dayIndexToDate(thaiDayIndex(Date.UTC(2026, 9, 15, 16, 59) / 1000))).toBe('2026-10-15');
    expect(dayIndexToDate(thaiDayIndex(Date.UTC(2026, 9, 15, 17, 0) / 1000))).toBe('2026-10-16');
  });
});
