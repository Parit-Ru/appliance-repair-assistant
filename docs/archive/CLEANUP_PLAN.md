# CLEANUP_PLAN — แผนเก็บกวาดโค้ด appliance-repair-assistant (ช่วง A)

> สำรวจเมื่อ 17 ต.ค. 2569 บน branch `refactor/cleanup` (HEAD = `76c0911 add all`)
> **ช่วง A อ่านอย่างเดียว:** ไม่ได้แก้โค้ด, ไม่ได้รัน migration/seed/เทสต์, ไม่ได้เปิด `.env`, ไม่ได้ติดตั้งเครื่องมือใหม่
> เครื่องมือที่ใช้: `tsc --noEmit --noUnusedLocals --noUnusedParameters` ทั้งสองฝั่ง, สคริปต์ค้น export ที่ไม่มีไฟล์อื่นอ้าง (อยู่ในโฟลเดอร์ชั่วคราว ไม่อยู่ใน repo), `grep` ทั้ง `backend/src`, `frontend/src`, `backend/scripts`, `scripts/`, `package.json`, `render.yaml`, `docs/`
> แผนที่ประกอบ: `docs/study/READING_ROADMAP_v2.md` (แต่ยึดโค้ดจริง)

---

## 0. สรุป

| ระดับ | จำนวนรายการ | ความหมาย |
|---|---|---|
| 1 (ปลอดภัย) | 11 | ลบของที่ไม่มีใครเรียก, comment ล้าสมัย, ตั้งชื่อในไฟล์เดียว, จัดรูปแบบ, `.gitignore` |
| 2 (ปานกลาง) | 9 | ยุบโค้ดซ้ำ / ตัวห่อที่ไม่ทำอะไร / ย้ายคอมโพเนนต์ที่ตั้งชื่อผิดที่ (ไม่แตะแกนความปลอดภัย) |
| 3 (สูง — รายงานอย่างเดียว) | 10 | engine, safety gate, rephrase-guard, ตรวจเจ้าของ, SQL, โหลดผัง, validator ของผังจาก PDF |
| ไม่แน่ใจ (ต้องถามเจ้าของ) | 10 | dependency ที่อาจไม่ใช้แล้ว, เครื่องมือ/โฟลเดอร์เก่า |

**ข่าวดี:** `tsc` แบบเข้มไม่พบ import/ตัวแปร/พารามิเตอร์ที่ไม่ใช้เลยทั้งสองฝั่ง และไม่มีไฟล์ไหนที่ไม่มีใคร import (ยกเว้นจุดเริ่มต้น `main.ts`, `App.tsx` ที่ถูกเรียกโดยตรง) → โค้ดตายมีน้อย งานส่วนใหญ่คือ comment ล้าสมัยหลังลบเทสต์ และของซ้ำเล็กๆ ฝั่ง frontend

> ⚠️ **เรื่องด่วนที่ไม่ใช่การเก็บกวาดโค้ด (หัวข้อ 7):** commit `76c0911 add all` **push ขึ้น `origin/main` แล้ว** และมีไฟล์ dump ฐานข้อมูล `backup/backup_before_011.sql` กับ `backend/backup_before_012.sql` ที่มีตาราง `users` (อีเมล + bcrypt hash) อยู่ในนั้น

---

## 1. สถานะเทสต์และเครื่องตรวจ (ตอบข้อกำหนด "ก่อนรันเทสต์ต้องตรวจ config")

| ฝั่ง | config | ต่อฐานข้อมูลไหม | มีเทสต์ให้รันไหม |
|---|---|---|---|
| backend | `backend/jest.config.js`: `preset ts-jest`, `rootDir: 'src'`, `testRegex: '.*\.spec\.ts$'`, `testEnvironment: node` · ไม่มีบล็อก `jest` ใน `backend/package.json` (มีแค่ script `"test": "jest"`) · ไม่มี setup file ไม่มีตัวแปร env ของเทสต์ | config เองไม่ต่อ DB · เทสต์จะต่อ DB ก็ต่อเมื่อไฟล์เทสต์สร้าง pool จริงเอง (เทสต์เก่าใช้ pool ปลอม) | **ไม่มี** (ไม่พบ `*.spec.ts` ใน `backend/src`) |
| frontend | ไม่มี `vitest.config.*` และ `vite.config.ts` ไม่มีบล็อก `test` → ใช้ค่าเริ่มต้น · script `"test": "vitest run"` | ไม่ต่อ (frontend ไม่มีทางต่อ MySQL) | **ไม่มี** (ไม่พบ `*.test.ts(x)` ใน `frontend/src`) |
| `draft/` | ไม่ถูก include โดย jest (`rootDir: src`) และ vitest (ค่าเริ่มต้นอาจ include `**/*.test.*` นอก src ด้วย — **ไม่แน่ใจ** ถ้าจะรัน `vitest` ให้ระบุโฟลเดอร์ `src` เสมอ) | — | 22 ไฟล์ (ไม่ถูกรัน) |

**คำสั่งตรวจที่ปลอดภัยหลังแก้แต่ละชุด** (ไม่แตะฐานข้อมูล):

```powershell
# backend (ไม่มี eslint ใน backend)
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\backend
npx tsc --noEmit -p tsconfig.json --noUnusedLocals --noUnusedParameters
npm run build

# frontend
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\frontend
npx tsc -b
npx eslint .
npm run build
```

`npm test` / `npx vitest run` ตอนนี้ไม่มีอะไรให้รัน (จะรายงานว่าไม่พบเทสต์ ไม่ใช่ความผิดพลาดของการแก้)

---

## 2. รายการระดับ 1 (ปลอดภัย)

### C-01 · ระดับ 1 · ลบ `resetAuthStorageForTests`
- **ไฟล์:บรรทัด:** `frontend/src/lib/authStorage.ts:88-91`
- **ปัญหา:** ฟังก์ชันนี้มีไว้ให้เทสต์ล้างค่าในหน่วยความจำ เทสต์ถูกลบแล้ว จึงไม่มีใครเรียก คนอ่านจะสงสัยว่าใช้ที่ไหน
- **หลักฐาน:** ค้น `resetAuthStorageForTests` ทั้ง `frontend/src`, `backend/src`, `backend/scripts`, `draft/` → เจอแค่บรรทัดประกาศ (สคริปต์ค้น export ให้ `own=1`)
- **วิธีแก้:** ลบฟังก์ชันและ comment เหนือมัน · ไม่มีไฟล์อื่นกระทบ
- **ตรวจหลังแก้:** frontend `tsc -b`, `eslint .`, `build`
- **ขนาด/ประโยชน์:** เล็ก / ลดสิ่งที่ต้องอธิบาย 1 จุด

### C-02 · ระดับ 1 · ลบ `manualIssues`
- **ไฟล์:บรรทัด:** `frontend/src/lib/draftView.ts:158-162`
- **ปัญหา:** ฟังก์ชันกรอง issue ระดับคู่มือ ไม่มีคอมโพเนนต์ไหนเรียก (`ValidationReportPanel` แสดงรายการทั้งหมดอยู่แล้ว)
- **หลักฐาน:** ค้น `manualIssues` ทั้งโปรเจกต์ → เจอแค่บรรทัดประกาศ
- **วิธีแก้:** ลบฟังก์ชัน · ไม่มีไฟล์อื่นกระทบ
- **ตรวจหลังแก้:** frontend `tsc -b`, `eslint .`, `build`
- **ขนาด/ประโยชน์:** เล็ก / ไฟล์สั้นลง 5 บรรทัด

### C-03 · ระดับ 1 · ลบฟิลด์ `size` ที่ไม่ได้ใช้ใน `UploadedPdf`
- **ไฟล์:บรรทัด:** `backend/src/authoring/drafts.controller.ts:43-47`
- **ปัญหา:** interface ประกาศ `size` แต่โค้ดใช้แค่ `buffer` (`drafts.service.ts:90-93` รับ `{ buffer: Buffer }`) · comment บรรทัด 43 บอกว่า "ไม่ต้องพึ่ง @types/multer" ซึ่งยังจริงอยู่
- **หลักฐาน:** ค้น `.size` ใน `backend/src/authoring` → ไม่มีการอ่าน `file.size` (มีแต่ `nodes.size` ของ Map ใน validator)
- **วิธีแก้:** เหลือ `buffer: Buffer` อย่างเดียว · พฤติกรรมไม่เปลี่ยน (เป็นแค่ type)
- **ตรวจหลังแก้:** backend `tsc --noEmit`, `npm run build`
- **ขนาด/ประโยชน์:** เล็ก / ชัดว่าใช้อะไรจากไฟล์ที่อัปโหลด

### C-04 · ระดับ 1 · comment ที่อ้างถึงไฟล์เทสต์ที่ลบไปแล้ว
- **ไฟล์:บรรทัด:**
  - `backend/src/admin/admin.exception.filter.ts:7` — "(เทสต์ admin-http.spec.ts ยิงผ่าน pipeline จริง…)"
  - `backend/src/admin/admin.store.ts:7` — "(เทสต์ตรวจข้อความ SQL ทุกคำสั่งให้)"
  - `backend/src/admin/admin.service.ts:51` — "เทสต์แทนที่ได้"
  - `backend/src/authoring/draft-manual.ts:7-8` — "(ดู draft-manual.spec.ts …)"
  - `backend/src/authoring/graph-validator.ts:9` — "พิสูจน์ด้วย graph-validator.spec.ts"
  - `backend/src/authoring/drafts.exception.filter.ts:5` — "(admin-http / drafts-http spec …)"
  - `backend/src/authoring/authoring.module.ts:10` — "เพื่อให้เทสต์สลับเป็นของปลอมได้"
  - `backend/src/symptom-search/symptom-search.service.ts:78` — "(public เพื่อให้เทสเรียกและรอผลได้)"
  - `frontend/src/lib/authContext.ts:27-30` — "(เช่น เทสต์ที่ render หน้าเดี่ยวๆ)"
- **ปัญหา:** comment บอกว่ามีเทสต์ยืนยันอยู่ ซึ่งไม่จริงแล้ว ถ้ากรรมการถาม "เทสต์อยู่ไหน" จะตอบไม่ได้ และทำให้เข้าใจผิดว่าส่วนนั้นถูกป้องกันด้วยเทสต์
- **หลักฐาน:** `find` ไม่พบไฟล์ `*.spec.ts` / `*.test.ts(x)` ใน `src` ทั้งสองฝั่ง
- **วิธีแก้:** แก้ข้อความให้ตรงความจริง เช่น "(เคยมีเทสต์ยืนยัน ถูกลบเมื่อ 16–17 ต.ค. — กู้คืนได้จาก git)" หรือตัดวงเล็บนั้นออก · **แก้เฉพาะ comment** ไม่แตะโค้ด (บางไฟล์อยู่ในโซนระดับ 3 คือ `admin.store.ts`, `graph-validator.ts` แต่แตะเฉพาะบรรทัด comment)
- **ตรวจหลังแก้:** backend `tsc --noEmit` + `build` · frontend `tsc -b` + `eslint` + `build` · `git diff` ต้องเห็นเฉพาะบรรทัด comment
- **ขนาด/ประโยชน์:** เล็ก / กันเข้าใจผิดเรื่องความครอบคลุมของเทสต์

### C-05 · ระดับ 1 · comment ค้าง / อ้างโปรเจกต์อื่น
- **ไฟล์:บรรทัด:** `backend/src/traversal/session.store.ts:264` (`//Need to read this again later`) · `backend/src/symptom-search/symptom-search.module.ts:8` ("ต่างจาก FixStep ที่ provide EmbeddingService เอง…" — อ้างโปรเจกต์ต้นแบบที่คนอ่านไม่มี)
- **ปัญหา:** comment แรกเป็นโน้ตส่วนตัวท้ายไฟล์ ไม่บอกว่าต้องอ่านอะไร · comment ที่สองเทียบกับโค้ดที่ไม่อยู่ใน repo
- **หลักฐาน:** อ่านไฟล์โดยตรง · `session.store.ts` อยู่ในโซน SQL (ระดับ 3) แต่บรรทัดนี้เป็น comment ล้วนอยู่หลังโค้ดทั้งหมด
- **วิธีแก้:** ลบบรรทัด 264 · ตัดประโยคเทียบ FixStep ออก เหลือ "โหลดโมเดลครั้งเดียว ใช้ร่วมผ่าน EmbeddingModule"
- **ตรวจหลังแก้:** backend `tsc --noEmit` + `build`
- **ขนาด/ประโยชน์:** เล็ก / ลดสิ่งรบกวน

### C-06 · ระดับ 1 · เปลี่ยนชื่อ `toErrorBody` ใน symptom-search ที่ชื่อซ้ำกับของ traversal
- **ไฟล์:บรรทัด:** `backend/src/symptom-search/symptom-search.exception.filter.ts:28, 50`
- **ปัญหา:** มีฟังก์ชันชื่อ `toErrorBody` สองตัวคนละไฟล์ (ของ traversal `traversal.exception.filter.ts:64` ถูก auth/history import ไปใช้) คนอ่านจะสับสนว่าตัวไหนคือตัวไหน
- **หลักฐาน:** `grep -l toErrorBody` → auth/history import จาก `../traversal/traversal.exception.filter` เท่านั้น ไม่มีไฟล์ไหน import ตัวของ symptom-search
- **วิธีแก้:** เปลี่ยนเป็น `toSearchErrorBody` ภายในไฟล์เดียว (2 จุด) · ค่า error code ไม่เปลี่ยน
- **ตรวจหลังแก้:** backend `tsc --noEmit` + `build`
- **ขนาด/ประโยชน์:** เล็ก / ชื่อบอกที่มา

### C-07 · ระดับ 1 · cast `(request.user as { sub: string }).sub` ซ้ำ 3 จุด
- **ไฟล์:บรรทัด:** `backend/src/authoring/drafts.controller.ts:65, 94, 100`
- **ปัญหา:** เขียนแบบ cast ยาว ต่างจาก controller อื่นที่ใช้ `request.user!.sub` (`auth/auth.controller.ts:41`) ทั้งที่ `JwtAuthGuard` รับประกันว่ามี `user` แล้ว
- **หลักฐาน:** guard ระดับ class `drafts.controller.ts:51` · `jwt-auth.guard.ts:84-89` ตั้ง `request.user` ก่อนถึง handler เสมอ
- **วิธีแก้:** เปลี่ยนเป็น `request.user!.sub` (ตามรูปแบบเดิมของโปรเจกต์) · เป็นการเปลี่ยน type เท่านั้น ผลรันไม่ต่าง
- **ตรวจหลังแก้:** backend `tsc --noEmit` + `build`
- **ขนาด/ประโยชน์:** เล็ก / อ่านง่ายและเหมือนไฟล์อื่น

### C-08 · ระดับ 1 · `description` ใน backend/package.json เขียนว่า RAG
- **ไฟล์:บรรทัด:** `backend/package.json:5` — `"traversal engine + RAG"`
- **ปัญหา:** ระบบไม่ใช่ RAG (ไม่มีการดึงข้อความไปให้ LLM ตอบ) คำนี้ทำให้กรรมการเข้าใจผิด
- **หลักฐาน:** ไม่มีโค้ดส่งเนื้อหาคู่มือไปให้ LLM ตอบผู้ใช้ (`READING_ROADMAP_v2.md` หัวข้อ 3.5)
- **วิธีแก้:** แก้ข้อความเป็น "traversal engine (state machine)" · แก้เฉพาะฟิลด์ข้อความ ไม่แตะ dependencies/scripts
- **ตรวจหลังแก้:** `npm run build` (ยืนยันว่า JSON ยังถูกรูป)
- **ขนาด/ประโยชน์:** เล็ก / ตรงกับสถาปัตยกรรมจริง

### C-09 · ระดับ 1 · `.gitignore` ไม่ครอบไฟล์ dump/แคช
- **ไฟล์:บรรทัด:** `backend/.gitignore` (ignore `backups/` แต่ไม่ครอบ `backup_before_*.sql`) · ราก repo **ไม่มี** `.gitignore` · ไฟล์ที่ถูก track อยู่ตอนนี้: `backup/backup_before_010.sql`, `backup/backup_before_011.sql`, `backend/backup_before_012.sql`, `scripts/__pycache__/*.pyc` (2 ไฟล์)
- **ปัญหา:** dump ฐานข้อมูลและไฟล์แคชของ Python เข้า git ได้โดยไม่ตั้งใจ (เกิดขึ้นแล้ว — หัวข้อ 7)
- **หลักฐาน:** `git ls-files | grep -E "__pycache__|\.sql$"` (นอก `backend/migrations/`)
- **วิธีแก้:** สร้าง `.gitignore` ที่ราก: `backup/`, `**/backup_before_*.sql`, `**/backups/`, `__pycache__/`, `*.pyc`, `*.log` · จากนั้น **เจ้าของรันเอง** `git rm --cached <ไฟล์>` (ไฟล์ในเครื่องยังอยู่) — ผมไม่รัน git เอง
- **ตรวจหลังแก้:** `git status` ต้องไม่เห็นไฟล์เหล่านั้นเป็น untracked ใหม่ · `git check-ignore -v backup/backup_before_011.sql`
- **ขนาด/ประโยชน์:** เล็ก / กันรั่วซ้ำ (ไม่ได้ลบของที่ขึ้น GitHub ไปแล้ว)

### C-10 · ระดับ 1 · บรรทัด JSX ยาว 460+ ตัวอักษรในหน้าตรวจอาการ
- **ไฟล์:บรรทัด:** `frontend/src/pages/SessionPage.tsx:149`
- **ปัญหา:** `<StepView … outcomeForm={<OutcomeForm …/>} outcomeActions={<TerminalActions …/>} />` อยู่บรรทัดเดียว อ่านไม่ออกว่าส่งอะไรให้ใครบ้าง และเป็นหน้าที่กรรมการน่าจะขอดูมากที่สุด
- **หลักฐาน:** การจัดบรรทัดใหม่ไม่เปลี่ยน JSX ที่ได้
- **วิธีแก้:** แยกเป็นตัวแปร `const outcomeForm = <OutcomeForm … />` และ `const outcomeActions = <TerminalActions … />` ก่อน `return` แล้วส่ง prop ทีละบรรทัด · ไม่เปลี่ยน prop ใด
- **ตรวจหลังแก้:** frontend `tsc -b`, `eslint .`, `build` · เปิดหน้าตรวจอาการดูด้วยตา (ขั้นจบต้องเห็นฟอร์มผลลัพธ์ + ปุ่ม "ตรวจอาการอื่น/เริ่มอาการนี้ใหม่")
- **ขนาด/ประโยชน์:** เล็ก / หน้าหลักอ่านง่ายขึ้นมาก

### C-11 · ระดับ 1 · บรรทัดว่างซ้อนใน labels.ts
- **ไฟล์:บรรทัด:** `frontend/src/lib/labels.ts:2-3, 18-19, 42-43`
- **ปัญหา:** บรรทัดว่างสองบรรทัดติดกัน ไม่เหมือนไฟล์อื่น (ไม่สำคัญ แต่ทำพร้อมชุด 1 ได้)
- **วิธีแก้:** เหลือบรรทัดว่างเดียว
- **ตรวจหลังแก้:** frontend `tsc -b`, `eslint .`
- **ขนาด/ประโยชน์:** เล็กมาก / ความสม่ำเสมอ

---

## 3. รายการระดับ 2 (ปานกลาง)

### C-12 · ระดับ 2 · `HistoryErrorNotice` และ `Pagination` อยู่ผิดที่และชื่อผิดความหมาย
- **ไฟล์:บรรทัด:** `frontend/src/components/history/HistoryErrorNotice.tsx` (ทั้งไฟล์) · `frontend/src/components/history/Pagination.tsx`
- **ปัญหา:** ชื่อบอกว่าเป็นของหน้าประวัติ แต่ถูกใช้เป็น "กล่องแจ้งข้อผิดพลาดกลาง" ใน 13 ไฟล์ รวมหน้า admin และหน้าร่างผัง (`AdminAnalyticsPage.tsx:9`, `AdminFeedbackPage.tsx:6`, `AdminDraftsPage.tsx:7`, `AdminDraftReviewPage.tsx:10`, `components/admin/drafts/DraftActions.tsx:5`, `DraftJsonEditor.tsx:4`, `UploadDraftForm.tsx:8` ฯลฯ) · `Pagination` ใช้ใน `AdminFeedbackPage.tsx:7` ด้วย คนอ่านหน้า admin จะงงว่าทำไม import จาก `history/`
- **หลักฐาน:** `grep "HistoryErrorNotice\|Pagination" frontend/src` (รายการ import ทั้งหมด)
- **วิธีแก้:** ย้าย/เปลี่ยนชื่อเป็น `components/ErrorNotice.tsx` (`ErrorNotice`) และ `components/ui/Pagination.tsx` แล้วแก้ import ทุกจุด · **เนื้อ JSX เหมือนเดิมทุกตัวอักษร** (รวมลิงก์ `/history`, `/login`, `/symptoms/all`)
- **ไฟล์ที่กระทบ:** 13 + 2 ไฟล์ (เฉพาะบรรทัด import และชื่อ tag)
- **ตรวจหลังแก้:** frontend `tsc -b` (จับ import ที่ตกหล่น), `eslint .`, `build` · `grep -rn HistoryErrorNotice frontend/src` ต้องว่าง
- **ขนาด/ประโยชน์:** กลาง / โครงสร้างโฟลเดอร์ตรงกับการใช้งานจริง อธิบายง่าย

### C-13 · ระดับ 2 · ข้อความ "กำลังโหลด" พร้อม spinner ซ้ำ 10 ที่
- **ไฟล์:บรรทัด:** `pages/AdminAnalyticsPage.tsx:77-80`, `AdminDraftReviewPage.tsx:44-47`, `AdminDraftsPage.tsx:36-39`, `AdminFeedbackPage.tsx:108-111`, `AllSymptomsPage.tsx:71-74`, `DevicesPage.tsx:53-56`, `HistoryDetailPage.tsx:64-67`, `HistoryPage.tsx:88-91`, `HomePage.tsx:34-37`, `SessionPage.tsx:107-110`
- **ปัญหา:** โค้ด 4 บรรทัดเดิม `<p className="flex items-center gap-2 text-ink-soft"><Icon name="spinner" className="h-5 w-5 animate-spin" />…</p>` คัดลอกไว้ 10 ที่ ถ้าจะแก้หน้าตาต้องแก้ 10 ไฟล์
- **หลักฐาน:** `grep 'name="spinner" className="h-5 w-5 animate-spin"'` — 10 ที่ class เหมือนกันทุกตัว · **ไม่รวม** 2 ที่ที่ต่างกัน: `AdminRoute.tsx:25` (มี `role="status"`) และ `AdminDraftReviewPage.tsx:85` (สี `text-info`)
- **วิธีแก้:** สร้าง `components/ui/LoadingLine.tsx` (`<LoadingLine>กำลังโหลด…</LoadingLine>`) ที่ render markup เดิมทุกตัวอักษร แล้วแทนที่ 10 จุด
- **ตรวจหลังแก้:** frontend `tsc -b`, `eslint .`, `build` · เปิดแต่ละหน้าดูตอนโหลด (หรือจำลองเน็ตช้าใน DevTools)
- **ขนาด/ประโยชน์:** กลาง / ลดโค้ดซ้ำ ~30 บรรทัด

### C-14 · ระดับ 2 · `restartVariables` เป็นตัวห่อที่คืนค่าเดิม
- **ไฟล์:บรรทัด:** `frontend/src/lib/modelSelection.ts:50-57` · ผู้เรียกเดียว `pages/SessionPage.tsx:80`
- **ปัญหา:** ฟังก์ชันรับ `(graphId, manualId, modelSelection)` แล้วคืน `{ graphId, manualId, modelSelection }` ไม่ได้แปลงอะไร คนอ่านต้องเปิดไปดูว่ามันทำอะไร
- **หลักฐาน:** อ่านโค้ด `:55-56` · ค้น `restartVariables` → 1 ผู้เรียก
- **วิธีแก้:** เขียน object ตรงที่ `SessionPage.tsx:80` แล้วย้าย comment สำคัญ ("undefined ต้องคงเป็น undefined ห้ามเปลี่ยนเป็น 'selected'") ไปไว้ตรงนั้น · ลบฟังก์ชัน
- **ตรวจหลังแก้:** frontend `tsc -b`, `eslint .`, `build` · ลองกด "เริ่มอาการนี้ใหม่" ทั้งกรณีมาจากหน้าเลือกรุ่นและจากรายการทุกรุ่น
- **ขนาด/ประโยชน์:** เล็ก / ลดชั้นที่ต้องตามไปอ่าน

### C-15 · ระดับ 2 · `historyModelName` เรียก `manualTitle` ต่ออย่างเดียว
- **ไฟล์:บรรทัด:** `frontend/src/lib/historyView.ts:37-40` · ผู้เรียก `components/history/HistoryRow.tsx:41`, `pages/HistoryDetailPage.tsx:109, 147`
- **ปัญหา:** ตัวห่อที่ไม่ได้ทำอะไรเพิ่ม (comment ของมันบอกเองว่า "ใช้กฎเดียวกับหน้าอื่น")
- **หลักฐาน:** `historyView.ts:38-39` คืน `manualTitle(graph)` ตรงๆ · หน้าอื่นเรียก `manualTitle` ตรงอยู่แล้ว (`DevicesPage.tsx:148`, `SessionPage.tsx:130`)
- **วิธีแก้:** ผู้เรียก 3 จุด import `manualTitle` จาก `lib/models` แทน แล้วลบ `historyModelName` และ import `manualTitle` ใน `historyView.ts`
- **ตรวจหลังแก้:** frontend `tsc -b`, `eslint .`, `build`
- **ขนาด/ประโยชน์:** เล็ก / ทั้งแอปเหลือฟังก์ชันชื่อรุ่นตัวเดียว

### C-16 · ระดับ 2 · หน้าตรวจอาการหา "ผังของ session นี้" ซ้ำสองครั้ง
- **ไฟล์:บรรทัด:** `frontend/src/pages/SessionPage.tsx:42` (`currentSummary`) และ `:128` (`summary`)
- **ปัญหา:** ทั้งสองบรรทัดทำ `graphs.data?.find((graph) => graph.graphId === …graphId)` ผลเหมือนกัน (บรรทัด 128 ใช้ `graphId` จาก `session.data` ซึ่งเป็นค่าเดียวกับ `session.data?.graphId` ที่บรรทัด 42) คนอ่านจะสงสัยว่าต่างกันอย่างไร
- **หลักฐาน:** บรรทัด 128 ทำงานเฉพาะเมื่อ `session.data` มีค่า (หลัง `if` ที่ 103 และ 115) จึงได้ผลเท่ากับ `currentSummary`
- **วิธีแก้:** ใช้ `currentSummary` ตัวเดียว (หรือเปลี่ยนชื่อเป็น `summary` ที่บรรทัด 42) แล้วลบบรรทัด 128
- **ตรวจหลังแก้:** frontend `tsc -b`, `eslint .`, `build` · ดูหัวหน้าตรวจอาการว่ายังแสดงชื่ออาการ/รุ่นถูก
- **ขนาด/ประโยชน์:** เล็ก / ลดความกำกวม

### C-17 · ระดับ 2 · รายการประเภทเครื่องฝั่ง frontend ประกาศ 3 ที่
- **ไฟล์:บรรทัด:** `frontend/src/lib/historyParams.ts:24` (`CATEGORIES`) · `pages/DevicesPage.tsx:28` (`CATEGORY_ORDER`) · `lib/draftView.ts:200` (`DRAFT_DEVICE_CATEGORIES` เขียนสตริงเอง)
- **ปัญหา:** ถ้าเพิ่มประเภทเครื่องต้องแก้หลายที่ และ `draftView.ts` เขียนซ้ำเองแทนที่จะอ่านจาก `DEVICE_CATEGORY_LABELS`
- **หลักฐาน:** ทั้งสามมีลำดับเดียวกัน (Air Conditioner, Microwave, Refrigerator, Washing Machine, Television) — ตรงกับลำดับ key ของ `lib/labels.ts:4-10` · `UploadDraftForm.tsx:153` ใช้ลำดับนี้แสดงตัวเลือก
- **วิธีแก้:** เพิ่ม `export const DEVICE_CATEGORIES = Object.keys(DEVICE_CATEGORY_LABELS) as DeviceCategory[]` ใน `labels.ts` แล้วให้ 3 ที่ใช้ตัวนี้ · ลำดับตัวเลือกบนหน้าจอเหมือนเดิม
- **ตรวจหลังแก้:** frontend `tsc -b`, `eslint .`, `build` · ดูหน้าเลือกเครื่อง, ตัวกรองประวัติ, ฟอร์มอัปโหลดร่างว่าลำดับเหมือนเดิม
- **ขนาด/ประโยชน์:** เล็ก / แหล่งความจริงเดียว

### C-18 · ระดับ 2 · `catch()` ของ exception filter 6 ตัวเขียนซ้ำกัน
- **ไฟล์:บรรทัด:** `traversal/traversal.exception.filter.ts:123-142` · `history/history.exception.filter.ts:33-49` · `auth/auth.exception.filter.ts:65-81` · `admin/admin.exception.filter.ts:24-38` · `authoring/drafts.exception.filter.ts:56-70` · `symptom-search/symptom-search.exception.filter.ts:45-61`
- **ปัญหา:** ทุกตัวทำ 3 อย่างเหมือนกัน: แปลง error → body, log ถ้า 500, เขียน response · ต่างกันแค่ฟังก์ชันแปลง
- **หลักฐาน:** อ่านโค้ดทั้ง 6 ไฟล์ · จุดต่างจุดเดียว: symptom-search ใช้ `=== 500` ที่อื่นใช้ `>= 500` แต่ตัวแปลงของ symptom-search คืนได้แค่ 400/503/500 (`:32-42`) จึงได้ผลเท่ากัน
- **วิธีแก้:** เพิ่มฟังก์ชัน `sendErrorBody(host, logger, exception, body)` ใน `traversal.exception.filter.ts` (ที่เก็บ `ApiErrorBody` อยู่แล้ว) แล้วให้ `catch()` ทุกตัวเหลือ 1 บรรทัด · **ฟังก์ชันแปลง `to…ErrorBody` ไม่แตะ** (ตาราง error code เดิมทั้งหมด)
- **ข้อควรระวัง:** filter เป็นตัวแปลง 401/403 ของ guard — ถ้าพลาดอาจกลายเป็น 500 · ก่อนแก้ควรมีเทสต์ HTTP ขั้นต่ำ (ดูหัวข้อ 5) หรืออย่างน้อยยิงด้วยมือ: `GET /admin/feedback` ไม่มี token → 401, token user → 403, `POST /traversal/sessions` body ผิด → 400 `INVALID_ACTION`
- **ตรวจหลังแก้:** backend `tsc --noEmit`, `build` + ยิงด้วยมือตามข้างบนบน localhost
- **ขนาด/ประโยชน์:** กลาง / ลด ~60 บรรทัด และเห็นชัดว่าแต่ละโมดูลต่างกันแค่ตารางแปลง

### C-19 · ระดับ 2 (ทางเลือก) · คลาส `LINK_CLASSES` เดียวกันประกาศ 5 ไฟล์
- **ไฟล์:บรรทัด:** `pages/AdminDraftReviewPage.tsx:16`, `AllSymptomsPage.tsx:26`, `HistoryDetailPage.tsx:32`, `HistoryPage.tsx:27`, `SymptomsPage.tsx:33` (+ เขียนตรงใน `ForbiddenPage.tsx:12,15`, `NotFoundPage.tsx:15,18`, `LoginPage.tsx:105`, `RegisterPage.tsx:100,116`, `AdminDraftsPage.tsx:64`)
- **ปัญหา:** สตริงเดียวกัน `'text-accent underline-offset-4 hover:underline'` กระจาย 11 ไฟล์
- **วิธีแก้:** export ค่าคงที่เดียว (เช่น `components/ui/linkClasses.ts`) · **ประโยชน์น้อย** ทำเฉพาะถ้าต้องการ
- **ตรวจหลังแก้:** frontend `tsc -b`, `eslint .`, `build`
- **ขนาด/ประโยชน์:** เล็ก / น้อย

### C-20 · ระดับ 2 (ทางเลือก) · หัวหน้า admin ซ้ำ 4 หน้า
- **ไฟล์:บรรทัด:** `AdminAnalyticsPage.tsx:47-52`, `AdminFeedbackPage.tsx:48-53`, `AdminDraftsPage.tsx:23-28`, `AdminDraftReviewPage.tsx:32-41`
- **ปัญหา:** `<h1>ผู้ดูแลระบบ</h1>` + คำอธิบาย + `<AdminTabs />` ซ้ำทุกหน้า
- **วิธีแก้:** คอมโพเนนต์ `AdminHeader({ description })` ที่รวม `AdminTabs` · **ประโยชน์น้อย** (4 จุด)
- **ตรวจหลังแก้:** frontend `tsc -b`, `eslint .`, `build` + ดูทั้ง 4 หน้า
- **ขนาด/ประโยชน์:** เล็ก / น้อย

> หมายเหตุการนับ: ระดับ 2 มี 9 รายการ (C-12 ถึง C-20) — C-19, C-20 เป็นทางเลือก

---

## 4. ชุดงาน (เรียงจากปลอดภัย + คุ้มที่สุด)

| ชุด | รายการ | ฝั่ง | ตรวจด้วย | เหตุผลของลำดับ |
|---|---|---|---|---|
| **ชุด 1** | C-01, C-02, C-10, C-11 | frontend | `tsc -b`, `eslint .`, `build` + ดูหน้าตรวจอาการ | ลบของตาย + ทำหน้าหลักอ่านง่าย ไม่มีความเสี่ยง |
| **ชุด 2** | C-03, C-04, C-05, C-06, C-07, C-08 | backend (comment/ชื่อ/type) | `tsc --noEmit`, `build` | comment ที่อ้างเทสต์ซึ่งไม่มีแล้วทำให้เข้าใจผิดเรื่องความครอบคลุม |
| **ชุด 3** | C-09 | git | `git status`, `git check-ignore` | กันรั่วซ้ำ (เจ้าของรัน `git rm --cached` เอง) |
| ชุด 4 | C-14, C-15, C-16 | frontend (ตัวห่อ/ของซ้ำ) | `tsc -b`, `eslint .`, `build` + กดเริ่มใหม่ | ลดชั้นที่ต้องตามอ่าน ผลกระทบแคบ |
| ชุด 5 | C-12, C-13 | frontend (ย้าย/รวมคอมโพเนนต์) | `tsc -b`, `eslint .`, `build` + เปิดทุกหน้า | แตะหลายไฟล์ แต่เปลี่ยนแค่ import/ชื่อ tag |
| ชุด 6 | C-17 (+ C-19, C-20 ถ้าต้องการ) | frontend (ค่าคงที่) | `tsc -b`, `eslint .`, `build` | ประโยชน์รองลงมา |
| ชุด 7 | C-18 | backend (filter) | `tsc --noEmit`, `build` + ยิง 401/403/400 ด้วยมือ | แตะเส้นทาง error ของทุกโมดูล — ทำหลังสุด หรือหลังมีเทสต์ HTTP |

**แนะนำให้เริ่ม:** ชุด 1 → ชุด 2 → ชุด 4 (ส่วนชุด 3 ควรทำทันทีที่ตัดสินใจเรื่องหัวข้อ 7)

---

## 5. ระดับ 3 ที่ยังไม่แตะ (รายงานอย่างเดียว + เทสต์ที่ควรมีก่อน)

| รหัส | ไฟล์:บรรทัด | สิ่งที่เห็นว่าทำให้ง่ายขึ้นได้ | ทำไมเป็นระดับ 3 | เทสต์ที่ต้องมีก่อนแตะ |
|---|---|---|---|---|
| L3-01 | `backend/src/traversal-engine/traversal-engine.ts:76-127` | `resolveNextNode` อ่านง่ายอยู่แล้ว — **ไม่ต้องแก้** · ข้อความ error ใน `types.ts:133` ยังอ้าง "validate_graph.py" แต่เป็นข้อความที่ส่งออกใน response 500 จึงห้ามแก้ (API body) | engine + safety gate | unit test ทุกชนิด node: checkpoint yes/no, instruction ปกติ `continue`, instruction `safety_critical` + `continue` → `SafetyConfirmationRequiredError` และ + `confirm_safety` ผ่าน, input ผ่าน/ไม่ผ่าน pattern/ไม่มี `on_invalid`, node จบรับ action ไม่ได้, session completed → error, `{{var}}` แทนค่า · เดินทุกเส้นทางของผังจริง 644 ผังต้องจบที่ terminal |
| L3-02 | `backend/src/rephrase/rephrase-guard.ts:26-61` | โครงสร้างเรียบอยู่แล้ว — **ไม่ต้องแก้** | rephrase-guard | ตารางเคส: ตัวเลขต่าง/เลขไทย, ชื่อเฉพาะขาด/เกิน, จำนวน "ไม่" ต่าง (และ "หรือไม่" ไม่นับ), ความยาว 0.5/1.6, ลิงก์, markdown, หลายย่อหน้า |
| L3-03 | `backend/src/auth/session-owner.ts:54-59` · `history/history.store.ts:80, 96, 132` · `traversal/session.store.ts:187-195` | `${where.sql}` ต่อสตริงเข้า SQL (เป็นค่าคงที่ ปลอดภัย) — อ่านยากสำหรับมือใหม่ แต่ห้ามแก้ | ตรวจเจ้าของ + SQL | pool ปลอมที่จับ SQL+params: user A อ่าน/ลบของ B ไม่ได้ (404), guest ไม่เห็นของ user แม้ client_id เดียวกัน, ไม่ส่ง X-Client-Id → 400 |
| L3-04 | `backend/src/traversal/traversal.service.ts:249-262` | `authorize` ตรวจเฉพาะ session ของ user — session ของ guest ยังใช้ UUID เป็นกุญแจ (ตั้งใจ) | ตรวจเจ้าของ | GET/actions/outcome: session ของ user ไม่มี token/คนอื่น → 404, guest ทำงานเหมือนเดิม |
| L3-05 | `backend/src/traversal/session.store.ts:109-163` | ส่ง action พร้อมกันได้ 500 (ควรมี `WHERE current_node_id = ?`) — เป็นการ**เปลี่ยนพฤติกรรม** ไม่ใช่เก็บกวาด | SQL | สองคำขอพร้อมกันกับ pool ปลอม → 1 สำเร็จ 1 ได้ 409 และ `session_history` ไม่ซ้ำ |
| L3-06 | `backend/src/traversal/graph.repository.ts:123-175` | `loadAll` ยาว 50 บรรทัด แยกเป็น `groupNodesByGraph` + `buildMaps` ได้ | โหลดผังตอนบูต | โหลดข้อมูลจริง 644 ผังผ่าน pool ปลอม (อ่าน `data/manuals`) แล้วเทียบกับ JSON ต้นฉบับทีละฟิลด์ + กรณีข้อมูลเสีย throw และ Map เดิมไม่เปลี่ยน |
| L3-07 | `backend/scripts/seed-graphs.js:20-76` vs `backend/src/authoring/graph-validator.ts:161` | ตรวจผังสองชุดกฎ (seed ตรวจ 4 ข้อ, validator ตรวจ 30+ ข้อ) — รวมให้ seed ใช้ validator จะทำให้ seed **เข้มขึ้น** = เปลี่ยนพฤติกรรม | SQL + ข้อมูลเข้า DB | validator โหมด `existing` กับ `data/manuals` ทั้ง 22 ไฟล์ต้องผ่าน 0 error ก่อน · seed แบบ dry-run (ไม่ต่อ DB) |
| L3-08 | `backend/src/authoring/graph-validator.ts:287-378` (`validateNode` ~90 บรรทัด), `:392-484` (`validateStructure` ~90 บรรทัด) | ยาว แยกเป็นฟังก์ชันย่อยตามกลุ่มกฎได้ | ตัดสินว่าผังที่ LLM ร่างเผยแพร่ได้ไหม (รวมกฎ safety placement) | 644 ผังจริงโหมด `existing` ผ่านทั้งหมด + ชุดผังผิดทีละกฎ (ทุก error/warning code 32 แบบ) ได้ code เดิม |
| L3-09 | `backend/src/authoring/drafts.service.ts:256-286` + `drafts.store.ts:246-282` | publish อ่านง่ายแล้ว — **ไม่ต้องแก้** | SQL + transaction + กฎ publish | error ≥ 1 → 409 ไม่เขียนอะไร, warning ไม่ ack → 409, id ชน → 409, สำเร็จ → INSERT ครบ 3 ตาราง + reload |
| L3-10 | `backend/src/traversal/traversal.exception.filter.ts:65, 120` · `health/health.controller.ts:27, 34` | 500 ส่ง `exception.message` (อาจเป็นข้อความ MySQL) และ `/health` ส่ง `databaseError` — ควรซ่อน แต่เป็นการ**เปลี่ยน response body** จึงอยู่นอกขอบเขตรอบนี้ | API contract | HTTP test ว่า 500 ตอบ `{statusCode:500, code:'INTERNAL_ERROR', message:<ข้อความทั่วไป>}` |

**แหล่งเทสต์ที่กู้ได้:** เทสต์เก่าที่ถูก track อยู่ใน commit `61c3fb0` (เช่น `backend/src/history/history-ownership.spec.ts`, `traversal/traversal-ownership.spec.ts`, `auth/*.spec.ts`, `admin/admin-http.spec.ts`, `frontend/src/**/*.test.tsx`) — กู้ได้ด้วย `git checkout 61c3fb0 -- <ไฟล์>` · เทสต์ engine/rephrase อยู่ใน `draft/code/backend/tests*` (ยังไม่เคยนำเข้า ต้องปรับให้เข้ากับโค้ดปัจจุบัน) · เทสต์ของ Step 5 (authoring) **ไม่เคย commit จึงกู้ไม่ได้**

---

## 6. ที่ไม่แน่ใจ (ต้องถามเจ้าของ) และสิ่งที่ "ไม่แนะนำ" ให้แก้

### 6.1 ต้องถามก่อน

| # | อะไร | หลักฐาน | คำถาม |
|---|---|---|---|
| U-01 | `jest`, `ts-jest`, `@types/jest` (backend) · `vitest` (frontend) · `"types": ["node", "jest"]` ใน `backend/tsconfig.json:4` · script `test` | ไม่มีไฟล์เทสต์แล้ว | จะกู้/เขียนเทสต์ใหม่ไหม? ถ้าใช่ **เก็บไว้** (แนะนำ) · ถ้าไม่ ถอดได้ (ต้องขออนุมัติถอด dependency) |
| U-02 | `ts-node` (backend dependencies) | ค้น `ts-node` ใน `backend/src`, `backend/scripts`, `nest-cli.json`, `package.json` scripts → ไม่พบการใช้ | ถอดได้ไหม (มีผลกับ `npm ci` บน Render เท่านั้น) |
| U-03 | `@nestjs/schematics` | ใช้โดย `nest generate` (`nest-cli.json:3` อ้าง `collection`) ไม่ใช้ตอน build/รัน | ยังใช้ `nest g` สร้างไฟล์ไหม |
| U-04 | `@types/multer` (devDependencies) | ไม่มีไฟล์ไหนอ้าง type `Express.Multer` (`drafts.controller.ts:43` ประกาศ type เอง) · **ไม่แน่ใจ** ว่า type ของ `FileInterceptor` ใน `@nestjs/platform-express` ต้องใช้หรือไม่ (ต้องลองถอดแล้ว `tsc` ซึ่งเป็นการถอด dependency) | อนุญาตให้ลองไหม |
| U-05 | `GET /admin/sessions` | มี endpoint (`admin.controller.ts:47-50`) แต่ไม่มีหน้าจอเรียก | จะทำหน้าจอ หรือคงไว้ใช้ด้วยมือ (ห้ามลบเพราะเป็น API contract) |
| U-06 | `backend/scripts/try-rephrase.js` | ไม่อยู่ใน npm scripts แต่ `docs/features/LLM-INTEGRATION.md:187` และ `docs/reference/FILES-BACKEND.md:330` สอนให้ใช้ | ยังใช้ลอง Groq ด้วยมือไหม (ถ้าใช่ เก็บไว้) |
| U-07 | `scripts/old/` (3 ไฟล์ Python) และ `check/*.html` (7 ไฟล์) | สคริปต์รุ่นเก่าและผลตรวจ chunk · ไม่มีโค้ดอ้าง | เก็บเป็นหลักฐานในรายงานไหม |
| U-08 | `AdminService.nowEpoch` เป็น field สาธารณะ (`admin.service.ts:52`) | ทำไว้ให้เทสต์เปลี่ยนนาฬิกา | ถ้าจะกู้เทสต์ admin ให้คงไว้ · ถ้าไม่ ทำเป็นการเรียก `Date.now()` ตรงได้ |
| U-09 | export ที่ถูกใช้แค่ในไฟล์ตัวเอง ~110 ตัว (เช่น `buildJwtOptions`, `maxPdfBytes`, `chunkPages`, `to…ErrorBody`, `extractNumbers`, `cosineSimilarity`, `parseStoredAuth`, `matchesPattern`) | สคริปต์ค้น export: ไม่มีไฟล์อื่นอ้าง · เกือบทั้งหมด export ไว้ให้เทสต์ที่ลบไป | **แนะนำไม่ลบคำว่า export** เพราะถ้ากู้เทสต์จะต้องใส่กลับ · ยืนยันไหม |
| U-10 | `draft/` (รายงานอย่างเดียว ไม่แก้) | มีเทสต์ 22 ไฟล์ที่ไม่ถูกรัน, `draft/code/backend/scripts/validate-graphs.js` (ถูกแทนด้วย `graph-validator.ts` แล้ว), patch `0002-health-hide-database-error` (ยังไม่ได้ใช้ ตรงกับ L3-10), `draft/frontend-phase3/` (ล้าสมัยตาม `docs/archive/HANDOFF.md`), `draft/tools/query-collector.html` | จะนำเข้าหรือเก็บเป็นหลักฐานประกอบรายงาน |

### 6.2 เห็นแล้วแต่ไม่แนะนำให้แก้ (เหตุผล)

| อะไร | ทำไมไม่แก้ |
|---|---|
| `normalizeComment` / `normalizeOutcome` / `normalizeQuery` (แค่ `trim()`) ใน `lib/feedback.ts:15`, `lib/outcome.ts:3`, `lib/search.ts:15` | สั้นและชื่อบอกเจตนาว่า "ทำเหมือนเซิร์ฟเวอร์" ลบแล้วไม่ได้อ่านง่ายขึ้น |
| `asObject` / `asRecord` เขียนแยกในแต่ละ DTO (`traversal.dto.ts:67`, `auth.dto.ts:62`, `admin.dto.ts:47`, `drafts.dto.ts:28`) และ `parseOutcomeBody` ที่ตรวจ object เอง (`traversal.dto.ts:180`) | แต่ละตัวโยน error คนละคลาส = **error code คนละตัว** (`INVALID_ACTION`, `INVALID_OUTCOME`, `INVALID_AUTH_REQUEST` …) รวมกันเสี่ยงเปลี่ยน code |
| ตัวช่วยแปลง epoch → ISO ซ้ำ (`admin.service.ts:37`, `drafts.service.ts:50`, `auth.service.ts:46`, `history.service.ts:183, 213`) และ `round3` (`admin.service.ts:38`, `symptom-search.service.ts:35`) | บรรทัดเดียว ย้ายไปไฟล์กลางแล้วต้องตามไปอ่านอีกไฟล์ ไม่คุ้ม |
| `DEVICE_CATEGORIES` ซ้ำฝั่ง backend (`history/history.dto.ts:28` vs `authoring/graph-validator.ts:46`) | ให้ history import จาก authoring จะสร้างการพึ่งข้ามโมดูลที่แปลก และ `graph-validator.ts` เป็นโซนระดับ 3 |
| `SymptomsErrorNotice` แสดง HTTP status แทนข้อความจาก `describeError` (`components/SymptomsErrorNotice.tsx:27`) | รวมกับ `ErrorNotice` จะเปลี่ยนข้อความบนหน้าจอ = เปลี่ยนพฤติกรรมที่ผู้ใช้เห็น |
| `LoginPage` กับ `RegisterPage` คล้ายกัน | ต่างกันพอสมควร (ฟิลด์, ปลายทางหลังสำเร็จ, ลิงก์ EMAIL_TAKEN) รวมแล้วอ่านยากขึ้น |
| `SessionErrorNotice` กับ `HistoryErrorNotice` คล้ายกัน | ปุ่ม/ลิงก์ต่างกัน (`/symptoms` vs `/symptoms/all`, มี `role="alert"` หรือไม่) รวมแล้วเปลี่ยนพฤติกรรม |
| `DevicesPage.tsx:42` `DEVICE_CATEGORY_LABELS[category] ?? ''` | `?? ''` เกินจำเป็น แต่เล็กมาก ไม่คุ้มเปิดไฟล์ |

---

## 7. เรื่องด่วนที่พบระหว่างสำรวจ (ไม่ใช่การเก็บกวาดโค้ด — ต้องตัดสินใจเอง)

- `git log` แสดง HEAD = `76c0911 add all` และ `git branch -r --contains HEAD` → **`origin/main` มี commit นี้แล้ว**
- `git ls-files` มี `backup/backup_before_011.sql` และ `backend/backup_before_012.sql` ซึ่ง (จากการนับชื่อตาราง ไม่ได้พิมพ์ค่า) มี `INSERT INTO users` = **อีเมลและ bcrypt hash ของผู้ใช้ขึ้น GitHub แล้ว** รวมถึงแถว `sessions` (มี `client_id`) และชื่อโฮสต์ Aiven
- สิ่งที่ควรพิจารณา (ผมไม่ทำเองเพราะเป็นงานที่ย้อนกลับไม่ได้/แตะภายนอก):
  1. เช็กว่า repo เป็นสาธารณะไหม (GitHub → Settings) ถ้าใช่ พิจารณาตั้งเป็น private ชั่วคราว
  2. เปลี่ยนรหัสผ่านของบัญชีที่อยู่ใน dump (โดยเฉพาะ admin) และรหัสผ่าน Aiven
  3. ตัดสินใจว่าจะเขียนประวัติ git ใหม่เพื่อลบไฟล์ (เช่น `git filter-repo`) หรือไม่ — เป็นงานทำลายประวัติ ต้อง force push
  4. ทำชุด 3 (C-09) เพื่อกันไม่ให้เกิดซ้ำ
