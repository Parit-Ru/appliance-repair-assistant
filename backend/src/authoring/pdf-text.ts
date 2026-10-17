/**
 * pdf-text.ts — แยกข้อความรายหน้าจาก PDF ที่อยู่ในหน่วยความจำ
 *
 * - ไม่เขียนไฟล์ลงดิสก์เลย (Render free ใช้ดิสก์ชั่วคราว) · เก็บเฉพาะข้อความของ "ช่วงหน้าที่เลือก" ไม่เก็บไฟล์ PDF
 * - ไม่รองรับ PDF ที่เป็นภาพสแกน (ไม่ทำ OCR): ไม่มีข้อความให้ดึง → PdfNoTextError (ผู้ใช้เห็นข้อความชัดเจน)
 * - ใช้ unpdf (pdf.js ของ Mozilla แบบ pure JS) โหลดแบบ lazy ด้วย require เพราะแพ็กเกจมี export สำหรับ CommonJS (index.cjs)
 *   จึงไม่ผูกชนิดข้อมูลกับ d.ts ของแพ็กเกจ (ประกาศ interface เท่าที่ใช้เอง) และไฟล์นี้ import ได้แม้ยังไม่ติดตั้ง unpdf
 *   (ล้มตอนเรียกใช้จริงเท่านั้น) · unpdf ต้องการ Node >= 22
 */

import { Injectable } from '@nestjs/common';

export const PDF_TEXT_EXTRACTOR = 'PDF_TEXT_EXTRACTOR';

export const MAX_PDF_PAGES = 200;
export const MAX_RANGE_PAGES = 10;
/** ข้อความต่อหน้าที่ยอมรับ — เกินแล้วปฏิเสธ (ตัดทิ้งเงียบๆ อาจทำให้คำเตือนความปลอดภัยหาย) */
export const MAX_PAGE_CHARS = 12_000;
/** ข้อความรวมของช่วงหน้าที่เลือก (ไม่นับช่องว่าง) ต่ำกว่านี้ถือว่าไม่มีข้อความ (น่าจะเป็นภาพสแกน) */
export const MIN_TOTAL_CHARS = 50;

export class PdfUnreadableError extends Error {
  constructor(detail?: string) {
    super(`อ่านไฟล์ PDF ไม่ได้ (ไฟล์เสียหรือมีรหัสผ่าน)${detail ? `: ${detail}` : ''}`);
    this.name = this.constructor.name;
  }
}

export class PdfTooManyPagesError extends Error {
  constructor(readonly totalPages: number) {
    super(`PDF มี ${totalPages} หน้า เกินที่รองรับ (${MAX_PDF_PAGES} หน้า)`);
    this.name = this.constructor.name;
  }
}

export class PdfPageRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class PdfNoTextError extends Error {
  constructor() {
    super('ไม่พบข้อความใน PDF ช่วงหน้าที่เลือก — ไม่รองรับไฟล์ที่เป็นภาพสแกน ต้องเป็น PDF ที่เลือกคัดลอกข้อความได้');
    this.name = this.constructor.name;
  }
}

export class PdfPageTooLongError extends Error {
  constructor(readonly page: number) {
    super(`หน้า ${page} มีข้อความยาวเกิน ${MAX_PAGE_CHARS} ตัวอักษร ระบบไม่ตัดทิ้งให้เพราะอาจทำให้คำเตือนหาย — เลือกหน้าอื่นหรือแบ่งช่วงใหม่`);
    this.name = this.constructor.name;
  }
}

export interface PageText {
  page: number;
  text: string;
}

export interface ExtractedPdf {
  totalPages: number;
  /** เฉพาะหน้าในช่วงที่เลือกและมีข้อความ เรียงตามเลขหน้า */
  pages: PageText[];
}

export interface PdfTextExtractor {
  extract(data: Uint8Array, pageFrom: number, pageTo: number): Promise<ExtractedPdf>;
}

// ---- ส่วนของ unpdf / pdf.js ที่ใช้ ----
interface PdfPageProxy {
  getTextContent(): Promise<{ items: Array<{ str?: string; hasEOL?: boolean }> }>;
}
interface PdfDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
  cleanup(): Promise<void>;
  loadingTask: { destroy(): Promise<void> };
}
interface UnpdfModule {
  getDocumentProxy(data: Uint8Array): Promise<PdfDocumentProxy>;
}

function loadUnpdf(): UnpdfModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('unpdf') as UnpdfModule;
}

/** ช่องว่างซ้ำ → ช่องเดียว · เก็บการขึ้นบรรทัดไว้ */
export function normalizePageText(text: string): string {
  return text
    .replace(/[ \t ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

@Injectable()
export class UnpdfTextExtractor implements PdfTextExtractor {
  async extract(data: Uint8Array, pageFrom: number, pageTo: number): Promise<ExtractedPdf> {
    const { getDocumentProxy } = loadUnpdf();

    let pdf: PdfDocumentProxy;
    try {
      // pdf.js ถือ/แก้ buffer ที่ให้ไป จึงส่งสำเนา เพื่อไม่ให้กระทบ buffer ของผู้เรียก
      pdf = await getDocumentProxy(new Uint8Array(data));
    } catch (err) {
      throw new PdfUnreadableError(err instanceof Error ? err.name : undefined);
    }

    try {
      const totalPages = pdf.numPages;
      if (totalPages > MAX_PDF_PAGES) throw new PdfTooManyPagesError(totalPages);
      if (!Number.isInteger(pageFrom) || !Number.isInteger(pageTo) || pageFrom < 1 || pageTo < pageFrom || pageTo > totalPages) {
        throw new PdfPageRangeError(`ช่วงหน้า ${pageFrom}–${pageTo} ไม่ถูกต้อง (PDF นี้มี ${totalPages} หน้า)`);
      }
      if (pageTo - pageFrom + 1 > MAX_RANGE_PAGES) {
        throw new PdfPageRangeError(`เลือกได้ไม่เกิน ${MAX_RANGE_PAGES} หน้าต่อร่าง`);
      }

      const pages: PageText[] = [];
      let totalChars = 0;
      for (let number = pageFrom; number <= pageTo; number += 1) {
        let text: string;
        try {
          const content = await (await pdf.getPage(number)).getTextContent();
          text = normalizePageText(content.items.map((item) => (item.str ?? '') + (item.hasEOL ? '\n' : ' ')).join(''));
        } catch (err) {
          throw new PdfUnreadableError(err instanceof Error ? err.name : undefined);
        }
        if (text.length > MAX_PAGE_CHARS) throw new PdfPageTooLongError(number);
        totalChars += text.replace(/\s/g, '').length;
        if (text !== '') pages.push({ page: number, text });
      }

      if (totalChars < MIN_TOTAL_CHARS) throw new PdfNoTextError();
      return { totalPages, pages };
    } finally {
      // ปล่อยทรัพยากรของ pdf.js (ล้มเหลวก็ไม่เป็นไร ไม่กระทบผลที่ได้)
      await pdf.cleanup().catch(() => undefined);
      await pdf.loadingTask.destroy().catch(() => undefined);
    }
  }
}
