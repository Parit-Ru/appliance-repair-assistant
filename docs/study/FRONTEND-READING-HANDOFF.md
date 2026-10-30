# Handoff: อ่านโค้ด frontend (ฉบับส่งต่อ)

> เขียนเมื่อ 26 ต.ค. 2569 · ผู้อ่านคือ session ถัดไปของ Claude (หรือผู้ใช้เองตอนกลับมาอ่าน) ที่ต้องพาผู้ใช้อ่าน `frontend/src` ต่อ
> **ผู้ใช้:** นักศึกษาปี 4 เตรียมสอบโปรเจกต์จบ อ่านโค้ดเพื่อเข้าใจและอธิบายได้ ตอบเป็นภาษาไทย อธิบายแบบมือใหม่
> **สถานะ:** backend อ่านแล้ว 46/50 ไฟล์ · frontend **ยังไม่ได้อ่านแบบไล่ทีละไฟล์** (เคยผ่านตาเฉพาะไฟล์ที่อยู่บนเส้นทางของ user journey ช่วง 1–9)

---

## 1. ข้อตกลงที่ต้องทำตาม (อย่าให้พลาด)
- ตอบเป็นภาษาไทย ศัพท์เทคนิคอธิบายเป็นคำพูดง่ายๆ ก่อน แล้วค่อยใส่ชื่อ
- UI ภาษาไทยใช้คำว่า **"แผนผังขั้นตอน"** ไม่ใช้ "กราฟ"
- **ห้ามอ่านหรือพิมพ์ค่าใน `backend/.env`** · ห้ามแตะ `troubleshoot-assistantv2`
- ไม่ commit/push เอง (ผู้ใช้ commit เอง) · ไม่แตะ `package.json`, migrations/schema ถ้าไม่ได้รับอนุญาต · ไม่เพิ่มไลบรารีใหม่ในโปรเจกต์
- ไม่แก้ `draft/`, `check/`, `scripts/old/`, `docs/reference/`, `docs/archive/`, `docs/draft/`
- ก่อนแก้ไฟล์ตรวจ CRLF/LF แล้วคงรูปแบบเดิม (`READING-PROGRESS.md` เป็น CRLF)
- **ตอนอ่านโค้ด ผู้ใช้อ่านอย่างเดียว ไม่ต้องแก้โค้ด** ถ้าเจอจุดผิดให้จดเป็นข้อสังเกต แก้เมื่อผู้ใช้สั่งเท่านั้น
- รายงานตรงๆ ว่า "เทียบอะไรแล้ว / อะไรไม่ได้ทดสอบ"
- ผู้ใช้ **ลบคอมเมนต์ในโค้ดหลังอ่านแล้ว** เลขบรรทัดในเอกสารเก่าจึงเลื่อน ให้ grep/อ่านไฟล์จริงก่อนอ้างเลขบรรทัดเสมอ และระวังแท็บ VS Code เก่าที่อาจเซฟทับ

## 2. รูปแบบการสอนที่ผู้ใช้ชอบ
- **ขั้นต่อขั้น เป็น bullet ไม่ใช้ตาราง** ใส่ `ไฟล์:บรรทัด` ในตัวข้อความ โค้ด SQL/โค้ดสำคัญเป็น code block
- โครงต่อ 1 หัวข้อ: ภาพรวม → ขั้นตอน → ข้อสังเกต → เฉลยคำถาม → ที่ไม่ได้ทดสอบ
- **คำถามทดสอบให้เฉลยทันที** ไม่ปล่อยค้าง
- ไฟล์ที่ผู้ใช้สั่ง "mark ไว้ สำคัญ ควรกลับมาอ่าน" ให้บันทึกใน `docs/study/READING-PROGRESS.md` (🔖/⭐)
- ผู้ใช้ชอบให้เก็บเนื้อหาเป็นไฟล์ใน `docs/study/` เพื่อกลับมาอ่านและจดเอง
- ถ้าผู้ใช้บอก "งงๆ" ให้อธิบายใหม่ละเอียดขึ้นด้วยตัวอย่าง ไม่ใช่ทวนเดิม
- ผู้ใช้ขอแล้วว่า "ไปต่อ" = ไปไฟล์ถัดไปทันที ไม่ต้องถามซ้ำ

## 3. สิ่งที่ทำไปแล้ว (อ้างอิง)
- `docs/study/JOURNEY-ALL-1-9.md` / `.pdf` (35 หน้า) = เส้นทางผู้ใช้ช่วง 1–9 ผ่าน frontend และ backend ช่วง 1, 2, 8, 9 เลขบรรทัดเทียบแล้ว ช่วง 3–7 ยังต้องเทียบใหม่
- `docs/study/BACKEND-FILES-EXPRESS.md` = สรุป backend 50 ไฟล์
- `docs/study/QA-WALKTHROUGH-BACKEND.md` = ถามตอบ 87 ข้อ
- `docs/study/READING-PROGRESS.md` = ตารางความคืบหน้าและรายการ 🔖
- `docs/FRONTEND_REVIEW.md` = รายงานตรวจ frontend (26 ต.ค.) · ทำแล้วกลุ่ม 1–3: รวม className ซ้ำ (`LINK_CLASSES` ฯลฯ) + แก้ eslint, รวม `Session` เข้า `StoredAuth`, รวม `outcome.ts` เข้า `textInput.ts` · **เลขบรรทัดของ `api/auth.ts`, `authStorage.ts`, `AuthProvider.tsx`, `textInput.ts` เปลี่ยนแล้ว** ให้เปิดไฟล์จริงก่อนอ้าง

## 4. สิ่งที่ frontend ใช้ (เช็คจาก `frontend/package.json`)
- React 19, React Router 7, TanStack Query 5, Vite 8, TypeScript, Tailwind 3, Vitest
- **ไม่มี** state library แยก (ไม่มี zustand/redux) · ไม่มีไลบรารีฟอร์มหรือ validation (ตรวจเองใน `lib/`)
- สคริปต์: `dev`, `build` (`tsc -b && vite build`), `test` (`vitest run`), `deploy` (gh-pages)
- ผมค้นไฟล์ใน `src` พบ **ไม่มีไฟล์ `*.test.*`** (ค้นเฉพาะใน `src` ตอนเขียนเอกสารนี้) ถ้าจะอ่านเรื่องเทสต์ให้หาที่อื่นก่อน

## 5. รายการไฟล์ใน `frontend/src` (86 ไฟล์ / 5,935 บรรทัด ตรวจจากดิสก์ 26 ต.ค. หลังรอบ simplify frontend กลุ่ม 1–3)
คำอธิบายหน้าที่ของไฟล์ที่มีเครื่องหมาย ✔ เคยอ่านในการเดิน user journey แล้ว ส่วนไฟล์ที่มีเครื่องหมาย ? **สรุปจากชื่อไฟล์และตำแหน่ง ยังไม่ได้เปิดอ่านจริง** ต้องเปิดยืนยันก่อนสอน

### ชั้นที่ 1: จุดเริ่มต้น
- `main.tsx` (10) ? จุดเริ่มแอป ครอบ provider ต่างๆ
- `App.tsx` (58) ✔ ตาราง route ทั้งหมด (`/login`, `/register`, `/history`, `/admin/*` ฯลฯ) `/admin/*` ครอบด้วย `AdminRoute`
- `index.css` (9), `env.d.ts` (8) ? สไตล์พื้นฐานและชนิดของตัวแปร env

### ชั้นที่ 2: ติดต่อ backend (`src/api/`)
- `http.ts` (86) ✔ ประตูเดียวที่ยิง `fetch` ประกอบ URL, แนบ token, จัดการ 401/error (`ApiError`)
- `auth.ts` (33) ✔ login/register/getMe + แปลงผลเป็น `StoredAuth` (type ตัวเดียวกับที่ `authStorage.ts` เก็บ · `toStoredAuth` `:9-11`, `toAuthUser` `:5-7`)
- `history.ts` (35) ✔ list/get/delete/submitFeedback
- `traversal.ts` (75) ✔ เริ่ม session / ส่ง action / บันทึกผล / ยกเลิก
- `admin.ts` (22) ✔ feedback list + analytics summary
- `drafts.ts` (45) ? API ของระบบร่างผังจาก PDF (ฝั่ง admin)
- `queries.ts` (233) ✔ hook ของ TanStack Query ทั้งหมด (`useHistory`, `useSubmitFeedback`, `useAdminSummary` ...) ⭐ ไฟล์กลาง เปิดแล้วเห็นว่าหน้าไหนเรียกอะไร
- `types.ts` (290) ? ชนิดข้อมูลที่ตรงกับ response ของ backend ควรอ่านคู่กับ DTO ฝั่ง backend

### ชั้นที่ 3: ตัวช่วยที่ไม่ใช่หน้าจอ (`src/lib/`)
- `authContext.ts` (30) ✔ context + `useAuth` + `useIdentity` (id ผู้ใช้หรือ `'guest'`)
- `authStorage.ts` (62) ✔ เก็บ token ใน localStorage + สำเนาในหน่วยความจำ
- `authForm.ts` (53) ✔ ตรวจฟอร์มสมัคร/ล็อกอินฝั่งหน้าจอ
- `authRedirect.ts` (17) ? `safeNext`, `loginUrl` (ป้องกันเด้งไปหน้าที่ไม่ปลอดภัย)
- `clientId.ts` (40), `clientHeaders.ts` (6) ✔/? `X-Client-Id` ของ guest และ `ownerHeaders()`
- `textInput.ts` (35) ✔ ตรวจข้อความ 3 ช่อง (ค้นหา 200 · บันทึกผล 1,000 · ความเห็น 500) ด้วย `checkText(raw, max)` + `formatCounter(raw, max)` ชุดเดียว · `toFeedback`, `isSameFeedback` (ไฟล์ `outcome.ts` ถูกรวมเข้าไฟล์นี้แล้ว)
- `errors.ts` (272) ? แปลง error เป็นข้อความไทย (ไฟล์ใหญ่สุดของ lib)
- `draftView.ts` (222) ? ตัวช่วยแสดงผลหน้าร่างผัง (admin)
- `adminParams.ts` (54), `adminView.ts` (49), `historyView.ts` (34) ✔/? ตัวช่วยของหน้า admin และประวัติ
- `symptoms.ts` (57), `labels.ts` (44), `trail.ts` (31), `modelSelection.ts` (50), `models.ts` (32), `useStartSymptom.ts` (21), `useSlowWait.ts` (18) ? เกี่ยวกับเลือกเครื่อง/รุ่น ค้นอาการ ป้ายชื่อ และการรอ server ช้า

### ชั้นที่ 4: หน้า (`src/pages/`) เรียงตามเส้นทางผู้ใช้
- `HomePage` (21), `DevicesPage` (146), `SymptomsPage` (89), `AllSymptomsPage` (112) ? เลือกเครื่อง/รุ่น และอาการ (ช่วง 3–4)
- `SessionPage` (175) ✔ หน้าเดินผังทีละขั้น (ช่วง 5–6) ⭐
- `LoginPage` (94), `RegisterPage` (103) ✔ (ช่วง 1–2)
- `HistoryPage` (102), `HistoryDetailPage` (215) ✔ (ช่วง 7–8)
- `AdminAnalyticsPage` (131), `AdminFeedbackPage` (158) ✔ (ช่วง 9)
- `AdminDraftsPage` (88), `AdminDraftReviewPage` (114) ? หน้า admin ของระบบร่างผัง
- `ForbiddenPage` (22), `NotFoundPage` (25) ? หน้าไม่มีสิทธิ์ / ไม่พบ

### ชั้นที่ 5: ส่วนประกอบหน้าจอ (`src/components/`)
- `layout/AppShell` (81 · export `NAV_ACTIVE`/`NAV_IDLE` ให้ `AdminTabs` ใช้ต่อ) ✔ เมนูหลัก/ปุ่มออกจากระบบ · `layout/ServerStatus` (36) ?
- `auth/AuthProvider` (105) ✔ · `auth/AdminRoute` (41) ✔ · `auth/TextField` (56 · export `FIELD_CLASSES`) ?
- `step/` ? ส่วนแสดงขั้นของผัง: `StepView` (67) เลือกว่าจะแสดงชนิดไหน, `StepCard`, `InputStep`, `SafetyGateStep`, `OutcomeStep`, `PathRail`, `ReferenceLine`
- `history/` ✔/? `FeedbackButtons` (81) ✔, `HistoryRow` (77), `DeleteConfirm` (31), `Pagination` (28)
- `admin/` ? `StatCard`, `BarList`, `DailyBars`, `AdminTabs`
- `admin/drafts/` ? `UploadDraftForm` (189), `DraftGraphCard` (127), `DraftActions` (118), `DraftJsonEditor` (99), `ValidationReportPanel` (66), `DraftStatusBadge` (11)
- ส่วนประกอบรวม: `EquipmentPanel`, `SymptomSearchForm`, `SymptomSearchResults`, `SymptomRow`, `SessionHeader`, `OutcomeForm` ✔ (export `TEXTAREA_CLASSES` ให้ `FeedbackButtons` ใช้ต่อ), `TerminalActions`, `ErrorNotice`, `LoadingText`, `RephraseNote`, `SlowServerNotice`
- `ui/Button` (34 · export `LINK_CLASSES` คลาสลิงก์ตัวเดียวของทั้งแอป), `ui/Icon` (156), `ui/Notice` (54) ? ชิ้นส่วน UI พื้นฐาน

## 6. ลำดับการอ่านที่แนะนำ
1. **ภาพรวม:** `main.tsx` → `App.tsx` → `AppShell.tsx` (ดูโครงทั้งแอปก่อน)
2. **ชั้นติดต่อ backend:** `http.ts` → `auth.ts` → `queries.ts` → `types.ts` (ถ้าเข้าใจชั้นนี้ จะอ่านหน้าอื่นง่ายขึ้นมาก)
3. **ตัวตนผู้ใช้:** `authStorage.ts` → `authContext.ts` → `AuthProvider.tsx` → `AdminRoute.tsx` → `clientId.ts`/`clientHeaders.ts`
4. **เส้นทางหลัก:** `DevicesPage` → `SymptomsPage` (+ `SymptomSearchForm/Results`) → `SessionPage` (+ `components/step/*`) ⭐ ช่วง 5 ผู้ใช้ยังงง ควรอ่านละเอียด
5. **ประวัติและ feedback:** `HistoryPage` → `HistoryDetailPage` → `FeedbackButtons`
6. **admin:** `AdminAnalyticsPage` → `AdminFeedbackPage` → กลุ่ม drafts (ใหญ่ ทำทีหลัง)
7. **ท้ายสุด:** `errors.ts` (272 บรรทัด), `types.ts` (290), `draftView.ts` (222) ไฟล์ยาวแต่เป็นการแปลง/นิยาม ไม่ซับซ้อนเท่าตรรกะเส้นทางหลัก

## 7. คำถามที่ควรให้ผู้ใช้ตอบได้ก่อนสอบ (เริ่มจากที่เคยอธิบายแล้ว)
- ตัวตนของผู้ใช้ฝั่งหน้าจอมี 3 ชั้นคืออะไร (สถานะใน `AuthContext`, `useIdentity()` ใน key ของ React Query, `ownerHeaders()`)
- ทำไม `queryClient.clear()` ตอนล็อกอิน/ออกจากระบบ
- `request()` ใน `http.ts` ทำอะไรบ้างตามลำดับ และทำไม 401 ของการล็อกอินไม่เด้งไปหน้าล็อกอินซ้ำ
- หน้าเดินผังเอาข้อมูลจากไหน (แคชของ React Query vs ยิงไป server) ⭐ ช่วง 5
- `AdminRoute` กับ `requireAdmin` ต่างกันยังไง ใครเป็นตัวบังคับจริง

## 8. ข้อสังเกตที่เจอฝั่ง frontend แล้ว (ยังไม่แก้)
- กฎตรวจฟอร์ม (รหัสผ่าน 8–72, feedback 500 ตัวอักษร) คัดลอกมือจาก backend ต้องแก้ 2 ที่เมื่อเปลี่ยน
- token เก็บใน `localStorage` (เสี่ยง XSS) และไม่มี logout ฝั่ง server
- ให้คะแนนได้เฉพาะจากหน้ารายละเอียดประวัติ

## 9. วิธีเริ่ม session ถัดไป
1. อ่านไฟล์นี้ + `docs/study/READING-PROGRESS.md` + `docs/study/JOURNEY-ALL-1-9.md` (ถ้าต้องการบริบท)
2. ถามผู้ใช้ว่าจะเริ่มที่ขั้น 6.1 หรือไฟล์ไหน (ถ้าไม่ตอบ ให้เริ่ม `main.tsx` → `App.tsx`)
3. ก่อนสอนไฟล์ใด **เปิดไฟล์จริงและเช็คเลขบรรทัด** ห้ามใช้เลขจากเอกสารเก่า
4. หลังจบแต่ละไฟล์ ถ้าผู้ใช้ mark ไว้ให้เพิ่มลง `READING-PROGRESS.md` (CRLF)
5. ท้ายทุกคำตอบ บอกว่าไม่ได้ทดสอบอะไร (ส่วนใหญ่ไม่ได้รันเว็บ)
