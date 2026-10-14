export type GuardResult = { ok: true } | { ok: false; reason: string };

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

function normalizeDigits(s: string): string {
  return s.replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));
}

export function extractNumbers(s: string): string[] {
  return (normalizeDigits(s).match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.')).sort();
}

export function extractLatinTokens(s: string): string[] {
  const m = s.match(/[A-Za-z][A-Za-z0-9\-]*/g) ?? [];
  return [...new Set(m)];
}

export function countNegations(s: string): number {
  return (s.replace(/หรือไม่/g, '').match(/ไม่/g) ?? []).length;
}

function sameMultiset(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function checkRephrase(original: string, candidate: string): GuardResult {
  const minRatio = 0.5;
  const maxRatio = 1.6;

  const o = original.trim();
  const c = candidate.trim();

  if (c === '') return { ok: false, reason: 'ผลลัพธ์ว่าง' };
  if (/https?:\/\/|www\./i.test(c)) return { ok: false, reason: 'ผลลัพธ์มีลิงก์ที่ต้นฉบับไม่มี' };
  if (/```|<\/?[a-z][^>]*>|^\s*[#>*-]\s/m.test(c) && !/```|<\/?[a-z][^>]*>|^\s*[#>*-]\s/m.test(o)) {
    return { ok: false, reason: 'ผลลัพธ์มีรูปแบบ markdown/HTML ที่ต้นฉบับไม่มี' };
  }
  if (/\n\s*\n/.test(c)) return { ok: false, reason: 'ผลลัพธ์มีหลายย่อหน้า (ต้องเป็นข้อความเดียว)' };

  const ratio = c.length / Math.max(o.length, 1);
  if (ratio < minRatio) return { ok: false, reason: `ผลลัพธ์สั้นเกินไป (${ratio.toFixed(2)}× ของต้นฉบับ อาจตกหล่นเนื้อหา)` };
  if (ratio > maxRatio) return { ok: false, reason: `ผลลัพธ์ยาวเกินไป (${ratio.toFixed(2)}× ของต้นฉบับ อาจเพิ่มเนื้อหาเอง)` };

  const on = extractNumbers(o);
  const cn = extractNumbers(c);
  if (!sameMultiset(on, cn)) {
    return { ok: false, reason: `ตัวเลขไม่ตรงต้นฉบับ (ต้นฉบับ [${on.join(',')}] ผลลัพธ์ [${cn.join(',')}])` };
  }

  const missing = extractLatinTokens(o).filter((t) => !c.includes(t));
  if (missing.length > 0) return { ok: false, reason: `ขาดชื่อเฉพาะ/รหัสจากต้นฉบับ: ${missing.join(', ')}` };

  const extra = extractLatinTokens(c).filter((t) => !o.includes(t));
  if (extra.length > 0) return { ok: false, reason: `มีชื่อเฉพาะ/รหัสที่ต้นฉบับไม่มี: ${extra.join(', ')}` };

  if (countNegations(o) !== countNegations(c)) {
    return { ok: false, reason: `จำนวนคำว่า "ไม่" ต่างจากต้นฉบับ (${countNegations(o)} → ${countNegations(c)}) อาจกลับความหมาย` };
  }

  return { ok: true };
}
