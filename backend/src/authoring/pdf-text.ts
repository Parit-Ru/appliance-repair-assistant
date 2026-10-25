
import { ApiError } from '../common/api-error';
const MAX_PDF_PAGES = 200;
export const MAX_RANGE_PAGES = 10;
const MAX_PAGE_CHARS = 12_000;
const MIN_TOTAL_CHARS = 50;

// error ของการอ่าน PDF (ApiError รหัสละตัว · errorHandler (common/error-handler.ts) แปลงเป็น response)
const pdfUnreadable = (detail?: string) =>
  new ApiError(422, 'PDF_UNREADABLE', `อ่านไฟล์ PDF ไม่ได้ (ไฟล์เสียหรือมีรหัสผ่าน)${detail ? `: ${detail}` : ''}`);

const pdfTooManyPages = (totalPages: number) =>
  new ApiError(413, 'PDF_TOO_LARGE', `PDF มี ${totalPages} หน้า เกินที่รองรับ (${MAX_PDF_PAGES} หน้า)`);

const pdfPageRange = (message: string) => new ApiError(400, 'INVALID_DRAFT_REQUEST', message);

const pdfNoText = () =>
  new ApiError(422, 'PDF_NO_TEXT', 'ไม่พบข้อความใน PDF ช่วงหน้าที่เลือก — ไม่รองรับไฟล์ที่เป็นภาพสแกน ต้องเป็น PDF ที่เลือกคัดลอกข้อความได้');

const pdfPageTooLong = (page: number) =>
  new ApiError(
    422,
    'PDF_PAGE_TOO_LONG',
    `หน้า ${page} มีข้อความยาวเกิน ${MAX_PAGE_CHARS} ตัวอักษร ระบบไม่ตัดทิ้งให้เพราะอาจทำให้คำเตือนหาย — เลือกหน้าอื่นหรือแบ่งช่วงใหม่`,
  );

export interface PageText {
  page: number;
  text: string;
}

interface ExtractedPdf {
  totalPages: number;
  pages: PageText[];
}

export interface PdfTextExtractor {
  extract(data: Uint8Array, pageFrom: number, pageTo: number): Promise<ExtractedPdf>;
}

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
  return require('unpdf') as UnpdfModule;
}

//ช่องว่างซ้ำ ช่องเดียว  เก็บการขึ้นบรรทัดไว้ 
function normalizePageText(text: string): string {
  return text
    .replace(/[ \t ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export class UnpdfTextExtractor implements PdfTextExtractor {
  async extract(data: Uint8Array, pageFrom: number, pageTo: number): Promise<ExtractedPdf> {
    const { getDocumentProxy } = loadUnpdf();

    let pdf: PdfDocumentProxy;
    try {
      pdf = await getDocumentProxy(new Uint8Array(data));
    } catch (err) {
      throw pdfUnreadable(err instanceof Error ? err.name : undefined);
    }

    try {
      const totalPages = pdf.numPages;
      if (totalPages > MAX_PDF_PAGES) throw pdfTooManyPages(totalPages);
      if (!Number.isInteger(pageFrom) || !Number.isInteger(pageTo) || pageFrom < 1 || pageTo < pageFrom || pageTo > totalPages) {
        throw pdfPageRange(`ช่วงหน้า ${pageFrom}–${pageTo} ไม่ถูกต้อง (PDF นี้มี ${totalPages} หน้า)`);
      }
      if (pageTo - pageFrom + 1 > MAX_RANGE_PAGES) {
        throw pdfPageRange(`เลือกได้ไม่เกิน ${MAX_RANGE_PAGES} หน้าต่อร่าง`);
      }

      const pages: PageText[] = [];
      let totalChars = 0;
      for (let number = pageFrom; number <= pageTo; number += 1) {
        let text: string;
        try {
          const content = await (await pdf.getPage(number)).getTextContent();
          text = normalizePageText(content.items.map((item) => (item.str ?? '') + (item.hasEOL ? '\n' : ' ')).join(''));
        } catch (err) {
          throw pdfUnreadable(err instanceof Error ? err.name : undefined);
        }
        if (text.length > MAX_PAGE_CHARS) throw pdfPageTooLong(number);
        totalChars += text.replace(/\s/g, '').length;
        if (text !== '') pages.push({ page: number, text });
      }

      if (totalChars < MIN_TOTAL_CHARS) throw pdfNoText();
      return { totalPages, pages };
    } finally {
      await pdf.cleanup().catch(() => undefined);
      await pdf.loadingTask.destroy().catch(() => undefined);
    }
  }
}
