# 08 — Frontend (React 19 + TanStack Query)

## อธิบายแบบง่าย
หน้าเว็บเป็น SPA ไม่มี Redux หรือ store กลาง ข้อมูลจากเซิร์ฟเวอร์ให้ TanStack Query จัดการ (โหลด, cache, error) ข้อมูลผู้ใช้ที่ล็อกอินอยู่ใน React Context ตัวเดียว ส่วนสถานะเล็กๆ ของหน้าใช้ `useState`

## 1. หน้าและ routing (`frontend/src/App.tsx:30-58`)

| Path | หน้า | สิทธิ์ | หน้าที่ |
|---|---|---|---|
| `/` | `HomePage` | ทุกคน | หน้าแรก |
| `/devices` | `DevicesPage` | ทุกคน | เลือกประเภทเครื่อง → รุ่น หรือ "ไม่ทราบรุ่น" (`pages/DevicesPage.tsx:91`) |
| `/symptoms` | `SymptomsPage` | ทุกคน | พิมพ์อาการค้นหา · ยังไม่เลือกรุ่น → redirect `/devices` (`pages/SymptomsPage.tsx:35`) |
| `/symptoms/all` | `AllSymptomsPage` | ทุกคน | รายการอาการทั้งหมดของรุ่น (ใช้เมื่อค้นไม่เจอ) |
| `/session/:sessionId` | `SessionPage` | ทุกคน (session ของ user ต้องเป็นเจ้าของ) | เดินผังทีละขั้น |
| `/history`, `/history/:sessionId` | `HistoryPage`, `HistoryDetailPage` | guest/user | ประวัติ + feedback + ลบ |
| `/login`, `/register` | `LoginPage`, `RegisterPage` | ทุกคน | บัญชี |
| `/admin` → `/admin/analytics` | `AdminAnalyticsPage` | admin (`AdminRoute`) | สถิติ |
| `/admin/feedback` | `AdminFeedbackPage` | admin | รายการ feedback |
| `/admin/drafts`, `/admin/drafts/:id` | `AdminDraftsPage`, `AdminDraftReviewPage` | admin | อัปโหลด PDF / ตรวจร่าง |
| `*` | `NotFoundPage` | — | 404 |

- `BrowserRouter basename={import.meta.env.BASE_URL}` + `base: '/appliance-repair-assistant/'` ตอน production (`frontend/vite.config.ts:24`)
- GitHub Pages ไม่มี rewrite จึงคัดลอก `index.html` เป็น `404.html` ตอน build ให้ refresh หน้าลึกได้ (`vite.config.ts:10-17`)
- `AppShell` = layout + เมนู + สถานะเซิร์ฟเวอร์ (`components/layout/AppShell.tsx`, `components/layout/ServerStatus.tsx:15` ใช้ `useHealth`)

## 2. TanStack Query (cache + invalidation) — `frontend/src/api/queries.ts`

- ค่าเริ่มต้น: `retry: false`, `refetchOnWindowFocus: false` (`App.tsx:21-28`) ไม่ให้ยิงซ้ำเองตอน Render หลับ
- **Query key มี identity ของผู้ใช้** เช่น `['session', identity, id]`, `['history', identity, 'list', page]` (`queries.ts:9-19, 58-65`) โดย `useIdentity()` = user id หรือ `'guest'` (`lib/authContext.ts:28-30`) → เปลี่ยนผู้ใช้แล้วไม่เห็นข้อมูลคนก่อน และ `AuthProvider` ยัง `queryClient.clear()` ทุกครั้งที่ login/logout/หมดอายุ (`components/auth/AuthProvider.tsx:58-66, 82-88`)

| Hook | ชนิด | cache / invalidation |
|---|---|---|
| `useManuals`, `useGraphs` | query | `staleTime: Infinity` (ข้อมูลแทบไม่เปลี่ยน) · invalidate หลัง publish ร่าง (`queries.ts:41-51, 228-231`) |
| `useHealth` | query | `staleTime: 30_000` |
| `useSymptomSearch` | **mutation** (ไม่ cache ผลค้นหา) | — (`:90-94`) |
| `useStartSession`, `useSubmitAction`, `useSubmitOutcome` | mutation | `setQueryData` ใส่ผลลง key ของ session ทันที → ไม่ต้อง GET ซ้ำ (`:96-130`) |
| `useAbandonSession` | mutation | `removeQueries` session นั้น (`:132-141`) |
| `useHistory(page)` | query | `placeholderData: keepPreviousData` เปลี่ยนหน้าแล้วไม่กระพริบ (`:58-65`) |
| `useDeleteHistory` | mutation | ลบ detail + session ออกจาก cache · invalidate รายการ (`:143-156`) |
| `useSubmitFeedback` | mutation | แก้ `feedback` ใน cache ของ detail ตรงๆ (`:159-170`) |
| `useAdminDrafts`, `useAdminDraft` | query | **poll ทุก 3 วินาที เฉพาะตอนมีร่าง `drafting`** (`:22-34`, `api/drafts.ts:4`) |
| `useUpload/Update/Reject/PublishDraft` | mutation | invalidate prefix `['admin', identity, 'drafts']` (`:182-232`) |

## 3. State management

| ชนิด state | เก็บที่ไหน | ตัวอย่าง |
|---|---|---|
| ข้อมูลจาก server | TanStack Query cache | session, ประวัติ, รายการรุ่น |
| ผู้ใช้ที่ล็อกอิน | React Context `AuthContext` + localStorage `fixstep.auth` | `components/auth/AuthProvider.tsx` · `lib/authStorage.ts` |
| guest id | localStorage `fixstep.clientId` (+ ตัวแปรในหน่วยความจำ) | `lib/clientId.ts` |
| รุ่นที่เลือก | URL query string (`manualId`, `selected/unknown`) | `lib/modelSelection.ts:7-27` |
| `modelSelection` ข้ามหน้า | `navigate(..., { state })` ของ router | `lib/useStartSymptom.ts:16` · `lib/modelSelection.ts:28` |
| เส้นทางที่เดินมา (trail) | `useState` ในหน้า session | `pages/SessionPage.tsx:41, 52` |
| กันกดซ้ำ | `useRef` (`isSendingRef`) — อัปเดตทันทีไม่รอ render | `SessionPage.tsx:42-57` |

## 4. Component สำคัญ

| Component | หน้าที่ | ไฟล์ |
|---|---|---|
| `StepView` | เลือกการแสดงผลตามชนิดโหนด: outcome / safety gate / checkpoint / input / instruction | `components/step/StepView.tsx:22-42` |
| `SafetyGateStep` | กล่องคำเตือนแดง + checkbox บังคับ ก่อนส่ง `confirm_safety` | `components/step/SafetyGateStep.tsx` |
| `InputStep` | กรอกรหัส error | `components/step/InputStep.tsx` |
| `OutcomeStep` + `OutcomeForm` + `TerminalActions` | ผลสุดท้าย, บันทึกข้อความผลลัพธ์, เริ่มใหม่/อาการอื่น | `components/step/OutcomeStep.tsx`, `components/OutcomeForm.tsx` |
| `ReferenceLine` | "ที่มาของขั้นตอนนี้: คู่มือ … หน้า …" + ปุ่มดูรหัสเอกสาร | `components/step/ReferenceLine.tsx:15-33` |
| `PathRail` | แสดงขั้นที่ผ่านมา | `components/step/PathRail.tsx` |
| `SessionHeader` | ชื่ออาการ/รุ่น + คะแนนความคล้าย (กำกับว่าเป็นข้อมูลประกอบ) + ปุ่มยกเลิก | `components/SessionHeader.tsx:33-36` |
| `EquipmentPanel` | อุปกรณ์ที่อาจต้องใช้ | `components/EquipmentPanel.tsx` |
| `RephraseNote` | บอกว่าข้อความถูกเรียบเรียง + ดูต้นฉบับ | `components/RephraseNote.tsx` |
| `SymptomSearchForm` / `SymptomSearchResults` / `SymptomRow` | ค้นหาและแสดงผล ≤ 3 พร้อมคะแนน | `components/SymptomSearch*.tsx` |
| `FeedbackButtons` | 👍/👎 + comment ≤ 500 | `components/history/FeedbackButtons.tsx:21-38` |
| `DraftJsonEditor`, `ValidationReportPanel`, `DraftGraphCard`, `DraftActions` | ตรวจ/แก้/เผยแพร่ร่าง | `components/admin/drafts/*` |
| `StatCard`, `BarList`, `DailyBars` | กราฟ dashboard ทำเอง ไม่ใช้ไลบรารีกราฟ | `components/admin/*` |

## 5. การเรียก API และ loading / error

- ทุกคำขอผ่าน `request()` ตัวเดียว (`frontend/src/api/http.ts:39-86`)
  - base URL จาก `VITE_API_URL` (ไม่ตั้ง = throw ชัดเจน `:16-22`)
  - ใส่ `Authorization: Bearer` อัตโนมัติถ้ามี token (เว้นแต่ `anonymous`) · ส่ง `FormData` ได้ (อัปโหลด PDF)
  - เน็ตล่ม → `ApiError(0, 'NETWORK_ERROR')` · non-2xx → อ่าน `{code, message}` จาก body · 204 → `undefined`
  - 401 ขณะมี token → เรียก unauthorized handler (ออกจากระบบอัตโนมัติ)
- `describeError(error)` แปลง `code` เป็นหัวข้อ/คำอธิบายภาษาไทย (ตัดสินจาก code ไม่ใช่ message) (`lib/errors.ts:212`)
- `ErrorNotice` แสดง error + ปุ่ม "ดึงขั้นตอนล่าสุด" ให้ refetch (`pages/SessionPage.tsx:83-88, 108-115`)
- **Render free หลับ:** `useSlowWait` ถ้ารอเกิน 4 วินาทีจะขึ้น `SlowServerNotice` "เซิร์ฟเวอร์กำลังเริ่มทำงาน" (`lib/useSlowWait.ts:3-18`) ใช้ในหน้า session, ค้นหา, admin
- error ของการค้นหาที่เป็นเรื่องปกติ (`SEARCH_NOT_READY`, `SEARCH_UNAVAILABLE`, `INVALID_QUERY`) แสดงเป็นกล่องสีข้อมูล ไม่ใช่สีแดง (`pages/SymptomsPage.tsx:18, 80-88`)
- ตรวจความยาวข้อความฝั่ง client ก่อนส่ง (`lib/textInput.ts` · `SymptomsPage.tsx:29`) — server ตรวจซ้ำเสมอ

## 6. ข้อสังเกต
- ชื่อแอปบนหน้าจอยังเป็น **"FixStep"** (`frontend/index.html:14`, `components/layout/AppShell.tsx:8`) และ key ของ localStorage เป็น `fixstep.*` (ชื่อจากโปรเจกต์เก่า)
- ไม่มีไฟล์เทสต์ frontend (มี `vitest` ใน `frontend/package.json` แต่ไม่มี `*.test.*`)
- ไม่ได้ใช้ไลบรารี UI หรือกราฟ (ทำเองด้วย Tailwind)
- ⚠ เว็บบน GitHub Pages เป็น build วันที่ 14 ต.ค. ซึ่ง**ไม่มี** `/history`, `/login`, `/admin`, การเลือกรุ่น (ตรวจจาก `assets/index-BSKYd8q1.js` บน branch `gh-pages`) ต้อง `npm run deploy` ใหม่ก่อนเดโม (ไฟล์ 15)
