# หน้า "ประวัติการซ่อม" (Repair History)

ทำเมื่อ 15 ต.ค. 2569 · เส้นทาง `/#/history` และ `/#/history/:sessionId`
ผ่านเครื่องตรวจ (tsc / eslint / jest / vitest / build) · **ยังไม่ได้ดูด้วยตาในเบราว์เซอร์ ยังไม่ได้รัน migration ยังไม่ได้ deploy**

---

## 1. ภาพรวมและ flow

หน้านี้ให้ผู้ใช้เปิดดูผลการตรวจอาการที่ "จบแล้ว" ย้อนหลัง กรอง/ค้นหา/เรียงตามวันที่ ลบรายการ ให้คะแนน 👍/👎 และตรวจซ้ำได้

ระบบนี้ไม่มีล็อกอิน จึงผูกประวัติกับ "เบราว์เซอร์" ด้วย `client_id` (UUID ที่เบราว์เซอร์สุ่มสร้างเองครั้งเดียว เก็บใน localStorage)

```
เบราว์เซอร์                                    backend                         MySQL
───────────                                    ───────                         ─────
เปิดเว็บ → getClientId()  (สร้าง/อ่าน UUID)
เริ่มตรวจ  POST /traversal/sessions
           + หัวข้อ X-Client-Id ───────────────► SessionStore.create ─────────► sessions.client_id
ตอบจนจบ    POST …/actions ─────────────────────► update(): status=completed ──► expires_at = +90 วัน
                                                                              (ที่ยังไม่จบ = 24 ชม. เหมือนเดิม)
เปิด /history
           GET /history?…  + X-Client-Id ──────► HistoryService.list ─────────► WHERE client_id=? AND
                                                 (กรอง/เรียง/แบ่งหน้า            status='completed' AND
                                                  ในหน่วยความจำ + ผังใน RAM)      expires_at > NOW()
กดแถว      GET /history/:id ───────────────────► detail: อ่านขั้นที่เคยผ่าน
                                                 + replay ผ่าน engine ในผังปัจจุบัน
ให้คะแนน   POST /history/:id/feedback ─────────► session_feedback (upsert)
ลบ         DELETE /history/:id ────────────────► DELETE sessions (CASCADE ลบ history/feedback)
```

ข้อสำคัญของการออกแบบ (ตรงกับกฎของโครงงาน):

- **ไม่มีตรรกะขั้นตอนใหม่** ข้อความ/โหนดทุกอย่างมาจาก engine (`getCurrentNode`, `submitAction`) ตรงๆ
  `HistoryService` ไม่เรียก LLM (ไม่มี displayText) ไม่เดาสาเหตุ ไม่คิดเกณฑ์ confidence ใหม่
- หน้าจอแสดงเฉพาะสิ่งที่ API ส่งมา ไม่แต่งขั้นตอน/reference/คะแนนเอง
- `client_id` เป็นข้อมูลบันทึกอย่างเดียว engine ไม่เห็นและไม่ใช้ตัดสินขั้นตอน

---

## 2. การตัดสินใจ

### ที่ตกลงกันไว้ (D1–D7)

| # | เรื่อง | ที่ทำ |
|---|---|---|
| D1 | ตัวระบุเจ้าของ | `client_id` = UUID ในเบราว์เซอร์ ไม่ใช่การยืนยันตัวตน (ดูหัวข้อ 8) |
| D2 | อายุข้อมูล | session ที่ `completed` ตั้ง `expires_at` = +90 วัน ที่ไม่จบยัง 24 ชม. |
| D3 | รายการ | แสดงเฉพาะ session ที่จบแล้ว |
| D4 | ให้คะแนน | 👍/👎 พร้อมช่องข้อความ · `comment TEXT NULL` ไม่เกิน **500** ตัวอักษร · ว่าง = NULL · `POST /history/:id/feedback` รับ `{ helpful, comment? }` |
| D5 | ปุ่มตรวจซ้ำ | "ตรวจอาการนี้อีกครั้ง" / "ตรวจอาการอื่นของรุ่นนี้" ใช้ `useStartSymptom` และ `otherSymptomsPath` เดิม · detail ส่ง `graphId`/`manualId`/`modelSelection` (NULL ส่งเป็น NULL) |
| D6 | confidence | ไม่ตั้งเกณฑ์ใหม่ · `null` แสดง "ไม่มีคะแนน" · `handoff_unknown` = "หลักฐานไม่เพียงพอ" ใช้ข้อความโหนดสุดท้ายจากเซิร์ฟเวอร์ |
| D7 | Possible Cause | ไม่แสดง (ไม่มีข้อมูล ไม่ใส่หัวข้อว่าง) |

ป้ายสถานะ (ตัดสินจาก `outcome_kind` ของโหนดสุดท้ายเท่านั้น):

| `outcome_kind` | ป้าย |
|---|---|
| `user_fixed` | แก้ได้แล้ว |
| `handoff_informed` | ยังไม่ได้แก้ |
| `handoff_unknown` | หลักฐานไม่เพียงพอ |
| `normal_behavior` | เครื่องทำงานปกติ ไม่ได้เสีย (ข้อความเดิมจาก `OUTCOME_TITLES`) |

### ที่ผมตัดสินใจเอง — ขอให้ตรวจ

| เรื่อง | ที่เลือก | เหตุผล / ผลถ้าไม่เห็นด้วย |
|---|---|---|
| ส่ง client id อย่างไร | หัวข้อ HTTP `X-Client-Id` (ไม่ใช่ query/body) | ไม่ติดใน URL/log · CORS ของ `enableCors` สะท้อนหัวข้อที่ขอมาให้เอง ไม่ต้องแก้ main.ts |
| ให้คะแนนซ้ำ | 1 session = 1 คะแนน ส่งซ้ำ = **แทนที่ทั้งชุด** (ไม่มี 409) ถ้าครั้งหลังไม่ส่ง `comment` ข้อความเดิมถูกล้างเป็น NULL | ต่างจากผลลัพธ์ที่บันทึกได้ครั้งเดียว เพราะผู้ใช้เปลี่ยนใจได้ · หน้าจอส่งค่าทั้งชุดเสมอ |
| ปุ่มที่สองเมื่อ `modelSelection` เป็น NULL | ป้ายเป็น "ตรวจอาการอื่น" (ไม่มีคำว่า "ของรุ่นนี้") และพาไป `/symptoms/all` | ถ้าพาไปหน้าของรุ่น การเริ่มตรวจต่อจากนั้นจะถูกบันทึกเป็น `selected` ทั้งที่ผู้ใช้ไม่ได้เลือกรุ่น (เรื่องที่เราแก้ไปแล้วในระยะ 3) |
| วันที่ที่แสดง | เวลาเริ่มตรวจ (`sessions.created_at`) | `updated_at` เลื่อนทุกครั้งที่บันทึกผลลัพธ์ |
| หัวข้อกล่องแดง | "คำเตือนด้านความปลอดภัย" | สเปกบอกแค่ "Safety (กล่องแดง)" · **นี่เป็นถ้อยคำที่ผมเขียน** (ตัวคำเตือนข้างในมาจากผังตรงๆ) ขอให้คุณยืนยัน/แก้ที่ `HistoryDetailPage.tsx` |
| มีหัวข้อ "ขั้นตอนที่ผ่านมา" | เพิ่มรายการขั้นที่ผู้ใช้เคยผ่านพร้อมสิ่งที่ตอบ | ข้อความโหนดสุดท้ายอย่างเดียวมักไม่บอกว่าแก้อย่างไร (คำเตือนก็มาจากเส้นทางนี้) ใช้ `toTrailEntry` ตัวเดิมกับหน้าตรวจ |
| ข้อความใต้หัวหน้ารายการ | "ประวัติผูกกับเบราว์เซอร์เครื่องนี้และเก็บไว้ 90 วัน ถ้าล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนเครื่องจะไม่เห็นประวัติเดิม" | ข้อจำกัดข้อ 2 ผู้ใช้ควรรู้ตั้งแต่หน้านี้ |
| ผังเปลี่ยนแล้วตอบอย่างไร | detail ตอบ 200 พร้อม `available:false` (ไม่ใช่ 4xx/5xx) | ให้หน้ายังลบ/ดูข้อความที่ผู้ใช้บันทึกเองได้ |
| รายการแบ่งหน้า | 10 แถว/หน้า (เซิร์ฟเวอร์รับ 1–50) · หน้าที่เกินถูกดึงกลับหน้าสุดท้าย | ลบแถวสุดท้ายของหน้าแล้วไม่เจอหน้าว่าง |

---

## 3. ไฟล์ที่สร้าง/แก้

### backend

| ไฟล์ | | เหตุผล |
|---|---|---|
| `migrations/008_add_session_client_id.sql` | สร้าง | `sessions.client_id CHAR(36) NULL` + index `(client_id, status, expires_at)` คำสั่ง DDL เดียว |
| `migrations/009_create_session_feedback.sql` | สร้าง | ตาราง `session_feedback`: `session_id` (PK, FK CASCADE), `helpful TINYINT(1) NOT NULL`, **`comment TEXT NULL`** คำสั่ง DDL เดียว |
| `src/traversal/session.store.ts` | แก้ | `create()` รับ `clientId` · `update()` ตั้ง +90 วันตอนจบ · export `rowToHistoryEntry`/`parseVariables`/`HistoryRow` ให้หน้าประวัติแปลงแถวแบบเดียวกับตอนเดินขั้นตอน |
| `src/traversal/traversal.dto.ts` | แก้ | `InvalidClientIdError`, `parseOptionalClientId`, `parseRequiredClientId` |
| `src/traversal/traversal.controller.ts` | แก้ | `POST /traversal/sessions` อ่านหัวข้อ `X-Client-Id` (ไม่บังคับ) |
| `src/traversal/traversal.service.ts` | แก้ | ส่ง `clientId` ต่อให้ store |
| `src/traversal/traversal.exception.filter.ts` | แก้ | `InvalidClientIdError` → 400 `INVALID_CLIENT_ID` |
| `src/history/history.dto.ts` | สร้าง | type ของ API + ตัวตรวจ query/feedback |
| `src/history/history.store.ts` | สร้าง | SQL ทั้งหมดของหน้าประวัติ (ทุกคำสั่งมี `client_id`) |
| `src/history/history.service.ts` | สร้าง | list / detail / remove / saveFeedback · replay ผ่าน engine · รองรับผังหาย |
| `src/history/history.controller.ts` | สร้าง | 4 endpoint |
| `src/history/history.exception.filter.ts` | สร้าง | แปลง error → HTTP (ที่เหลือส่งต่อ `toErrorBody` ของ traversal) |
| `src/history/history.module.ts` | สร้าง | ประกอบโมดูล (import `GraphModule`) |
| `src/app.module.ts` | แก้ | เพิ่ม `HistoryModule` |
| `src/history/*.spec.ts` (3 ไฟล์) | สร้าง | เทสต์ (ดูหัวข้อ 7) |

> `HistoryStore` แยกจาก `SessionStore` โดยตั้งใจ: `SessionStore` คือที่เก็บสถานะของการ "เดิน" ขั้นตอนและไม่ควรรู้เรื่องหน้าประวัติ

### frontend

| ไฟล์ | | เหตุผล |
|---|---|---|
| `src/lib/clientId.ts` | สร้าง | สร้าง/อ่าน UUID (localStorage ใน try/catch · ใช้ไม่ได้ก็จำในหน่วยความจำของแท็บ) |
| `src/api/http.ts` | แก้ | `RequestOptions.headers` |
| `src/api/types.ts` | แก้ | type ของประวัติ (`HistoryParams`, `HistoryListItem`, `HistoryDetail` …) |
| `src/api/history.ts` | สร้าง | `listHistory`/`getHistory`/`deleteHistory`/`submitFeedback` (แนบ `X-Client-Id`) |
| `src/api/traversal.ts` | แก้ | `startSession` แนบ `X-Client-Id` |
| `src/api/queries.ts` | แก้ | `useHistory`, `useHistoryDetail`, `useDeleteHistory`, `useSubmitFeedback` + query key |
| `src/lib/historyParams.ts` | สร้าง | URL ↔ ตัวกรอง/เรียง/หน้า (ค่าที่ไม่รู้จักถูกปัดเป็นค่าเริ่มต้น) |
| `src/lib/historyView.ts` | สร้าง | วันที่ (พ.ศ.), ชื่อที่แสดง, ค่าคงที่ 90 วัน, สีป้าย |
| `src/lib/feedback.ts` | สร้าง | เพดาน 500, ตัดช่องว่าง, ว่าง → null, เทียบกับค่าที่บันทึกไว้ (รูปแบบเดียวกับ `lib/outcome.ts`) |
| `src/lib/labels.ts` | แก้ | `HISTORY_STATUS_LABELS`, `HISTORY_STATUS_ORDER` |
| `src/lib/errors.ts` | แก้ | `INVALID_CLIENT_ID`, `INVALID_HISTORY_QUERY`, `INVALID_FEEDBACK`, `HISTORY_NOT_FOUND` + recovery `back-to-history` |
| `src/components/history/HistoryFilters.tsx` | สร้าง | ค้นหา + ประเภท/ยี่ห้อ/สถานะ + เรียง |
| `src/components/history/HistoryRow.tsx` | สร้าง | 1 แถว + ลบ (ยืนยันในแถว) |
| `src/components/history/DeleteConfirm.tsx` | สร้าง | ขั้นยืนยันลบ ใช้ร่วมแถว/หน้ารายละเอียด |
| `src/components/history/Pagination.tsx` | สร้าง | ก่อนหน้า/ถัดไป |
| `src/components/history/FeedbackButtons.tsx` | สร้าง | 👍/👎 + ช่องข้อความ (ชื่อตาม roadmap B12) |
| `src/components/history/HistoryErrorNotice.tsx` | สร้าง | กล่องข้อผิดพลาด (ข้อความจาก `describeError`) |
| `src/pages/HistoryPage.tsx` | สร้าง | หน้ารายการ |
| `src/pages/HistoryDetailPage.tsx` | สร้าง | หน้ารายละเอียด |
| `src/App.tsx`, `src/components/layout/AppShell.tsx` | แก้ | route + เมนู "ประวัติการซ่อม" (ไฮไลต์ต่อเนื่องเมื่ออยู่ใน `/history/:id`) |
| `src/lib/clientId.test.ts`, `historyParams.test.ts`, `feedback.test.ts`, `src/pages/History*.test.tsx` | สร้าง | เทสต์ |

---

## 4. Endpoint และ type

ทุก endpoint ของ `/history` **บังคับ** หัวข้อ `X-Client-Id: <uuid>` (ไม่ส่ง/ไม่ใช่ UUID → 400 `INVALID_CLIENT_ID`)
session ที่ไม่ใช่ของ id นั้น / ยังไม่จบ / หมดอายุ / ไม่มี → **404** `HISTORY_NOT_FOUND` เหมือนกันหมด (ไม่ใช่ 403)

| Method + path | ส่ง | สำเร็จ | error |
|---|---|---|---|
| `GET /history` | query: `q`, `category`, `brand`, `status`, `sort=newest\|oldest`, `page`, `pageSize` (ทั้งหมดไม่บังคับ) | 200 `HistoryListResponse` | 400 `INVALID_HISTORY_QUERY` |
| `GET /history/:id` | – | 200 `HistoryDetail` | 404 |
| `POST /history/:id/feedback` | `{ helpful: boolean, comment?: string }` — `helpful` ต้องเป็น boolean จริง · `comment` ตัดช่องว่างหน้าหลัง, ว่าง/ไม่ส่ง/`null` = NULL, ยาวเกิน **500** ตัวอักษร → 400 | 200 `{ helpful, comment }` | 400 `INVALID_FEEDBACK` · 404 |
| `DELETE /history/:id` | – | 204 | 404 |
| `POST /traversal/sessions` (เดิม) | + หัวข้อ `X-Client-Id` (ไม่บังคับ) | เหมือนเดิม | 400 `INVALID_CLIENT_ID` ถ้าส่งมาแต่ไม่ใช่ UUID |

รูปร่างข้อมูล (ตัวเต็มอยู่ที่ `backend/src/history/history.dto.ts` และ `frontend/src/api/types.ts`):

```ts
// รายการ
interface HistoryListResponse {
  items: {
    sessionId: string
    graphId: string
    startedAt: string                 // ISO 8601
    outcomeKind: OutcomeKind | null   // null = โหนดสุดท้ายหาไม่เจอในผังปัจจุบัน
    graph: { manualId, entrySymptom, entrySymptomTh?, deviceCategory, brand,
             modelPattern, displayName? } | null   // null = ผังนี้ไม่มีแล้ว
  }[]
  total: number; page: number; pageSize: number; totalPages: number   // page = หน้าจริงที่ส่ง
  facets: { categories: DeviceCategory[]; brands: string[] }          // ตัวเลือกตัวกรองจากประวัติทั้งหมดของผู้ใช้
}

// รายละเอียด
interface HistoryDetail {
  sessionId; graphId; startedAt
  modelSelection: 'selected' | 'unknown' | null   // NULL ส่งเป็น null ห้ามเติมเป็น selected
  confidence: number | null                        // null = ไม่มีคะแนน (ไม่ใช่ 0)
  graph: … | null
  outcomeKind: OutcomeKind | null
  available: boolean                               // false = ผัง/โหนดเปลี่ยน อ่านย้อนหลังไม่ได้
  steps: { node: RenderedNode; action: TraversalAction }[]
  finalNode: RenderedNode | null                   // ข้อความสรุปจากคู่มือ ใช้ตรงๆ
  safetyWarnings: string[]                         // จากโหนดที่เคยผ่าน ไม่ซ้ำ · ว่าง = ไม่มีกล่องแดง
  reference: { source; pageRange } | null
  outcome: string | null                           // ข้อความที่ผู้ใช้บันทึกเอง
  feedback: { helpful: boolean; comment: string | null } | null
}
```

---

## 5. เมื่อผังถูก seed ใหม่

`seed-graphs.js` ลบ `nodes` ของผังแล้ว insert ใหม่ ดังนั้น session อายุ 90 วันอาจอ้างโหนด/ทางเดินที่ไม่เหมือนเดิม จัดการดังนี้:

| สถานการณ์ | รายการ | รายละเอียด |
|---|---|---|
| ผัง (graph_id) หายไป | แถวแสดง "ข้อมูลผังเปลี่ยนไปแล้ว ดูรายละเอียดไม่ได้" ยังเปิด/ลบได้ | `available:false` ไม่มีขั้นตอน/ผล/คำเตือน เหลือแค่ข้อความที่ผู้ใช้บันทึกเอง |
| โหนดสุดท้ายหาย หรือไม่ใช่โหนดสิ้นสุดแล้ว | แสดงชื่ออาการ แต่ไม่มีป้ายสถานะ | `available:false` |
| โหนดที่เคยผ่านหาย | (รายการไม่ดูขั้นที่ผ่าน) | `available:false` |
| ทางเดินถูกแก้ (on_yes/on_no/next เปลี่ยน, ขั้นนั้นกลายเป็นต้องยืนยันความปลอดภัย) | (ไม่ตรวจ) | `available:false` — **replay** ขั้นที่บันทึกไว้ผ่าน `submitAction` ของ engine ในผังปัจจุบัน ต้องไปจบที่โหนดสุดท้ายเดิม ไม่งั้นไม่โชว์ขั้นเก่าคู่ข้อสรุปใหม่ |

ไม่มีกรณีไหนเป็น 500 · รายการไม่ล้มทั้งหน้าเพราะแถวเดียว

---

## 6. วิธีรัน migration และลำดับ deploy

ฐานข้อมูล Aiven ตัวเดียวใช้ร่วมกับ Render (production) และโปรเจกต์เก่า migration ทั้งสองเป็นแบบเพิ่มอย่างเดียว
(คอลัมน์ NULL ได้ + ตารางใหม่ที่ตรวจแล้วว่าโปรเจกต์เก่าไม่มีชื่อซ้ำ) แถวเดิมไม่ถูกแตะ

**ลำดับ: migration → backend → frontend** (backend ที่เขียน `client_id` จะ INSERT ล้มถ้ายังไม่ได้รัน 008)

> **หมายเหตุ 009:** ไฟล์นี้ถูกแก้ในที่เดิมเมื่อปรับ D4 (`comment TEXT NULL`, เพดาน 500) เพราะยังไม่เคยถูกรัน
> ถ้า 009 เคยถูกรันกับฐานข้อมูลไปแล้ว (ตรวจด้วย `--status` ด้านล่าง ถ้าเห็น ✅ ข้างหน้า 009) การแก้ไฟล์ **ไม่มีผลกับตารางที่สร้างไปแล้ว**
> ต้องเพิ่ม migration ใหม่ (010) สำหรับ `ALTER TABLE session_feedback` แทน

```powershell
# 1) ดูก่อนว่ารอรันอะไร (ไม่เขียนอะไร) — ต้องเห็น 008 และ 009 เป็น ⬜
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\backend
npm run migrate -- --status

# 2) รันจริง (เชื่อมฐานข้อมูลตาม backend/.env = ตัวเดียวกับ production)
npm run migrate
```

ตรวจหลังรัน (SQL):

```sql
SHOW COLUMNS FROM sessions LIKE 'client_id';      -- ต้องมี CHAR(36) NULL
SHOW INDEX FROM sessions WHERE Key_name = 'idx_sessions_client';
SHOW CREATE TABLE session_feedback;               -- ต้องมี FK fk_feedback_session
SELECT filename FROM schema_migrations ORDER BY filename DESC LIMIT 3;
```

จากนั้น deploy backend (Render) → ทดสอบ `GET /health` และ `GET /history` (ไม่ส่งหัวข้อ ต้องได้ 400 `INVALID_CLIENT_ID`)
แล้วจึง `npm run deploy` ฝั่ง frontend

ย้อนกลับ: วิธีย้อนแต่ละ migration เขียนไว้ในคอมเมนต์หัวไฟล์ (ไม่รันอัตโนมัติ)
ถ้าต้องถอย **โค้ด** อย่างเดียว คอลัมน์/ตารางที่เพิ่มไว้ไม่เป็นอันตราย (NULL / ไม่มีใครอ่าน)

---

## 7. การทดสอบ

| ชุด | จำนวน | ครอบคลุม |
|---|---|---|
| backend `history.service.spec.ts` | 35 | pool ปลอมที่ทำตามเงื่อนไข WHERE ใน SQL จริง: ความเป็นเจ้าของ/ยังไม่จบ/หมดอายุ · 4 สถานะ · ผังหาย/โหนดหาย/ทางเดินถูกแก้ · confidence NULL ไม่กลายเป็น 0 · modelSelection NULL คงเดิม · คำเตือน · กรอง/ค้นหา/เรียง/แบ่งหน้า · ลบ/ให้คะแนนของคนอื่น |
| backend `history.dto.spec.ts` | 31 | ตัวตรวจ query/feedback/client id · ตาราง error → HTTP |
| backend `history.controller.spec.ts` | 8 | ยก Nest ขึ้นจริง + `fetch`: DI ครบ, 400/404, หัวข้อบังคับ, ไม่ใช่ 403, CORS preflight ของ `X-Client-Id`/DELETE ผ่านด้วยตัวเลือกเดียวกับ main.ts |
| frontend `clientId.test.ts` | 10 | สร้าง/คงที่/ค่าเสีย/localStorage ใช้ไม่ได้/ไม่มี randomUUID + หัวข้อที่แนบกับ request จริง |
| frontend `historyParams.test.ts` | 18 | URL ↔ พารามิเตอร์, ค่าไม่รู้จัก, รีเซ็ตหน้า |
| frontend `HistoryPage.test.tsx` | 12 | แถว/ป้าย 4 แบบ/แถวผังหาย/ตัวกรองจาก URL/ว่าง 2 แบบ/โหลด/แบ่งหน้า |
| frontend `feedback.test.ts` | 11 | เพดาน 500, ว่าง → null, ตัดช่องว่าง, เทียบกับค่าที่บันทึกไว้, ข้อความ error ของ `INVALID_FEEDBACK` |
| frontend `HistoryDetailPage.test.tsx` | 15 | ข้อมูลครบ/ไม่มี Possible Cause/confidence null/กล่องแดงเฉพาะเมื่อมี/ปุ่ม/feedback/available:false |

รวมใหม่: backend 74 (ก่อนหน้าไม่มีเทสต์ backend เลย) · frontend 66 (ชุดเดิม 45 → 111 ผ่านหมด)

ส่วนของคะแนน/ข้อความ (D4) ที่เทสต์ยึดไว้: ชื่อคอลัมน์ใน SQL ของ `HistoryStore` ต้องตรงกับที่ migration 009 สร้างจริง
(pool ปลอมอ่านรายชื่อคอลัมน์จากไฟล์ .sql — ลองสลับชื่อเป็น `comment_text` เทสต์ล้มทันที) · `comment` เป็น `TEXT NULL` · 500 ผ่าน 501 ไม่ผ่าน · "" และไม่ส่ง → NULL

นอกจากนี้ตรวจกับ **ผังจริงทั้งหมด** (ไฟล์ `data/manuals/*.json` ที่ใช้ seed): เดินผ่าน engine จริง 644 ผัง × 6 เส้นทางสุ่ม = 3,864 ครั้ง
→ `detail` ได้ `available:true` ทุกครั้ง ขั้นตอนและโหนดสุดท้ายตรงกับที่เดิน ครบทั้ง 4 `outcome_kind` (755 ครั้งมีคำเตือนความปลอดภัยในเส้นทาง)
(สคริปต์ใช้ชั่วคราว ไม่ได้เก็บไว้ใน repo)

```powershell
cd backend;  npx tsc --noEmit -p tsconfig.json; npx jest; npm run build
cd ..\frontend; npx tsc -b; npx eslint src; npm test; npm run build
```

---

## 8. ข้อจำกัด

1. **`client_id` ไม่ใช่การยืนยันตัวตน** ใครได้ id ก็เห็น/ลบ/ให้คะแนนประวัติของ id นั้นได้ ระบบไม่มีล็อกอิน (ตามขอบเขตของโครงงาน)
2. **ล้างข้อมูลเบราว์เซอร์ หรือเปลี่ยนเบราว์เซอร์/เครื่อง = เห็นประวัติเดิมไม่ได้** (แถวยังอยู่ในฐานข้อมูลจนเลย 90 วัน แต่ไม่มี id ให้เรียก) ผู้ใช้โหมดส่วนตัวหรือปิด localStorage ได้ id ที่อยู่แค่ในแท็บเดียว
3. **ข้อความที่ผู้ใช้พิมพ์เก็บ 90 วัน** ทั้งผลลัพธ์ (`outcome_text` ได้ถึง 1,000 ตัวอักษร) และความเห็น (`comment` ได้ถึง 500) ลบได้จากหน้าประวัติ (ลบ session = ลบทั้งหมด) ผู้ใช้อาจพิมพ์ข้อมูลส่วนตัวแม้มีข้อความเตือนอยู่
4. **รายละเอียดย้อนหลังอ้างผังปัจจุบัน** ถ้าแก้ข้อความผังหรือ seed ใหม่ ข้อความที่เห็นจะเปลี่ยนตาม (ถ้าทางเดินเปลี่ยน/โหนดหาย จะเปิดดูไม่ได้ ตามหัวข้อ 5)
5. **ไม่มีงานล้างแถวที่หมดอายุ** แถวที่เกิน `expires_at` แค่ถูกซ่อนจาก `find()`/รายการ ไม่ถูกลบ ตาราง `sessions` โตเรื่อยๆ (มีอยู่ก่อนงานนี้ แต่ตอนนี้แถวที่จบแล้วอยู่นานขึ้น) ถ้าต้องล้างจริงต้องเขียน job แยก (ต้องตัดสินใจเรื่องข้อมูลที่ผู้ใช้สั่งเก็บ 90 วันด้วย)

ที่พบระหว่างทำ (ไม่ได้อยู่ในรายการที่ตกลงไว้):

6. **session ก่อนมีฟีเจอร์นี้** (`client_id` เป็น NULL) ไม่ปรากฏในประวัติของใคร และ session ที่ API เรียกตรงโดยไม่ส่งหัวข้อก็เช่นกัน
7. **เพดาน 500 รายการต่อผู้ใช้** (ใหม่สุดก่อน) รายการที่เก่ากว่านั้นไม่ถูกนับ/แสดง
8. **ค้นหาข้อความ** ครอบคลุมชื่ออาการ (ไทย/อังกฤษ) ยี่ห้อ รุ่น/ชื่อรุ่น ไม่ครอบคลุมชื่อประเภทเครื่องภาษาไทย (ใช้ตัวกรองประเภทแทน) ทุกคำที่พิมพ์ต้องอยู่ในแถวนั้น (AND)
9. **แถวที่ผังหายไม่ตรงตัวกรองประเภท/ยี่ห้อ/สถานะ** (ไม่รู้ข้อมูลนั้น) ปรากฏเฉพาะตอนไม่ได้กรองด้วยสิ่งนั้น
10. **ป้ายสถานะในรายการดูแค่โหนดสุดท้าย** (ไม่ replay เพื่อไม่ต้องดึงประวัติทีละ session) จึงมีได้ที่แถวมีป้ายแต่เปิดรายละเอียดแล้วได้ "ดูรายละเอียดไม่ได้"
11. **ผลข้างเคียงของ D2:** `GET /traversal/sessions/:id` และการบันทึกผลลัพธ์ (`POST …/outcome`) ของ session ที่จบแล้วใช้ได้นาน 90 วัน (เดิม 24 ชั่วโมง) ลิงก์ `/#/session/:id` ของงานที่จบแล้วจึงเปิดได้นานขึ้น
12. **endpoint เดิม `DELETE /traversal/sessions/:id` ไม่ตรวจเจ้าของ** และลบ session ที่จบแล้วได้ ใครรู้ session UUID ก็ลบได้ (มีอยู่ก่อนงานนี้ แต่ตอนนี้แถวที่จบแล้วอยู่ 90 วัน) — ไม่ได้แก้ในงานนี้ เพราะเป็นการเปลี่ยนพฤติกรรมของ API เดิม

---

## 9. ผลตรวจข้อความของโหนด `handoff_unknown` (คำแนะนำติดต่อศูนย์บริการ)

ตรวจจากไฟล์ผัง `data/manuals/*.json` (ที่ใช้ seed) **ไม่ใช่จากฐานข้อมูลบน Aiven** · ไม่ได้แก้ข้อมูลใดๆ

- โหนดสิ้นสุดทั้งหมด 1,515 โหนด: `user_fixed` 520 · `normal_behavior` 198 · `handoff_informed` 155 · `handoff_unknown` 642
- `handoff_unknown` 642 โหนด **ไม่มีโหนดใดที่ไม่มีคำแนะนำติดต่อเลย**
  - 315 โหนด (140 ข้อความไม่ซ้ำ) มีคำว่า "ศูนย์บริการ" ตรงๆ
  - 327 โหนดไม่มีคำว่า "ศูนย์บริการ" แต่ชี้ไปช่องทางของ Samsung: ขอรับบริการผ่านเมนูทีวี (Settings > Support > Request Support / Device Care) หรือ Samsung Customer Care พร้อมเบอร์โทร หรือตัวแทนจำหน่าย
  - ใน 327 นี้ 21 โหนด (ผังทีวี) เป็นแบบ "ให้เลือกอาการอื่นที่ตรงกับที่เห็น หรือขอรับบริการจาก Samsung ผ่าน Settings > Support > Request Support"
- ถ้าสเปกต้องการให้ข้อความ `handoff_unknown` ทุกโหนดใช้คำว่า "ศูนย์บริการ" ตรงๆ ต้องแก้ที่ข้อมูลผัง (ผมไม่ได้แก้) — ไฟล์/ผังที่เข้าข่ายหาได้ด้วยการค้นข้อความโหนด `outcome_kind = handoff_unknown` ที่ไม่มีคำนั้น

---

## 10. ที่ยังไม่ได้ทำ / ต้องทำเอง

- รัน migration 008 → 009 (หัวข้อ 6) · deploy backend → frontend · commit (ผมไม่ได้ commit/push)
- ดูด้วยตาในเบราว์เซอร์ (`npm run dev` ฝั่ง frontend, backend ชี้ฐานข้อมูลที่ migrate แล้ว):
  1. ตรวจอาการจนจบ → เปิด "ประวัติการซ่อม" ต้องเห็นรายการนั้น วันที่/ป้ายถูก
  2. ค้นหา/กรอง/เรียง → URL เปลี่ยน กดย้อนกลับแล้วค่ากลับมา รีเฟรชแล้วค่ายังอยู่
  3. ลบ → ขึ้นยืนยันในแถว → หายจากรายการ หน้าเดิมไม่เป็นหน้าว่าง
  4. รายละเอียด: ผลที่ `handoff_unknown` เห็นข้อความโหนดสุดท้ายและป้าย "หลักฐานไม่เพียงพอ"; รายการที่เริ่มจากหน้า "อาการทั้งหมด" (ไม่ผ่านเลือกรุ่น) ปุ่มที่สองต้องเป็น "ตรวจอาการอื่น"
  5. ให้คะแนน 👍 + ข้อความ → รีเฟรช → ค่ายังอยู่ · เปลี่ยนเป็น 👎 บันทึกซ้ำได้
  6. เปิดแท็บส่วนตัว/ล้าง localStorage → ประวัติเดิมหาย ตามข้อจำกัดข้อ 2
- ยืนยันหัวข้อกล่องแดง "คำเตือนด้านความปลอดภัย" (ตารางหัวข้อ 2) และเรื่องปุ่มที่สองเมื่อ `modelSelection` เป็น NULL
- ตัดสินใจเรื่องข้อจำกัดข้อ 12 (`DELETE /traversal/sessions/:id` ไม่ตรวจเจ้าของ) และข้อ 5 (งานล้างแถวหมดอายุ)
- อัปเดต `docs/FILES-FRONTEND.md` และ `docs/TOR-COMPLIANCE` ถ้าต้องการให้เอกสารเดิมรู้จักหน้านี้
