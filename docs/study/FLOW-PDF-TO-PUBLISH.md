# Flow: PDF → ร่าง → ตรวจ → publish → ผู้ใช้ค้นเจอ (frontend + backend)

> บันทึกจากการอ่านทีละไฟล์ (ยังไม่ได้ทดสอบกับ Groq / PDF จริง / MySQL จริง)

## 🔖 ที่คั่นหนังสือ (walkthrough)

| สถานะ | ไฟล์ |
|---|---|
| อ่านแล้ว | UploadDraftForm.tsx · api/queries.ts · api/drafts.ts · api/http.ts · drafts.controller.ts (ตอนนี้ drafts.routes.ts) · drafts.service.ts · drafts.store.ts · pdf-text.ts · draft-llm.client.ts · draft-schema.ts · draft-manual.ts · graph-validator.ts · drafts.dto.ts · drafts.exception.filter.ts · authoring.module.ts (สองไฟล์นี้ลบแล้ว) · AdminDraftReviewPage.tsx · DraftActions.tsx · draftView.ts · DraftGraphCard.tsx · ValidationReportPanel.tsx · DraftJsonEditor.tsx · DraftStatusBadge.tsx · lib/errors.ts · HistoryErrorNotice.tsx (จบฝั่งหน้าจอ) · traversal/graph.repository.ts (loadAll / reload) · symptom-search.service.ts (addGraphs, prepareIndex, search) |
| 🔁 **ต้องกลับมาอ่าน graph-validator.ts อีกรอบ** | อ่านรอบแรกแบบภาพรวมแล้ว ให้กลับมาไล่ทีละกฎ (โดยเฉพาะ validateStructure, checkTemplateVariables, findBackEdges/longestPath) — **ถึงคิวแล้ว (จบเส้นทาง flow ครบ)** |
| ถัดไป | graph-validator.ts อ่านซ้ำทีละกฎ |
| หมายเหตุ | update/reject ใช้ setQueryData จากผลที่ backend ตอบ (useDraftCacheUpdate) ไม่ได้ refetch · upload ใช้ invalidate รายการ · publish ยังไม่ได้เปิดดู onSuccess |

## 📌 ข้อค้นพบที่ต้องจำ (ตอบกรรมการ)

1. **การตรวจซ้ำตอน publish อยู่ "ข้างใน" transaction** : `drafts.service.publish` ส่ง callback ให้ `store.publish` ซึ่งเรียกหลังล็อกแถวร่างด้วย `SELECT … FOR UPDATE` แล้ว (parse → assemble → validate → เช็ก error/warning → toDbRows) ข้อมูลที่ตรวจกับข้อมูลที่เขียนจึงเป็นสแนปช็อตเดียวกัน
2. **`GraphRepository.reload()` โหลดผัง "ทั้งหมด" ใหม่** (~644 ผัง / 4,834 โหนด, SQL 2 คำสั่ง) ไม่ใช่เพิ่มเฉพาะผังใหม่
   - สร้างผลใน Map ใหม่ให้ครบก่อน แล้วสลับเข้า Map จริงโดยไม่มี `await` คั่น → ล้มกลางทาง ผังเดิมไม่เปลี่ยน
   - **ผังเสียผังใดผังหนึ่งใน DB (ไม่ใช่แค่ผังใหม่) ทำให้ reload ล้มได้** → `PublishReloadError` (500 `PUBLISH_RELOAD_FAILED`) ทั้งที่ DB commit แล้ว หน้าจอบอกให้รีสตาร์ต backend
   - ความจำอยู่ต่อโปรเซส : รันหลาย instance จะไม่เห็นผังใหม่จนกว่าจะรีสตาร์ต (ยังไม่ได้ตรวจการ deploy)
   - `severity`, `difficulty`, `config`, รูป ฯลฯ ถูกเก็บลง DB แต่ `loadAll` ไม่ SELECT กลับมา
3. **DB กับความจำไม่ atomic** : commit สำเร็จแต่ reload ล้ม = DB มีผังใหม่ ความจำไม่มี (ระบบสื่อสารเรื่องนี้ชัด แต่ไม่แก้ให้เอง)
4. **`acknowledgedWarnings` เป็น boolean ตัวเดียว** ไม่ใช่รายการ
5. **update/reject** ใช้ `setQueryData` จากผลที่ backend ตอบ ไม่ refetch
6. **error มี 2 ตาราง** : ความล้มเหลวของ HTTP → `lib/errors.ts` (`describeError`) · ความล้มเหลวของงานเบื้องหลังที่เก็บในแถวร่าง (`LLM_*`, `NO_GRAPHS_FOUND`, `INTERRUPTED`, `REJECTED`) → `FAILURE_LABELS` ใน `lib/draftView.ts`
8. **`addGraphs` เพิ่มเฉพาะข้อความของผังใหม่เข้าดัชนีค้นหา** (embed เฉพาะข้อความที่ยังไม่เคยมี ใช้เวกเตอร์เดิมซ้ำถ้าข้อความเหมือนกัน) แล้วสลับดัชนีทีเดียว · **ถ้าระบบค้นหาปิด (`SYMPTOM_SEARCH_ENABLED` ไม่ใช่ `true`) หรือยังโหลดไม่เสร็จ → `indexed=false`** ผังที่ publish ยังเลือกจากรายการอาการได้ทันที แต่ค้นด้วยข้อความจะเจอหลังรีสตาร์ต
9. `manualIssues` ใน `draftView.ts` ไม่พบผู้เรียกใน `.tsx` (อาจตัดได้ ยังไม่ยืนยัน)

## ภาพรวม 6 ช่วง

```
[1 อัปโหลด] → [2 สร้างแถวร่าง] → [3 งานเบื้องหลัง: PDF→AI→ตรวจ] → [4 admin รีวิว/แก้] → [5 publish] → [6 ผู้ใช้ค้นเจอ]
   frontend        backend              backend (background)              frontend+backend     backend         backend
```

## ช่วง 1: Admin อัปโหลด PDF

```
หน้ารายการร่าง (AdminRoute: login แล้ว + role admin)
  UploadDraftForm.tsx  เลือก PDF + กรอก ประเภท/ยี่ห้อ/รุ่น/ชื่อแสดง/หน้าเริ่ม–สุดท้าย
  → useUploadDraft (queries.ts)  → api/drafts.ts uploadDraft(formData)
  → api/http.ts request(): Bearer + X-Client-Id, FormData (ไม่ตั้ง Content-Type เอง)
  ═══ POST /admin/drafts (multipart) ═══
  drafts.routes.ts router.post('/'):
    1 requireAuth  2 requireAdmin  3 uploadPdf() = multer (memory, ≤10MB, 1 ไฟล์, 12 ฟิลด์)  4 → drafts.createFromUpload
```

## ช่วง 2: ตรวจ + สร้างแถวร่าง

```
drafts.service.create():
  drafts.dto.ts ตรวจฟิลด์ฟอร์ม (400) · ตรวจ %PDF- (400) · ช่วงหน้า ≤10 (400)
  AI ไม่ตั้งค่า (503 LLM_NOT_CONFIGURED) · มีงานอยู่ (409 DRAFT_BUSY)
  pdf-text.ts: unpdf → Map<หน้า,ข้อความ> (≤200 หน้า, ≤12,000 ตัว/หน้า, รวม ≥50 ตัว, ไม่มี OCR)
  สร้าง manual_id + กันชนกับของเดิม
  store.insert(): INSERT graph_drafts status='drafting' (meta, pages, created_by)
  เรียกงานเบื้องหลังแบบไม่ await
  ตอบ 202 {id, status:'drafting'} → frontend invalidate ['admin', identity, 'drafts'] → ไปหน้ารีวิว
```

## ช่วง 3: งานเบื้องหลัง (ทีละงาน, busy=true)

```
แบ่งหน้าเป็นกลุ่มละ 2 หน้า วนทีละกลุ่ม:
  store.setProgress(done,total)
  draft-llm.client: POST Groq (JSON mode, temp 0, timeout 60s, max_tokens 6000) → สตริงดิบ
  draft-schema.parseLlmOutput → LlmGraph[] (รูปผิด = DraftParseError)
ครบแล้ว:
  ไม่มีผังเลย → markFailed(NO_GRAPHS_FOUND)
  assignGraphIds → graph_id = <manual_id>_<slug>(_2,_3)
  draft-manual.assembleManual → ก้อนคู่มือ (source/page_range/source_chunk_id เซิร์ฟเวอร์ใส่เอง)
  graph-validator.validateManual(mode draft, pages) → ValidationReport
  store.markReady (WHERE status='drafting')
error ระหว่างทาง → markFailed ; ท้ายสุด busy=false เสมอ
restart เซิร์ฟเวอร์ → failInterrupted(): drafting ที่ค้าง → failed (INTERRUPTED)
```

## ช่วง 4: Admin รีวิว/แก้

```
AdminDraftReviewPage: useAdminDraft(id) → GET /admin/drafts/:id (poll 3000ms เฉพาะ drafting)
  drafting → progress · failed → สาเหตุ + "อัปโหลดใหม่" (ไม่มี retry) · ready → ผัง + รายงานตรวจ
  แก้ผัง: PUT /admin/drafts/:id → parseDraftGraphs → assembleManual → validateManual → store.saveEdit (WHERE ready)
  ปฏิเสธ: POST /admin/drafts/:id/reject → rejected
  publish: ไปช่วง 5
```

## ช่วง 5: Publish

```
Frontend: warning ต้องติ๊กรับทราบ, มี error ปุ่มปิด → POST /admin/drafts/:id/publish { acknowledgedWarnings: true|false }  (boolean ตัวเดียว ไม่ใช่รายการ)
Backend service.publish():
  เรียก store.publish(id, userId, callback) — การตรวจซ้ำทำ "ข้างใน" transaction ผ่าน callback หลังล็อกแถวแล้ว:
  store.publish() ใน transaction เดียว:
    BEGIN → SELECT … FOR UPDATE (ล็อกแถวร่าง) → เช็ก status='ready'
    → เรียก callback ของ service กับร่างที่ล็อกไว้:
         parseDraftGraphs → assembleManual → validateManual (ซ้ำครั้งสุดท้าย)
         มี error → draftInvalid (409 DRAFT_INVALID, ไม่มี override) · warning ไม่ถูก acknowledge → warningsNotAcknowledged (409)
         toDbRows() → คืน { rows, report, graphIds }
    → assertNoConflicts (ไม่เขียนทับ)
    INSERT manuals → graphs → nodes (VALUES ? bulk) → UPDATE draft status='published' → COMMIT (พลาด=ROLLBACK)
  (ตรวจซ้ำอยู่ใน lock เดียวกับการเขียน ข้อมูลจึงเปลี่ยนระหว่างตรวจกับเขียนไม่ได้)
  (นอก transaction, หลัง COMMIT แล้ว)
  GraphRepository.reload()  — โหลดผัง "ทั้งหมด" จาก DB ใหม่ (ไม่ใช่เฉพาะผังใหม่) ; ล้ม → PublishReloadError (500) แต่ DB ลงแล้ว
  SymptomSearchService.addGraphs()  — ล้มไม่ทำให้ publish ล้ม แค่ searchIndex.indexed=false
  ตอบ 200 → frontend invalidate ['admin', id, 'drafts'] + ['graphs'] + manuals
```

## ช่วง 6: ผู้ใช้ค้นเจอ

```
พิมพ์อาการ → SymptomSearchService (cosine ≥0.55, top 3) → เลือกผัง → session → traversal engine → resolution/escalation
(ผังใหม่อยู่ในดัชนีแล้ว ไม่ต้อง restart)
```

## สถานะของร่าง

```
drafting ──markReady──▶ ready ──publish──▶ published (จบ)
   │                     │ ▲
   │ markFailed /        │ └─ PUT แก้ผัง (ยัง ready)
   │ failInterrupted     └─ reject ─▶ rejected (จบ)
   ▼
 failed (จบ ต้องอัปโหลดใหม่) ── reject ─▶ rejected
```
ทุกการเปลี่ยนสถานะใน store ใช้ `WHERE status='…'` กันกดซ้ำ/ทำพร้อมกัน

## รูปของข้อมูลตลอดทาง

```
PDF → Map<หน้า,ข้อความ> → สตริง JSON จาก AI → LlmGraph[] (slug) → DraftGraph[] (graph_id)
 → ก้อนคู่มือ → ValidationReport → (publish) แถว manuals/graphs/nodes → ผังในความจำ + ดัชนีค้นหา
```

## ข้อจำกัดที่ต้องพูดตรงๆ
- AI ทำแค่ "ร่าง" ที่เหลือเป็นโค้ดตายตัว + คนตัดสิน
- ยังไม่เคยทดสอบกับ Groq/PDF/MySQL จริง · ไม่มีเทสต์ในโปรเจกต์ · migration 012 บน Aiven ยังไม่ยืนยัน
- ไม่มี OCR · งานเบื้องหลังอยู่ในโปรเซสเดียว (restart = ร่างค้างล้ม)
- ชื่อ endpoint ย่อยของ PUT/reject/publish และฝั่งหน้า review ยังต้องยืนยันตอนอ่านไฟล์ที่เหลือ
