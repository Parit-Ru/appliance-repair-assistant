// backend/src/symptom-search/symptom-matcher.spec.ts

/**
 * เทสตรรกะจับคู่อาการ (symptom-matcher.ts)
 *
 * ไม่โหลดโมเดล ไม่ต่อ MySQL — ใช้เวกเตอร์ปลอมที่คำนวณด้วยมือได้
 * ยกเว้นเคสเดียวที่อ่านไฟล์ผังแอร์จริง เพื่อยืนยันว่าข้อความตัวแทนครบ
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  buildSymptomTexts,
  cosineSimilarity,
  rankGraphs,
  selectMatches,
  type IndexedSymptom,
  type RankedGraph,
  type SymptomSource,
} from './symptom-matcher';

/** สร้างผังจำลองแบบมีเฉพาะ field ที่ matcher ใช้ */
function src(
  graph_id: string,
  entry_symptom: string,
  entry_symptom_th?: string,
  entry_symptom_aliases?: string[],
): SymptomSource {
  return { graph_id, entry_symptom, entry_symptom_th, entry_symptom_aliases };
}

/** แถวของดัชนีเวกเตอร์ปลอม */
function row(graphId: string, text: string, vector: number[]): IndexedSymptom {
  return { graphId, text, vector };
}

describe('cosineSimilarity', () => {
  it('เวกเตอร์ทิศทางเดียวกัน → 1', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it('เวกเตอร์ตั้งฉากกัน → 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it('เวกเตอร์ทิศตรงข้าม → -1', () => {
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1, 10);
  });

  it('ไม่ขึ้นกับความยาวเวกเตอร์ (คูณค่าคงที่แล้วคะแนนเท่าเดิม)', () => {
    const a = [1, 2, 3];
    const b = [3, 2, 1];
    const scaled = b.map((x) => x * 10);
    expect(cosineSimilarity(a, scaled)).toBeCloseTo(cosineSimilarity(a, b), 10);
  });

  it('คำนวณตรงกับค่าที่คิดด้วยมือ: [1,1] กับ [1,0] = 1/√2', () => {
    expect(cosineSimilarity([1, 1], [1, 0])).toBeCloseTo(Math.SQRT1_2, 10);
  });

  it('มิติไม่เท่ากัน → โยน error', () => {
    expect(() => cosineSimilarity([1, 2, 3], [1, 2])).toThrow(/dimension/);
  });

  it('เวกเตอร์ศูนย์ → 0 (ไม่ใช่ NaN) ไม่ว่าฝั่งไหน', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [0, 0])).toBe(0);
  });
});

describe('buildSymptomTexts', () => {
  it('เรียงลำดับ ไทย → อังกฤษ → คำพ้อง', () => {
    const out = buildSymptomTexts([
      src('g1', 'AC stops', 'แอร์หยุดทำงาน', ['แอร์ดับ', 'แอร์ไม่ติด']),
    ]);
    expect(out.map((t) => t.text)).toEqual([
      'แอร์หยุดทำงาน',
      'AC stops',
      'แอร์ดับ',
      'แอร์ไม่ติด',
    ]);
  });

  it('ข้ามข้อความว่าง ช่องว่างล้วน และ field ที่ไม่มี', () => {
    const out = buildSymptomTexts([
      src('g1', 'AC stops', undefined, ['', '   ', 'แอร์ดับ']),
    ]);
    expect(out.map((t) => t.text)).toEqual(['AC stops', 'แอร์ดับ']);
  });

  it('ตัดช่องว่างหน้าหลังของข้อความ', () => {
    const out = buildSymptomTexts([src('g1', '  AC stops  ')]);
    expect(out[0].text).toBe('AC stops');
  });

  it('ผูกทุกข้อความกับ graphId ของผังตัวเอง', () => {
    const out = buildSymptomTexts([
      src('g1', 'one', 'หนึ่ง'),
      src('g2', 'two'),
    ]);
    expect(out).toEqual([
      { graphId: 'g1', text: 'หนึ่ง' },
      { graphId: 'g1', text: 'one' },
      { graphId: 'g2', text: 'two' },
    ]);
  });

  it('ผังแอร์จริง 13 ชุด → 36 ข้อความ และทุกผังมีอย่างน้อย 1 ข้อความ', () => {
    const file = path.resolve(
      __dirname,
      '../../../data/manuals/samsung_ac_ar70h.json',
    );
    const graphs = JSON.parse(fs.readFileSync(file, 'utf-8')).graphs;
    const texts = buildSymptomTexts(graphs);

    expect(graphs).toHaveLength(13);
    expect(texts).toHaveLength(36);
    const ids = new Set(texts.map((t) => t.graphId));
    expect(ids.size).toBe(13);
  });
});

describe('rankGraphs', () => {
  it('คืน 1 แถวต่อผัง ใช้คะแนนสูงสุดของข้อความในผัง และบอก matchedText', () => {
    const index = [
      row('g1', 'ข้อความ a', [0, 1]), // ตั้งฉากกับคำค้น → 0
      row('g1', 'ข้อความ b', [1, 0]), // ตรงกับคำค้น → 1
      row('g2', 'ข้อความ c', [1, 1]), // 1/√2
    ];
    const ranked = rankGraphs([1, 0], index);

    expect(ranked).toHaveLength(2);
    expect(ranked[0].graphId).toBe('g1');
    expect(ranked[0].score).toBeCloseTo(1, 10);
    expect(ranked[0].matchedText).toBe('ข้อความ b');
    expect(ranked[1].graphId).toBe('g2');
    expect(ranked[1].score).toBeCloseTo(Math.SQRT1_2, 10);
  });

  it('เรียงคะแนนมากไปน้อย', () => {
    const index = [
      row('low', 't', [0, 1]),
      row('high', 't', [1, 0]),
      row('mid', 't', [1, 1]),
    ];
    const ranked = rankGraphs([1, 0], index);
    expect(ranked.map((r) => r.graphId)).toEqual(['high', 'mid', 'low']);
  });

  it('คะแนนเท่ากันเรียงตาม graphId (ผลซ้ำได้เสมอ)', () => {
    const index = [
      row('g_c', 't', [1, 0]),
      row('g_a', 't', [1, 0]),
      row('g_b', 't', [1, 0]),
    ];
    const ranked = rankGraphs([1, 0], index);
    expect(ranked.map((r) => r.graphId)).toEqual(['g_a', 'g_b', 'g_c']);
  });

  it('ดัชนีว่าง → คืนรายการว่าง', () => {
    expect(rankGraphs([1, 0], [])).toEqual([]);
  });
});

describe('selectMatches', () => {
  const ranked: RankedGraph[] = [
    { graphId: 'a', score: 0.9, matchedText: 'a' },
    { graphId: 'b', score: 0.5, matchedText: 'b' },
    { graphId: 'c', score: 0.49, matchedText: 'c' },
  ];

  it('คะแนนเท่ากับเกณฑ์พอดีถือว่าผ่าน (>=) และตัดตัวที่ต่ำกว่าออก', () => {
    const out = selectMatches(ranked, 0.5, 10);
    expect(out.map((r) => r.graphId)).toEqual(['a', 'b']);
  });

  it('ไม่คืนเกิน max รายการ', () => {
    const out = selectMatches(ranked, 0, 2);
    expect(out.map((r) => r.graphId)).toEqual(['a', 'b']);
  });

  it('ไม่มีผังผ่านเกณฑ์ → คืนรายการว่าง', () => {
    expect(selectMatches(ranked, 0.95, 3)).toEqual([]);
  });
});