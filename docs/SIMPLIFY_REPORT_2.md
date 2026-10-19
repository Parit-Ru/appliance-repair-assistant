# SIMPLIFY_REPORT_2 — ลดความซับซ้อนรอบที่ 2 (Phase 0 + Phase 1)

> 19 ต.ค. 2569 · **ยังไม่แก้โค้ดใดๆ** (ไฟล์นี้ไฟล์เดียวที่เขียน) · ไม่ commit
> ตัวเลข "ลดได้" ทุกตัวเป็น **ค่าประมาณ** จากการนับบรรทัดของโค้ดที่เกี่ยวข้อง ยังไม่ได้ลงมือจริง
> เลขบรรทัดอ้างจากไฟล์บนดิสก์ตอนเขียนรายงาน (`path:บรรทัด`)

---

## Phase 0 — Baseline รอบ 2

### 0.1 ขนาดโค้ด (นับซ้ำได้)

คำสั่งที่ใช้ (Git Bash จากรากโปรเจกต์):
```bash
for d in backend/src frontend/src; do
  echo "$d files=$(find $d -type f | wc -l) lines=$(find $d -type f -exec cat {} + | wc -l)"
done
```

| ส่วน | ไฟล์ | บรรทัดทั้งหมด | คอมเมนต์* | บรรทัดว่าง* | โค้ด (ประมาณ)* |
|---|---|---|---|---|---|
| `backend/src` | 58 | 6,789 | 898 | 840 | ≈ 5,051 |
| `frontend/src` | 86 (`.ts` 29 · `.tsx` 56 · `.css` 1)** | 6,678 | 691 | 813 | ≈ 5,165 |
| **รวม** | **144** | **13,467** | 1,589 | 1,653 | ≈ 10,216 |

\* นับเฉพาะไฟล์ `.ts/.tsx` ด้วย `grep -cE "^\s*(//|\*|/\*)"` (คอมเมนต์) และ `grep -cE "^\s*$"` (ว่าง) — คอมเมนต์ท้ายบรรทัดไม่ถูกนับเป็นคอมเมนต์
\*\* จาก `find … | sed 's/.*\.//' | sort | uniq -c` ทั้งสองฝั่ง: `.ts` 87 (backend 58 + frontend 29) · `.tsx` 56 · `.css` 1 · คอลัมน์คอมเมนต์/ว่าง/โค้ดของ frontend นับจาก `.ts/.tsx` 6,669 บรรทัด (ไม่รวม `.css` 9 บรรทัด)

**ข้อสังเกต:** `frontend/src` ตอนจบรอบ 1 นับได้ 6,686 บรรทัด ตอนนี้ 6,678 (−8) เพราะ `pages/AdminDraftReviewPage.tsx` ถูกเขียนทับจากภายนอกเมื่อ 17:42 (คอมเมนต์หัวฟังก์ชัน 8 บรรทัดหายไป — ดูข้อ F3) และ `UploadDraftForm.tsx` ถูกบันทึกจาก IDE เมื่อ 17:57 (เนื้อหาตรงกับเวอร์ชันที่ถูกต้อง)

ส่วนอื่นที่ไม่อยู่ในขอบเขตรอบนี้ (ข้อมูลอ้างอิง): `backend/scripts` 7 ไฟล์ / 1,289 บรรทัด · `backend/migrations` 12 / 371 · `scripts/` (Python) 9 / 3,271

### 0.2 เครื่องมือตรวจ (รันจริงตอนเขียนรายงาน)

| ฝั่ง | คำสั่ง | ผล |
|---|---|---|
| backend | `npx tsc --noEmit -p tsconfig.json` | ✅ ผ่าน |
| backend | `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` | ✅ ไม่พบตัวแปร/พารามิเตอร์ที่ไม่ได้ใช้ |
| backend | `npm run build` (รวมใน `run-l2.sh`) | ✅ ผ่าน |
| frontend | `npx tsc -b` | ✅ ผ่าน (tsconfig เปิด `noUnusedLocals`/`noUnusedParameters` อยู่แล้ว) |
| frontend | `npm run build` | ✅ ผ่าน |
| frontend | `npx eslint .` | ❌ 1 error เดิม `components/auth/AuthProvider.tsx:33` (react-hooks/refs "Cannot update ref during render") |
| ทั้งสองฝั่ง | ไฟล์เทสต์อัตโนมัติ | ไม่มี |

### 0.3 baseline ของการเทียบ response (สคริปต์ในโฟลเดอร์ชั่วคราว `scratchpad/errcontract/` — อยู่นอก repo)

| ชุด | ผล | ไฟล์ผล |
|---|---|---|
| ชั้น 2: HTTP 120 กรณี (บูต `AppModule` ที่ build แล้ว + DB จำลอง) เทียบ baseline ของรอบ 1 | **120/120 เหมือน** → โค้ดปัจจุบันยังให้ response เท่ากับก่อนเริ่มงานรวม error ของรอบ 1 | `run-r2-baseline.json` (คัดลอกเป็น `baseline-r2.json` ไว้ใช้เทียบรอบ 2) |
| ในนั้นเป็นกรณีอัปโหลด `drafts upload: …` | 12 กรณี (รวม multer 413/400 และตรวจฟิลด์/ไฟล์) | — |
| ชั้น 1: error 35 ชนิดผ่าน `AllExceptionsFilter` เทียบ filter เดิม | 35/35 ตรง | สคริปต์ `l1-new.js` |
| unit ของ filter กลาง | 27/27 | สคริปต์ `unit-filter.js` |

**ไม่ได้ทดสอบ:** MySQL จริง, LLM จริง, เบราว์เซอร์จริง, Render/Aiven

### 0.4 git
- branch ปัจจุบัน `refactor/cleanup` · commit ล่าสุด `142ea2d` (17 ต.ค. 2569 "refactor")
- **งานรอบ 1 ทั้งหมดยังไม่ถูก commit** (`git status` มี 229 รายการ) → ถ้าเริ่มรอบ 2 ตอนนี้ diff ของรอบ 1 กับรอบ 2 จะปนกัน
- **ผมยังไม่ได้สร้าง branch ใหม่** เพราะการสร้างตอนนี้จะพางานที่ยังไม่ commit ของรอบ 1 ไปด้วย และจุดเริ่มจะไม่ชัด — ดูข้อ F1

---

## Phase 1 — สิ่งที่พบ

**ระดับความเสี่ยง:** ต่ำ = ไม่มีผลภายนอก แก้เฉพาะโครงสร้าง · กลาง = ต้องเทียบผลก่อน/หลังให้ดี · สูง = เปลี่ยนพฤติกรรมที่ผู้ใช้เห็นได้
**ผู้ใช้เห็นต่างไหม:** ทุกข้อใน A–D ออกแบบให้ **ไม่เปลี่ยนพฤติกรรมที่ผู้ใช้เห็น** (ข้อความ/ปุ่ม/รหัส error เท่าเดิม) ข้อที่เปลี่ยนจะเขียนไว้ชัดในข้อนั้น

**ภาพรวมที่ควรรู้ก่อนเลือก:** หลังรอบ 1 ไม่พบไฟล์ที่ไม่มีใคร import และไม่พบตัวแปร/พารามิเตอร์ที่ไม่ได้ใช้ (tsc ยืนยัน) สิ่งที่เหลือส่วนใหญ่คือ **โค้ดซ้ำเล็กๆ หลายจุด** และ **รูปแบบเขียนที่อ่านยากกว่าจำเป็น** ผลรวมทุกข้อถ้าทำครบประมาณ **−300 ถึง −400 บรรทัด (≈ 3%)** — ได้ผลด้าน "อ่านง่ายขึ้น" มากกว่าขนาด

---

### A. ลบได้แน่นอน (ยืนยันด้วย grep / tsc)

| ID | path:บรรทัด | อะไร | หลักฐาน | เสี่ยง | ลดได้ |
|---|---|---|---|---|---|
| A1 | `backend/src/health/health.controller.ts:8-13` | คอมเมนต์อ้าง "ไม่ได้ import DatabaseModule ในไฟล์ health.module.ts" | `health.module.ts` ถูกลบแล้วในรอบ 1 (B4) — ไฟล์ไม่มีแล้ว | ต่ำ | 2–3 บรรทัด (แก้ข้อความ) |
| A2 | `backend/src/admin/admin.module.ts:2` | คอมเมนต์บอกว่ามี "รายการ session" | endpoint `/admin/sessions` ถูกลบแล้ว (รอบ 1 B1) · controller มีแค่ `feedback` และ `analytics/summary` | ต่ำ | แก้ 1 บรรทัด |
| A3 | `backend/src/admin/admin.dto.ts:19-21` · `auth/auth.dto.ts:15-20` · `auth/auth.service.ts:25` · `authoring/graph-validator.ts:20,36,44-54,88` · `history/history.dto.ts:18` · `frontend/src/lib/adminView.ts:11` · `lib/authStorage.ts:34` · `lib/models.ts:7,21` · `lib/textInput.ts:57` | คำว่า `export` บนค่าที่ใช้แค่ในไฟล์ตัวเอง (≈ 25 ตัว) | สคริปต์สแกน export ที่ไม่มีไฟล์อื่นอ้างถึง (นับคำตรงตัวทั้ง `backend/src`, `frontend/src`, `backend/scripts`) | ต่ำ | 0 บรรทัด (บอกคนอ่านว่า "ใช้ในไฟล์นี้เท่านั้น") |

> **ไม่มีไฟล์หรือฟังก์ชันที่ "ไม่มีใครเรียกเลย"** เหลือแล้ว (ตรวจกราฟ import จาก `main.ts`/`main.tsx`: backend 58/58, frontend ทุกไฟล์ถูก import)

### B. รวมไฟล์ / รวมโค้ดซ้ำ

#### Backend
| ID | path:บรรทัด | ซ้ำอะไร | เสนอ | เสี่ยง | ลดได้ |
|---|---|---|---|---|---|
| B1 | `history/history.dto.ts:122` (`HistoryFeedbackDto`) · `:157` (`FeedbackBody`) · `history/history.store.ts:64` (`StoredFeedback`) | ชนิดข้อมูลเดียวกัน 3 ชื่อ (`{ helpful: boolean; comment: string \| null }`) | ใช้ชนิดเดียว | ต่ำ | ~10 |
| B2 | `admin/admin.service.ts:27-33` (`outcomeKindOf`) · `history/history.service.ts:111-118` (`toListItem` ใช้ `renderNodeIfPresent` แล้วดู `isTerminal`) | หา `outcome_kind` ของโหนดสุดท้ายในผังปัจจุบัน 2 วิธี | ใช้ฟังก์ชันเดียว (ให้ผลเท่าเดิม: ไม่มีผัง/โหนด/ไม่ใช่โหนดจบ = null) | กลาง (ต้องเทียบผลรายการประวัติ/สถิติ) | ~8 |
| B3 | `admin.service.ts:24` · `symptom-search/symptom-search.service.ts:27` | `round3` ซ้ำ | ใช้ตัวเดียว | ต่ำ | ~1 |
| B4 | `admin/admin.store.ts:90` · `authoring/drafts.store.ts:93` | `numOrNull` ซ้ำ | ใช้ตัวเดียว | ต่ำ | ~1 |
| B5 | `admin.service.ts:23` · `authoring/drafts.service.ts:23` · `auth/auth.service.ts:37` · `history/history.service.ts:123,138` | แปลงเวลา epoch (วินาที) → ISO ซ้ำ 5 จุด | ใช้ฟังก์ชันเดียว | ต่ำ | ~3 |
| B6 | `auth/auth.dto.ts:58-63` · `traversal/traversal.dto.ts:55-60,168-170` · `history/history.dto.ts:170` · `symptom-search/symptom-search.dto.ts:15` · `admin/admin.dto.ts:40-42` · `authoring/drafts.dto.ts:29-31` · `authoring/draft-schema.ts:47-49` · `authoring/graph-validator.ts:100-102` | ตรวจว่า body เป็น object ธรรมดา (ไม่ใช่ null/array) เขียนซ้ำ 9 จุด | ฟังก์ชันกลาง `isPlainObject()` ตัวเดียว (ข้อความ error ของแต่ละไฟล์คงเดิม) | ต่ำ–กลาง (ต้องเทียบ 120 กรณี) | ~15 |
| B7 | `authoring/drafts.service.ts:22` (`UUID_PATTERN`) · `traversal/traversal.dto.ts:17` (`CLIENT_ID_PATTERN`) | regex UUID เดียวกัน 2 ที่ | ใช้ตัวเดียว | ต่ำ | ~1 |

#### Frontend
| ID | path:บรรทัด | ซ้ำอะไร | เสนอ | เสี่ยง | ลดได้ |
|---|---|---|---|---|---|
| B8 | 12 จุด: `components/auth/AdminRoute.tsx:26` · `pages/AdminAnalyticsPage.tsx:69` · `AdminDraftReviewPage.tsx:37,78` · `AdminDraftsPage.tsx:37` · `AdminFeedbackPage.tsx:104` · `AllSymptomsPage.tsx:71` · `DevicesPage.tsx:54` · `HistoryDetailPage.tsx:66` · `HistoryPage.tsx:83` · `HomePage.tsx:35` · `SessionPage.tsx:109` | ย่อหน้า "ไอคอนหมุน + ข้อความกำลังโหลด" เขียนซ้ำ (4 บรรทัดต่อจุด) | คอมโพเนนต์ `LoadingText` ตัวเดียว (markup/คลาสเท่าเดิมทุกตัวอักษร) | ต่ำ | ~35 |
| B9 | `pages/AdminDraftReviewPage.tsx:16` · `AllSymptomsPage.tsx:25` · `HistoryDetailPage.tsx:33` · `HistoryPage.tsx:22` · `SymptomsPage.tsx:33` | ค่าคลาสลิงก์ `LINK_CLASSES` เหมือนกันทุกตัวอักษร 5 ไฟล์ | ค่าคงที่ที่เดียว | ต่ำ | ~4 |
| B10 | `components/auth/TextField.tsx:3-57` · `components/admin/drafts/UploadDraftForm.tsx:12-56` (`Field`) · `pages/AdminFeedbackPage.tsx:22-23` | ช่องกรอก "ป้าย + คำอธิบาย + error" ทำ 2 แบบ และคลาสช่องกรอกซ้ำ 3 ที่ | ให้ `UploadDraftForm` ใช้รูปแบบเดียวกับ `TextField` (หรือแชร์คลาส) | กลาง (UploadDraftForm มีทั้ง input/select/file — ต้องดูว่าทำได้โดยไม่ซับซ้อนกว่าเดิม) | ~20 |
| B11 | `pages/LoginPage.tsx:90-96` · `pages/RegisterPage.tsx:88-101` | กล่อง error ของฟอร์มทำเองซ้ำ (ไม่ได้ใช้ `ErrorNotice`) | ใช้ `ErrorNotice` ได้ **ถ้ายอมรับความต่าง**: `ErrorNotice` แสดงปุ่ม/ลิงก์ตาม `recovery` (เช่น `login`) — **ข้อนี้เปลี่ยนสิ่งที่ผู้ใช้เห็นเล็กน้อย** ดู F6 | กลาง | ~10 |
| B12 | `lib/draftView.ts:165` (`DRAFT_DEVICE_CATEGORIES`) · `lib/labels.ts:3-9` · `pages/DevicesPage.tsx:28` (`CATEGORY_ORDER`) | รายการ 5 หมวดเครื่อง 2 ที่ | สร้างจาก `DEVICE_CATEGORY_LABELS` ที่เดียว (ลำดับเท่าเดิม) | ต่ำ | ~1 |
| B13 | `api/admin.ts:12-20` · `lib/adminParams.ts:32-39` | สร้าง query string ของ feedback ซ้ำ (ต่างกันที่ page/pageSize) | ใช้ฟังก์ชันเดียวแล้วเติม `pageSize` | ต่ำ | ~5 |
| B14 | `api/auth.ts:14-17` (`toSession`) · `:39-49` (`getMe`) | หยิบ `{id, displayName, role}` ซ้ำ 2 ที่ | ฟังก์ชันเดียว | ต่ำ | ~5 |

### C. Logic ที่ซับซ้อนเกินไป (พร้อมก่อน/หลังแบบสั้น)

**C1 — `frontend/src/lib/errors.ts:54-332` switch 38 กรณี (คืน object ทีละกรณี) → ตาราง** · เสี่ยง ต่ำ (ข้อความเท่าเดิมทุกตัวอักษร ตรวจด้วยสคริปต์เทียบผล `describeError` ทุกรหัสก่อน/หลัง) · ลดได้ ~80 บรรทัด
```ts
// ก่อน (6 บรรทัดต่อรหัส × 38)
case 'SESSION_NOT_FOUND':
  return { title: 'ไม่พบการตรวจนี้', detail: '…', recovery: 'back-to-symptoms' }
// หลัง (ตารางอ่านเป็นแถว; เหลือ if เฉพาะ 3 รหัสที่ใช้ error.message ประกอบ: INVALID_DRAFT_REQUEST, PDF_PAGE_TOO_LONG, DRAFT_ID_CONFLICT)
const MESSAGES: Record<string, ErrorDescription> = {
  SESSION_NOT_FOUND: { title: 'ไม่พบการตรวจนี้', detail: '…', recovery: 'back-to-symptoms' },
  …
}
```

**C2 — `frontend/src/api/queries.ts` ตัวสร้าง `queryOptions` ที่ใช้ครั้งเดียว 6 ตัว** (`healthQuery` :29-34, `graphsQuery` :40-45, `manualsQuery` :48-53, `historyListQuery` :62-66, `adminFeedbackQuery` :75-79, `adminSummaryQuery` :81-85) + คอมเมนต์ซ้ำ (:36-39 กับ :108-111) → เขียนลงใน hook ตรงๆ · เก็บตัวที่ใช้หลายที่ (`sessionQuery`, `historyDetailQuery`, `adminDraftQuery`, `adminDraftsQuery`) · เสี่ยง ต่ำ (key/option เท่าเดิม) · ลดได้ ~35
```ts
// ก่อน
const manualsQuery = () => queryOptions({ queryKey: ['manuals'] as const, queryFn: listManuals, staleTime: Infinity })
export function useManuals() { return useQuery(manualsQuery()) }
// หลัง
export function useManuals() {
  return useQuery({ queryKey: ['manuals'], queryFn: listManuals, staleTime: Infinity })
}
```

**C3 — `backend/src/admin/admin.dto.ts`: generic ที่ใช้ครั้งเดียว** · `optionalEnum<T>` (:67-74) ใช้กับ `helpful` จุดเดียว (:167) และ `PagedDto<T>` (:189-195) ใช้กับชนิดเดียว → เขียนตรงๆ · เสี่ยง ต่ำ (ข้อความ error เท่าเดิม) · ลดได้ ~10
```ts
// ก่อน
const helpful = optionalEnum(source.helpful, 'helpful', ['true', 'false'] as const);
// หลัง
const helpfulText = optionalText(source.helpful, 'helpful');
if (helpfulText !== undefined && helpfulText !== 'true' && helpfulText !== 'false') throw invalid('helpful ต้องเป็นหนึ่งใน true, false');
```

**C4 — `backend/src/admin/admin.store.ts:29-47` ตัวช่วย `joinWhere` / `timeClauses` / `Where` ใช้แค่ใน `listFeedback`** → เขียนเงื่อนไขในฟังก์ชันนั้นตรงๆ · เสี่ยง ต่ำ–กลาง (SQL ต้องเหมือนเดิม; ชั้น 2 มีกรณี admin feedback) · ลดได้ ~10

**C5 — `backend/src/authoring/graph-validator.ts` จุดที่ใช้เทคนิคเกินระดับที่ต้องอธิบาย** · เสี่ยง กลาง (ต้องเทียบผลตรวจกับผังจริง 644 ผัง + ร่างตัวอย่าง เหมือนตอนปรับไฟล์นี้ในรอบก่อน) · ลดได้ ~15
- `reach()` (:497-507) ใช้ `for (let id = stack.pop(); id !== undefined; id = stack.pop())` → เปลี่ยนเป็น `while (stack.length > 0) { const id = stack.pop()! … }`
- `templateVariables()` (:459-467) ใช้ closure + memo `Map` (`reachedWithout`) → ลูปธรรมดาต่อตัวแปร
- `analyzePaths()` (:513-528) recursion ใน closure ที่เก็บสถานะ `'open' | number` ใน Map เดียว → แยกเป็นตัวแปร 2 ชุด (กำลังเยี่ยม / ความยาว) ให้อ่านง่าย (ยังเป็น DFS เดิม)

**C6 — `backend/src/authoring/draft-manual.ts:62-66` ชนิด `Record<(typeof MANUAL_COLUMNS)[number], unknown>`** (mapped type จากอาร์เรย์ `as const`) → `Record<string, unknown>` · เสี่ยง ต่ำ (ไม่มีผลตอนรัน แต่ TypeScript จะไม่ช่วยจับชื่อคอลัมน์สะกดผิดอีก) · ลดความซับซ้อนของชนิด ไม่ลดบรรทัด

**C7 — `frontend/src/lib/adminParams.ts:42-48` `patchFeedbackParams` ใช้ ternary ซ้อนกับ `'page' in patch`** → if/else 2 กรณี (เปลี่ยนตัวกรอง → หน้า 1 / เปลี่ยนหน้า) · เสี่ยง ต่ำ · +2 บรรทัด แต่อ่านง่ายขึ้น

**C8 — `frontend/src/components/auth/AuthProvider.tsx:31-33` error ของ eslint เดิม** (`locationRef.current = location` ระหว่าง render) → ย้ายไปอัปเดตใน `useEffect` · ตัวจัดการ 401 อ่าน `locationRef.current` ตอนเกิดเหตุการณ์ (หลัง render เสร็จ) จึงได้ค่าล่าสุดเหมือนเดิม · **ผมคาดว่าไม่เปลี่ยนพฤติกรรม แต่ยังไม่ได้ทดสอบในเบราว์เซอร์** · เสี่ยง ต่ำ–กลาง · ผล: eslint เหลือ 0 error

**C9 — ชื่อที่สับสน:** `MAX_MANUAL_ID_LENGTH` มี 2 ค่าใน 2 ไฟล์ (`authoring/drafts.dto.ts:20` = 60 สำหรับรหัสคู่มือใหม่, `symptom-search/symptom-search.dto.ts:4` = 80 สำหรับรหัสที่รับตอนค้น/เริ่ม session) → เปลี่ยนชื่อให้บอกที่ใช้ (ค่าเท่าเดิม) · เสี่ยง ต่ำ · 0 บรรทัด

### D. ไฟล์ใหญ่/อ่านยากที่สุด 10 อันดับ + วิธีทำให้อ่านง่ายขึ้น

| # | ไฟล์ | บรรทัด | สังเกต | เสนอ |
|---|---|---|---|---|
| 1 | `backend/src/authoring/graph-validator.ts` | 528 | คลาส `Validator` เมธอด `node()` (:297-370) และ `structure()` (:376-449) ยาว 70+ บรรทัด · มีโหมด `existing` ที่ไม่มีผู้เรียก (ดู F2) | C5 + แบ่ง `structure()` เป็น `checkEdges` / `checkReachability` / `checkWarnings` · F2 |
| 2 | `frontend/src/api/queries.ts` | 377 | ตัวสร้าง query ใช้ครั้งเดียว 6 ตัว · คอมเมนต์ซ้ำ · `onSuccess` ใส่ cache session ซ้ำ 3 ที่ (:208-210, :228-230, :248-250) | C2 + ฟังก์ชันเดียวสำหรับ "ใส่ session ลง cache" |
| 3 | `frontend/src/api/types.ts` | 346 | สำเนาชนิด response จาก backend (import ชนิดจาก DTO ของ backend ตรงๆ ไม่ได้ เพราะ DTO ดึง `@nestjs/*` ซึ่ง frontend ไม่มี — ดู E8) | คงไว้ · ลบเฉพาะคอมเมนต์ที่ซ้ำกับชื่อฟิลด์ (เล็กน้อย) |
| 4 | `frontend/src/lib/errors.ts` | 332 | switch 38 กรณี | C1 |
| 5 | `backend/src/traversal/graph.repository.ts` | 305 | `buildNode` (:224-285) switch ตามชนิดโหนด ชัดเจนอยู่แล้ว | คงไว้ (E3) |
| 6 | `backend/src/traversal/traversal.service.ts` | 300 | 114 บรรทัดเป็นคอมเมนต์อธิบาย (มีค่าต่อการสอบ) | ไม่แตะเนื้อโค้ด · ตัดคอมเมนต์ที่พูดซ้ำกับชื่อเมธอดได้เล็กน้อย |
| 7 | `backend/src/authoring/drafts.service.ts` | 282 | `list()` / `toDetail()` (:131-154, :257-281) map ฟิลด์ชุดเดียวกันซ้ำ | ให้ `toDetail` ใช้ส่วน summary ร่วมกับ `list` (~10 บรรทัด) |
| 8 | `backend/src/authoring/drafts.store.ts` | 262 | `json()` / `numOrNull` ซ้ำกับไฟล์อื่น (B4) | B4 |
| 9 | `backend/src/history/history.service.ts` | 261 | `buildDetail` (:129-190) ยาวแต่เป็นขั้นตอนชัด | B2 · แยก "หาคำเตือนความปลอดภัย" (:174-179) เป็นฟังก์ชันสั้น (ไม่บังคับ) |
| 10 | `backend/src/traversal/session.store.ts` | 257 | `update()` transaction ชัดเจน · `rowToAction` switch ตรวจข้อมูลเสีย | คงไว้ (E5) |

### E. ซับซ้อนแต่จำเป็นต้องเก็บ (พร้อมเหตุผลตามโค้ด)

| ID | ส่วน | ทำไมเก็บ |
|---|---|---|
| E1 | `traversal-engine/traversal-engine.ts` | ที่เดียวที่ตัดสินขั้นถัดไปและด่าน `safety_critical` (invariant) |
| E2 | `traversal/traversal.service.ts` ลำดับ "engine ก่อน → บันทึก" | กลไกที่ทำให้ไม่ต้องมีโค้ดย้อนสถานะ |
| E3 | `traversal/graph.repository.ts` `loadAll` สร้าง Map ใหม่ก่อนสลับ (:150-172) | reload ระหว่างระบบทำงานแล้วล้มต้องไม่ทำให้ผังเดิมหาย |
| E4 | `symptom-search/*` ดัชนีในหน่วยความจำ + `addGraphs` | invariant: cosine ใน TypeScript, เกณฑ์/จำนวนผลเท่าเดิม |
| E5 | `traversal/session.store.ts` `update()` transaction | UPDATE + INSERT ต้องสำเร็จพร้อมกัน |
| E6 | `authoring/drafts.store.ts` `publish()` (`FOR UPDATE` + ตรวจซ้ำ + INSERT ล้วน) | ไม่มีช่องว่างระหว่างตรวจกับเขียน · ไม่เขียนทับผังเดิม |
| E7 | `history/history.service.ts` `replayReaches` | กันโชว์ขั้นตอนเก่าคู่ข้อสรุปใหม่เมื่อผังเปลี่ยน |
| E8 | `frontend/src/api/types.ts` สำเนาชนิดจาก backend | frontend import ได้เฉพาะไฟล์ที่ไม่ดึงไลบรารีของ Nest (เช่น `traversal-engine/types.ts` ที่ import อยู่แล้ว) — DTO อื่นดึง `ApiError`/Nest มาด้วย |
| E9 | `admin/admin.dto.ts` + `admin.service.ts` วันที่เวลาไทย | สถิติรายวันต้องตรงวันไทย ไม่พึ่ง time_zone ของ MySQL (รอบ 1 ข้าม C7 ด้วยเหตุผลนี้) |
| E10 | `common/all-exceptions.filter.ts` + `UploadErrorsFilter` | สัญญา error ที่ frontend ใช้ (ห้ามเปลี่ยน) |
| E11 | `database/database.constants.ts` (1 บรรทัด) | ค่าคงที่ `MYSQL_POOL` แยกไฟล์เพื่อให้ store ทุกตัว import ได้โดยไม่ต้อง import ไฟล์โมดูล (ไม่ทราบว่าผู้พัฒนาตั้งใจกันการ import วนหรือไม่ — แต่แยกไว้ไม่มีข้อเสีย) |

### F. เรื่องที่ต้องให้คุณตัดสินใจ

| ID | เรื่อง | ทางเลือก | ผลต่อผู้ใช้ |
|---|---|---|---|
| **F1** | **ลำดับ git:** งานรอบ 1 ยังไม่ commit | (ก) แนะนำ: คุณ commit รอบ 1 ก่อน แล้วผมจะบอกคำสั่งสร้าง branch `refactor/simplify-2` จาก commit นั้น · (ข) ทำต่อบน branch เดิมโดยไม่ commit (diff รอบ 1 กับรอบ 2 จะปนกัน) | ไม่มี |
| **F2** | `graph-validator.ts` โหมด `'existing'` **ไม่มีผู้เรียกในโค้ด** (มีแค่ `drafts.service.ts:202,244` ที่ใช้ `'draft'`) | (ก) ลบโหมด `existing` และค่าคงที่/กิ่งที่ใช้เฉพาะโหมดนี้ (`:20,83-84,94-95,227,301,303` และหัวไฟล์) ~25 บรรทัด — ผลการตรวจร่างเท่าเดิม แต่จะ **ตรวจผังเดิม 644 ผังด้วยไฟล์นี้ไม่ได้อีก** (ไฟล์ Python `scripts/validate_graph.py` ยังทำได้) · (ข) เก็บไว้เป็นเครื่องมือยืนยันว่าตัวตรวจถูก (หัวไฟล์อ้างผลตรวจ 644 ผัง) | ไม่มี |
| **F3** | `pages/AdminDraftReviewPage.tsx` คอมเมนต์หัวฟังก์ชัน 8 บรรทัด **หายไปจากการเขียนทับภายนอกเมื่อ 17:42** (มีใน HEAD) | (ก) ใส่คืน · (ข) ปล่อยไว้ | ไม่มี (คอมเมนต์) |
| **F4** | dependency ที่ไม่พบการ import: `@nestjs/schematics` (ใช้กับคำสั่ง `nest generate` เท่านั้น) และ `@types/multer` (โค้ดไม่ได้ใช้ชนิด `Express.Multer`) | ถอด (ต้องอนุมัติตามข้อตกลง) แล้วตรวจ `tsc`/build · หรือเก็บ · **ผมไม่แนะนำแตะตัวอื่น** ที่ดูเหมือนไม่ถูก import (`reflect-metadata`, `rxjs`, `@nestjs/cli`, `typescript`, `@types/*`, `postcss`, `autoprefixer`, `gh-pages`) เพราะถูกใช้ทางอ้อมผ่าน Nest/เครื่องมือ build | ไม่มี |
| **F5** | **C5 ของรอบ 1 (ยังไม่ได้ทำ):** `queries.ts` ใส่ `identity` ใน key ทุกตัว **และ** ล้าง cache ทั้งหมดตอน login/logout (กันสองชั้น) | (ก) เก็บไว้ (แนะนำก่อนสอบ — ลดได้ ~25 บรรทัดแต่ต้องตรวจ race ที่คำขอค้างตอบหลังเปลี่ยนผู้ใช้) · (ข) เหลือชั้นเดียว | ไม่น่าต่าง แต่พิสูจน์ได้ยากโดยไม่ทดสอบในเบราว์เซอร์ |
| **F6** | B11: ใช้ `ErrorNotice` ในหน้า Login/Register | (ก) ไม่ทำ · (ข) ทำ — **ผู้ใช้จะเห็นต่าง**: กล่อง error ของฟอร์มจะมีปุ่ม/ลิงก์ตาม `recovery` (เช่น `NETWORK_ERROR` จะไม่มีปุ่ม เพราะไม่ส่ง `onRetry` · `UNAUTHENTICATED` จะมีลิงก์ "เข้าสู่ระบบ") และหน้า Register ยังต้องคงลิงก์ "ไปหน้าเข้าสู่ระบบ" ของ `EMAIL_TAKEN` | **เปลี่ยนเล็กน้อย** |
| **F7** | C8 แก้ eslint error ที่ `AuthProvider.tsx:33` | ทำ / ไม่ทำ | ไม่ควรต่าง (ไม่ได้ทดสอบเบราว์เซอร์) |

---

## สรุปข้อที่ "เปลี่ยนพฤติกรรมที่ผู้ใช้เห็น"
- **เปลี่ยน:** F6 (ถ้าเลือกทำ B11) เท่านั้น
- **ไม่เปลี่ยน (ตามที่ออกแบบ):** A1–A3, B1–B10, B12–B14, C1–C9, F1–F5, F7 — ข้อที่แตะ backend ต้องผ่านชุดเทียบ 120/35/27 ให้เหมือน baseline รอบ 2 ทุกกรณี · C1 จะเทียบผลของ `describeError` ทุกรหัสก่อน/หลังด้วยสคริปต์ · C5 จะเทียบผลตรวจผังกับข้อมูลจริง

## ลำดับที่แนะนำ (ถ้าเลือกทำ)
1. **F1** (commit รอบ 1 / สร้าง branch) ก่อนแก้ไฟล์แรก
2. **A1–A3 + B3, B4, B5, B7, B9, B12, B14** (เสี่ยงต่ำ ไม่เปลี่ยนอะไรภายนอก)
3. **B1, B6, B13, C2, C3, C4, C6, C7, C9**
4. **C1** (errors.ts → ตาราง) พร้อมสคริปต์เทียบข้อความ
5. **B8, B10** (คอมโพเนนต์ใช้ซ้ำฝั่งหน้าจอ)
6. **B2, C5** (เสี่ยงกลาง ต้องเทียบผลกับข้อมูลจริง) · **F2** ถ้าเลือก (ก)
7. **C8/F7** ถ้าอนุมัติ · **F4, F5, F6** ตามที่คุณตัดสิน

**ประมาณการถ้าทำ 2–6 ครบ:** backend −70 ถึง −100 บรรทัด, frontend −190 ถึง −230 บรรทัด, ไฟล์ +1 ถึง +2 (คอมโพเนนต์/ตัวช่วยใหม่) · ถ้าเลือก F2 (ก) อีก −25

## คำถามที่ต้องตอบก่อนเริ่ม Phase 2
1. F1: commit รอบ 1 ก่อนไหม (แนะนำ) และให้ผมสร้าง branch ใหม่หรือไม่
2. เลือกข้อที่จะทำ (เช่น "ข้อ 2–5 ทั้งหมด, B2, C5")
3. F2 (โหมด `existing`) · F3 (คอมเมนต์ที่หาย) · F4 (ถอด 2 dependency) · F5 · F6 · F7 ตัดสินอย่างไร
