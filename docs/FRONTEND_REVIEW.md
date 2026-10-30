# FRONTEND_REVIEW — ตรวจ frontend หาส่วนที่ไม่ได้ใช้ / ซ้ำ / ซับซ้อนเกิน

> โหมด: **ตรวจและรายงานเท่านั้น** ไม่ได้แก้โค้ดใน `frontend/src` ไม่ได้ commit/push · ตรวจเมื่อ 26 ต.ค. 2026

## สรุป (อ่านส่วนนี้ก่อน)

- **Baseline:** `frontend/src` มี **87 ไฟล์ · 6,055 บรรทัด** (ไม่นับบรรทัดว่าง 5,310) · `tsc -b` ผ่าน · `vite build` ผ่าน · eslint มี error 2 จุดที่รู้แล้ว (`authStorage.ts:54,62` no-empty)
- **ไม่พบไฟล์ที่ไม่มีใครใช้** ทุกไฟล์เข้าถึงได้จาก `main.tsx` และ export ที่ไม่มีไฟล์อื่นใช้มีตัวเดียว (`RequestOptions`) · frontend เรียก endpoint ของ backend ครบทุกตัว ยกเว้น `GET /symptom-search/status` · type ตรงกับ DTO ของ backend ทุกตัว
- **ลดได้รวม (ประมาณ):** 4–5 ไฟล์ · **~280–330 บรรทัด (~5%)** ส่วนใหญ่มาจากโค้ดซ้ำและ wrapper ไม่ใช่ dead code
- **5 ข้อที่คุ้มที่สุด:** (1) รวม `useSlowWait` เข้า `SlowServerNotice` (2) ให้ `UploadDraftForm` ใช้ `TextField` แทน `Field` แบบ render-prop (3) รวม type `Session`/`StoredAuth` และ wrapper ใน auth (4) รวม `outcome.ts` เข้า `textInput.ts` เพราะ "trim/ตรวจความยาว/ตัวนับ" เขียนซ้ำ 3 ชุด (5) รวมค่า className ที่ซ้ำ (`LINK_CLASSES` 14 จุด, NAV/TAB, FIELD, TEXTAREA) และหัวหน้า admin 4 หน้า
- **พบบั๊กที่น่าจะเกิดจริง 1 จุด (ยังไม่ได้ทดสอบในเบราว์เซอร์):** ข้อความ "ตรวจใหม่แล้ว" ใน `DraftJsonEditor` น่าจะไม่ขึ้นเลย (ดู C14)
- **ไม่แนะนำให้ทำ:** รวม Login/Register เป็นหน้าเดียว · เอา identity ออกจาก query key · ตัด ref กันกดซ้ำใน `SessionPage.handleAction` · import DTO จาก backend แทน `types.ts` · รวม step component ทุกตัวเป็นไฟล์เดียว · ทำ generic `Paged<T>`

---

## 1. วิธีตรวจ (รันซ้ำได้)

```bash
cd frontend
find src -type f | wc -l                                   # 87
find src -type f -print0 | xargs -0 cat | wc -l            # 6055
find src -type f -print0 | xargs -0 cat | grep -cv '^\s*$' # 5310 (ไม่นับบรรทัดว่าง)
npx tsc -b                                                 # exit 0
npx eslint .                                               # 2 errors: authStorage.ts:54:11, 62:11 no-empty
npx vite build --outDir <โฟลเดอร์ชั่วคราว>                  # ผ่าน · JS 436 kB (gzip 124 kB) · CSS 16 kB
```

| โฟลเดอร์ | ไฟล์ | บรรทัด |
|---|---|---|
| `api/` | 8 | 895 |
| `lib/` | 20 | 1,161 |
| `components/` | 40 | 2,319 |
| `pages/` | 15 | 1,595 |
| ราก (`main.tsx`, `App.tsx`, `index.css`, `env.d.ts`) | 4 | 85 |

**หมายเหตุเรื่อง build:** ผม build ไปที่โฟลเดอร์ชั่วคราวเพื่อไม่แตะ `dist/` แต่ plugin `spaFallback404` ใน `vite.config.ts` เขียน path `dist` ตายตัว (ไม่อ่าน `outDir`) จึงคัดลอก `dist/index.html` ไปทับ `dist/404.html` ของเดิม เนื้อหาเหมือนเดิมทุกไบต์ (1,187 ไบต์ทั้งคู่) และ `dist/` อยู่ใน `.gitignore` ไม่กระทบอะไร แต่ควรรู้ไว้

**กราฟ import:** ไล่ export ทุกตัว (`grep -rhoE "^export (async )?(function|const|interface|type|class) …"`) แล้วนับไฟล์อื่นที่อ้างชื่อนั้นด้วย `grep -rlw` ทีละตัว (ครอบคลุมการใช้ใน JSX และผ่าน spread เพราะเป็นการค้นชื่อ ไม่ได้ค้นรูปแบบ import) ไม่มี dynamic import (`import(`) ในโปรเจกต์ · local ที่ไม่ได้ใช้ถูก `noUnusedLocals` ของ tsc ตรวจอยู่แล้ว

**เทียบ backend:** อ่าน `backend/src/*/*.routes.ts`, `app.ts`, และ DTO (`traversal.dto.ts`, `graph.repository.ts`, `history.dto.ts`, `admin.dto.ts`, `drafts.dto.ts`, `auth.service.ts`, `health.routes.ts`)

---

## 2. เทียบ API: frontend ↔ backend

| Endpoint (backend) | frontend เรียกที่ | ส่ง X-Client-Id | สถานะ |
|---|---|---|---|
| `GET /health` | `api/traversal.ts:14` | – | ✔ อ่านแค่ `status` |
| `POST /auth/register`, `/auth/login`, `GET /auth/me` | `api/auth.ts` | – | ✔ |
| `POST /symptom-search` | `api/traversal.ts:43` | – | ✔ |
| `GET /symptom-search/status` | **ไม่เรียก** | – | ปกติ (เป็นเครื่องมือดีบัก) |
| `GET /traversal/graphs`, `/manuals` | `api/traversal.ts:19,24` | – | ✔ |
| `POST /traversal/sessions` | `api/traversal.ts:34` | ✔ (backend ใช้ `resolveOptionalOwner`) | ✔ |
| `GET/POST …/sessions/:id`, `/actions`, `/outcome` | `api/traversal.ts:50,54,64` | ไม่ส่ง (backend ไม่อ่าน) | ✔ |
| `DELETE /traversal/sessions/:id` | `api/traversal.ts:71` | ✔ (backend บังคับ) | ✔ |
| `GET/DELETE /history…`, `POST /history/:id/feedback` | `api/history.ts` | ✔ (backend บังคับ) | ✔ |
| `GET /admin/feedback`, `/admin/analytics/summary` | `api/admin.ts` | – | ✔ |
| `/admin/drafts` (POST, GET, GET :id, PUT :id, POST reject/publish) | `api/drafts.ts` | – | ✔ |

**Field ที่ frontend คาดหวังแต่ backend ไม่ส่ง:** ไม่พบ · **Field ที่ backend ส่งแต่หน้าจอไม่อ่าน:** ดู A1

---

## 3. ตาราง A — ไม่ได้ใช้จริง (ยืนยันด้วย grep ทีละตัว)

| ID | path:บรรทัด | ปัญหา | ข้อเสนอ | เสี่ยง | ผู้ใช้เห็น? | ลดได้ |
|---|---|---|---|---|---|---|
| A1 | `api/types.ts:64` `SessionResponse.status` · `:53-54` `threshold`, `bestScore` · `:81` `ApiErrorBody.statusCode` · `:103` `HistoryListItem.graphId` · `:117`,`:180` `pageSize` · `:168-169` `AdminFeedbackItem.updatedAt/graphId` · `:293` `validatedAt` · `:325` `reviewedAt` · `api/traversal.ts:7-10` `HealthResponse.service/database/timestamp/environment` | backend ส่งมาแต่ไม่มีหน้าจอไหนอ่าน (grep นอก `types.ts` = 0 ครั้ง) | ลบออกจาก type ได้ (TS ไม่ตรวจตอน runtime อยู่แล้ว) **หรือเก็บไว้เป็นเอกสาร API** ถ้าอยากใช้อธิบายตอนสอบว่า backend ส่งอะไร | ต่ำ | ไม่ | ~15 |
| A2 | `api/types.ts:66-69` | `equipment?`, `confidence?`, `outcome?`, `displayText?` เป็น optional แต่ backend ส่งครบทุกครั้ง (`traversal.service.ts:160-169`) | ทำเป็น required ให้ตรง DTO (`items?` ใน `EquipmentPanel` ก็เป็น required ได้) | ต่ำ | ไม่ | ~0 (อ่านง่ายขึ้น) |
| A3 | `api/http.ts:24` | `export interface RequestOptions` ไม่มีไฟล์อื่น import | เอา `export` ออก | ต่ำ | ไม่ | 0 |
| A4 | `api/queries.ts:9,15,22,29` | ค่าเริ่มต้น `identity = 'guest'` ไม่เคยถูกใช้ (ทุกที่ส่ง identity มาเอง) | ลบค่าเริ่มต้น | ต่ำ | ไม่ | 0 |
| A5 | `api/queries.ts:37` | `staleTime: 30_000` ของ `useHealth` แทบไม่มีผล: `ServerStatus` mount ครั้งเดียวใน `AppShell` และปิด `refetchOnWindowFocus` ไว้แล้ว (มีผลเฉพาะตอนเน็ตกลับมาภายใน 30 วิ) | ลบได้ ถ้ายอมรับว่าเน็ตหลุดแล้วกลับมาจะเช็กใหม่ทันที | ต่ำ | แทบไม่ | 1 |
| A6 | `env.d.ts:1,7-9` | `/// <reference types="vite/client" />` ซ้ำกับ `tsconfig.app.json` (`types: ["vite/client"]`) และ `interface ImportMeta` ซ้ำกับที่ vite ประกาศไว้แล้ว | เหลือแค่ `interface ImportMetaEnv` (ยืนยันด้วย `tsc -b` หลังแก้) | ต่ำ | ไม่ | 4 |
| A7 | `components/ui/Notice.tsx:11-12` | คอมเมนต์ล้าสมัย: บอกว่าด่าน safety "ประกอบในหน้า SessionPage" แต่จริงอยู่ที่ `step/SafetyGateStep.tsx` · `:18` อ้าง "เหตุผลเดียวกับ Button.tsx" แต่ `Button.tsx` ไม่ได้เขียนเหตุผลนั้นไว้แล้ว | แก้คอมเมนต์ (เหตุผลจริงคือ Tailwind ต้องเห็นชื่อคลาสเต็มในโค้ด ดู D11) | ต่ำ | ไม่ | 0 |
| A8 | `lib/modelSelection.ts:4` | คอมเมนต์ยกตัวอย่าง `/#/symptoms?manual=…` แต่แอปใช้ `BrowserRouter` (ไม่มี `#`) | แก้เป็น `/symptoms?manual=…` | ต่ำ | ไม่ | 0 |
| A9 | `pages/AdminDraftReviewPage.tsx:72` | ข้อความบนจอบอก `docs/authoring-step5.md` แต่ไฟล์จริงอยู่ที่ `docs/authoring/authoring-step5.md` (ตรงกับ `UploadDraftForm.tsx:143`) | แก้ path ในข้อความ | ต่ำ | **ใช่** (admin เห็นข้อความเปลี่ยน) | 0 |
| A10 | `index.html:5` | อ้าง `/favicon.svg` แต่ไม่มีโฟลเดอร์ `public/` และไม่มีไฟล์นี้ (นอก `src` แต่เกี่ยวกัน) | เพิ่มไฟล์ หรือลบบรรทัด | ต่ำ | ใช่ (ไอคอนแท็บ) | 1 |
| A11 | `package.json` `vitest`, script `test` / `test:watch` | ไม่มีไฟล์ test ใน `frontend/` เลย (`find src -name '*.test.*'` = 0) | **รายงานเท่านั้น ห้ามถอด** (ตามข้อตกลง) | – | ไม่ | – |
| A12 | dependency อื่นใน `package.json` | ตรวจแล้วใช้ครบ: `@types/node` ใช้ใน `vite.config.ts` (node:fs, node:path) · `gh-pages` ใช้ใน script `deploy` · `autoprefixer`/`postcss` ใช้ใน `postcss.config.js` | – | – | – | – |
| A13 | ตัวแปร env | อ่านเฉพาะ `VITE_API_URL` (`http.ts:17`) และ `BASE_URL` (built-in, `App.tsx:33`) · ไม่มีตัวที่ประกาศแล้วไม่ใช้ | – | – | – | – |
| A14 | ไอคอน / สี Tailwind | ไอคอนทั้ง 12 ตัวใน `Icon.tsx` ถูกใช้ทุกตัว · สีทั้ง 8 ตัวใน `tailwind.config.js` ถูกใช้ทุกตัว · ไม่พบโค้ดที่ถูกคอมเมนต์ปิด, `console.*`, `TODO` | – | – | – | – |

---

## 4. ตาราง B — ซ้ำกันและรวมได้

| ID | path:บรรทัด | ซ้ำอะไร | ข้อเสนอ | เสี่ยง | ผู้ใช้เห็น? | ลดได้ |
|---|---|---|---|---|---|---|
| B1 | `useSlowWait` + `{isSlow && <SlowServerNotice/>}` ใน 8 หน้า: `AdminAnalyticsPage:26,57` · `AdminFeedbackPage:22,91` · `AllSymptomsPage:34,62` · `DevicesPage:20,37` · `HistoryDetailPage:46,52` · `HistoryPage:27,68` · `SessionPage:102` · `SymptomsPage:33,58` | ทุกหน้าเรียก hook แล้วเอาค่าไปเปิดกล่องเดิม | ให้ `<SlowServerNotice waiting={…} />` เรียก `useSlowWait` ข้างในเอง แล้วย้ายโค้ด hook (18 บรรทัด) เข้าไฟล์ `SlowServerNotice.tsx` → **ลบ `lib/useSlowWait.ts`** (ดู C1) | ต่ำ | ไม่ | ~25 + 1 ไฟล์ |
| B2 | `'text-accent underline-offset-4 hover:underline'` เขียน 14 จุดใน 11 ไฟล์ (เป็นค่าคงที่ `LINK_CLASSES` 6 ไฟล์ + พิมพ์ตรงใน `ForbiddenPage`, `NotFoundPage`, `LoginPage`, `RegisterPage`, `AdminDraftsPage:62`) | คลาสลิงก์เดียวกัน (รอบก่อนเสนอเป็น B9 ใน SIMPLIFY_REPORT_2 แต่ยังไม่ได้ทำ) | `export const LINK_CLASSES` ที่เดียว (เช่น ใน `ui/Button.tsx` ไม่ต้องเพิ่มไฟล์ · กฎ `react-refresh` แบบ vite อนุญาต export ค่าคงที่) | ต่ำ | ไม่ | ~6 |
| B3 | `layout/AppShell.tsx:17-18` (`NAV_ACTIVE/NAV_IDLE`) · `admin/AdminTabs.tsx:9-10` (`TAB_ACTIVE/TAB_IDLE`) | ค่าเหมือนกันทุกตัวอักษร | export จาก `AppShell` แล้ว `AdminTabs` import | ต่ำ | ไม่ | 2 |
| B4 | `auth/TextField.tsx:3-4` · `admin/drafts/UploadDraftForm.tsx:12-13` · `pages/AdminFeedbackPage.tsx:16` | `FIELD_CLASSES` 3 ชุด (2 ชุดแรกเหมือนกันทุกตัวอักษร) | ใช้ค่าเดียว (และดู B5) | ต่ำ | ไม่ | ~4 |
| B5 | `auth/TextField.tsx` (56) · `UploadDraftForm.tsx:26-56` (`Field`) | ช่องกรอก "ป้าย + คำใบ้ + error + aria" ทำ 2 แบบ | ย้าย `TextField` ไป `components/ui/` เพิ่ม prop `inputMode`, `className` แล้วให้ `UploadDraftForm` ใช้กับช่องข้อความทั้ง 7 ช่อง · ช่องไฟล์กับ select เขียน label ตรงๆ (ดู C2) | กลาง | เล็กน้อย: คำใบ้ใน `TextField` เป็น `text-sm` ส่วน `Field` เป็น `text-xs` | ~40 |
| B6 | `components/OutcomeForm.tsx:16` · `history/FeedbackButtons.tsx:15` | `TEXTAREA_CLASSES` เหมือนกันทุกตัวอักษร | ค่าเดียว | ต่ำ | ไม่ | 1 |
| B7 | `lib/textInput.ts:6-21,25-37` · `lib/outcome.ts:1-18` | "trim → ตรวจว่าง/ยาวเกิน → ตัวนับ x/MAX" เขียน 3 ชุด (query, comment, outcome) · `normalizeX()` ทุกตัวคือ `.trim()` | รวม `outcome.ts` เข้า `textInput.ts` ใช้ฟังก์ชันเดียว `checkText(raw, max)` และ `counter(raw, max)` (ดู C3) → **ลบ `lib/outcome.ts`** | ต่ำ | ไม่ | ~20 + 1 ไฟล์ |
| B8 | `lib/textInput.ts:19-21` `formatScore` · `lib/adminView.ts:20-22` `formatConfidence` | ทั้งคู่ `toFixed(3)` ต่างกันแค่รับ `null` | เหลือ `formatScore(value: number \| null)` ตัวเดียว | ต่ำ | ไม่ | 3 |
| B9 | `api/auth.ts:4-7` `Session` · `lib/authStorage.ts:5-8` `StoredAuth` | type รูปร่างเดียวกัน `{ token, user }` · `AuthProvider.tsx:77` ยังคัดลอกฟิลด์จากตัวหนึ่งไปอีกตัวเฉยๆ | ใช้ `StoredAuth` ตัวเดียว (ดู C4) | ต่ำ | ไม่ | ~8 |
| B10 | `lib/clientHeaders.ts` (6 บรรทัด) · `lib/clientId.ts` | `ownerHeaders()` เป็นเรื่องเดียวกับ client id | ย้ายเข้า `clientId.ts` → **ลบ 1 ไฟล์** | ต่ำ | ไม่ | ~3 + 1 ไฟล์ |
| B11 | `api/admin.ts:9-17` · `lib/adminParams.ts:25-32` | สร้าง query string ของ feedback ซ้ำ (ต่างกันแค่ page/pageSize · รอบก่อนเป็น B13 ยังไม่ได้ทำ) | `getAdminFeedback` เรียก `feedbackToSearchParams(params)` แล้ว `set('page')`, `set('pageSize')` เพิ่ม | ต่ำ | ไม่ | ~5 |
| B12 | `pages/HistoryPage.tsx:15-19` `pageFromUrl` · `lib/adminParams.ts:14,20` | แปลง `?page=` เป็นเลขหน้าสองแบบ (`isSafeInteger`+regex vs `isInteger`) | ฟังก์ชันเดียว `parsePage(search)` ไว้ใน `history/Pagination.tsx` (เพราะใช้คู่กับ Pagination ทั้งสองหน้า) | ต่ำ | ไม่ | ~4 |
| B13 | หัวหน้า admin 4 หน้า: `AdminAnalyticsPage:31-36` · `AdminFeedbackPage:36-41` · `AdminDraftsPage:24-29` · `AdminDraftReviewPage:32-41` | `<h1>ผู้ดูแลระบบ</h1>` + คำอธิบาย + `<AdminTabs/>` ซ้ำ | ให้ `AdminTabs` รับ prop `description` (หรือ `children`) แล้วแสดง h1 + p + แถบเมนูเอง | ต่ำ | ไม่ | ~12 |
| B14 | `auth/AdminRoute.tsx:25-28` | markup ไอคอนหมุน + ข้อความ ซ้ำกับ `LoadingText` (ต่างแค่ `role="status"`) | ใช้ `LoadingText` (ถ้าอยากเก็บ `role="status"` ให้ `LoadingText` ใส่ role นี้ทุกที่ ซึ่งดีต่อ a11y อยู่แล้ว) | ต่ำ | ไม่ (โปรแกรมอ่านหน้าจออาจอ่านข้อความโหลดเพิ่ม) | 3 |
| B15 | `lib/draftView.ts:126-135` | `issuesForNode` กับ `issuesForGraph` ต่างกันแค่เงื่อนไข `nodeId` | ฟังก์ชันเดียว `issuesAt(report, graphId, nodeId?)` | ต่ำ | ไม่ | ~5 |
| B16 | `admin/drafts/DraftGraphCard.tsx:55-59` และ `:99-103` | วนแสดง issue ของโหนดและของแผนผังเขียนซ้ำ (map + `includes` เลือกสี) | คอมโพเนนต์เล็ก `IssueLines` ในไฟล์เดียวกัน | ต่ำ | ไม่ | ~5 |
| B17 | `lib/draftView.ts:69-83` `edgesText` · `DraftGraphCard.tsx:21-27` `edges` | อธิบายลูกศรของโหนด 2 แบบ (ข้อความต่างกันเล็กน้อย: "ผล: x" vs "■ จบ (x)") | ให้ `NodeRow` เรียก `edgesText` ตัวเดียว | ต่ำ | **ใช่** (ข้อความลูกศรในหน้า admin เปลี่ยนเล็กน้อย) | ~7 |
| B18 | `pages/SessionPage.tsx:78-86` `handleRestart` · `lib/useStartSymptom.ts` | เริ่ม session ใหม่แล้ว navigate พร้อม state เขียน 2 ที่ (ต่างแค่ `replace: true`) | เพิ่มตัวเลือก `replace` ใน `useStartSymptom` แล้ว `SessionPage` ใช้ hook นี้ | กลาง (ต้องคง modelSelection = undefined ไว้ตามเดิม) | ไม่ | ~8 |
| B19 | `components/OutcomeForm.tsx:70-81` | สร้างกล่อง error เองจาก `describeError` ซ้ำกับ `ErrorNotice` | `<ErrorNotice error={error} onRetry={onRefresh} reloadLabel="ดึงข้อมูลล่าสุด" />` | กลาง | **ใช่**: `ErrorNotice` จะแสดงปุ่ม "ลองอีกครั้ง" (recovery=retry เช่น NETWORK_ERROR ซึ่งจะเรียก refresh ไม่ใช่ส่งซ้ำ) และลิงก์ "เลือกอาการใหม่" (SESSION_NOT_FOUND) เพิ่ม | ~10 |
| B20 | `history/HistoryRow.tsx:39-52` · `pages/HistoryDetailPage.tsx:91-96,121-124` | บรรทัด "ประเภท · ยี่ห้อ รุ่น" และป้ายสถานะ outcome เขียนซ้ำ | ฟังก์ชัน/คอมโพเนนต์เล็กใน `historyView` หรือ `HistoryRow.tsx` (export ไปใช้) | ต่ำ | ไม่ | ~6 |
| B21 | `pages/AllSymptomsPage.tsx:42-59` | ย่อหน้าคำอธิบาย 2 ชุดที่ต่างกันแค่ลิงก์ | คำนวณ `to`/ข้อความลิงก์ก่อน แล้วเขียนย่อหน้าเดียว | ต่ำ | ไม่ | ~6 |
| B22 | สีของ outcome 3 ตาราง: `lib/historyView.ts:15-20` · `step/OutcomeStep.tsx:14-19` · `step/PathRail.tsx:12-17` | ความหมายเดียวกัน (success/info/accent/accent) ต่างกันแค่ prefix `border+text`, `text`, `bg` | **ไม่แนะนำให้รวมเป็น `bg-${tone}`** เพราะ Tailwind จะไม่สร้างคลาส (ดู D11) · ถ้าจะรวม ให้เป็นตารางเดียวที่เก็บชื่อคลาสเต็ม `{ text, bg, badge }` | ต่ำ | ไม่ | ~4 |

**ไฟล์ใน `lib/` ที่ถูกใช้จากที่เดียว (ตรวจแล้ว):**

| ของที่ใช้ที่เดียว | ใช้ที่ | ข้อเสนอ |
|---|---|---|
| `adminView.ts:12` `EXPIRED_UNFINISHED_LABEL`, `:14` `NONE_OWNER_NOTE` | `AdminAnalyticsPage` | ย้ายไปไว้ในหน้า (~4 บรรทัด) |
| `adminParams.ts:51-54` `parseSummaryDays` + `api/admin.ts:5-6` `SUMMARY_DAY_OPTIONS`, `DEFAULT_SUMMARY_DAYS` | `AdminAnalyticsPage` | ย้ายไปไว้ในหน้า และใช้ `DEFAULT_SUMMARY_DAYS` แทนเลข `30` ที่เขียนตายตัวใน `AdminAnalyticsPage.tsx:46` (~5 บรรทัด) |
| `adminParams.ts` ส่วนที่เหลือ (feedback params) | `AdminFeedbackPage` | **เก็บไฟล์ไว้** แต่ทำให้ง่ายขึ้นตาม C6 (ถ้าย้ายเข้าหน้า หน้าจะยาว ~200 บรรทัด) |
| `modelSelection.ts:38-44` `startOptions` | `AllSymptomsPage` | inline ในหน้า (~8 บรรทัดรวมคอมเมนต์) |
| `draftView.ts:215-217` `isDemoManualId` | `UploadDraftForm` | inline (`startsWith('demo_')`) |
| `draftView.ts:163-213` ฟอร์มอัปโหลด (`validateUploadForm`, types) | `UploadDraftForm` | **เก็บไว้** (ถ้าย้าย `UploadDraftForm` จะยาว ~250 บรรทัด อ่านยากขึ้น) |
| `models.ts` `manualMatches`, `symptoms.ts` `groupSymptoms` | หน้าละหนึ่ง | **เก็บไว้** เพราะอยู่คู่ `manualTitle`/`symptomName` ที่ใช้หลายที่ |

**คอมโพเนนต์ที่ใช้ที่เดียว:** `TerminalActions` (20 บรรทัด, ปุ่ม 2 ปุ่ม) inline ใน `SessionPage` ได้ (−1 ไฟล์, ~12 บรรทัด) · `StatCard` (19) inline ใน `AdminAnalyticsPage` ได้ถ้าต้องการ · `RephraseNote`, `SessionHeader`, `BarList`, `DailyBars` **แนะนำให้เก็บ** เพราะชื่อไฟล์ช่วยชี้ตอนสอบ (โดยเฉพาะ rephrase note ที่ TOR กำหนด)

---

## 5. ตาราง C — ซับซ้อนเกินจำเป็น (พร้อมก่อน/หลัง)

| ID | path:บรรทัด | ปัญหา | ข้อเสนอ | เสี่ยง | ผู้ใช้เห็น? | ลดได้ |
|---|---|---|---|---|---|---|
| C1 | `SlowServerNotice.tsx` + `lib/useSlowWait.ts` + 8 หน้า | hook แยกไฟล์แต่ใช้คู่กล่องเดิมเสมอ · `SessionPage.tsx:102` เรียก hook ในนิพจน์ `&&` ซึ่งอ่านยาก | ดูโค้ดด้านล่าง | ต่ำ | ไม่ | (นับใน B1) |
| C2 | `UploadDraftForm.tsx:30,70,122…` | `Field` ใช้ **render-prop** `children: (id, describedBy) => ReactNode` และ `set('x')(value)` เป็นฟังก์ชันซ้อนฟังก์ชัน · สองอย่างนี้อธิบายยากที่สุดในฝั่ง frontend | ใช้ `TextField` (B5) + `set(key, value)` ธรรมดา · ส่ง `file` (เป็น `File` ซึ่งมี `name`/`type` อยู่แล้ว) เข้า `validateUploadForm` ตรงๆ ไม่ต้องสร้าง object ใหม่ที่ `:75` · ใช้ `hasErrors()` จาก `authForm.ts` แทน `Object.keys(found).length > 0` | กลาง | เล็กน้อย (ดู B5) | (นับใน B5) |
| C3 | `lib/textInput.ts`, `lib/outcome.ts` | ดู B7 | ดูโค้ดด้านล่าง | ต่ำ | ไม่ | (นับใน B7) |
| C4 | `lib/authStorage.ts:42-44` · `AuthProvider.tsx:36-38,75-84` | `readStoredAuth()` แค่เรียก `load()` ต่อ · state `initial` เก็บไว้แค่ใช้ตั้งค่าเริ่มต้นของอีก 2 state · `applySession` คัดลอก `{token, user}` ไปเป็น object ใหม่ที่หน้าตาเหมือนเดิม | เปลี่ยนชื่อ `load` เป็น `readStoredAuth` · ใช้ `useState(readStoredAuth)` ตรงๆ (มีแคช `memory` อยู่แล้ว เรียกซ้ำไม่เสียอะไร) · `applySession(session)` ใช้ `session` ตรงๆ | ต่ำ | ไม่ | (นับใน B9) +5 |
| C5 | `lib/useStartSymptom.ts:9,13` | state `startingId` ซ้ำกับข้อมูลที่ React Query เก็บไว้แล้วใน `mutation.variables` | `const startingId = startSession.isPending ? startSession.variables.graphId : null` แล้วลบ `useState` | ต่ำ | ไม่ | 3 |
| C6 | `lib/adminParams.ts:35-43` `patchFeedbackParams` | ใช้ `'helpful' in patch` ตรวจว่าแก้ตัวกรองหรือไม่ — เทคนิคที่อธิบายยาก | แยก 2 ฟังก์ชันในหน้า: `setFilter(patch)` = `{...params, ...patch, page: 1}` และ `setPage(page)` = `{...params, page}` | ต่ำ | ไม่ | ~6 |
| C7 | nested ternary: `api/http.ts:56` · `lib/adminParams.ts:17` · `components/SymptomRow.tsx:18` · `AuthProvider.tsx:109` | ternary ซ้อน 2 ชั้น | เปลี่ยนเป็น if/else หรือตัวแปรกลาง (`AuthProvider:109` อ่านพอได้ อาจคงไว้) | ต่ำ | ไม่ | 0 (อ่านง่ายขึ้น) |
| C8 | `api/http.ts:44,55,63-68` | `typeof FormData !== 'undefined'` (ในเบราว์เซอร์มีเสมอ) · `Object.keys(mergedHeaders).length === 0 ? undefined : …` (ส่ง `{}` ได้) · try/catch เพื่ออ่าน JSON ของ error | ลบ guard สองอันแรก · `const parsed = await response.json().catch(() => undefined)` | ต่ำ | ไม่ | ~5 |
| C9 | `api/queries.ts:121,128,135` | `onSuccess: useCacheSession()` เรียก hook ในค่าของ object — ถูกกฎ hook แต่คนอ่านสะดุด | `const cacheSession = useCacheSession()` ก่อน แล้ว `onSuccess: cacheSession` (แบบเดียวกับ `useDraftCacheUpdate`) | ต่ำ | ไม่ | 0 (+3) |
| C10 | `pages/AdminDraftReviewPage.tsx:111` | `draft.status === 'ready' \|\| canReject(draft.status)` — `canReject` รวม `'ready'` อยู่แล้ว (`draftView.ts:44-46`) | `canReject(draft.status)` อย่างเดียว | ต่ำ | ไม่ | 0 |
| C11 | `components/ErrorNotice.tsx:34-58` | 5 บล็อกเงื่อนไขแยกกัน (ปุ่ม 2 + ลิงก์ 3) | ตารางลิงก์ `{ 'back-to-history': {to, label}, login: …, 'back-to-symptoms': … }` + ปุ่มเดียวสำหรับ retry/reload | ต่ำ | ไม่ | ~10 |
| C12 | `step/StepView.tsx:17-27` | `outcomeForm`, `outcomeActions` ถูกส่งผ่าน `StepView` ไป `OutcomeStep` อย่างเดียว | ให้ `SessionPage` เลือกเอง: `node.isTerminal ? <OutcomeStep …/> : <StepView …/>` | ต่ำ | ไม่ | ~4 |
| C13 | `pages/SessionPage.tsx:47,63-72` | `isSavingOutcomeRef` กันกดบันทึกผลซ้ำ แต่ปุ่มปิดระหว่างส่งอยู่แล้ว และ backend ปฏิเสธครั้งที่ 2 (`OUTCOME_ALREADY_SUBMITTED`) | ลบได้ (ไม่บังคับ) · **ต่างจาก `isSendingRef` ที่ต้องเก็บ** (D6) | กลาง | กรณีดับเบิลคลิกเร็วมาก อาจเห็น error "บันทึกผลไปแล้ว" | ~8 |
| C14 | `admin/drafts/DraftJsonEditor.tsx:27,43,76` + `AdminDraftReviewPage.tsx:107` | **น่าจะเป็นบั๊ก:** editor ถูกใส่ `key={draft.updatedAt}` · PUT สำเร็จ → `setQueryData` ใส่ร่างใหม่ที่ `updated_at` เปลี่ยน (คอลัมน์เป็น `ON UPDATE CURRENT_TIMESTAMP` ใน `migrations/006_graph_drafts.sql:33`) → editor ถูก unmount/mount ใหม่ → state `saved` หาย และ React Query v5 ไม่เรียก callback ของ `mutate()` ถ้าคอมโพเนนต์ unmount แล้ว → ข้อความ "ตรวจใหม่แล้ว" **น่าจะไม่เคยขึ้น** (ยกเว้นบันทึก 2 ครั้งในวินาทีเดียวกัน) | ทางที่ง่ายสุด: ลบ state `saved` และข้อความนี้ (รายงานการตรวจด้านบนอัปเดตให้เห็นอยู่แล้ว) · หรือย้ายข้อความไปไว้ที่ `AdminDraftReviewPage` | ต่ำ | **ใช่ถ้าข้อความเคยขึ้นจริง** · **ไม่แน่ใจ ต้องเปิดเบราว์เซอร์กด "ตรวจใหม่" ดู** | ~8 |
| C15 | `pages/DevicesPage.tsx:29` | `DEVICE_CATEGORY_LABELS[category] ?? ''` — `category` ผ่านการตรวจที่ `:24` แล้ว | ลบ `?? ''` | ต่ำ | ไม่ | 0 |
| C16 | `App.tsx:47-50` | `<AdminRoute> <AdminAnalyticsPage />` มีช่องว่างใน JSX (สร้าง text node `" "` ที่มองไม่เห็น) และ `"/admin/analytics"element=` ไม่มีเว้นวรรค | จัดรูปแบบใหม่ ไม่เปลี่ยนการทำงาน | ต่ำ | ไม่ | 0 |
| C17 | `components/ui/Notice.tsx:27-30` | ชื่อ `DEFAULT_ICONS` ทั้งที่เปลี่ยนไม่ได้ | ย้ายไอคอนเข้า `TONE_CLASSES` เป็น `{ box, accent, icon }` | ต่ำ | ไม่ | ~4 |

### ก่อน/หลัง (สั้น)

**C1 — SlowServerNotice ดูแลการรอเอง**
```tsx
// ก่อน (ทุกหน้า)
const isSlow = useSlowWait(graphs.isPending || isStarting)
…
{isSlow && <SlowServerNotice />}

// หลัง
<SlowServerNotice waiting={graphs.isPending || isStarting} />

// SlowServerNotice.tsx
export function SlowServerNotice({ waiting }: { waiting: boolean }) {
  const [isSlow, setIsSlow] = useState(false)
  useEffect(() => { /* โค้ดเดิมจาก useSlowWait */ }, [waiting])
  if (!isSlow) return null
  return <Notice tone="info" title="เซิร์ฟเวอร์กำลังเริ่มทำงาน">…</Notice>
}
```
ข้อควรระวัง: `SessionPage` แสดงกล่องนี้ 2 ตำแหน่ง (`:107` ตอนโหลด และ `:157` หลังโหลด) เป็นคนละ return จึงยังทำงานเหมือนเดิม แต่ถ้า state ของ timer รีเซ็ตตอนสลับ return กล่องอาจขึ้นช้าลงหลังโหลดเสร็จ (เดิมก็รีเซ็ตเพราะ `isWaiting` เปลี่ยนค่า) → ทดสอบด้วยมือ

**C3 — รวมการตรวจข้อความ**
```ts
// ก่อน: normalizeQuery/checkQuery, normalizeComment/checkComment/formatCommentCounter,
//       normalizeOutcome/checkOutcome/formatOutcomeCounter (สองไฟล์)
// หลัง (textInput.ts)
export type TextCheck = 'ok' | 'empty' | 'too-long'
export function checkText(raw: string, max: number): TextCheck {
  const text = raw.trim()
  if (text === '') return 'empty'
  return text.length > max ? 'too-long' : 'ok'
}
export const counter = (raw: string, max: number) => `${raw.length}/${max}`
// comment ไม่บังคับ → ผู้เรียกเช็ก checkText(c, MAX) !== 'too-long'
```

**C4 — auth**
```ts
// ก่อน (AuthProvider)
const [initial] = useState<StoredAuth | null>(readStoredAuth)
const [stored, setStored] = useState<StoredAuth | null>(initial)
const [verifying, setVerifying] = useState(initial !== null)
… const next = { token: session.token, user: session.user }; storeAuth(next); setStored(next)

// หลัง
const [stored, setStored] = useState(readStoredAuth)
const [verifying, setVerifying] = useState(() => readStoredAuth() !== null)
… storeAuth(session); setStored(session)          // session เป็น StoredAuth อยู่แล้ว
```

**C5 — useStartSymptom**
```ts
// ก่อน
const [startingId, setStartingId] = useState<string | null>(null)
function start(graphId, options) { setStartingId(graphId); startSession.mutate(…) }
// หลัง
const startingId = startSession.isPending ? startSession.variables.graphId : null
```

### ไฟล์ใหญ่สุด 10 อันดับ + วิธีทำให้อ่านง่ายขึ้น (ไม่เพิ่มไฟล์)

| # | ไฟล์ | บรรทัด | ข้อเสนอ |
|---|---|---|---|
| 1 | `api/types.ts` | 346 | ลบ field ที่ไม่อ่าน (A1) ถ้าเลือก · `HistoryGraphInfo` เขียนเป็น `Omit<GraphSummary, 'graphId'> & { displayName?: string }` ได้ แต่**ไม่แนะนำ**: แบบเดิมอ่านตรงกว่า · ส่วนอื่นเป็นสัญญากับ backend ต้องเก็บ |
| 2 | `lib/errors.ts` | 273 | เกือบทั้งหมดเป็นตารางข้อความ (ข้อมูล ไม่ใช่ logic) · **เก็บไว้ไฟล์เดียว** อย่าแยก · logic จริงมีแค่ `describeError` 28 บรรทัด |
| 3 | `api/queries.ts` | 249 | A4, A5, C9 · ลบบรรทัดว่างซ้อน (`:39-40`, `:164-165`, `:178-180`) · จัดกลุ่มเป็น 4 หมวดพร้อมหัวคอมเมนต์ (traversal / history / admin / drafts) |
| 4 | `lib/draftView.ts` | 222 | B15, B17, inline `isDemoManualId` · ใส่หัวคอมเมนต์คั่น 3 ส่วน: ป้าย / เส้นทาง+issue / ฟอร์มอัปโหลด |
| 5 | `pages/HistoryDetailPage.tsx` | 216 | B2, B20 · ส่วน "ผลการตรวจ / ความมั่นใจ / ขั้นตอน" แยกเป็นฟังก์ชันคอมโพเนนต์**ในไฟล์เดียวกัน** (แบบ `DraftBody` ใน `AdminDraftReviewPage`) |
| 6 | `components/admin/drafts/UploadDraftForm.tsx` | 191 | B5 + C2 (ลดได้มากสุด ~40 บรรทัด) |
| 7 | `pages/SessionPage.tsx` | 175 | B1, B18, C12, (C13) · inline `TerminalActions` |
| 8 | `pages/AdminFeedbackPage.tsx` | 158 | B13, C6 · ตัวกรอง 3 ช่องใช้ label แบบเดียวกับ `TextField` ได้ |
| 9 | `components/ui/Icon.tsx` | 156 | เป็นข้อมูล SVG ล้วน **เก็บไว้** |
| 10 | `pages/DevicesPage.tsx` | 146 | เล็กน้อย (C15) · โครง 2 ขั้น (`CategoryStep`/`ModelStep`) อ่านง่ายอยู่แล้ว |

---

## 6. ตาราง D — ซับซ้อนแต่ต้องเก็บ + จุดที่ต้องอธิบายตอนสอบ

| ID | ที่ไหน | ทำไมต้องเก็บ / ต้องอธิบายอะไร |
|---|---|---|
| D1 | `api/http.ts` `request()` + `setUnauthorizedHandler` | ทุกคำขอผ่านที่นี่: อ่าน token จาก `authStorage` ทุกครั้ง (ไม่ผ่าน React state จึงไม่มีช่วงที่ใช้ token เก่า) · ได้ 401 → เรียก handler ที่ `AuthProvider` ลงทะเบียนไว้ พร้อม token ที่ใช้ส่ง เพื่อให้ `AuthProvider` **เมิน 401 ของคำขอเก่า** หลังผู้ใช้ล็อกอินใหม่ (`AuthProvider.tsx:43`) · แปลงทุก error เป็น `ApiError(status, code)` |
| D2 | `components/auth/AuthProvider.tsx` | สถานะ 3 ค่า `verifying/guest/user` คำนวณจาก `stored` + `verifying` · เปิดแอปมี token → `GET /auth/me` · `locationRef` จำเป็นเพราะ handler ลงทะเบียนครั้งเดียวแต่ต้องรู้หน้าปัจจุบันเพื่อทำ `?next=` · `queryClient.clear()` ทุกครั้งที่เปลี่ยนผู้ใช้ · `useMemo`/`useCallback` ทำให้ค่า context ไม่เปลี่ยนตัวทุกครั้งที่ `AuthProvider` render ใหม่ (มัน render ใหม่ทุกครั้งที่เปลี่ยนหน้า เพราะเรียก `useLocation`) |
| D3 | `lib/authStorage.ts` | ตัวแปร `memory` มี 3 สถานะ: `undefined` = ยังไม่อ่าน localStorage, `null` = อ่านแล้วไม่มี, object = มี · `parseStoredAuth` ตรวจทุกฟิลด์เพราะ localStorage แก้ได้/อาจเป็นรูปแบบเก่า · try/catch เพราะ localStorage โยน error ได้ (โหมดส่วนตัว/ถูกบล็อก) |
| D4 | `lib/clientId.ts` | guest ระบุตัวด้วย UUID ที่เบราว์เซอร์สุ่ม (`X-Client-Id`) · อ่านซ้ำหลังเขียนเพื่อให้ 2 แท็บที่เปิดพร้อมกันได้ id เดียวกัน |
| D5 | `api/queries.ts` | factory `sessionQuery`/`historyDetailQuery`/`adminDraft(s)Query` มีไว้ให้ `useQuery`, `setQueryData`, `removeQueries` ใช้ **key เดียวกัน** · **identity อยู่ใน key** เป็นชั้นที่ 2 ต่อจาก `clear()` (ข้อมูลของผู้ใช้คนก่อนจะไม่ถูกหยิบมาแสดง แม้มีคำขอค้างอยู่) · `keepPreviousData` + `isPlaceholderData` = หน้าที่ 2 ยังโชว์หน้าเดิมแบบจางระหว่างโหลด · `refetchInterval` = poll ร่างทุก 3 วิเฉพาะตอนมีสถานะ `drafting` · `useDraftCacheUpdate` invalidate แบบ `exact` เพื่อไม่ให้ดึงรายละเอียดที่เพิ่งใส่แคชซ้ำ |
| D6 | `pages/SessionPage.tsx` | `isSendingRef` **ต้องเก็บ**: กันดับเบิลคลิกส่ง action 2 ครั้งก่อน React render ปุ่มเป็น disabled (ส่งซ้ำอาจข้ามขั้น/ข้ามคำถาม) · `trail` สร้างฝั่งหน้าจอจาก `nodeBefore` + action หลังส่งสำเร็จ (รีเฟรชแล้วหาย เป็นเรื่องตั้งใจ) · `key={sessionId}` ที่ `SessionPage` และ **`key={node.nodeId}` ที่ `StepView`** ทำให้ state ในขั้น (เช่น ช่องติ๊กของด่าน safety) **รีเซ็ตทุกครั้งที่เปลี่ยนโหนด** — อธิบายข้อนี้ให้ได้ เพราะเป็นเหตุผลที่ติ๊กของขั้นก่อนไม่ติดมาขั้นถัดไป · useEffect เลื่อนจอ + โฟกัส h2 เพื่อโปรแกรมอ่านหน้าจอ |
| D7 | `step/StepView.tsx` ลำดับเลือกจอ | `isTerminal` → **`requiresSafetyConfirmation` ก่อนดูชนิดโหนด** → checkpoint → input → instruction · ด่าน safety มาก่อนชนิดโหนดเสมอ |
| D8 | `SessionPage.tsx:123` `canRephrase` | backend ไม่ส่ง `displayText` ให้โหนด safety/โหนดจบอยู่แล้ว (`rephrase.service.ts:40`) แต่หน้าจอตรวจซ้ำอีกชั้น (defense in depth ตาม TOR) — ซ้ำโดยตั้งใจ ไม่ควรลบ |
| D9 | `lib/modelSelection.ts` | `modelSelection` = `'selected' \| 'unknown' \| undefined` · `undefined` = ไม่ได้ผ่านหน้าเลือกรุ่น **ห้ามเติมเป็น `'selected'`** เพราะจะบันทึกผิดใน DB · ส่งต่อผ่าน `navigate(..., { state })` จึงหายเมื่อเปิดลิงก์ในแท็บใหม่ |
| D10 | `lib/errors.ts` | ตัดสินจาก `code` ไม่ใช้ `message` ของเซิร์ฟเวอร์ (ยกเว้น 3 code ของร่างที่เขียนไว้ให้ admin) · `recovery` บอกว่าควรแสดงปุ่ม/ลิงก์อะไร |
| D11 | ตารางคลาสสีแยกหลายชุด (`STATUS_BADGE_CLASSES`, `OUTCOME_COLOR_CLASSES`, …) | Tailwind สร้าง CSS จากชื่อคลาสที่**เห็นเต็มในโค้ด**เท่านั้น ถ้าเขียน `` `bg-${tone}` `` จะไม่มี CSS ออกมา จึงต้องเขียนชื่อเต็มในตาราง |
| D12 | `api/types.ts:1-10` import จาก `../../../backend/src/traversal-engine/types` | ใช้ type ชุดเดียวกับ backend (ไม่ต้องเขียนซ้ำ) · ทำได้เพราะเป็น `import type`/`export type` (ถูกลบตอน build) และไฟล์นั้นไม่ import อะไรของ Node · build frontend ต้องมีโฟลเดอร์ backend อยู่ข้างกัน · **ไม่แนะนำขยายไปยัง DTO ตัวอื่น** เพราะไฟล์ DTO import `express`/`mysql2` ซึ่ง frontend ไม่มี type |
| D13 | `lib/draftView.ts` `pathLines` | BFS จาก `entry_node` เพื่อหาโหนดที่เดินถึงไม่ได้ (แสดงสีแดง) · `publishGate` เป็น UX เท่านั้น backend ตรวจซ้ำตอน publish |
| D14 | `vite.config.ts` + `App.tsx:33` | GitHub Pages อยู่ใต้ `/appliance-repair-assistant/` จึงต้องตั้ง `base` และ `basename` · `404.html` = สำเนา `index.html` เพื่อให้รีเฟรชหน้าลึกได้ |
| D15 | `AdminRoute`, `AppShell` ซ่อนเมนู admin | เป็น UX เท่านั้น สิทธิ์จริงตรวจที่ backend (`requireAdmin`) |
| D16 | `EquipmentPanel.tsx` | ปุ่มพับ (`md:hidden`) กับหัวข้อ (`hidden md:flex`) คือการแสดงคนละแบบบนมือถือ/จอใหญ่ ไม่ใช่โค้ดซ้ำ |

---

## 7. ตาราง E — เรื่องที่ต้องให้คุณตัดสินใจ

### เปลี่ยนสิ่งที่ผู้ใช้เห็น (ระบุชัด)

| ID | เรื่อง | สิ่งที่จะเปลี่ยนบนจอ | ผมแนะนำ |
|---|---|---|---|
| E1 | A9 แก้ path เอกสารในหน้าตรวจร่าง | ข้อความ admin เปลี่ยนเป็น `docs/authoring/authoring-step5.md` | ทำ |
| E2 | A10 favicon | ไอคอนแท็บขึ้น (หรือเลิกขอไฟล์ที่ไม่มี) | ทำ (นอก `src`) |
| E3 | B5/C2 `UploadDraftForm` ใช้ `TextField` | คำใบ้ใต้ป้ายในฟอร์มอัปโหลดตัวใหญ่ขึ้นเล็กน้อย (`text-xs` → `text-sm`) | ทำ (หรือเพิ่ม prop ให้คงขนาดเดิม) |
| E4 | B17 ข้อความลูกศรในการ์ดโหนดของร่าง | "ผล: user_fixed" → "■ จบ (user_fixed)" แบบในส่วนเส้นทาง | ทำได้ ไม่เร่ง |
| E5 | B19 `OutcomeForm` ใช้ `ErrorNotice` | กรณี error บางชนิดมีปุ่ม/ลิงก์เพิ่ม | ไม่เร่ง |
| E6 | C14 ข้อความ "ตรวจใหม่แล้ว" | ถ้าลบ: ข้อความหายไป (แต่น่าจะไม่เคยขึ้นอยู่แล้ว) | ทดสอบในเบราว์เซอร์ก่อน แล้วค่อยเลือก ลบ/ย้าย |
| E7 | `SymptomsPage.tsx:50-55` และ `:70-75` | ลิงก์ "ดูอาการทั้งหมด" ซ้ำ 2 ที่ในหน้าเดียว → เหลือที่เดียว | ตามใจ (ที่เดียวพอ แต่ที่ล่างช่วยคนที่ค้นไม่เจอ) |
| E8 | `NotFoundPage.tsx:18` | ลิงก์ "ไปหน้าเลือกอาการ" ไป `/symptoms` ซึ่ง redirect ไป `/devices` อยู่แล้ว (`SymptomsPage.tsx:35`) → ชี้ `/devices` ตรงๆ | ทำ (URL เปลี่ยน หน้าที่เห็นเหมือนเดิม) |
| E9 | `RegisterPage.tsx:27,31` | สมัครสำเร็จไป `/history` แต่ถ้าล็อกอินอยู่แล้วเปิดหน้าสมัครไป `/` — ไม่สม่ำเสมอ | ไม่แน่ใจว่าตั้งใจหรือไม่ บอกผมได้ |
| E10 | C13 ลบ `isSavingOutcomeRef` | ดับเบิลคลิกเร็วมากอาจเห็น error "บันทึกผลไปแล้ว" | ไม่ต้องทำ ถ้าไม่ต้องการลดบรรทัดเพิ่ม |

### ไม่เปลี่ยนสิ่งที่ผู้ใช้เห็น

ทุกข้อใน A (ยกเว้น A9, A10), B1–B4, B6–B16, B18, B20–B22, C1, C3–C12, C15–C17 · ตัดสินใจเพิ่มแค่ 2 เรื่อง:
- **A1** ลบ field ที่ไม่อ่านออกจาก `types.ts` (~15 บรรทัด) หรือเก็บไว้เป็นเอกสาร API
- **identity ใน query key** (D5): เอาออกจะลด ~15 บรรทัด (ไม่ต้องเรียก `useIdentity()` 14 hook) แต่**ไม่แนะนำ** เพราะเป็นตัวกันข้อมูลข้ามผู้ใช้ชั้นที่ 2 และผมไม่แน่ใจว่า `queryClient.clear()` อย่างเดียวพอกับคำขอที่ค้างอยู่หรือไม่ (ต้องอ่านเอกสาร TanStack Query เรื่อง query ที่ถูกลบระหว่าง fetch)

### ข้อที่ไม่แนะนำ (และเหตุผล)

| เรื่อง | เหตุผล |
|---|---|
| รวม `LoginPage` + `RegisterPage` เป็นหน้าเดียว | ต้องใส่ `if (mode === …)` หลายจุด อ่านยากกว่าสองหน้าที่ตรงไปตรงมา |
| ตัด `isSendingRef` | กันส่ง action ซ้ำ เกี่ยวกับความถูกต้องของการเดินผัง (D6) |
| import DTO จาก backend แทน `types.ts` | DTO import `express`/`mysql2` → tsc ฝั่ง frontend พัง (D12) |
| รวม `InputStep`/`SafetyGateStep`/`OutcomeStep` เข้า `StepView.tsx` | ได้ไฟล์ ~175 บรรทัด และเสียจุดชี้ "ด่าน safety อยู่ไฟล์นี้" ตอนสอบ |
| generic `Paged<T>` แทน `HistoryListResponse`/`AdminFeedbackResponse` | ประหยัด ~4 บรรทัด แต่เพิ่ม generic ที่ต้องอธิบาย |
| รวม `BarList`/`DailyBars`/`StatCard` เข้า `AdminAnalyticsPage` ทั้งหมด | หน้าจะยาว ~260 บรรทัด (ถ้าจะทำ ทำแค่ `StatCard`) |
| แยก `errors.ts` เป็นหลายไฟล์ | เป็นตารางข้อมูล อยู่ที่เดียวหาง่ายกว่า |
| ลบ `canRephrase` ฝั่งหน้าจอ | ซ้ำกับ backend โดยตั้งใจ (D8) |

---

## 8. ลำดับที่แนะนำสำหรับ Phase แก้ไข (เสี่ยงต่ำก่อน)

หลัง**ทุกกลุ่ม**รัน: `npx tsc -b` · `npx eslint .` · `npm run build` และเทียบจำนวนไฟล์/บรรทัดด้วยคำสั่งในหัวข้อ 1

| กลุ่ม | รายการ | ตรวจเพิ่มหลังทำ |
|---|---|---|
| 1. คอมเมนต์/type/ของไม่ใช้ (ไม่แตะ logic) | A2–A4, A6–A8, C10, C15, C16 + แก้ eslint no-empty ใน `authStorage.ts` (ใส่คอมเมนต์ในบล็อก catch แบบ `clientId.ts:35`) | eslint ต้องเหลือ 0 error |
| 2. ค่าคงที่ซ้ำ | B2, B3, B4, B6, B8, B22(ถ้าทำ) | `grep -rn "text-accent underline-offset-4" src` ต้องเหลือที่เดียว · เปิดหน้า login/history/admin ดูลิงก์และเมนู |
| 3. รวมไฟล์ lib | B7/C3 (ลบ `outcome.ts`), B10 (ลบ `clientHeaders.ts`), ย้ายของที่ใช้ที่เดียว (`startOptions`, `isDemoManualId`, ค่าคงที่ analytics) | ทดสอบมือ: ค้นอาการ (ว่าง/ยาวเกิน 200), บันทึกผล (ตัวนับ 1000), feedback (ตัวนับ 500) · ประวัติแบบ guest ยังเห็นรายการเดิม (X-Client-Id ยังส่ง) |
| 4. auth | B9/C4 | ทดสอบมือ: login → logout → login คนละบัญชี · ลบ/แก้ token ใน localStorage แล้วรีเฟรช (ต้องเด้งไป login พร้อม `?reason=expired&next=`) · เปิด `/admin` ตอนเป็น guest |
| 5. คอมโพเนนต์ | B1/C1 (ลบ `useSlowWait.ts`), B13, B14, inline `TerminalActions`, C11, C12, C5 | ทดสอบมือ: เดินผังครบ 1 รอบรวมด่าน safety + input + โหนดจบ · "เริ่มอาการนี้ใหม่" · ใช้ throttling ใน DevTools ให้ช้ากว่า 4 วิ ดูว่ากล่อง "เซิร์ฟเวอร์กำลังเริ่มทำงาน" ยังขึ้น |
| 6. ฟอร์ม admin + query params | B5/C2, B11, B12, C6, B15–B17, B21 | ทดสอบมือ: อัปโหลดฟอร์มว่าง (error ทุกช่อง + aria-describedby) · ตัวกรอง feedback: เปลี่ยนตัวกรองแล้วกลับหน้า 1, เปลี่ยนหน้าแล้วตัวกรองคงอยู่ · ประวัติ `?page=abc` → หน้า 1 |
| 7. ข้อที่ต้องตัดสินใจ | E1–E10, A1, C13, C14, B18, B19 | ตามที่เลือก |

---

## 9. สิ่งที่ตรวจไม่ได้ในรอบนี้ (บอกตรงๆ)

- **ไม่ได้เปิดเบราว์เซอร์จริง** — ทุกข้อที่บอกว่า "ผู้ใช้เห็น/ไม่เห็น" มาจากการอ่านโค้ด ไม่ได้ดูหน้าจอ · โดยเฉพาะ C14 ("ตรวจใหม่แล้ว" ไม่ขึ้น) เป็นข้อสรุปจากโค้ด + schema **ยังไม่ได้ยืนยัน**
- **ไม่ได้รัน backend หรือเรียก API จริง** — การเทียบ type ทำจากการอ่าน DTO/route ในโค้ดเท่านั้น ไม่ได้ดู response จริงจาก Render หรือ DB
- ไม่ได้ทดสอบ a11y ด้วยโปรแกรมอ่านหน้าจอ
- ไม่ได้ตรวจพฤติกรรมของ TanStack Query เมื่อ `clear()` ระหว่างที่คำขอค้าง (เกี่ยวกับการตัดสินใจเรื่อง identity ใน key)
- ไม่ได้รัน `npm run build` ตรงๆ แต่รัน `tsc -b` + `vite build --outDir <ชั่วคราว>` แยกกัน (ผลเท่ากัน) · ไม่มี test ของ frontend ให้รัน
- ตัวเลข "ลดได้" เป็นค่าประมาณจากการอ่านโค้ด

---

## 10. สถานะการแก้ไข (อัปเดต 26 ต.ค.)

เลขบรรทัดและตัวเลขในหัวข้อ 1–9 เป็นของ **ก่อนแก้** (ไม่ได้ปรับตามโค้ดใหม่ เพื่อให้เทียบย้อนหลังได้)

| รายการ | สถานะ |
|---|---|
| กลุ่ม 1: eslint no-empty + รวม className (B2, B3, B4 บางส่วน, B6) | ทำแล้ว — eslint เหลือ 0 error · บรรทัดไม่ลด (+1) |
| กลุ่ม 2: รวม `Session`/`StoredAuth` + ตัด wrapper (B9, C4) | ทำแล้ว — −11 บรรทัด |
| กลุ่ม 3: รวม `outcome.ts` เข้า `textInput.ts` (B7, C3) | ทำแล้ว — −32 บรรทัด · −1 ไฟล์ |
| กลุ่ม 4: `UploadDraftForm` ใช้ `TextField` (B5, C2) | **ไม่ทำ** — ต้องเพิ่ม 3 prop และยังลบ `Field` ไม่ได้ (ช่องไฟล์/dropdown) ผลประหยัดจริงไม่ถึง 10 บรรทัด ไม่ใช่ ~40 ตามที่ประเมินไว้ในข้อ B5 |
| กลุ่ม 5: หัวหน้าหน้า admin 4 หน้า (B13) | หยุดไว้ก่อน |
| `SlowServerNotice`/`useSlowWait` (B1, C1), C14, ข้อที่เหลือ | หยุดไว้ก่อน |

ตัวเลข `frontend/src` ณ ตอนนี้: **86 ไฟล์ / 5,935 บรรทัด** (นับด้วยคำสั่งในหัวข้อ 1) · ดูรายละเอียดงานที่ทำใน `docs/STUDY_GUIDE.md` ส่วน 5.8
