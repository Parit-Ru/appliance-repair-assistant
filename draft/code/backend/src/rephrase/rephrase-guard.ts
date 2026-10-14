/**
 * rephrase-guard.ts — ด่านตรวจข้อความที่แบบจำลองภาษา (LLM) เรียบเรียงใหม่ (ร่างใน draft/)
 *
 * หลักการของ TOR: LLM "ไม่มีสิทธิ์ตัดสินว่าขั้นตอนถัดไปคืออะไร" และทำหน้าที่เพียงเรียบเรียงถ้อยคำ
 * ไฟล์นี้บังคับข้อนั้นฝั่ง "เนื้อหา": ข้อความที่ LLM ส่งกลับต้องไม่เปลี่ยนข้อเท็จจริงของต้นฉบับ
 * ถ้าไม่ผ่านด่าน ระบบใช้ข้อความต้นฉบับ (fail-safe) — ไม่มีทางที่ LLM จะทำให้ข้อมูลผิดไปจากคู่มือโดยไม่ถูกจับ
 *
 * เป็นฟังก์ชันล้วน (ไม่ต่อเครือข่าย ไม่มีสถานะ) ทดสอบได้ตรงๆ
 *
 * ⚠️ ด่านนี้ "จับการเปลี่ยนที่ตรวจด้วยกฎได้" (ตัวเลข รหัส ชื่อเฉพาะ การปฏิเสธ รูปแบบ ความยาว)
 *    ไม่สามารถพิสูจน์ว่าความหมายเท่าเดิมทั้งหมดได้ — จึงยังต้องเปิดใช้เฉพาะโหนดที่ไม่ใช่ safety_critical
 *    และควรให้ผู้พัฒนาสุ่มอ่านผลจริงก่อนเปิดใช้ (ดู draft/docs/LLM-REPHRASE-DESIGN.md)
 */

export type GuardResult = { ok: true } | { ok: false; reason: string };

export interface GuardOptions {
  /** อัตราส่วนความยาว (ผลลัพธ์ / ต้นฉบับ) ที่ยอมรับ */
  minLengthRatio?: number;
  maxLengthRatio?: number;
}

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

/** แปลงเลขไทยเป็นเลขอารบิก เพื่อเทียบตัวเลขข้ามรูปแบบ */
function normalizeDigits(s: string): string {
  return s.replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));
}

/** ตัวเลขทุกชุดในข้อความ (เช่น 30, 2, 0.5) เรียงแล้ว */
export function extractNumbers(s: string): string[] {
  return (normalizeDigits(s).match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.')).sort();
}

/**
 * โทเค็นภาษาอังกฤษ/รหัส เช่น Good Sleep, Cool, E1, AR70H, Wi-Fi — ถือเป็นชื่อเฉพาะที่ต้องคงไว้ตามต้นฉบับ
 * (เลขล้วนไม่นับตรงนี้ เพราะตรวจแยกใน extractNumbers)
 */
export function extractLatinTokens(s: string): string[] {
  const m = s.match(/[A-Za-z][A-Za-z0-9\-]*/g) ?? [];
  return [...new Set(m)];
}

/** จำนวนคำปฏิเสธ "ไม่" — การเรียบเรียงที่ทำให้ความหมายกลับขั้วมักเปลี่ยนจำนวนนี้ */
export function countNegations(s: string): number {
  return (s.match(/ไม่/g) ?? []).length;
}

function sameMultiset(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function checkRephrase(original: string, candidate: string, opts: GuardOptions = {}): GuardResult {
  const minRatio = opts.minLengthRatio ?? 0.5;
  const maxRatio = opts.maxLengthRatio ?? 1.6;

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
