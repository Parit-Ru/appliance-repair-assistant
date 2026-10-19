# SIMPLIFY_REPORT — รายงานลดความซับซ้อน (Phase 0 + Phase 1)

> 19 ต.ค. 2569 · ยังไม่แก้โค้ดใดๆ (ไฟล์นี้ไฟล์เดียวที่เขียน) · ไม่ commit
> ทุกตัวเลข "ประหยัดได้" เป็นค่าประมาณจากการนับบรรทัดของโค้ดที่เกี่ยวข้อง ยังไม่ได้ลงมือจริง

---

## Phase 0 — Baseline

### ผลเครื่องมือตรวจ (ก่อนแก้)

| ฝั่ง | คำสั่ง | ผล |
|---|---|---|
| backend | `npm run build` (nest build) | ✅ ผ่าน |
| backend | `npx tsc --noEmit -p tsconfig.json` | ✅ ผ่าน |
| backend | lint | ⚪ **ไม่มี** (ไม่ได้ติดตั้ง eslint ใน backend) |
| backend | `npx jest` | ⚪ ไม่มีไฟล์เทสต์ (`No tests found`) |
| frontend | `npm run build` (tsc -b + vite build) | ✅ ผ่าน |
| frontend | `npx eslint .` (ไม่มี script `lint` ใน package.json) | ❌ **1 error เดิม**: `components/auth/AuthProvider.tsx:33` react-hooks/refs ("Cannot update ref during render") |
| frontend | `npx vitest run` | ⚪ ไม่มีไฟล์เทสต์ (exit 1 "No test files found") |

**เกณฑ์หลังแก้แต่ละกลุ่ม (Phase 2):** build ทั้งสองฝั่งต้องผ่าน · `tsc --noEmit` ผ่าน · eslint ต้องไม่มี error เพิ่มจาก 1 ตัวเดิม · เพราะไม่มีเทสต์ จะใช้การเทียบผลก่อน/หลัง (แบบที่ทำกับ `graph-validator.ts`) กับส่วนที่เป็นตรรกะ

### ขนาดโปรเจกต์

| ส่วน | ไฟล์ | บรรทัด |
|---|---|---|
| `backend/src` | 64 | 7,453 |
| `frontend/src` | 95 | 7,097 |
| `backend/migrations` | 12 | 371 |
| `backend/scripts` (JS) | 6 | 1,010 |
| `scripts/` (Python offline) | 11 | 3,271 |
| **รวมโค้ดที่ต้องอธิบายตอนสอบ (backend/src + frontend/src)** | **159** | **~14,550** |

นอก runtime แต่อยู่ใน git: `draft/` 63 ไฟล์ (813 KB) · `check/` 7 ไฟล์ HTML (5.3 MB) · `data/pdf` 25 ไฟล์ (415 MB)

### ไฟล์ใหญ่สุด 10 อันดับ (ลำดับการอ่าน)
`graph-validator.ts` 528 · `api/queries.ts` 377 · `api/types.ts` 364 · `lib/errors.ts` 332 · `traversal.service.ts` 322 · `history.service.ts` 321 · `admin.store.ts` 320 · `graph.repository.ts` 305 · `drafts.store.ts` 284 · `admin.dto.ts` 284

### วิธีหา dead code ที่ใช้
สคริปต์สร้างกราฟ import จาก `main.ts` / `main.tsx` → **ทุกไฟล์มีคน import** (ไม่มีไฟล์ตกค้าง) · หา export ที่ไม่มีใครใช้ แล้วยืนยันด้วย grep ทีละตัว · หา endpoint ที่ frontend ไม่เรียก โดยเทียบ `frontend/src/api/*.ts` กับ controller

---

## ⚠ ต้องตอบก่อนเริ่ม Phase 2: invariants บางข้อไม่ตรงกับโค้ดจริง

ผมรักษาไม่ได้ในสิ่งที่ไม่มีอยู่ ข้อเหล่านี้คุณต้องบอกว่าจะ "คงตามโค้ด" หรือ "ต้องสร้างให้ตรง" (การสร้างไม่ใช่งานลดโค้ด)

| # | invariant ที่ให้มา | โค้ดจริง | หลักฐาน |
|---|---|---|---|
| I1 | Retrieval: filter Device/Brand/Model **จาก MySQL ก่อน** แล้ว cosine ใน TS | ผังโหลดจาก MySQL **ครั้งเดียวตอนบูต** เข้าหน่วยความจำ ตอนค้นกรองด้วย **`manualId` อย่างเดียว ในหน่วยความจำ** (ไม่ query MySQL ต่อคำค้น ไม่กรองด้วย device/brand) · cosine คำนวณใน TS ✓ · reload ได้หลังเพิ่มคู่มือ ✓ (`addGraphs`) | `symptom-search.service.ts:191-224`, `graph.repository.ts:122-184` |
| I2 | รูปแบบคำตอบ AI: Problem / Possible Cause / Confidence / Solution / Safety / References | **ไม่มีรูปแบบนี้** ระบบตอบเป็นขั้นตอนทีละโหนดจากผัง (state machine) · "สาเหตุที่เป็นไปได้" ถูกตั้งใจ **ไม่** ส่ง เพราะไม่มีในข้อมูล | `history.dto.ts:7-8`, `HistoryDetailPage.tsx:28` |
| I3 | confidence ต่ำ → บอกว่าหลักฐานไม่พอ + แนะนำศูนย์บริการ | ไม่มีการตัดสินจาก confidence (เป็นข้อมูลแสดงอย่างเดียว) · ค้นไม่เจอเลย (ทุกผลต่ำกว่า 0.55) → ข้อความ "แนะนำให้ติดต่อศูนย์บริการ Samsung" · `bestScore` ส่งมาแต่หน้าจอไม่ใช้ · ป้าย "หลักฐานไม่เพียงพอ" มาจาก `outcome_kind = handoff_unknown` ของผัง ไม่ใช่จาก confidence | `SymptomSearchResults.tsx:16`, `traversal.service.ts:306-322`, `lib/labels.ts:22-26` |
| I4 | "RAG" | ไม่ใช่ RAG แบบสร้างคำตอบจากเอกสาร: ใช้ embedding **เลือกผัง** แล้วเดินผังตามคู่มือ · LLM มีแค่ (ก) เรียบเรียงถ้อยคำ (ปิดได้) (ข) ช่วยร่างผังให้ admin | `symptom-search/`, `rephrase/`, `authoring/` |
| I5 | JWT / History list+detail / Feedback thumbs+comment / Dashboard | ✓ มีครบ (Dashboard = `/admin/analytics`) | — |
| I6 | mysql2 parameterized + utf8mb4 | ✓ (`database.module.ts:53` charset `utf8mb4`) · ข้อยกเว้นเดียว: ชิ้น SQL คงที่ต่อสตริง (`ownerWhere`, `OWNER_FILTER_SQL`, `timeClauses` ชื่อคอลัมน์คงที่) ไม่มีค่าจากผู้ใช้ | `auth/session-owner.ts:54`, `admin.store.ts` |

**คำแนะนำ:** ใช้ I1–I4 ตาม "โค้ดจริง" เป็น invariant แทน (คือ รักษาพฤติกรรมที่มีอยู่) แล้วค่อยแก้ TOR/สไลด์ให้พูดตรงกับระบบ

---

## Phase 1 — สิ่งที่พบ

ระดับความเสี่ยง: **ต่ำ** = ไม่มีผลภายนอก · **กลาง** = ต้องเทียบผลก่อน/หลังให้ดี · **สูง** = เปลี่ยนพฤติกรรมที่ผู้ใช้เห็นได้

### A. ลบได้แน่นอน (ไม่มีใครใช้)

| ID | path | อะไร | เหตุผล | เสี่ยง | ลดได้ |
|---|---|---|---|---|---|
| A1 | `frontend/src/lib/authStorage.ts:88-91` | `resetAuthStorageForTests()` | ไว้ให้เทสต์ ซึ่งถูกลบแล้ว (grep เจอแค่บรรทัดนิยาม) | ต่ำ | 4 บรรทัด |
| A2 | `frontend/src/lib/draftView.ts:153-157` | `manualIssues()` | ไม่มีใครเรียก (grep เจอแค่บรรทัดนิยาม) | ต่ำ | 5 |
| A3 | `backend/package.json` | dependency `ts-node` | ไม่มีไฟล์ไหนใช้ (สคริปต์เป็น JS ล้วน, build ใช้ tsc) · **ถอด dependency ต้องให้คุณอนุมัติตามข้อตกลงเดิม** | ต่ำ | 1 dep |
| A4 | `backend/src/admin/admin.service.ts:37-38` | field `nowEpoch` ที่ "ให้เทสต์เปลี่ยนเวลาได้" | ไม่มีเทสต์แล้ว เปลี่ยนเป็นเรียก `Date.now()` ตรงจุดเดียวที่ใช้ | ต่ำ | 2 |
| A5 | หลายไฟล์ backend | คอมเมนต์ที่อ้าง "แยกไว้ให้เทสต์" / "เทสต์ถูกลบแล้ว" (เช่น `traversal.exception.filter.ts:11-13`, `symptom-search.service.ts:77`, `graph-validator.ts:9`) | ข้อมูลไม่จริงแล้ว ทำให้งงตอนอ่าน | ต่ำ | ~15 |
| A6 | ~90 ตัวใน backend · ~45 ตัวใน frontend | คำว่า `export` บนค่าที่ใช้แค่ในไฟล์ตัวเอง (เช่น `MAX_PAGE`, `buildPrompt`, `GroqDraftLlmClient`, `cosineSimilarity`) | ไม่ลดบรรทัด แต่บอกคนอ่านชัดว่า "ใช้แค่ในไฟล์นี้" · ทำแบบเหมาได้ | ต่ำ | 0 (อ่านง่ายขึ้น) |

ข้อสังเกต: ผลสแกนแรกบอกว่า `historyListQuery`, `adminFeedbackQuery`, `adminSummaryQuery`, `DEFAULT_HISTORY_PARAMS` ไม่มีใครใช้ แต่ grep ยืนยันแล้วว่า **มีใช้** (ถูกเรียกผ่าน spread `...`) จึง **ไม่อยู่ใน A**

### B. ลบ/รวมได้ แต่ให้คุณตรวจก่อน

| ID | path | อะไร | เหตุผล / ผลกระทบ | เสี่ยง | ลดได้ |
|---|---|---|---|---|---|
| B1 | `admin.controller.ts:46-50` + `admin.service.ts:67-90` + `admin.store.ts:169-229` + `admin.dto.ts` (`parseSessionsQuery`, `SessionsQuery`, `AdminSessionItemDto`, `SESSION_STATUSES`, `MAX_GRAPH_ID_LENGTH`) + `OWNER_FILTER_SQL` | endpoint `GET /admin/sessions` | **frontend ไม่เรียกเลย** (ไม่มีหน้า) · ถูกอธิบายใน `docs/auth/auth-step3.md` ว่าใช้ทดสอบด้วยมือ | ต่ำ–กลาง | ~130 |
| B2 | `symptom-search.controller.ts:34-38`, `symptom-search.service.ts:241-254`, `symptom-search.dto.ts:72-85`, field `loadMs/lastError` + `embedding.service.ts` `modelFilesFoundLocally` | endpoint `GET /symptom-search/status` | frontend ไม่เรียก · มีไว้ดูหน่วยความจำ/ความคืบหน้าบน Render ด้วยมือ ถ้ายังใช้ดู Render ให้เก็บไว้ | ต่ำ | ~40 |
| B3 | `traversal/traversal.exception.filter.ts` (123) · `symptom-search/…filter.ts` (58) · `auth/auth.exception.filter.ts` (81) · `history/…filter.ts` (49) · `admin/…filter.ts` (38) · `authoring/drafts.exception.filter.ts` (60) + `@UseFilters` 9 จุด | **รวม exception filter 6 ตัวเป็นตัวเดียว** (global filter ตารางเดียว) | ตอนนี้แต่ละตัวส่งต่อกันเป็นทอด (admin → auth → traversal) และถ้าลืม `@UseFilters` 401/403 จะกลายเป็น 500 · รวมแล้วมีที่เดียวที่บอกว่า error ไหน = รหัสไหน · **ต้องคงรหัส/สถานะเดิมทุกตัว** · จุดที่ต้องระวัง: `BadRequestException` ตอนนี้แปลงเป็น 400 เฉพาะ `/admin/drafts` (เส้นทางอื่นเป็น 500) และ JSON ที่ผิดไวยากรณ์อาจเปลี่ยนรูปแบบ response | กลาง | ~300 บรรทัด, −5 ไฟล์ |
| B4 | `embedding/embedding.module.ts` (9) · `health/health.module.ts` (6) | โมดูลห่อของชิ้นเดียว | ย้าย `EmbeddingService` ไปเป็น provider ของ `SymptomSearchModule` · ย้าย `HealthController` เข้า `AppModule` | ต่ำ | −2 ไฟล์, ~15 |
| B5 | `components/SessionErrorNotice.tsx` · `components/SymptomsErrorNotice.tsx` · `components/history/HistoryErrorNotice.tsx` | กล่อง error 3 แบบ | รวมเป็น `ErrorNotice` ตัวเดียวที่ใช้ `describeError` · **เปลี่ยนข้อความที่ผู้ใช้เห็น**: `SymptomsErrorNotice` ตอนนี้โชว์ "HTTP 500" ดิบๆ แทนข้อความไทยจาก `describeError` (รวมแล้วจะได้ข้อความไทยแทน) | กลาง (เปลี่ยน UI text) | −2 ไฟล์, ~60 |
| B6 | `lib/search.ts` (43) · `lib/outcome.ts` (18) · `lib/feedback.ts` (44) · `lib/reference.ts` (13) · `lib/trail.ts` (31) · `step/stepProps.ts` (7) · `step/InstructionStep.tsx` (14) · `step/CheckpointStep.tsx` (19) | ไฟล์เล็กที่เกี่ยวกัน | รวม 3 ไฟล์ตรวจข้อความ (search/outcome/feedback ใช้แพตเทิร์นเดียวกัน normalize→check→counter) เป็นไฟล์เดียว · รวมขั้นตอน 2 ชนิดที่สั้นมากเข้า `StepView.tsx` · ย้าย `formatSourceLine` เข้า `ReferenceLine.tsx` | ต่ำ | −6 ไฟล์, ~40 |
| B7 | `history/history.dto.ts:22-36` | `DEVICE_CATEGORIES`, `OUTCOME_KINDS` ซ้ำกับ `graph-validator.ts` | ใช้ชุดเดียว (ซ้ำ 2 ที่ใน backend ตอนนี้) | ต่ำ | ~15 |
| B8 | `scripts/old/` (3 ไฟล์ Python 100 KB) · `check/` (HTML 5.3 MB) · `draft/` (63 ไฟล์ รวมสำเนาโค้ด rephrase รุ่นเก่า) | ของนอก runtime ที่อยู่ใน git | ไม่กระทบระบบ แต่ทำให้ repo ดูใหญ่และสับสนตอนกรรมการเปิดดู · **อาจเป็นหลักฐานประกอบรายงาน** | ต่ำ | −73 ไฟล์ (ไม่นับใน 14,550) |
| B9 | `backend/package.json` · `frontend/package.json` | `jest`, `ts-jest`, `@types/jest`, `vitest` + `jest.config.js` | ไม่มีเทสต์ให้รัน · **ขัดกับข้อตกลงเดิม "ห้ามถอด jest/vitest"** จึงแค่เสนอ | ต่ำ | 4 deps, 1 ไฟล์ |

### C. Logic ที่ซับซ้อนเกินไป และวิธีที่ง่ายกว่า

| ID | path | ตอนนี้ | เสนอ | ก่อน/หลังต่างกันอย่างไร | เสี่ยง | ลดได้ |
|---|---|---|---|---|---|---|
| C1 | ทั้ง backend (~43 คลาส error ใน 17 ไฟล์) + filter 6 ตัว | error ทุกชนิดเป็นคลาสของตัวเอง (`GraphNotFoundError`, `InvalidOutcomeError`, `DraftBusyError`…) แล้ว filter ต้อง `instanceof` ทีละคลาสเพื่อแปลงเป็นรหัส | คลาสเดียว `ApiError(status, code, message)` โยนพร้อมรหัสเลย filter เหลือ ~20 บรรทัด (อ่าน `status/code` จาก error) · error ภายใน engine (`traversal-engine/types.ts`) เก็บไว้ เพราะ engine ไม่ควรรู้จัก HTTP แล้วแปลงที่ service | ก่อน: เพิ่ม error ใหม่ต้องแก้ 3 ที่ (คลาส, filter, frontend) · หลัง: 2 ที่ · response เหมือนเดิมทุกตัว | กลาง | ~400 (รวมกับ B3) |
| C2 | `traversal/session.store.ts:74-102,104-158` | ทุก GET/action อ่าน `session_history` ทั้งหมดของ session มาใส่ `SessionState.history` ทั้งที่ใช้แค่ `history.length` คำนวณ `step_order` | `update()` คำนวณ `step_order` ใน SQL เอง (`SELECT COALESCE(MAX(step_order)+1, 0)`) แล้ว `find()` ไม่ต้องอ่านประวัติ | ลด 1 query ต่อคำขอ · โค้ดสั้นลง · engine ยังต่อ `history` ได้ตามเดิม | กลาง | ~20 |
| C3 | `lib/modelSelection.ts:51-57` | `restartVariables(graphId, manualId, modelSelection)` คืน `{ graphId, manualId, modelSelection }` ตรงๆ (ฟังก์ชันว่าง) | เขียน object ตรงจุดเรียกใน `SessionPage.tsx:80` | ไม่มีความต่าง | ต่ำ | ~8 |
| C4 | `lib/clientId.ts:24-40` | ประกอบ UUID v4 เองเมื่อเบราว์เซอร์ไม่มี `crypto.randomUUID` | ใช้ `crypto.randomUUID()` อย่างเดียว (GitHub Pages เป็น https และ localhost นับเป็น secure context ทั้งคู่) | ต่างเฉพาะเบราว์เซอร์เก่ามากที่ไม่มี randomUUID | ต่ำ | ~15 |
| C5 | `api/queries.ts` (377) | แคชมี `identity` ใน key ทุกตัว **และ** `queryClient.clear()` ทุกครั้งที่ login/logout (กันสองชั้น) | เหลือชั้นเดียว: `clear()` ตอนสลับผู้ใช้ แล้วตัด `identity` ออกจาก key | ลด useIdentity/พารามิเตอร์ทั่วไฟล์ · ต้องยืนยันว่าไม่มีคำขอค้างที่ตอบกลับหลัง clear แล้วเขียนแคชผิดคน | กลาง | ~40 |
| C6 | `components/auth/AuthProvider.tsx` (117) | `locationRef` อัปเดตระหว่าง render (ต้นเหตุ lint error เดิม) + state 3 ตัว (`initial`, `stored`, `verifying`) | อ่าน location ผ่าน `window.location` ตอนเกิด 401 · ลด state เหลือ `stored` + `verifying` | แก้ lint error ไปด้วย · พฤติกรรมเหมือนเดิม | กลาง | ~15 |
| C7 | `admin/admin.dto.ts:26-149` + `admin.service.ts:92-174` | แปลงวันที่เวลาไทยเองด้วยเลข epoch (`THAI_OFFSET_SECONDS`, `thaiDayIndex`, `dayIndexToEpoch`, `parseCalendarDay`) | ทางเลือก: ให้ MySQL ทำ `DATE(CONVERT_TZ(created_at,'+00:00','+07:00'))` · **แต่ต้องรู้ว่า MySQL เก็บเวลาเป็น UTC หรือไม่** ผมยังไม่ได้ตรวจกับ Aiven | กลาง–สูง (ตัวเลขสถิติอาจเลื่อนวัน) | ~40 · **ไม่แนะนำให้ทำก่อนสอบ** |
| C8 | `history/history.service.ts:291-321` | `replayReaches()` เดินขั้นตอนเดิมซ้ำผ่าน engine เพื่อยืนยันว่าผังไม่ถูกแก้ทาง | ทางเลือก: เช็กแค่ว่าโหนดทุกตัวยังมีอยู่ | ก่อน: ผังที่ถูกแก้ลูกศรจะโชว์ "ข้อมูลผังเปลี่ยนไปแล้ว" · หลัง: อาจโชว์ขั้นตอนเก่าคู่กับผลใหม่ที่ไม่ตรงกัน | สูง (ความถูกต้อง) | ~30 · **ไม่แนะนำ** |

### D. ฟีเจอร์ที่อาจเกินความจำเป็น (คุณเลือก)

| ID | ฟีเจอร์ | ไฟล์ที่เกี่ยว | ขนาดประมาณ | ข้อพิจารณา |
|---|---|---|---|---|
| D1 | **LLM เรียบเรียงถ้อยคำ (rephrase)** | `backend/src/rephrase/*` (3 ไฟล์ 180), factory ใน `traversal.module.ts:35-46`, `displayText` ใน `traversal.service.ts:290-304`, `components/RephraseNote.tsx`, `SessionPage.tsx:125-127,175`, `backend/scripts/try-rephrase.js` (เกือบ 200), env ใน `render.yaml` | ~450 บรรทัด, 5 ไฟล์ | สถานะในบันทึกเดิม "พักไว้ รอเลือก A/B/C" · แต่ `render.yaml` ตั้ง `REPHRASE_ENABLED: "true"` (จะทำงานถ้าตั้ง GROQ_* บน Render) · **ถ้า TOR อ้างว่า "LLM เรียบเรียงถ้อยคำ" ตัดแล้วต้องแก้ TOR ด้วย** |
| D2 | `GET /admin/sessions` | ดู B1 | ~130 | ไม่มีหน้าใช้ |
| D3 | ตัวกรอง/ค้นหา/เรียง/facets ของหน้าประวัติ | `components/history/HistoryFilters.tsx` (146), `lib/historyParams.ts` (73), `history.dto.ts:56-140`, `history.service.ts:57-107` (ส่วน facets/filter) | ~300 | invariant บอกแค่ "list + detail" · ตัดเหลือ "รายการใหม่สุดก่อน + แบ่งหน้า" ได้ · **API `/history` จะรับ query น้อยลง ต้องแก้สองฝั่งพร้อมกัน** |
| D4 | ข้อความผลลัพธ์ที่ผู้ใช้พิมพ์หลังจบ (outcome) | `POST /traversal/sessions/:id/outcome`, `OutcomeForm.tsx` (88), `lib/outcome.ts`, `parseOutcomeBody`, `saveOutcome/findOutcome`, error 3 ชนิด | ~200 | ซ้อนกับ feedback comment (ทั้งคู่เป็นข้อความอิสระหลังจบ) · ข้อมูลเดิมอยู่ใน DB (migration 005) |
| D5 | โหมด "ฉันไม่ทราบรุ่น" + บันทึก `model_selection` | `DevicesPage.tsx` (ส่วน unknown), `lib/modelSelection.ts`, migration 007, ส่งต่อใน navigate state | ~100 | ไว้แยกเคสตอนวัดผล ถ้าไม่ได้วัดผลแยก ตัดได้ · ตรรกะ "undefined ห้ามกลายเป็น selected" เป็นจุดที่อธิบายยาก |
| D6 | แผงอุปกรณ์ที่ต้องใช้ (equipment) | `equipment.repository.ts` (60), `EquipmentPanel.tsx` (71), `seed-equipment.js`, ตาราง equipment (migration 003), ฟิลด์ `equipment` ใน session response | ~250 | เป็นข้อมูลประกอบ ไม่เกี่ยวกับการเดินขั้นตอน |
| D7 | `GET /symptom-search/status` | ดู B2 | ~40 | เก็บไว้ถ้ายังใช้ดู Render |

ฟีเจอร์ที่ **ไม่เสนอให้ตัด**: admin authoring (อาจารย์สั่งให้มีหน้า admin เพิ่มผัง), login/register, history list+detail, feedback, dashboard, ด่านความปลอดภัย

### E. ซับซ้อนแต่จำเป็น (เก็บไว้) + จุดที่ต้องเข้าใจตอนสอบ

| ID | ส่วน | ทำไมต้องเก็บ | จุดที่ต้องอธิบายได้ |
|---|---|---|---|
| E1 | `traversal-engine/traversal-engine.ts` (177) | หัวใจระบบ: ขั้นถัดไปตัดสินที่นี่ที่เดียว | `resolveNextNode` 5 ชนิดโหนด · ด่าน `safety_critical` (ส่ง `continue` แล้วโดน `SafetyConfirmationRequiredError`) · `{{var}}` interpolate · ทำไม service ไม่ตัดสินเอง |
| E2 | `traversal/traversal.service.ts` `submitAction` | ลำดับ "engine ตัดสินก่อน → แล้วค่อยบันทึก" คือกลไกที่ทำให้ไม่ต้องมีโค้ดย้อนสถานะ | ถ้า engine โยน error บรรทัด `sessionStore.update` จะไม่ถูกรัน |
| E3 | `graph.repository.ts` loadAll/reload | ผังอยู่ในหน่วยความจำ + สลับ Map ทีเดียว | ทำไมสร้าง Map ใหม่ก่อนสลับ · reload โหลดทั้งหมด ไม่ใช่เฉพาะผังใหม่ |
| E4 | `symptom-search.service.ts` + `symptom-matcher.ts` | การค้นด้วยความหมาย | embedding 384 มิติ · cosine · เกณฑ์ 0.55 · top 3 · กรองตามรุ่นก่อนจัดอันดับ · `addGraphs` · ค่าเริ่มต้นปิด (`SYMPTOM_SEARCH_ENABLED`) |
| E5 | `auth/jwt-auth.guard.ts`, `optional-jwt-auth.guard.ts`, `session-owner.ts` | ความปลอดภัยของข้อมูลผู้ใช้ | token เสีย = 401 ไม่ลดเป็น guest · guest: `client_id = ? AND user_id IS NULL` (หัวใจของการแยกเจ้าของ) · ไม่ใช่เจ้าของ = 404 ไม่ใช่ 403 |
| E6 | `session.store.ts` `update` (transaction) | UPDATE + INSERT ต้องสำเร็จพร้อมกัน | `beginTransaction/commit/rollback` · TTL 24 ชม. / 90 วัน |
| E7 | authoring: `draft-schema.ts`, `graph-validator.ts`, `drafts.store.ts` publish | อาจารย์สั่ง · ด่านกัน AI | 2 ด่าน (รูปร่าง / ความหมาย) · error กัน publish, warning ต้องยืนยัน · ตรวจซ้ำ **ใน** transaction หลัง `FOR UPDATE` · ไม่เขียนทับ |
| E8 | `history.service.ts` `buildDetail` + `replayReaches` | กันโชว์ขั้นตอนเก่าคู่ผลใหม่เมื่อผังถูกแก้ | `available: false` แทน 500 |
| E9 | `admin.service.ts summary` + วันที่เวลาไทย | สถิติต่อวันต้องตรงวันไทย | ทำไมไม่พึ่ง time_zone ของ MySQL |

---

## ลำดับที่แนะนำ (ถ้าเลือกทำ)

1. **A ทั้งหมด** (เสี่ยงต่ำ ทำเสร็จในรอบเดียว) + **C3, C4**
2. **B4, B6, B7** (รวมไฟล์เล็ก ไม่เปลี่ยนพฤติกรรม)
3. **B1** (ถ้ายืนยันว่าไม่ใช้ `/admin/sessions`)
4. **B3 + C1 คู่กัน** (ได้มากที่สุด ~700 บรรทัด แต่ต้องเทียบรหัส error ทุกตัว ผมจะเขียนสคริปต์เทียบ response ก่อน/หลังให้)
5. ฟีเจอร์ D ที่คุณเลือกตัด
6. C2, C5, C6 ถ้ายังมีเวลา · **ไม่แนะนำ C7, C8 ก่อนสอบ**

ถ้าทำ 1–4 ครบ (ไม่ตัดฟีเจอร์ D) ประมาณ: backend −900 ถึง −1,000 บรรทัด, −8 ไฟล์ · frontend −150 บรรทัด, −8 ไฟล์
ถ้าตัด D1 + D3 + D4 เพิ่ม: อีกประมาณ −950 บรรทัด, −6 ไฟล์

---

## ข้อสังเกตอื่นที่พบระหว่างตรวจ (ไม่ใช่งานลดโค้ด)

- `render.yaml` ไม่มี `JWT_SECRET` ในรายการ env · `AuthModule` จะบูตไม่ขึ้นถ้าไม่ตั้ง (`auth.module.ts:29-44`) ต้องตั้งในแดชบอร์ด Render เอง (ผมไม่ได้ดูค่าจริง)
- `render.yaml` ตั้ง `REPHRASE_ENABLED: "true"` ขัดกับบันทึกว่า rephrase "ยังไม่เปิดบน Render" (จะเปิดจริงถ้ามี `GROQ_API_KEY`/`GROQ_MODEL`)
- `data/pdf` 415 MB อยู่ใน git
- frontend `package.json` ไม่มี script `lint` (eslint ติดตั้งแล้ว รันด้วย `npx eslint .`)

---

## คำถามที่ต้องตอบก่อนเริ่ม Phase 2

1. invariant I1–I4: ใช้ "ตามโค้ดจริง" ได้ไหม (แนะนำ)
2. เลือกทำข้อไหนบ้าง (เช่น "A ทั้งหมด, B1, B3+C1, B4, B6")
3. ฟีเจอร์ D ข้อไหนตัด / เก็บ (D1 rephrase ขึ้นกับ TOR)
4. อนุญาตถอด dependency `ts-node` (A3) ไหม · jest/vitest (B9) ยังคงตามข้อตกลงเดิมใช่ไหม
5. B8 (`draft/`, `check/`, `scripts/old/`) ลบ / ย้ายออก / เก็บไว้
6. B5 ยอมให้ข้อความ error ตอนโหลดรายการเปลี่ยนจาก "HTTP 500" เป็นข้อความไทยไหม

---

## ผลการทำ B3 + C1 (รวม exception filter + `ApiError`)

- เพิ่ม `backend/src/common/api-error.ts` (`ApiError(status, code, message)`) และ `backend/src/common/all-exceptions.filter.ts` (filter กลางตัวเดียว ลงทะเบียนด้วย `APP_FILTER` ใน `app.module.ts`)
- ลบ filter 6 ตัว (traversal, symptom-search, auth, history, admin, drafts) และคลาส error ~34 คลาส → ฟังก์ชันสร้าง `ApiError` ที่จุดโยน · error ของ engine (`traversal-engine/types.ts`) ยังไม่รู้จัก HTTP — filter กลางแปลงผ่านตาราง `ENGINE_ERRORS`
- เหลือ filter เล็ก 1 ตัว (`UploadErrorsFilter` ใน `drafts.controller.ts`) เฉพาะ `POST /admin/drafts` สำหรับ error ของ multer (400/413)
- JSON ผิดไวยากรณ์ / 404 ของ route / 413 ของ body-parser: filter กลางส่งต่อให้ Nest ตอบเอง → response เหมือนเดิม
- ผลเทียบ: ชั้น 2 (120 กรณี HTTP จริงผ่าน AppModule + ฐานข้อมูลจำลอง) เหมือน baseline 120/120 · ชั้น 1 (ส่ง error 35 ชนิดจากโค้ดจริงผ่าน filter กลางเทียบกับ filter เดิมของโมดูลเจ้าของ) ตรง 35/35 · unit ของ filter 27/27
- backend/src: 62 ไฟล์ / 7,135 บรรทัด → 58 ไฟล์ / 6,789 บรรทัด
