# CLEANUP_LOG — บันทึกการเก็บกวาดโค้ด

> อ้างอิงรหัสรายการจาก `docs/archive/CLEANUP_PLAN.md` · ทุกชุดในไฟล์นี้ **ไม่เปลี่ยนพฤติกรรม** (API, error code, engine, safety gate, rephrase-guard, SQL ไม่ถูกแตะ)
> ยังไม่ได้ commit — เจ้าของ commit เอง

---

## รอบที่ 1 · 17 ต.ค. 2569 · branch `refactor/cleanup` · ชุด 1 + ชุด 2

### ชุด 1 — frontend: จัดรูปแบบหน้าตรวจอาการ

| รหัส | แก้อะไร | เพราะอะไร |
|---|---|---|
| C-10 | `frontend/src/pages/SessionPage.tsx`: ย้าย `<OutcomeForm …/>` และ `<TerminalActions …/>` ออกมาเป็นตัวแปร `outcomeForm` / `outcomeActions` ก่อน `return` แล้วเขียน props ของ `<StepView>` ทีละบรรทัด | เดิมเป็นบรรทัดเดียวยาว ~460 ตัวอักษร อ่านไม่ออกว่าส่งอะไรให้ใคร · prop ทุกตัวและค่าที่ส่งเหมือนเดิมทุกตัว (JSX ถูกสร้างทุกครั้งที่ render เหมือนเดิม StepView เป็นคนเลือกว่าจะแสดงเมื่อถึงโหนดสิ้นสุด) |
| C-11 | `frontend/src/lib/labels.ts`: ลบบรรทัดว่างที่ซ้อนกัน 3 จุด | ให้รูปแบบเหมือนไฟล์อื่น · ไม่มีผลกับโค้ด |

**ข้ามในชุดนี้**

| รหัส | เหตุผลที่ข้าม |
|---|---|
| C-01 `resetAuthStorageForTests` | ค้นใน git พบว่าเทสต์เดิม `frontend/src/api/http.test.ts` และ `frontend/src/lib/authStorage.test.ts` (commit `61c3fb0`) เรียกฟังก์ชันนี้ → เข้าข้อ "ห้ามลบ export ที่เทสต์เคยใช้" |
| C-02 `manualIssues` | ไม่มีใครเรียกในโค้ดปัจจุบัน แต่ไม่มั่นใจ 100% ว่าเทสต์ของ Step 5 (ไม่เคย commit จึงตรวจย้อนไม่ได้) เคยใช้หรือไม่ → ข้ามตามกฎ "ไม่มั่นใจให้ข้าม" |

**ผลตรวจ:** `npx tsc -b` ผ่าน · `npx eslint .` ผ่าน · `npm run build` ผ่าน (exit 0)

**ข้อความ commit ที่แนะนำ:** `refactor: split long StepView props in SessionPage and tidy labels`
**ไฟล์:** `frontend/src/pages/SessionPage.tsx`, `frontend/src/lib/labels.ts`

### ชุด 2 — backend: comment / type / คำอธิบายแพ็กเกจ

| รหัส | แก้อะไร | เพราะอะไร |
|---|---|---|
| C-04 | แก้ comment ที่อ้างถึงไฟล์เทสต์ซึ่งถูกลบไปแล้ว 9 จุด: `admin/admin.exception.filter.ts`, `admin/admin.store.ts`, `admin/admin.service.ts`, `authoring/draft-manual.ts`, `authoring/graph-validator.ts`, `authoring/drafts.exception.filter.ts`, `authoring/authoring.module.ts`, `symptom-search/symptom-search.service.ts` และฝั่ง frontend `lib/authContext.ts` | comment เดิมบอกว่า "มีเทสต์ยืนยัน" ซึ่งไม่จริงแล้ว ทำให้เข้าใจผิดว่าส่วนนั้นมีเทสต์คุ้มครอง · ตอนนี้บอกตรงๆ ว่าไม่มีเทสต์ และบอกวิธีตรวจด้วยมือในจุดที่สำคัญ (401/403 ของ admin) · `graph-validator.ts` และ `admin.store.ts` อยู่ในโซนระดับ 3 แต่แก้เฉพาะบรรทัด comment |
| C-05 | ลบ `//Need to read this again later` ท้าย `traversal/session.store.ts` · ตัดประโยคที่เทียบกับโปรเจกต์ FixStep ใน `symptom-search/symptom-search.module.ts` | โน้ตส่วนตัว/การเทียบกับโค้ดที่ไม่อยู่ใน repo ไม่ช่วยคนอ่าน · `session.store.ts` แก้เฉพาะบรรทัดสุดท้ายที่เป็น comment ไม่แตะ SQL |
| C-07 | `authoring/drafts.controller.ts`: `(request.user as { sub: string }).sub` → `request.user!.sub` (3 จุด) | ให้เหมือน `auth/auth.controller.ts` · `JwtAuthGuard` ที่ติดระดับ class รับประกันว่ามี `request.user` แล้ว · เปลี่ยนแค่วิธีบอก type ผลรันเหมือนเดิม |
| C-03 | `authoring/drafts.controller.ts`: ลบฟิลด์ `size` ออกจาก interface `UploadedPdf` | ไม่มีโค้ดอ่าน `file.size` (service ใช้แค่ `buffer`) · เป็น type อย่างเดียว ไม่กระทบไฟล์ที่ multer ส่งมา |
| C-08 | `backend/package.json`: `description` จาก "traversal engine + RAG" เป็น "traversal engine (state machine)" | ระบบไม่ใช่ RAG · แก้เฉพาะฟิลด์ข้อความ ไม่แตะ dependencies/scripts |

**ข้ามในชุดนี้**

| รหัส | เหตุผลที่ข้าม |
|---|---|
| C-06 เปลี่ยนชื่อ `toErrorBody` ใน `symptom-search.exception.filter.ts` | พบว่าเทสต์ใน `draft/code/backend/tests/symptom-search/symptom-search.exception.filter.spec.ts:6` import ชื่อ `toErrorBody` จากไฟล์นี้ → เปลี่ยนชื่อแล้วเทสต์นั้นจะใช้ไม่ได้เมื่อนำเข้า (เข้าข้อ "ห้ามลบ export ที่เทสต์เคยใช้") |

**ผลตรวจ:** backend `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` ผ่าน · `npm run build` ผ่าน (exit 0) · backend ไม่มี eslint · frontend (เพราะแก้ `authContext.ts`) `tsc -b` / `eslint .` / `build` ผ่าน

**ข้อความ commit ที่แนะนำ:** `chore: drop stale test references in comments and tidy drafts controller types`
**ไฟล์:** `backend/package.json`, `backend/src/admin/admin.exception.filter.ts`, `backend/src/admin/admin.service.ts`, `backend/src/admin/admin.store.ts`, `backend/src/authoring/authoring.module.ts`, `backend/src/authoring/draft-manual.ts`, `backend/src/authoring/drafts.controller.ts`, `backend/src/authoring/drafts.exception.filter.ts`, `backend/src/authoring/graph-validator.ts`, `backend/src/symptom-search/symptom-search.module.ts`, `backend/src/symptom-search/symptom-search.service.ts`, `backend/src/traversal/session.store.ts`, `frontend/src/lib/authContext.ts`

### ทดสอบด้วยมือที่ควรทำ

- **หน้าตรวจอาการ** (`/#/session/:id`): เดินจนถึงโหนดสิ้นสุด → ต้องเห็นฟอร์ม "บันทึกผลลัพธ์" และปุ่ม "ตรวจอาการอื่น" / "เริ่มอาการนี้ใหม่" กดได้เหมือนเดิม · ขั้นที่มีคำเตือนต้องยังขึ้นกล่องยืนยัน
- **อัปโหลดร่าง / ปฏิเสธ / เผยแพร่** (`/#/admin/drafts`): ยังทำงาน (ใช้ `request.user!.sub` เป็น id ผู้ทำรายการ) — ถ้ายังไม่พร้อมทดสอบ Step 5 อย่างน้อยเปิด `/admin/drafts` ด้วยบัญชี admin แล้วเห็นรายการ

### หมายเหตุอื่นที่พบระหว่างทาง

- ไฟล์ในโปรเจกต์ใช้การขึ้นบรรทัดปนกัน (บางไฟล์ CRLF บางไฟล์ LF) — การแก้รอบนี้คงรูปแบบเดิมของแต่ละไฟล์ · git เตือน "LF will be replaced by CRLF" เป็นเรื่องการตั้งค่า `core.autocrlf` ไม่ใช่การเปลี่ยนเนื้อหา

---

## รอบที่ 2 · 17 ต.ค. 2569 · branch `refactor/cleanup` · ชุด 4

> เจ้าของสั่งให้ทำต่อโดยยังไม่ commit รอบที่ 1 และจะ commit รวมครั้งเดียว — ไฟล์ `SessionPage.tsx` จึงมีงานของรอบที่ 1 (C-10) และรอบที่ 2 (C-16) ปนกัน

### ชุด 4 — frontend: ตัวห่อที่ไม่ได้ทำอะไรเพิ่ม / ของซ้ำ

| รหัส | แก้อะไร | เพราะอะไร |
|---|---|---|
| C-15 | ลบ `historyModelName` จาก `frontend/src/lib/historyView.ts` (และ import `manualTitle` ที่ไม่ใช้แล้วในไฟล์นั้น) · ผู้เรียก 3 จุดเปลี่ยนไปเรียก `manualTitle` จาก `lib/models` ตรงๆ: `components/history/HistoryRow.tsx` (1 จุด), `pages/HistoryDetailPage.tsx` (2 จุด) | `historyModelName(graph)` แค่คืน `manualTitle(graph)` ไม่ได้ทำอะไรเพิ่ม · หน้าอื่น (`DevicesPage`, `SessionPage`) เรียก `manualTitle` ตรงอยู่แล้ว ทั้งแอปเหลือฟังก์ชันชื่อรุ่นตัวเดียว · ค่าที่ส่งเข้าและข้อความที่แสดงเหมือนเดิมทุกตัวอักษร · ค้นแล้วไม่มีเทสต์เดิม (commit `61c3fb0`, `draft/`) หรือเอกสารใดอ้างชื่อนี้ |
| C-16 | `frontend/src/pages/SessionPage.tsx`: ลบบรรทัด `const summary = graphs.data?.find((graph) => graph.graphId === graphId)` และเปลี่ยนชื่อ `currentSummary` (บรรทัด 42) เป็น `summary` ใช้ตัวเดียวทั้งหน้า | สองบรรทัดหาผังเดียวกัน: `graphId` ที่บรรทัดหลังมาจาก `session.data` ซึ่งเป็นค่าเดียวกับ `session.data?.graphId` ที่บรรทัด 42 และบรรทัดหลังทำงานเฉพาะเมื่อ `session.data` มีค่าแล้ว (หลัง `if` ตรวจ pending/error) จึงได้ผลเท่ากัน · props ที่ส่งให้ `SessionHeader` (`summary`), `EquipmentPanel` (`deviceCategory`) และ `manualLabel` เป็นค่าเดิม |

**ข้ามในชุดนี้**

| รหัส | เหตุผลที่ข้าม |
|---|---|
| C-14 `restartVariables` | เทสต์เดิม `frontend/src/lib/modelSelection.test.ts` (commit `61c3fb0` บรรทัด 3, 68–71) import และทดสอบฟังก์ชันนี้ ("เริ่มอาการนี้ใหม่ต้องคงค่า modelSelection เดิม") → เข้าข้อ "ห้ามลบ export ที่เทสต์เคยใช้" · `docs/features/CHANGES-PHASE3-FRONTEND.md` ก็อ้างถึง |

**ผลตรวจ:** `npx tsc -b` ผ่าน · `npx eslint .` ผ่าน · `npm run build` ผ่าน (exit 0) · `grep historyModelName frontend/src` ไม่พบแล้ว

**ข้อความ commit ที่แนะนำ (ถ้าแยก):** `refactor: use manualTitle directly and drop duplicate graph lookup in SessionPage`
**ไฟล์:** `frontend/src/lib/historyView.ts`, `frontend/src/components/history/HistoryRow.tsx`, `frontend/src/pages/HistoryDetailPage.tsx`, `frontend/src/pages/SessionPage.tsx`

**ข้อความ commit ถ้ารวมรอบที่ 1 + 2 ครั้งเดียว:** `refactor: cleanup sets 1, 2 and 4 (stale comments, long JSX, redundant wrappers)`

### ทดสอบด้วยมือที่ควรทำ (รอบนี้)

- **หน้าประวัติ** (`/#/history`): แต่ละแถวต้องแสดงชื่อรุ่นเหมือนเดิม (ชื่อที่แสดง ถ้าไม่มีก็ `modelPattern`)
- **หน้ารายละเอียดประวัติ** (`/#/history/:id`): หัวหน้าแสดงประเภท · ยี่ห้อ · ชื่อรุ่น และบรรทัด "ที่มาของขั้นตอนนี้: คู่มือ <ยี่ห้อ> <รุ่น> หน้า …" เหมือนเดิม
- **หน้าตรวจอาการ** (`/#/session/:id`): หัวหน้าแสดงชื่ออาการ/รุ่น, กล่องอุปกรณ์ของประเภทเครื่องขึ้นถูก, ปุ่ม "ยกเลิก" แล้วกลับไปหน้าเดิม, ปุ่ม "เริ่มอาการนี้ใหม่" ยังเริ่มรุ่นเดิม
