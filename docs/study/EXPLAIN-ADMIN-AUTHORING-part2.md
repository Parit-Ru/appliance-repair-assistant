# อธิบายฟีเจอร์ร่างแผนผังขั้นตอนจาก PDF — ส่วนที่ 2: ฝั่ง backend จากอัปโหลดจนได้ร่าง

> path ย่อจาก `backend/src/` · อ้างแบบ `ไฟล์:ฟังก์ชัน` หรือ `ไฟล์:บรรทัด` · ตัวอย่างที่ติดป้าย "ตัวอย่างสมมติ" คือค่าที่ผมตั้งเองเพื่อให้เห็นภาพ ส่วนรูปร่างข้อมูลมาจาก type/โค้ดจริง
> ศัพท์ใช้ตามส่วนที่ 1: graph = แผนผังขั้นตอน, node = ขั้นตอน, draft = ร่าง

---

## 2.0 ศัพท์ที่ใช้ในส่วนนี้ (อ่านก่อน)

| ศัพท์ | ความหมายที่ใช้ในเอกสารนี้ |
|---|---|
| **HTTP request / response** | ข้อความที่เบราว์เซอร์ส่งไปหาเซิร์ฟเวอร์ / ที่เซิร์ฟเวอร์ตอบกลับ ประกอบด้วย method (GET/POST…), path, header, body และ status code (200, 202, 401 …) |
| **multipart upload** | วิธีส่งไฟล์ผ่าน HTTP: body ถูกแบ่งเป็นหลาย "ส่วน" คั่นด้วยเส้นแบ่ง (boundary) แต่ละส่วนคือฟิลด์ข้อความหรือไฟล์ 1 อัน (JSON ธรรมดาส่งไฟล์ไบนารีไม่ได้) |
| **Guard (NestJS)** | โค้ดที่ "ดักหน้าประตู" ก่อนถึงฟังก์ชันของ controller: คืนว่าให้ผ่านหรือโยน error เช่น `JwtAuthGuard` ตรวจว่าล็อกอินหรือยัง, `RolesGuard` ตรวจว่าเป็น admin ไหม |
| **Interceptor (NestJS)** | โค้ดที่ครอบการทำงานของ handler (ทำงาน "หลัง guard") ที่นี่ใช้ `FileInterceptor` เพื่ออ่านไฟล์ที่อัปโหลด |
| **multer** | ไลบรารีที่ Nest ใช้อ่าน multipart `FileInterceptor` เป็นตัวห่อมัน |
| **DTO / `parse*`** | รูปร่างข้อมูลเข้า-ออกของ API · โปรเจกต์นี้ไม่ใช้ class-validator แต่เขียนฟังก์ชัน `parse…` ตรวจเอง |
| **Exception filter** | ตัวจับ error แล้วแปลงเป็น HTTP response ที่ต้องการ (ถ้าไม่มี Nest จะตอบ 500 ให้ทุก error ที่ไม่รู้จัก) |
| **magic bytes** | ไบต์ที่ต้นไฟล์ที่บอกชนิดไฟล์ PDF จริงๆ ขึ้นต้นด้วยข้อความ `%PDF-` ต่างจากนามสกุล `.pdf` ที่ใครก็เปลี่ยนชื่อได้ |
| **buffer / ในหน่วยความจำ** | ไฟล์ทั้งก้อนอยู่ใน RAM ของเซิร์ฟเวอร์ (`Buffer`) ไม่ถูกเขียนลงดิสก์ |
| **งานเบื้องหลัง (background job)** | งานที่เริ่มแล้ว "ไม่รอให้เสร็จ" ก่อนตอบผู้เรียก เซิร์ฟเวอร์ตอบ 202 ไปก่อน แล้วทำงานต่อ |
| **202 Accepted** | status ที่แปลว่า "รับเรื่องแล้ว กำลังทำ ยังไม่เสร็จ" (ต่างจาก 200 ที่แปลว่าเสร็จ) |
| **JSON mode** | โหมดของ API ผู้ให้บริการ LLM ที่บังคับให้คำตอบเป็น JSON ที่ parse ได้ (แต่ไม่รับประกันว่า "ตรงรูปแบบที่เราต้องการ") |
| **timeout** | เวลาสูงสุดที่รอ เกินแล้วเลิกรอ |
| **strict parse (แปลงแบบเข้ม)** | ตรวจรูปร่างข้อมูลว่าตรงเป๊ะ ฟิลด์เกิน/ชนิดผิด/ขาด = ปฏิเสธทั้งก้อน ไม่แก้ไม่เดาให้ |
| **state machine (เครื่องสถานะ)** | ระบบที่อยู่ในสถานะเดียวเสมอ และเปลี่ยนสถานะได้เฉพาะทางที่กำหนด (ใช้อธิบายสถานะของร่าง) |

---

## 2.1 ตาม 1 คำขอ: `POST /admin/drafts`

### ตัวอย่างคำขอ (ตัวอย่างสมมติ)

```http
POST /admin/drafts HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIs…            ← token ของ admin
Content-Type: multipart/form-data; boundary=----X1

------X1
Content-Disposition: form-data; name="manualId"
demo_samsung_ms23k3513
------X1
Content-Disposition: form-data; name="deviceCategory"
Microwave
------X1
Content-Disposition: form-data; name="brand"
Samsung
------X1
Content-Disposition: form-data; name="modelPattern"
MS23K3513**
------X1
Content-Disposition: form-data; name="sourceManual"
MS23K3513_user_manual
------X1
Content-Disposition: form-data; name="pageFrom"
30
------X1
Content-Disposition: form-data; name="pageTo"
31
------X1
Content-Disposition: form-data; name="file"; filename="manual.pdf"
Content-Type: application/pdf
%PDF-1.7 …(ไบต์ของไฟล์)…
------X1--
```

ฟิลด์ที่บังคับ/ไม่บังคับ (`authoring/drafts.dto.ts:parseUploadFields` `:57-87`): `manualId` (a-z 0-9 _ ยาว 3–60), `deviceCategory` (1 ใน 5 ประเภท), `brand`, `modelPattern`, `sourceManual`, `pageFrom`, `pageTo` บังคับ · `displayName` ไม่บังคับ

### ตัวอย่างคำตอบเมื่อสำเร็จ

```http
HTTP/1.1 202 Accepted
{ "id": "5e2f9c4a-…", "status": "drafting" }
```

คืนแค่ `id` ไม่คืนผังเพราะผังยังไม่มี (AI ยังร่างอยู่) หน้าจอจะเอา `id` ไปถามสถานะต่อ

### เส้นทางของคำขอภายใน NestJS (ลำดับสำคัญมาก)

```
 คำขอเข้ามา
    │
    ▼
 ① Guard: JwtAuthGuard        ← ไม่มี/เสีย token → 401
    │                            (auth/jwt-auth.guard.ts)
    ▼
 ② Guard: RolesGuard + @Roles(Admin)   ← ไม่ใช่ admin → 403
    │                            (auth/roles.guard.ts)
    ▼
 ③ Interceptor: FileInterceptor('file')   ← "ตอนนี้เท่านั้น" ถึงอ่านไฟล์
    │      limits: fileSize = maxPdfBytes() (ค่าเริ่มต้น 10 MB), files:1, fields:12, fieldSize:1024
    │      ไฟล์ใหญ่เกิน → PayloadTooLargeException → 413
    ▼
 ④ handler create()  → parseUploadFields(body) ตรวจฟิลด์ข้อความ → 400 ถ้าผิด
    │
    ▼
 ⑤ DraftsService.createFromUpload(file, fields, userId)
    │
    ▼  (ทุกขั้นข้างบนถ้าโยน error → ไปที่ ⑥)
 ⑥ AllExceptionsFilter (common/)  แปลงเป็น {statusCode, code, message}
    (ยกเว้น error ของตัวรับไฟล์ multer ที่ UploadErrorsFilter เล็กๆ ใน drafts.controller.ts แปลงเอง)
```

ที่มา: decorator ระดับ class ใน `drafts.controller.ts` (`@Controller('admin/drafts')`, `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(Role.Admin)`) · decorator ของ handler `create()` (`@UseFilters(UploadErrorsFilter)`, `@UseInterceptors(FileInterceptor…)`) — เลขบรรทัดเดิมเลื่อนไปแล้วหลังรวม filter · ลำดับ "guard ก่อน interceptor" เป็นกฎของ NestJS (ผมอ้างจากความรู้เรื่อง request lifecycle ของ Nest ไม่ได้ทดสอบ ถ้ากรรมการถามให้ชี้เอกสาร Nest หัวข้อ "Request lifecycle")

**ทำไมลำดับนี้สำคัญ:** ผู้ที่ไม่ใช่ admin จะถูกปฏิเสธที่ ①② **ก่อนที่เซิร์ฟเวอร์จะรับไฟล์เข้าหน่วยความจำ** คนแปลกหน้าจึงยัดไฟล์ 10 MB ใส่ RAM เราซ้ำๆ ไม่ได้

### ทำไมต้องมี Exception filter (กฎ "401/403 ต้องไม่กลายเป็น 500")

Guard โยน `UnauthorizedException` / `ForbiddenException` ของ Nest และ multer โยน `PayloadTooLargeException` ถ้าไม่มี filter ที่รู้จักมัน มันจะกลายเป็น 500 `INTERNAL_ERROR` ซึ่งผิดความหมาย

(ปัจจุบัน) error ของโมดูลนี้เป็น `ApiError(status, code, message)` ที่สร้างจาก `drafts.errors.ts` / `pdf-text.ts` / `draft-schema.ts` แล้ว `common/all-exceptions.filter.ts` (ตัวเดียวทั้งแอป) แปลงเป็นตารางนี้ · 401/403 ของ guard filter กลางรู้จักเอง · ส่วน error ของ multer (ไฟล์ใหญ่เกิน 413 / ส่งฟิลด์ผิด 400) ใช้ `UploadErrorsFilter` เล็กๆ ใน `drafts.controller.ts`:

| error | status | code |
|---|---|---|
| ฟิลด์ผิด / ช่วงหน้าผิด / parse ผิด | 400 | `INVALID_DRAFT_REQUEST` |
| ไฟล์ใหญ่เกินเพดาน (multer) หรือ PDF เกิน 200 หน้า | 413 | `PDF_TOO_LARGE` |
| ไม่ใช่ PDF | 415 | `PDF_UNSUPPORTED_TYPE` |
| ไม่มีข้อความใน PDF (ภาพสแกน) | 422 | `PDF_NO_TEXT` |
| PDF เสีย/มีรหัสผ่าน | 422 | `PDF_UNREADABLE` |
| หน้าเดียวยาวเกิน 12,000 ตัวอักษร | 422 | `PDF_PAGE_TOO_LONG` |
| ไม่พบร่าง | 404 | `DRAFT_NOT_FOUND` |
| สถานะไม่อนุญาต / มีงานอื่นกำลังร่าง / ผังไม่ผ่านตรวจ / ยังไม่ ack คำเตือน / id ชน | 409 | `DRAFT_NOT_READY`, `DRAFT_BUSY`, `DRAFT_INVALID`, `DRAFT_WARNINGS_UNACKNOWLEDGED`, `DRAFT_ID_CONFLICT` |
| 401 / 403 ของ guard | 401 / 403 | `UNAUTHENTICATED` / `FORBIDDEN` (filter กลาง) |
| อื่นๆ ที่ไม่รู้จัก | 500 | `INTERNAL_ERROR` |

รูปแบบ body ของ error ทุกตัวเหมือนกัน: `{ "statusCode": 409, "code": "DRAFT_BUSY", "message": "…" }` — หน้าจอตัดสินจาก `code` ไม่ใช่ `message` (ส่วนที่ 5)

### เพดานขนาดไฟล์ (`drafts.controller.ts:32-41`)

```ts
export function maxPdfBytes(env = process.env): number {
  const mb = Number(env.AUTHORING_MAX_PDF_MB);
  return Math.max(1, Math.floor((Number.isFinite(mb) && mb > 0 ? mb : 10) * 1024 * 1024));
}
```

ค่าเริ่มต้น 10 MB ปรับด้วย env `AUTHORING_MAX_PDF_MB` · มี `Math.floor` เพราะ busboy (ไลบรารีใต้ multer) เทียบขนาดด้วย `===` ถ้าเพดานเป็นทศนิยม (เช่น 2.3 MB) จะไม่เคยเท่ากันและ **เพดานไม่ทำงานเงียบๆ** — บั๊กนี้เจอตอนทดสอบแล้วแก้ไว้ (จดไว้ในคอมเมนต์ `:34-37`)

### ตรวจชนิดไฟล์ด้วยไบต์จริง (`drafts.service.ts:createFromUpload` `:90-93`)

```ts
if (!file || file.buffer.length === 0) throw invalidDraftRequest('ต้องแนบไฟล์ PDF ในฟิลด์ file');
// ตรวจจากไบต์จริง ไม่เชื่อ mimetype/นามสกุลที่ผู้ใช้ส่งมา (PDF ต้องมี %PDF- ภายใน 1 KB แรก)
if (!file.buffer.subarray(0, 1024).includes('%PDF-')) throw pdfUnsupportedType();
```

เหตุผล: ใครก็แก้ `Content-Type` หรือชื่อไฟล์ให้ดูเหมือน PDF ได้ แต่ไบต์ต้นไฟล์เปลี่ยนไม่ได้ถ้าจะให้ตัวอ่าน PDF อ่านออก · **ข้อจำกัด:** แค่ขึ้นต้นด้วย `%PDF-` ไม่ได้แปลว่าไฟล์ไม่เสีย (ไฟล์เสียจับได้ตอนแยกข้อความ → `PDF_UNREADABLE`)

### ด่านต่อมา: "ทีละ 1 งาน" และ "คู่มือห้ามซ้ำ" (`:95-101`)

```ts
if (this.busy) throw draftBusy();          // ① ธงในหน่วยความจำ
this.busy = true;
try {
  if ((await this.store.countDrafting()) > 0) throw draftBusy();   // ② เช็กจากฐานข้อมูล
  if (this.graphRepository.listManuals().some((m) => m.manualId === fields.manualId)) {
    throw draftIdConflict([...]);          // ③ manual_id ต้องใหม่
  }
```

- ① `busy` ตั้งและตรวจ **แบบ synchronous ก่อน await ใดๆ** (คอมเมนต์ `:61`) จึงไม่มีทางที่สองคำขอพร้อมกันแย่งกันผ่านได้ (JavaScript ทำงานทีละส่วนที่ไม่มี await)
- ② ฐานข้อมูลเป็นแนวป้องกันที่สอง (กันกรณีที่ธงในหน่วยความจำไม่รู้ เช่น มีเซิร์ฟเวอร์สองตัว) · **ข้อจำกัด:** ② ไม่ atomic ถ้ามีสองเครื่องเซิร์ฟเวอร์จริง ก็ยังมีช่องแข่งกันได้ แต่ตอนนี้ใช้เครื่องเดียว
- ③ **เผยแพร่ได้เฉพาะคู่มือใหม่** ถ้า `manualId` มีอยู่แล้วใน RAM (ผังที่ใช้งานอยู่) ปฏิเสธตั้งแต่อัปโหลด ไม่ต้องรอไปพังตอนเผยแพร่

### แยกข้อความจาก PDF (`authoring/pdf-text.ts:UnpdfTextExtractor.extract` `:102-146`)

1. เปิด PDF ด้วย `unpdf` (ห้องสมุด pure JS ที่ห่อ pdf.js ของ Mozilla) จาก buffer ในหน่วยความจำ — **ไม่เขียนไฟล์ลงดิสก์เลย** (`:3`) เพราะดิสก์ของ Render ไม่ถาวร
2. ปฏิเสธถ้า: อ่านไม่ได้ (`pdfUnreadable` → 422) · เกิน **200 หน้า** (`MAX_PDF_PAGES`) · ช่วงหน้าไม่ถูก/เกินจำนวนหน้าจริง (`pdfPageRange` → 400) · ช่วงหน้าเกิน **10 หน้า** (`MAX_RANGE_PAGES`)
3. ไล่ทีละหน้าในช่วงที่เลือก ดึงข้อความ แล้วทำความสะอาดช่องว่าง (`normalizePageText :92-98`)
4. หน้าใดยาวเกิน **12,000 ตัวอักษร** → ปฏิเสธทั้งร่าง (`pdfPageTooLong` → 422) **ไม่ตัดทิ้งให้** เพราะการตัดเงียบๆ อาจทำให้คำเตือนความปลอดภัยท้ายหน้าหายไป (คอมเมนต์ `:17`)
5. ข้อความรวม (ไม่นับช่องว่าง) น้อยกว่า **50 ตัวอักษร** → `pdfNoText` 422 (น่าจะเป็นภาพสแกน) — ระบบ **ไม่ทำ OCR**
6. คืน `{ totalPages, pages: [{ page: 30, text: "…" }, …] }` และปล่อยทรัพยากรของ pdf.js ใน `finally`

ตัวอย่างผลลัพธ์ที่ส่งกลับ (รูปร่างจริง `PageText` ใน `pdf-text.ts`, ค่าตัวอย่างสมมติ):

```json
{ "totalPages": 64,
  "pages": [
    { "page": 30, "text": "Troubleshooting\nThe microwave oven does not start\nCheck the power plug …" },
    { "page": 31, "text": "The display shows an error code …" } ] }
```

**ข้อจำกัดที่ต้องพูดตรงๆ:** (ก) PDF ภาพสแกน = ใช้ไม่ได้ (ข) ข้อความจาก PDF บางไฟล์สลับลำดับ/ตารางพัง/ภาษาไทยเพี้ยน ซึ่งระบบไม่รู้ตัว (ค) **ผมยังไม่เคยลองกับ PDF คู่มือจริง** เคยลองแค่ PDF ที่สร้างเองเพื่อทดสอบ

### สร้างแถวร่างแล้วตอบ 202 (`drafts.service.ts:103-118`, `drafts.store.ts:insert :123`)

```ts
const extracted = await this.extractor.extract(new Uint8Array(file.buffer), fields.meta.page_from, fields.meta.page_to);
const id = randomUUID();
await this.store.insert({ id, manualId, meta, pages: extracted.pages,
  progressTotal: chunkPages(extracted.pages).length,   // จำนวนรอบที่ต้องเรียก AI (ทีละ 2 หน้า)
  llmModel: this.llm?.model ?? null, promptVersion: PROMPT_VERSION, createdBy: userId });
void this.runDrafting(id);   // เริ่มงานเบื้องหลัง ไม่ await
return { id };
```

แถวที่เขียนลง `graph_drafts`: `status='drafting'` และเก็บ `meta` (ข้อมูลคู่มือที่ admin กรอก) กับ `pages` (**ข้อความของหน้าที่เลือก ไม่ใช่ไฟล์ PDF**) เป็นคอลัมน์ JSON · ส่วน `graphs`, `validation` ยัง `NULL`

`void this.runDrafting(id)` = "เรียกฟังก์ชันแล้วไม่รอผล" (คีย์เวิร์ด `void` บอกว่าตั้งใจไม่ await) จึงตอบ 202 ได้ทันที

---

## 2.2 ทำไมต้องเป็นงานเบื้องหลัง / ทีละ 1 งาน / ถ้าเซิร์ฟเวอร์รีสตาร์ตกลางงาน

**ทำไมเบื้องหลัง:** เรียก AI ทีละ 2 หน้า คู่มือ 10 หน้า = 5 รอบ รอบละอาจหลายสิบวินาที (timeout ต่อรอบตั้งไว้ 60 วินาที) รวมอาจเกินนาที ถ้าให้หน้าเว็บรอคำตอบเดียวนานขนาดนั้น เบราว์เซอร์/พร็อกซีอาจตัดการเชื่อมต่อก่อน จึงตอบ 202 ทันทีแล้วให้หน้าเว็บ "ถามสถานะเป็นช่วงๆ" (poll — ส่วนที่ 5)

**ทำไมทีละ 1 งาน:** (คอมเมนต์หัวไฟล์ `drafts.service.ts:11`) ข้อจำกัดของ rate limit ของ Groq และ Render free ที่มี CPU/RAM น้อย · เป็นการตัดสินใจเรียบง่าย ไม่ต้องทำคิวงาน

**ถ้าเซิร์ฟเวอร์รีสตาร์ตระหว่างงาน:** งานเบื้องหลังอยู่ในหน่วยความจำของโปรเซสเดียว รีสตาร์ต = งานหาย แต่แถวในฐานข้อมูลยังเป็น `drafting` ค้าง → ตอนบูต `DraftsService.onApplicationBootstrap` (`:72-80`) เรียก `store.failInterrupted()` (`drafts.store.ts:172-179`) ซึ่งสั่ง SQL:

```sql
UPDATE graph_drafts SET status='failed', error_code='INTERRUPTED',
       error_message='งานถูกขัดจังหวะ (เซิร์ฟเวอร์เริ่มทำงานใหม่) ให้อัปโหลดคู่มือใหม่'
 WHERE status='drafting'
```

ร่างที่ `failed` เป็นสถานะสิ้นสุด (ถอดฟีเจอร์ "ลองร่างใหม่" ออกแล้ว) admin ต้อง **อัปโหลดคู่มือใหม่** · ข้อความหน้าใน `pages` ของร่างเก่ายังเก็บอยู่ในฐานข้อมูล · ถ้าตาราง `graph_drafts` ยังไม่มี (ยังไม่รัน migration 012) ขั้นนี้แค่ log error ไม่ทำให้แอปทั้งตัวล้ม (`:76-79`)

---

## 2.3 งานเบื้องหลัง `runDrafting` (`drafts.service.ts:144-176`)

```
 runDrafting(id)
   │
   ├─ ไม่มี LLM client (ไม่ได้ตั้ง GROQ_API_KEY/AUTHORING_LLM_MODEL)
   │      → markFailed 'LLM_NOT_CONFIGURED'  → จบ
   │
   ├─ แบ่งหน้าเป็นกลุ่มละ 2 หน้า (chunkPages, PAGES_PER_LLM_CALL = 2)
   │
   ├─ วนทีละกลุ่ม:
   │     raw = await llm.draft({manualId, meta, pages})        ← เรียก Groq
   │     collected.push(...parseLlmOutput(raw))                 ← แปลงแบบเข้ม (พังตรงนี้ = ทั้งร่างล้ม)
   │     store.setProgress(id, index+1)                         ← หน้าจอเห็น "2/5"
   │
   ├─ ไม่ได้ผังเลย → markFailed 'NO_GRAPHS_FOUND'
   │
   ├─ graphs = assignGraphIds(manualId, collected)              ← เซิร์ฟเวอร์ตั้ง graph_id เอง
   ├─ report = validate(...)                                    ← ตัวตรวจแผนผัง (ส่วนที่ 3)
   └─ markReady(id, graphs, report)                             ← status = ready
   
   ถ้าขั้นไหนโยน error → describeFailure → markFailed(code, message)
   finally → busy = false  (ปล่อยให้งานถัดไปเข้าได้)
```

สิ่งที่ควรสังเกต:
- **ล้มทีเดียวล้มทั้งร่าง:** ถ้ากลุ่มที่ 3 จาก 5 ตอบ JSON เสีย ทั้งร่างเป็น `failed` (ไม่เก็บผลบางส่วน) เพราะข้อมูลบางส่วนอาจทำให้ admin เข้าใจผิดว่าคู่มือถูกแปลงครบ
- **แบ่งทีละ 2 หน้ามีข้อเสีย:** อาการที่ยาวคาบสองกลุ่มหน้าจะถูกตัดครึ่ง (prompt ข้อ 7 สั่งให้ AI "ข้ามอาการที่ถูกตัดที่ขอบหน้า" จึงอาจหายไปทั้งอาการ หรือได้เป็นสองผังท่อนๆ) ตรวจไม่ได้ว่าจะเกิดบ่อยแค่ไหน
- **ไม่ log ข้อความหน้าคู่มือหรือคำตอบของ AI** (log แค่ id และสถานะ — คอมเมนต์ `:12`)
- รหัสความล้มเหลวที่เป็นไปได้ (`describeFailure :178-182`): `LLM_TIMEOUT`, `LLM_HTTP`, `LLM_BAD_RESPONSE` (จาก `DraftLlmError`) · `LLM_PARSE_ERROR` (จาก `DraftParseError`) · `INTERNAL_ERROR` (อย่างอื่น ข้อความทั่วไป ไม่หลุดรายละเอียดภายใน)

---

## 2.4 ตัวเรียก AI (`authoring/draft-llm.client.ts`)

### ส่งอะไรไป Groq (`:108-129`)

```
POST https://api.groq.com/openai/v1/chat/completions
Authorization: Bearer <GROQ_API_KEY จาก env>
{
  "model": <AUTHORING_LLM_MODEL>,
  "temperature": 0,
  "max_tokens": 6000,                         ← ปรับด้วย AUTHORING_LLM_MAX_TOKENS
  "response_format": { "type": "json_object" },   ← JSON mode
  "messages": [
    { "role": "system", "content": <SYSTEM_PROMPT> },
    { "role": "user",   "content": <ชื่อคู่มือ/ยี่ห้อ/รุ่น/ประเภท + ข้อความ 2 หน้า> }
  ]
}
```

ข้อความ user (`buildPrompt :86-93`) หน้าตาแบบนี้ (ตัวอย่างสมมติ):

```
Manual: MS23K3513_user_manual
Brand: Samsung | Model: MS23K3513** | Category: Microwave

=== PAGE 30 ===
Troubleshooting
The microwave oven does not start …

=== PAGE 31 ===
…
```

- **`temperature: 0`** = ให้ตอบแบบแน่นอนที่สุดเท่าที่โมเดลทำได้ (ลดการ "สร้างสรรค์") — ไม่ได้รับประกันว่าทุกครั้งจะได้คำตอบเหมือนกัน
- **JSON mode** บังคับให้เป็น JSON ที่ parse ได้ แต่ **ไม่บังคับ schema** เราจึงยังต้อง parse เข้มเองอีกชั้น (หัวข้อ 2.5)
- **ส่งไปแค่:** ข้อความของหน้าที่เลือก + ข้อมูลคู่มือที่ admin กรอก **ไม่ส่ง:** ไฟล์ PDF, อีเมล/ตัวตนของ admin, ข้อมูลผู้ใช้ทั่วไป
- **Timeout:** ใช้ `AbortController` + `setTimeout` ค่าเริ่มต้น 60,000 ms (`AUTHORING_LLM_TIMEOUT_MS`) → เกินแล้ว `LLM_TIMEOUT`
- **ตอบกลับที่ผิดปกติ:** HTTP ไม่ ok → `LLM_HTTP` (แนบรายละเอียด ≤ 200 ตัวอักษร) · `finish_reason === 'length'` (คำตอบถูกตัดเพราะเกิน max_tokens) → `LLM_BAD_RESPONSE` · เนื้อหาว่าง → `LLM_BAD_RESPONSE` (`:136-156`)
- **ตั้งค่า:** ถ้าไม่มี `GROQ_API_KEY` หรือ `AUTHORING_LLM_MODEL` → `createDraftLlmFromEnv()` คืน `null` (`:164-176`) ระบบยังอัปโหลดได้แต่ร่างจะล้มด้วย `LLM_NOT_CONFIGURED` · ชื่อโมเดลไม่มีค่าเริ่มต้นโดยตั้งใจ เพราะชื่อโมเดลของผู้ให้บริการเปลี่ยนบ่อย

### prompt ทีละข้อ (`:55-84` · ภาษาอังกฤษตามต้นฉบับ พร้อมคำอธิบายไทย)

> `You convert pages of a home-appliance user manual into troubleshooting decision graphs.`
> `You only DRAFT. A deterministic validator and a human reviewer check everything you write, so never guess.`

บอกบทบาทและ "ขอบเขตอำนาจ": แค่ร่าง และมีโค้ด+คนตรวจต่อ → ห้ามเดา (เป็นแค่คำขอ ไม่ใช่การบังคับ การบังคับจริงอยู่ที่ validator)

> `Reply with ONE JSON object and nothing else: {"graphs":[{"slug":"...","entry_symptom":"...","entry_symptom_th":"...","aliases":["..."],"severity":"low|medium|high|critical","difficulty":"easy|medium|hard","entry_node":"n1","nodes":[...]}]}`

กำหนดรูปร่างคำตอบ (ตรงกับที่ `parseLlmOutput` ยอมรับ)

> `Graph fields:` slug (3–30 ตัว `a-z 0-9 _`), `entry_symptom` (ภาษาอังกฤษตามคู่มือ), `entry_symptom_th` (แปลไทย), `aliases` (วลีไทยที่ผู้ใช้อาจพิมพ์ ≤ 5), `severity`/`difficulty` ไม่บังคับ, `entry_node`

`slug` คือ "ชื่อสั้น" ของอาการ เซิร์ฟเวอร์เอาไปต่อเป็น `graph_id` = `<manual_id>_<slug>` (หัวข้อ 2.5) AI ไม่ได้ตั้ง id เอง

> `Node types (every node needs node_id, type, source_page; node_id starts with "n", lowercase a-z 0-9 _ only):` + นิยาม 5 ชนิด (checkpoint / instruction / input / resolution / escalation) พร้อมฟิลด์ของแต่ละชนิด

บอก AI ว่าแต่ละชนิดขั้นตอนต้องมีฟิลด์อะไร (ตรงกับ `traversal-engine/types.ts`) · `source_page` บังคับทุกโหนด เพื่อให้ผู้ตรวจรู้ว่าแต่ละขั้นมาจากหน้าไหน

> `add "safety_critical":true and "safety_warning":"..." when the step involves electricity, unplugging/plugging, gas, heat, hot water, moving heavy parts, opening or removing covers, or refrigerant.`

สั่งให้ติดธงอันตรายตามหมวดที่กำหนด — **เป็นแค่คำสั่งต่อ AI** ถ้า AI ลืม ตัวตรวจฝั่งโค้ดมีคำเตือนสองแบบคอยจับ (`W_NODE_RISK`, `W_PAGE_RISK` — ส่วนที่ 3) แต่ **เป็นแค่ warning ไม่ใช่ error** (ผู้ตรวจต้องรับทราบ)

> `input: only to ask the user for an error code shown on the display …`

จำกัดการใช้ช่องกรอกไว้เฉพาะ "รหัส error ที่ขึ้นหน้าจอ" · ตัวแปรอ้างอิงด้วย `{{error_code}}`

> `Hard rules:` 8 ข้อ

| ข้อ | เนื้อหา | อธิบาย |
|---|---|---|
| 1 | ใช้ข้อมูลในหน้าที่ให้เท่านั้น ห้ามเพิ่มขั้นตอน/สาเหตุ/ตัวเลขจากความรู้ตัวเอง | ลดการ "แต่งเอง" · **ตรวจไม่ได้อัตโนมัติ** ว่า AI ทำตามจริงไหม ผู้ตรวจต้องอ่านเทียบหน้าต้นฉบับ |
| 2 | `source_page` = เลขหน้าจากเครื่องหมาย `=== PAGE n ===` เท่านั้น | validator ตรวจว่าเลขหน้าอยู่ในหน้าที่อัปโหลดจริง (`E_SOURCE_PAGE_OUTSIDE`) |
| 3 | ห้ามลด/ตัดคำเตือนของต้นฉบับ ขั้นอันตรายต้อง `safety_critical: true` และคำเตือนเป็นภาษาไทย | ข้อนี้ AI อาจพลาด → มี warning ช่วยจับ + คนตรวจ |
| 4 | ทุกเส้นทางต้องจบที่ resolution/escalation, ขั้นสุดท้ายไม่มี next, ทุกลูกศรชี้ไปขั้นที่มีอยู่จริง | validator ตรวจแน่นอน (`E_NO_TERMINAL`, `E_EDGE_TARGET_MISSING`, `E_NO_EXIT` …) |
| 5 | ถ้าคู่มือไม่บอกว่าไปต่ออย่างไร ให้จบด้วย escalation "ติดต่อศูนย์บริการ" แทนการแต่งขั้นตอน | ป้องกัน AI แต่งทางออก |
| 6 | ข้อความเป็นภาษาไทยธรรมชาติ แต่ชื่อรุ่น/รหัส error/ชื่อปุ่ม/ตัวเลขคงตามต้นฉบับ | **ตรวจไม่ได้อัตโนมัติ** (ผู้ตรวจต้องดู) |
| 7 | ไม่มีเนื้อหาแก้ปัญหา หรืออาการถูกตัดที่ขอบหน้า → ข้าม และคืน `{"graphs":[]}` ได้ | ถ้าทุกกลุ่มหน้าคืนว่าง → `NO_GRAPHS_FOUND` |
| 8 | ไม่เกิน 12 ผัง/40 โหนดต่อผัง และห้ามใส่ key ที่ไม่ได้ระบุ | `parseLlmOutput` บังคับเพดานและปฏิเสธ key เกิน |

หมายเหตุ: prompt เวอร์ชัน `v1` (`PROMPT_VERSION :20`) บันทึกลงคอลัมน์ `prompt_version` ของร่างเพื่อย้อนดูว่าร่างมาจาก prompt ไหน

---

## 2.5 ทำไมแปลงผลแบบ "เข้ม" และทำไมเซิร์ฟเวอร์เป็นคนตั้ง id/source/page_range

### แปลงแบบเข้ม (`authoring/draft-schema.ts:parseLlmOutput` `:145-179`)

หลักการ (คอมเมนต์ `:1-11`): **ไม่เชื่อ JSON mode** — ทุกคำตอบจาก AI ต้องผ่านการตรวจนี้ก่อนถึง validator:

- ไม่ใช่ JSON → `DraftParseError('คำตอบของ LLM ไม่ใช่ JSON')`
- ฟิลด์ที่ไม่อยู่ในรายการอนุญาต → **ปฏิเสธทั้งก้อน** (ไม่ตัดทิ้งเงียบๆ ไม่ซ่อม ไม่เดา)
- ชนิดค่าต้องตรง: `safety_critical` เป็น true/false, `source_page` เป็นจำนวนเต็ม, ที่เหลือเป็นข้อความ ≤ 2,000 ตัวอักษร (`parseNodes :83-90`)
- เพดาน: ≤ 12 ผัง/การเรียก, ≤ 60 ขั้นตอน/ผัง, slug ต้องตรง `^[a-z0-9_]{3,30}$`

ตัวอย่างคำตอบ AI ที่ **จะถูกปฏิเสธ** (ตัวอย่างสมมติ): AI แถม `manual_id` มาเอง

```json
{ "graphs": [ { "slug": "no_power", "manual_id": "samsung_ms23k3513", "entry_symptom": "…", "entry_node": "n1", "nodes": [ … ] } ] }
```

→ `DraftParseError: graphs[0]: ฟิลด์ที่ไม่อนุญาต manual_id` → ร่างเป็น `failed` พร้อม `LLM_PARSE_ERROR`

**ทำไมเข้ม:** ถ้า "ซ่อมให้" (เช่น ตัดฟิลด์เกินทิ้ง) เราจะไม่รู้ว่า AI พยายามทำอะไรอยู่ และอาจซ่อมผิด · ปฏิเสธชัดๆ ปลอดภัยกว่าและผู้ดูแลกดลองใหม่ได้ · ข้อเสีย: AI ที่ "เกือบถูก" ก็ล้มทั้งร่าง (ต้องลองใหม่หรือปรับ prompt)

### เซิร์ฟเวอร์เป็นคนตั้ง id / source / page_range (`authoring/draft-manual.ts:assembleManual` `:29-61`)

ข้อมูลที่ AI **ไม่มีสิทธิ์กำหนด** (ถ้าใส่มา = ถูกปฏิเสธตามข้างบน):

| ฟิลด์ | มาจากไหน |
|---|---|
| `manual_id`, `device_category`, `brand`, `model_pattern`, `source` (ชื่อคู่มือ), `display_name` | สิ่งที่ admin กรอกตอนอัปโหลด (เก็บในคอลัมน์ `meta`) |
| `graph_id` | `assignGraphIds` (`draft-schema.ts:213-221`) = `<manual_id>_<slug>` ถ้าซ้ำในคู่มือเดียวกันต่อ `_2`, `_3` |
| `page_range` | **คำนวณจาก `source_page` ของทุกโหนด** (ต่ำสุดถึงสูงสุด) ไม่เชื่อค่าจาก AI (`draft-manual.ts:39-41`) |
| `source_chunk_id` | `draft:<draftId>:<graphId>` (`draft-manual.ts:25-27`) → ผังที่เผยแพร่ย้อนกลับมาหาร่างต้นทางได้ |
| `schema_version` | 2 ตายตัว |

**เหตุผล 3 ข้อ:**
1. **ความเชื่อถือ:** `source` และ `page_range` คือสิ่งที่หน้าจอผู้ใช้แสดงเป็น "ที่มาของขั้นตอนนี้" (`ReferenceLine`) ถ้าให้ AI กำหนดเองได้ AI อาจอ้างคู่มือ/หน้าที่ไม่ได้ใช้ ระบบที่อ้างว่า "ทุกขั้นบอกหน้าคู่มือที่มา" จะเชื่อถือไม่ได้
2. **ความปลอดภัยของข้อมูล:** AI กำหนด `manual_id`/`graph_id` เองได้ = อาจชนกับผังที่ใช้งานอยู่แล้ว (ที่ผู้ใช้กำลังเดินอยู่)
3. **ลดพื้นที่ให้ AI พลาด:** ให้ AI เขียนเฉพาะเนื้อหา (คำถาม คำสั่ง ลูกศร) ส่วนที่เหลือโค้ดทำเอง

ตัวอย่างข้อมูลหนึ่งผังหลัง `assembleManual` (ตัวอย่างสมมติ · รูปร่างตาม `draft-manual.ts`):

```json
{
  "schema_version": 2,
  "graph_id": "demo_samsung_ms23k3513_no_power",
  "device_category": "Microwave", "brand": "Samsung", "model_pattern": "MS23K3513**",
  "entry_symptom": "The microwave oven does not start",
  "entry_symptom_th": "ไมโครเวฟไม่ทำงาน",
  "source": "MS23K3513_user_manual",
  "page_range": [30, 30],
  "source_chunk_id": "draft:5e2f9c4a-…:demo_samsung_ms23k3513_no_power",
  "entry_node": "n1",
  "nodes": [
    { "node_id": "n1", "type": "checkpoint", "question": "ปลั๊กเสียบแน่นอยู่หรือไม่?", "on_yes": "n2", "on_no": "n3", "source_page": 30 },
    { "node_id": "n3", "type": "instruction", "content": "เสียบปลั๊กให้แน่น", "safety_critical": true,
      "safety_warning": "ตรวจสอบว่ามือแห้งก่อนเสียบปลั๊ก", "next": "n2", "source_page": 30 }
  ]
}
```

(`source_page` อยู่ในร่างเป็นหลักฐานให้ผู้ตรวจ แต่ **ไม่ถูกเขียนลงตาราง `nodes`** ตอนเผยแพร่ — ตารางไม่มีคอลัมน์นี้ — `draft-manual.ts` คอมเมนต์หัวไฟล์)

---

## 2.6 สถานะของร่าง (state machine)

มี 5 สถานะ (ENUM ใน `migrations/012_create_graph_drafts.sql:23`):

| สถานะ | ความหมาย |
|---|---|
| `drafting` | AI กำลังร่างอยู่ |
| `ready` | ร่างเสร็จ มีรายงานการตรวจ รอคนตรวจ/แก้/เผยแพร่ |
| `failed` | ล้มเหลว (AI ล้ม / parse ไม่ผ่าน / ไม่พบผัง / ถูกขัดจังหวะ) **จบ** ต้องอัปโหลดใหม่ (ปฏิเสธได้) |
| `rejected` | admin ปฏิเสธ (จบถาวร) |
| `published` | เผยแพร่แล้ว (จบถาวร) |

```
                         อัปโหลด PDF  (store.insert)
                                │
                                ▼
                         ┌────────────┐
              ┌──────────│  drafting  │
              │          └────────────┘
   LLM/parse ล้ม,        │  ร่างสำเร็จ
   ไม่พบผัง, ถูกขัด        │  (markReady)
   จังหวะตอนรีสตาร์ต       ▼
   (markFailed /      ┌────────┐   PUT แก้ผัง (saveEdit)
    failInterrupted)  │ ready  │───┐  ← ยังเป็น ready ตรวจใหม่
              │       └────────┘◀──┘
              │         │    │
              │ reject  │    │ publish (ผ่านตรวจ + transaction)
              │         │    ▼
              ▼         │  ┌───────────┐
         ┌────────┐     │  │ published │ (จบ)
         │ failed │─────┘  └───────────┘
         └────────┘  (จบ: ต้องอัปโหลดใหม่)
              │ reject
              ▼
         ┌──────────┐
         │ rejected │ (จบ)
         └──────────┘
```

ตารางการเปลี่ยนสถานะ — **สถานะต้นทางถูกบังคับใน SQL** ด้วยเงื่อนไข `WHERE status = …` (ไม่ใช่แค่ใน TypeScript) จึงกันเคสกดซ้ำ/แข่งกันได้:

| จาก → ไป | ฟังก์ชัน | เงื่อนไข SQL | `drafts.store.ts` |
|---|---|---|---|
| (ใหม่) → `drafting` | `insert` | — | `:123` |
| `drafting` → `ready` | `markReady` | `WHERE id=? AND status='drafting'` | `:185` |
| `drafting` → `failed` | `markFailed` | `WHERE … status='drafting'` | `:194` |
| `drafting` → `failed` (รีสตาร์ต) | `failInterrupted` | `WHERE status='drafting'` (ทุกแถว) | `:172` |
| `ready` → `ready` | `saveEdit` (PUT) | `WHERE … status='ready'` | `:214` |
| `ready`/`failed` → `rejected` | `reject` | `WHERE … status IN ('ready','failed')` | `:223` |
| `ready` → `published` | `publish` | ล็อกแถว `FOR UPDATE` แล้วเช็ก `status === 'ready'` | `:246-282` |

**ที่ไม่มี:** `failed` → `drafting` (ถอด retry ออกแล้ว ต้องอัปโหลดใหม่) · `drafting` → `rejected`/`published` โดยตรง (ปฏิเสธ/เผยแพร่ระหว่าง AI ยังร่างอยู่ไม่ได้) · `rejected`/`published` → อะไรก็ไม่ได้ · `published` แก้/ถอนผ่านหน้าจอไม่ได้ (ต้องใช้ SQL — ข้อจำกัดที่ต้องพูดตรงๆ)

ถ้าสถานะไม่ตรง service โยน `draftNotReady` (ApiError) → 409 `DRAFT_NOT_READY`

---

## 2.7 สิ่งที่ตรวจแล้ว / ยังไม่ตรวจ (เฉพาะส่วนนี้)

| ส่วน | สถานะ |
|---|---|
| ลำดับ guard → ไฟล์ → filter, เพดานไฟล์ (413), ตรวจ `%PDF-` (415), ฟิลด์ผิด (400), ทีละ 1 งาน (409) | 🟡 เคยทดสอบผ่าน HTTP จริงของ NestJS (`NestFactory` + `fetch`) แต่ใช้ **ฐานข้อมูลปลอมในหน่วยความจำ** และ AI ปลอม · ไฟล์เทสต์ถูกลบแล้วและไม่เคย commit |
| `maxPdfBytes` แบบทศนิยม | ✅ เคยจำลองบั๊กแล้วแก้ (`Math.floor`) · ไม่มีเทสต์เหลือ |
| แยกข้อความ PDF (`unpdf`) | 🟡 เคยรันใน Node แยกโปรเซสกับ PDF สร้างเอง (หลายบรรทัด/หลายหน้า/PDF เสีย) · **ไม่เคยลองกับ PDF คู่มือจริง** ภาษาไทย ตาราง หรือหลายคอลัมน์ |
| การเรียก Groq (prompt, JSON mode, timeout, `finish_reason`) | ❌ **ไม่เคยเรียกจริงสักครั้ง** ทดสอบกับ `fetch` ปลอมเท่านั้น จึงไม่รู้ว่า (1) โมเดลที่เลือกตอบตรงรูปแบบแค่ไหน (2) คุณภาพของร่าง (3) โมเดลแบบ reasoning อาจใช้ token คิดจน `max_tokens` 6000 ไม่พอ (4) โดน rate limit บ่อยแค่ไหน |
| SQL ของ `graph_drafts` (`insert`, `markReady`, `markFailed` …), คอลัมน์ JSON, `failInterrupted` | ❌ ไม่เคยรันบน MySQL จริง · ไม่แน่ใจว่า migration 012 รันบน Aiven แล้วหรือยัง |
| ขอบเขตของ "ทีละ 1 งาน" เมื่อมีหลายเซิร์ฟเวอร์ | ไม่ได้ออกแบบ/ทดสอบ (ใช้เครื่องเดียว) |

---

## ส่วนที่ 2 จบ — รอคุณพิมพ์ "ok" หรือถามต่อ

ส่วนถัดไป (ส่วนที่ 3) คือ **ตัวตรวจแผนผัง `graph-validator.ts`** ทีละกฎ พร้อมตัวอย่าง JSON ที่ทำให้แต่ละกฎ error
