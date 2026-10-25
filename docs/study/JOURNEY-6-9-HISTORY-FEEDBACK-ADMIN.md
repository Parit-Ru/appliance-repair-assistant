# User Walkthrough ช่วงที่ 6–9: บันทึกประวัติ → ประวัติ → ให้คะแนน → แดชบอร์ด

> บันทึกจากการเดินตาม `docs/USER_JOURNEY_WALKTHROUGH.md` ช่วงที่ 6, 7, 8, 9 รูปแบบ **ขั้นต่อขั้น ไม่มีตาราง** ไว้ให้กลับมาอ่านและจดเองว่าแต่ละขั้นผ่าน **ไฟล์ไหน → function ไหน → โค้ดบรรทัดไหน**
> เลขบรรทัดตรวจจากไฟล์บนดิสก์ ณ 24 ต.ค. 2569 (backend/frontend หลายไฟล์ถูกลบคอมเมนต์แล้ว เลขในเอกสารเก่าอาจคลาดเคลื่อน) · ทุกข้อความมาจากการอ่านโค้ด ไม่ได้รันทดสอบจริง
> ต่อจาก `docs/study/JOURNEY-1-REGISTER.md` และ `JOURNEY-2-LOGIN.md` (ช่วง 3–5 เดินในแชต ยังไม่มีไฟล์บันทึก และช่วง 5 ถูก mark 🔖⭐ ใน `READING-PROGRESS.md` ว่าต้องกลับมาอ่านอีกรอบก่อนสอบ)
> **ช่องว่างสำหรับจด:** เว้นท้ายแต่ละช่วงไว้ที่หัวข้อ "โน้ตของฉัน"

## สารบัญ
- ช่วงที่ 6: บันทึกประวัติ (ก. อัตโนมัติทุกขั้น · ข. บันทึกผลลัพธ์ · ค. ยกเลิก)
- ช่วงที่ 7: หน้าประวัติ (ก. รายการ · ข. รายละเอียด · ค. ลบ)
- ช่วงที่ 8: ให้คะแนน 👍/👎 + ข้อความ
- ช่วงที่ 9: แดชบอร์ดผู้ดูแล (ก. สถิติ · ข. รายการความเห็น)

---

# ช่วงที่ 6: บันทึกประวัติ

**ภาพรวม:** ไม่มีปุ่ม "บันทึกประวัติ" ประวัติเกิดเองทุกครั้งที่ผู้ใช้กดตอบ ผู้ใช้มีแค่ปุ่มเสริม 2 อย่าง คือ "บันทึกผล" (ไม่บังคับ) และ "ยกเลิกการตรวจ" และ **ไม่มีตาราง chat/message/references** มีแค่ `sessions` กับ `session_history`

## ก. บันทึกอัตโนมัติทุกขั้น (เกิดตอนผู้ใช้กดตอบ)
1. ผู้ใช้กด เช่น "ใช่" → `POST /traversal/sessions/:id/actions` (รายละเอียดช่วง 5)
2. `TraversalService.submitAction` (`backend/src/traversal/traversal.service.ts:86`):
   - ตรวจเจ้าของ `authorize` (`:91`) → อ่าน session จาก DB `requireSession` (`:92`) → หาผังจากหน่วยความจำ `requireGraph` (`:93`)
   - ให้ engine ตัดสินขั้นถัดไป `engineSubmitAction(session, graph, action)` (`:95`)
   - **บันทึกผลลง DB** `sessionStore.update(...)` (`:98-101`) ← รันหลัง engine อนุมัติเท่านั้น ถ้า engine โยน error บรรทัดนี้ไม่ถูกรัน DB ไม่เปลี่ยน
   - ประกอบคำตอบ `toResponse` (`:103`) แล้ว route ตอบ 201 (`traversal.routes.ts:34`)
3. `SessionStore.update` (`backend/src/traversal/session.store.ts:89-142`) ทำใน **transaction เดียว** (สำเร็จทั้งคู่หรือย้อนกลับทั้งคู่):
```sql
-- :106-112  ย้ายพิกัดไปโหนดใหม่ + ต่ออายุ
UPDATE sessions SET current_node_id = ?, status = ?, variables = ?, expires_at = NOW() + INTERVAL ? HOUR
 WHERE session_id = ?
-- :122-125  จดว่าผู้ใช้ทำอะไรที่โหนดไหน (1 แถวต่อขั้น)
INSERT INTO session_history (session_id, step_order, node_id, action_type, action_value)
VALUES (?, ?, ?, ?, ?)
```
   - `step_order` = ลำดับขั้น (นับจาก 0) · `node_id` = โหนดที่ผู้ใช้อยู่ตอนกด · `action_type` ∈ answer/continue/confirm_safety/input · `action_value` = yes/no หรือข้อความที่กรอก
   - **อายุข้อมูล** (`session.store.ts:8-10`, `:99-100`): กำลังเดิน 24 ชั่วโมง (ต่ออายุทุกขั้น) · ถึงโหนดจบ (`completed`) 90 วัน
   - `UNIQUE (session_id, step_order)` (`backend/migrations/004_sessions.sql`) กันสองคำขอซ้อนกัน ผู้แพ้ชนข้อจำกัดนี้

## ข. บันทึกข้อความผลลัพธ์ (ปุ่มเสริม ไม่บังคับ)
**เรื่อง:** ถึงโหนดจบแล้ว สมชายพิมพ์ "ทำตามแล้วหาย" แล้วกด "บันทึกผล"
1. ฟอร์มแสดงเฉพาะที่โหนดจบ: `frontend/src/components/step/StepView.tsx:27-29` เห็น `node.isTerminal` → `OutcomeStep` ใส่ฟอร์มไว้ที่ `OutcomeStep.tsx:44`
2. กรอกข้อความ ปุ่มจะกดได้เมื่อ `checkOutcome` ได้ `ok` (ไม่ว่าง และไม่เกิน 1,000 ตัว `lib/outcome.ts:9-14`) `components/OutcomeForm.tsx:43-50` → `handleSubmit` ส่ง `normalizeOutcome(value)` (ตัดช่องว่างหัวท้าย)
3. กดปุ่ม "บันทึกผล" (`OutcomeForm.tsx:83-85`) → `handleOutcome` (`pages/SessionPage.tsx:63-72`) กันกดซ้ำด้วย `isSavingOutcomeRef` แล้ว `saveOutcome.mutate(text)`
4. `useSubmitOutcome` (`api/queries.ts:132`) → `api/traversal.ts:64-69` → **`POST /traversal/sessions/:id/outcome`** body `{ "text": "ทำตามแล้วหาย" }`
5. Backend: `traversal.routes.ts:38-42` ผ่าน `optionalAuth` แล้วเรียก `parseOutcomeBody` (`traversal.dto.ts:166-185`): ต้องเป็นข้อความ, `trim` แล้วไม่ว่าง, ไม่เกิน 1,000 (`MAX_OUTCOME_LENGTH` `:6`) ผิด → 400 `INVALID_OUTCOME`
6. `TraversalService.submitOutcome` (`traversal.service.ts:114`):
   - ตรวจเจ้าของ/หา session/หาผัง (`:119-121`) ไม่ใช่ของเรา/ไม่มี → 404
   - **ต้องจบแล้วเท่านั้น** (`:123-125`) ยัง `in_progress` → 409 `SESSION_NOT_COMPLETED`
   - บันทึก `sessionStore.saveOutcome` (`:127`) ได้ `false` (เคยบันทึกแล้ว) → 409 `OUTCOME_ALREADY_SUBMITTED` (`:128-130`)
7. `SessionStore.saveOutcome` (`session.store.ts:171-182`):
```sql
UPDATE sessions SET outcome_text = ?, outcome_at = NOW()
 WHERE session_id = ? AND status = 'completed' AND outcome_text IS NULL
```
   เงื่อนไขใน `WHERE` คือประตูในคำสั่งเดียว: ต้องจบแล้ว **และ** ยังไม่เคยบันทึก (atomic) สองคำขอพร้อมกัน ชนะได้คนเดียว ผู้แพ้ `affectedRows = 0` → 409
8. ตอบ 200 (`traversal.service.ts:132-133` `toResponse(session, node, graph, text)`) → หน้าจอจดลงแคช → `OutcomeForm.tsx:32-41` `isSaved` เปลี่ยนเป็น "บันทึกผลแล้ว" พร้อมข้อความอ่านอย่างเดียว
9. ข้อควรรู้: **บันทึกได้ครั้งเดียว แก้ไขภายหลังไม่ได้** (ข้อความบนหน้าจอ `OutcomeForm.tsx:58-60`) · ผลลัพธ์ **ไม่เข้า engine** ไม่เปลี่ยนสถานะ · กด F5 แล้วยังเห็น เพราะ `GET session` อ่าน `outcome_text` กลับมา (`findOutcome` `session.store.ts:184-192`)

## ค. ยกเลิกการตรวจ (ปุ่มเสริม)
1. ปุ่ม "ยกเลิกการตรวจ" แสดงเฉพาะตอนยังไม่จบ: `components/SessionHeader.tsx:28-32` (`canAbandon={!node.isTerminal}` `SessionPage.tsx:151`)
2. `handleAbandon` (`SessionPage.tsx:74-76`) → `useAbandonSession` (`api/queries.ts:139` สำเร็จแล้วลบแคชของ session นั้น กันกดย้อนกลับแล้วเห็นขั้นเก่า) → `api/traversal.ts:71-75` **`DELETE /traversal/sessions/:id`** แนบ `ownerHeaders()`
3. Backend: `traversal.routes.ts:44-49` `optionalAuth` → `resolveRequiredOwner` (ล็อกอิน = user, ไม่ล็อกอิน = `X-Client-Id` บังคับ) → `TraversalService.abandonSession` (`traversal.service.ts:107-110`) ลบไม่ได้ → 404 `SESSION_NOT_FOUND` → ตอบ **204**
4. `SessionStore.delete` (`session.store.ts:161-169`):
```sql
DELETE FROM sessions WHERE session_id = ? AND ${ownerWhere} AND expires_at > NOW()
```
   `session_history` และ `session_feedback` ถูกลบตามด้วย `ON DELETE CASCADE` ผู้ที่ไม่ใช่เจ้าของลบไม่ได้ (404 เหมือนไม่มีอยู่)

## ข้อสังเกตช่วง 6
- เจ้าของ session: ผู้ล็อกอิน → `user_id` · guest → `client_id` · ไม่ส่งอะไรเลย → ไม่มีเจ้าของ **จะไม่ปรากฏในประวัติใคร** (`backend/src/auth/session-owner.ts:14-23`)
- ไม่มีงานลบแถวที่หมดอายุ (ค้น cron/job ลบแล้วไม่พบ) แถวหมดอายุแค่ถูกกรองออกตอนอ่าน
- ไม่มี endpoint ย้อนขั้นหรือแก้คำตอบ ผิดทางต้อง "เริ่มอาการนี้ใหม่" (สร้าง session ใหม่)

## เฉลยคำถามช่วง 6
- **กดบันทึกผลตอนยังไม่ถึงโหนดจบ (ยิง API ตรง):** 409 `SESSION_NOT_COMPLETED` (`traversal.service.ts:123-125`) และ SQL มี `AND status = 'completed'` เป็นประตูอีกชั้น
- **สองแท็บกดบันทึกผลพร้อมกัน:** `UPDATE ... WHERE outcome_text IS NULL` คำสั่งเดียว คนแรก `affectedRows = 1` คนที่สอง 0 → 409
- **ยกเลิกแล้วอะไรหาย:** แถว `sessions` + `session_history` + `session_feedback` (CASCADE) ไม่เหลือใน DB สถิติ admin จึงนับ "ยกเลิก" ไม่ได้ มีแต่ "เดินค้างแล้วหมดอายุ"
- **ปิดแท็บหลังตอบครบแต่ยังไม่พิมพ์ผลลัพธ์:** ประวัติไม่หาย session `completed` บันทึกครบทุกขั้นแล้ว เก็บ 90 วัน ข้อความผลลัพธ์เป็นแค่ส่วนเสริม

## โน้ตของฉัน (ช่วง 6)
-

---

# ช่วงที่ 7: หน้าประวัติการซ่อม (รายการ + รายละเอียด)

**ภาพรวม:** สมชายตรวจจบหลายครั้งแล้ว กดเมนู "ประวัติการซ่อม" หน้าแรกคือ **รายการ** กดแถวแล้วเข้า **รายละเอียด** คำถามหลักสองข้อ: ระบบรู้ได้ไงว่านี่คือประวัติของสมชาย และถ้าผังถูกแก้ไปแล้วจะโชว์ประวัติเก่าอย่างไร

## ก. หน้ารายการ (`/history`)
1. กดเมนู "ประวัติการซ่อม" (`components/layout/AppShell.tsx:30`) → `App.tsx:45` แสดง `HistoryPage`
2. `pages/HistoryPage.tsx:24-28` อ่านเลขหน้าจาก URL `?page=` (ไม่ใช่เลขบวก → หน้า 1) แล้ว `:32` เรียก `useHistory(page)` (`api/queries.ts:58`)
   - key ของแคชมี identity: `['history', identity, 'list', page]` และใช้ `keepPreviousData` (เปลี่ยนหน้าแล้วรายการเดิมค้างจนผลใหม่มา ไม่กะพริบ)
3. `api/history.ts:11-13` `listHistory` → **`GET /history?page=N`** พร้อม `headers: ownerHeaders()` (`lib/clientHeaders.ts:12-14`): ล็อกอินอยู่ → ไม่ส่งอะไร (token แนบโดย `api/http.ts`) · guest → ส่ง `X-Client-Id` นี่คือสิ่งที่บอก backend ว่า "ฉันคือเจ้าของประวัติชุดไหน"
4. Backend: `backend/src/history/history.routes.ts:13-17`
   - `optionalAuth` อ่านบัตร
   - `resolveRequiredOwner(currentUser(request), request.headers['x-client-id'])` (`auth/session-owner.ts:7-12`): ล็อกอิน → `{kind:'user', userId}` · ไม่ล็อกอิน → ต้องมี `X-Client-Id` ไม่งั้น 400 `INVALID_CLIENT_ID`
   - `parseHistoryQuery(request.query)` (`history/history.dto.ts:41`): `page` ≥ 1 ค่าเริ่มต้น 1, `pageSize` 1–50 ค่าเริ่มต้น 10 (`:6-7`) ผิด → 400 `INVALID_HISTORY_QUERY`
5. `HistoryService.list` (`history/history.service.ts:45`) เรียก `HistoryStore.listCompleted(owner)` (`history/history.store.ts:48-60`):
```sql
-- :50-57  ownerWhere = "(user_id = ?)" หรือ "(client_id = ? AND user_id IS NULL)"
SELECT session_id, graph_id, current_node_id, UNIX_TIMESTAMP(created_at) AS created_epoch
  FROM sessions
 WHERE ${where.sql} AND status = 'completed' AND expires_at > NOW()
 ORDER BY created_at DESC
 LIMIT ?          -- MAX_HISTORY_ROWS = 50 (history.store.ts:10)
```
   **"ประวัติของสมชาย" ถูกกรองที่ SQL** ด้วย `ownerWhere` (`session-owner.ts:25-30`) เห็นเฉพาะ session ที่ เป็นของเจ้าของนี้ + จบแล้ว + ยังไม่หมดอายุ
6. กลับมาที่ service: เรียงใหม่สุดก่อน → แบ่งหน้าในหน่วยความจำ (หน้าเกินถูกดึงกลับหน้าสุดท้าย) → `toListItem` (`:110`) ต่อชื่ออาการ/รุ่นจากผังในหน่วยความจำ (ผังหายไป → `graph: null`, `outcomeKind: null` รายการไม่ล้ม)
7. ตอบ:
```json
{ "items": [ { "sessionId": "...", "graphId": "...", "startedAt": "2026-10-22T03:00:00.000Z",
               "outcomeKind": "user_fixed", "graph": { "manualId":"...", "entrySymptom":"...", "deviceCategory":"microwave", "brand":"Samsung", "modelPattern":"..." } } ],
  "total": 12, "page": 1, "pageSize": 10, "totalPages": 2 }
```
8. หน้าจอแสดงแต่ละแถวที่ `components/history/HistoryRow.tsx:23-78` (ชื่ออาการ, ประเภท/ยี่ห้อ/รุ่น, วันเวลา, ป้ายสถานะ) เปลี่ยนหน้าด้วย `Pagination` (`HistoryPage.tsx:110`) ถ้าไม่มีประวัติ แสดง "ยังไม่มีประวัติการซ่อม" พร้อมลิงก์เลือกเครื่อง (`:87-97`)
9. หมายเหตุ: รายการดูแค่ "โหนดสุดท้ายเป็นจบแบบไหน" (`getOutcomeKind`) ไม่ replay ทุกแถว เพราะหนัก

## ข. หน้ารายละเอียด (`/history/:id`)
1. กดแถว (`HistoryRow.tsx:32-35` `Link to="/history/:id"`) → `App.tsx:46` แสดง `HistoryDetailPage`
2. `pages/HistoryDetailPage.tsx:52` เรียก `useHistoryDetail(sessionId)` (`api/queries.ts:67`) → `api/history.ts:16-18` **`GET /history/:id`** + `ownerHeaders()`
3. Backend: `history.routes.ts:20-24` (`optionalAuth` + `resolveRequiredOwner`) → `HistoryService.detail` (`history.service.ts:68`) ทำตามลำดับ:
   - **`requireOwned`** (`:100`) → `HistoryStore.findCompleted` (`history.store.ts:62-82`): ตรวจเจ้าของ + จบแล้ว + ไม่หมดอายุในคำสั่งเดียว ไม่ใช่ของเรา → 404 `HISTORY_NOT_FOUND` (ไม่ใช่ 403 เพื่อไม่บอกว่า id นั้นมีจริง `history.service.ts:35-36`)
   - `findFeedback` (`history.store.ts:114-123`) อ่านคะแนนที่เคยให้
   - `graphRepository.findById(graphId)` หาผังจากหน่วยความจำ
   - `findSteps` (`history.store.ts:84-93`) อ่านขั้นที่เคยผ่าน
   - `buildDetail` (`history.service.ts:126`) ประกอบรายละเอียด
```sql
-- findCompleted  history.store.ts:64-71
SELECT session_id, graph_id, current_node_id, variables, confidence, model_selection, outcome_text,
       UNIX_TIMESTAMP(created_at) AS created_epoch
  FROM sessions WHERE session_id = ? AND ${where.sql} AND status = 'completed' AND expires_at > NOW()
-- findSteps  :85-91
SELECT node_id, action_type, action_value FROM session_history WHERE session_id = ? ORDER BY step_order
-- findFeedback  :115-119
SELECT helpful, `comment` FROM session_feedback WHERE session_id = ?
```
   ⚠️ `findSteps` ไม่ตรวจเจ้าของเอง ต้องเรียกหลัง `findCompleted` ผ่านเท่านั้น (service ทำถูกแล้ว)
4. **ปัญหาใหญ่: ผังถูกแก้หลังผู้ใช้ตรวจจบ** ประวัติเก็บแค่ "รหัสโหนด + สิ่งที่กด" ไม่ได้เก็บข้อความตอนนั้น อ่านย้อนหลังต้องเอาข้อความจากผัง **ปัจจุบัน** ถ้าผังเปลี่ยน อาจโชว์ขั้นเก่าคู่ข้อสรุปใหม่ที่ไม่เกี่ยวกัน ทางออกคือ **เล่นซ้ำเพื่อพิสูจน์** (`replayReaches` `history.service.ts:232`):
   - เริ่มที่ `entry_node` ของผังปัจจุบัน → ป้อน action ที่บันทึกไว้ทีละขั้นผ่าน engine จริง
   - ต้องผ่านทุกขั้นและไปจบที่ "โหนดสุดท้ายเดิม" ในสถานะ `completed` → ผ่าน: ตอบข้อมูลเต็ม `available: true`
   - ไม่ผ่าน (โหนดหาย, ทางเดินเปลี่ยน, engine ไม่รับ action เดิม) → ตอบ `available: false` (HTTP 200 ไม่ใช่ error) ยังมีข้อความที่ผู้ใช้บันทึกเอง คะแนนที่ให้ และปุ่มลบ แต่ไม่มี steps/finalNode/คำเตือน (ไม่ปล่อยข้อมูลครึ่งๆ กลางๆ)
5. ตอบ `HistoryDetail`: `available`, `steps[]`, `finalNode`, `safetyWarnings[]`, `reference`, `outcome`, `feedback`, `confidence`, `modelSelection` (shape ที่ `frontend/src/api/types.ts`)
6. หน้าจอแสดงตามลำดับ: กล่อง "ผังถูกเปลี่ยน" ถ้า `available:false` (`HistoryDetailPage.tsx:115-119`) → คำเตือนความปลอดภัย (`:122-130`, เฉพาะที่ผังมีจริง) → ผลการตรวจ + ที่มา (`:132-149`) → ความมั่นใจ (`:151-163` `null` = "ไม่มีคะแนน" ไม่แสดงเป็น 0) → ขั้นตอนที่ผ่านมา (`:165-183`) → ผลที่ผู้ใช้บันทึก (`:185-190`) → ฟอร์มให้คะแนน (`:192-199` ช่วง 8) → ปุ่ม "ตรวจอาการนี้อีกครั้ง" (`:205-207`, `handleRestart :88-91` เริ่ม session ใหม่ด้วยรุ่นเดิม) → ปุ่มลบ (`:226-228`)

## ค. ลบจากประวัติ
1. กด "ลบ" (`HistoryRow.tsx:59-61` หรือ `HistoryDetailPage.tsx:226-228`) → `DeleteConfirm` ขึ้นขั้นยืนยัน → `useDeleteHistory` (`api/queries.ts:150`) → `api/history.ts:21-26` **`DELETE /history/:id`**
2. Backend: `history.routes.ts:34-39` → `HistoryService.remove` (`history.service.ts:78`) → `HistoryStore.deleteCompleted` (`history.store.ts:95-103`):
```sql
DELETE FROM sessions WHERE session_id = ? AND ${where.sql} AND status = 'completed' AND expires_at > NOW()
```
3. ตอบ 204 · ไม่ใช่ของเรา/ไม่พบ → 404 · `session_history` กับ `session_feedback` ถูกลบตาม (CASCADE) · ฝั่งหน้าจอลบแคชของรายการนั้นแล้วโหลดรายการใหม่ทุกหน้า (`onSettled`)

## ข้อสังเกตช่วง 7
- เพดาน **50 รายการต่อผู้ใช้** (`MAX_HISTORY_ROWS`) รายการเก่ากว่านั้นเปิดดู/ลบจากหน้ารายการไม่ได้
- guest ผูกกับ `client_id` ใน localStorage: ล้างข้อมูลเบราว์เซอร์ = ประวัติหาย และใครรู้ id ก็เปิดประวัติ guest ของ id นั้นได้ (ไม่ใช่การยืนยันตัวตน)
- ประวัติก่อนล็อกอินไม่ย้ายเข้าบัญชี (หน้าจอบอกชัด `HistoryPage.tsx:74-76`)

## เฉลยคำถามช่วง 7
- **ระบบรู้ได้ไงว่า session ไหนเป็นของสมชาย:** จาก `sessions.user_id` (ล็อกอิน) หรือ `sessions.client_id` (guest) ที่เก็บตอนเริ่มตรวจ (`session.store.ts:38-57`) และทุก query ของประวัติมี `ownerWhere` ใน SQL (`history.store.ts:54, :69, :99`) ตัวระบุเจ้าของมาจาก token หรือหัว `X-Client-Id`
- **เดา session id ของคนอื่นถูก:** ได้ 404 `HISTORY_NOT_FOUND` เพราะกรองด้วย `ownerWhere` แล้วผลว่างเหมือนไม่มี (ไม่ตอบ 403)
- **admin แก้ผังหลังตรวจจบ:** `replayReaches` เล่นซ้ำกับผังปัจจุบัน ไม่ไปจบที่โหนดเดิม → `available:false` (HTTP 200) หน้าจอบอกว่าผังถูกเปลี่ยน ไม่โชว์ขั้นเก่าคู่ข้อสรุปใหม่
- **ทำไมรายการไม่ replay ทุกแถว:** ต้องดึงขั้นของแต่ละ session แยกซึ่งหนัก ตัวตรวจเข้มอยู่ที่หน้ารายละเอียด
- **มีประวัติ 60 รายการ เห็นกี่รายการ:** สูงสุด 50 ล่าสุด (`LIMIT` ใน SQL) และ `total` ก็นับจากที่ดึงมา 50

## โน้ตของฉัน (ช่วง 7)
-

---

# ช่วงที่ 8: ให้คะแนน 👍/👎 + ข้อความ

**ภาพรวม:** สมชายเปิดรายละเอียดประวัติ กด 👍 พิมพ์ "ช่วยได้มาก" แล้วบันทึก คะแนนถูกเก็บในตาราง `session_feedback` (1 session = 1 แถว ส่งซ้ำ = แก้ค่าเดิม) และผู้ดูแลอ่านไปทำสถิติในช่วง 9 **ให้คะแนนได้เฉพาะในหน้ารายละเอียดประวัติ** ไม่มีฟอร์มที่หน้าจบการตรวจ (หน้าจบมีแต่ฟอร์ม "ผลเป็นอย่างไรบ้าง")

## ก. ฝั่งหน้าจอ
1. ฟอร์มอยู่ใน `components/history/FeedbackButtons.tsx` ที่หน้ารายละเอียดเรียกใช้ที่ `pages/HistoryDetailPage.tsx:192-199` แสดงเฉพาะเมื่อ `data.available` (ผังยังตรงเดิม)
2. ค่าเริ่มต้นของฟอร์มมาจากคะแนนที่เคยบันทึกไว้ (`saved`): `useState(saved?.helpful ?? null)` และ `useState(saved?.comment ?? '')` (`FeedbackButtons.tsx:28-29`) จึงเปิดมาแล้วเห็นของเดิม และส่งซ้ำคือแก้ค่าเดิม
3. ปุ่ม 👍 "ช่วยได้" (`:45-47`) และ 👎 "ไม่ช่วย" (`:48-50`) แค่ตั้งค่า `helpful` ใน state ยังไม่ส่ง · ต้องเลือกหนึ่งอย่าง (บังคับ)
4. ช่องข้อความ (`:62-71`): ไม่บังคับ ไม่เกิน 500 ตัวอักษร (`MAX_FEEDBACK_COMMENT_LENGTH` `lib/textInput.ts:23`) มีตัวนับ `formatCommentCounter` (`textInput.ts:35`) และข้อความเตือน "ไม่ต้องใส่ข้อมูลส่วนตัว" (`:57-59`)
5. ปุ่ม "บันทึก" (`:78-80`) กดได้เมื่อ (`:31-32`): เลือก 👍/👎 แล้ว **และ** ข้อความไม่เกิน 500 (`checkComment` `lib/textInput.ts:31`) **และ** ไม่กำลังส่ง **และ** ค่าต่างจากที่บันทึกไว้ (`isSameFeedback` `lib/textInput.ts:44` ถ้าเหมือนเดิมแสดง "บันทึกแล้ว" และปุ่มถูกปิด)
6. กดบันทึก → `handleSubmit` (`FeedbackButtons.tsx:34-38`) → `onSubmit(toFeedback(helpful, comment))` (`lib/textInput.ts:39`): ตัดช่องว่างหัวท้าย และ **ข้อความว่างส่งเป็น `null`** ให้ตรงกับที่ DB เก็บ (NULL ไม่ใช่สตริงว่าง) → `HistoryDetailPage.tsx:195` `feedback.mutate(value)`
7. `useSubmitFeedback(sessionId)` (`api/queries.ts:166`) → `api/history.ts:29-35` `submitFeedback` → **`POST /history/:id/feedback`** body `{ "helpful": true, "comment": "ช่วยได้มาก" }` (comment อาจเป็น `null`) + `headers: ownerHeaders()`

## ข. ฝั่งเซิร์ฟเวอร์
1. คำขอผ่าน `cors` → `express.json` → router `/history` → `backend/src/history/history.routes.ts:27-31`
2. `optionalAuth` อ่านบัตร → `resolveRequiredOwner(currentUser(request), request.headers['x-client-id'])` ระบุเจ้าของ (ล็อกอิน = user, ไม่ล็อกอิน = `X-Client-Id` บังคับ)
3. `parseFeedbackBody` (`history/history.dto.ts:112-135`) ตรวจ body:
   - ต้องเป็น JSON object
   - `helpful` **ต้องเป็น boolean จริง** ไม่รับข้อความ `"true"` หรือเลข 1 → ไม่งั้น 400 `INVALID_FEEDBACK`
   - `comment` ไม่บังคับ: ไม่ส่ง/`null` → `null` · ไม่ใช่ข้อความ → 400 · ตัดช่องว่างแล้วเกิน 500 → 400 · ว่างหลังตัด → `null`
4. ตอบ 200 (ไม่ใช่ 201 เพราะส่งซ้ำ = แก้ค่าเดิม) `response.status(200).json(await history.saveFeedback(owner, id, parseFeedbackBody(body)))` (`history.routes.ts:29`)
5. `HistoryService.saveFeedback` (`history/history.service.ts:86-94`):
   - **`requireOwned`** (`:91`) session ต้องเป็นของผู้ขอ และจบแล้ว ไม่งั้น 404 `HISTORY_NOT_FOUND` (กันให้คะแนน session ของคนอื่น)
   - `store.saveFeedback(sessionId, body)` (`:92`)
   - คืน `{ helpful, comment }` ที่บันทึก (`:93`)
6. `HistoryStore.saveFeedback` (`history/history.store.ts:105-112`):
```sql
INSERT INTO session_feedback (session_id, helpful, `comment`)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE helpful = VALUES(helpful), `comment` = VALUES(`comment`)
```
   `helpful` เก็บเป็น 1/0 (`feedback.helpful ? 1 : 0` `:110`) · `ON DUPLICATE KEY UPDATE` = ถ้ามีแถวของ session นี้อยู่แล้ว ให้แก้ค่าเดิมแทนเพิ่มแถวที่สอง (คำสั่งเดียว atomic ไม่ต้องตรวจก่อนแล้วค่อยเขียน)

## ค. ฐานข้อมูล
ตาราง `session_feedback` (`backend/migrations/005_session_feedback.sql:10-22`):
- `session_id` เป็น **PRIMARY KEY** และ FK ไป `sessions` (`ON DELETE CASCADE`) → 1 session มีได้ 1 แถว · ลบ session แถวนี้หายตาม
- `helpful TINYINT(1)` (1 = 👍, 0 = 👎) · `comment TEXT NULL` · `created_at`, `updated_at` (มี `ON UPDATE CURRENT_TIMESTAMP` แก้แล้วเวลาแก้ไขขยับ)

## ง. ตอบกลับและหน้าจออัปเดต
1. ตอบ:
```json
{ "helpful": true, "comment": "ช่วยได้มาก" }
```
2. `useSubmitFeedback` `onSuccess` เอาค่าที่เซิร์ฟเวอร์ตอบมาใส่ในแคชรายละเอียดทันที (`setQueryData` ใน `api/queries.ts:166`) ฟอร์มจึงรู้ว่า "บันทึกแล้ว" โดยไม่ต้องโหลดซ้ำ → `isSameFeedback` เป็นจริง → ขึ้น "บันทึกแล้ว" (`FeedbackButtons.tsx:81-85`) และปุ่มบันทึกถูกปิด
3. ผิดพลาด (เช่น 400/404/เครือข่าย) แสดง `ErrorNotice` ใต้ฟอร์ม (`:75`)

## ข้อสังเกตช่วง 8
- ให้คะแนนได้เฉพาะหลังเข้าหน้ารายละเอียดประวัติ ผู้ใช้ต้องกดเข้า `/history/:id` เอง
- ไม่มีผลต่อขั้นตอนหรือการตัดสินใดของระบบ เก็บไว้ประเมินเท่านั้น (คอมเมนต์ `FeedbackButtons.tsx:19-22`)
- ความเห็นเป็นข้อความอิสระ อาจมีข้อมูลส่วนตัวปน หน้าจอเตือนผู้ใช้ (`:57-59`) และหน้าแอดมินแสดงตามที่พิมพ์
- ตรวจ 2 ที่ (หน้าจอบอกทันที / backend ตัดสิน) เพดาน 500 คัดลอกมือ ต้องแก้สองที่เมื่อเปลี่ยน

## เฉลยคำถามช่วง 8
- **ส่งคะแนนซ้ำเปลี่ยนจาก 👍 เป็น 👎 เกิดอะไร:** `ON DUPLICATE KEY UPDATE` แก้แถวเดิม ไม่เพิ่มแถวใหม่ (`session_id` เป็น PRIMARY KEY) `updated_at` ขยับ
- **ส่ง `{"helpful": "true"}` (ข้อความ):** 400 `INVALID_FEEDBACK` เพราะต้องเป็น boolean จริง (`history.dto.ts` ตรวจ `typeof obj.helpful !== 'boolean'`)
- **ให้คะแนน session ของคนอื่นโดยเดา id:** 404 `HISTORY_NOT_FOUND` จาก `requireOwned` (`history.service.ts:91`) ก่อนถึงขั้นเขียน DB
- **ไม่พิมพ์ข้อความ:** ไม่เป็นไร ส่ง `comment: null` DB เก็บ NULL ไม่ใช่สตริงว่าง (`toFeedback`)
- **ส่งข้อความ `"   "` (ช่องว่างล้วน):** ตัดแล้วว่าง → `null`

## โน้ตของฉัน (ช่วง 8)
-

---

# ช่วงที่ 9: แดชบอร์ดผู้ดูแล (สถิติ + ความเห็น)

**ภาพรวม:** ผู้ดูแลระบบ (admin) เปิด `/admin/analytics` ดูสถิติ N วันล่าสุด และ `/admin/feedback` อ่านรายการความเห็นที่ผู้ใช้ให้ไว้ในช่วง 8 อ่านอย่างเดียว ไม่มีการแก้ข้อมูล และ **ไม่มีแดชบอร์ดฝั่งผู้ใช้ทั่วไป**

## ก. สถิติ `/admin/analytics`

### ฝั่งหน้าจอ
1. เมนู "ผู้ดูแลระบบ" แสดงเฉพาะ `role === 'admin'` (`components/layout/AppShell.tsx:46`) · route `/admin/analytics` ครอบด้วย `AdminRoute` (`App.tsx:51-58`)
2. `components/auth/AdminRoute.tsx:19-40` ตรวจสถานะ: กำลังยืนยัน token → "กำลังตรวจสอบสิทธิ์" · guest → พาไปล็อกอิน (`?reason=login-required&next=...`) · ล็อกอินแต่ไม่ใช่ admin → `ForbiddenPage` · admin → แสดงหน้า **นี่เป็น UX เท่านั้น** ตัวบังคับจริงคือ backend (หัวไฟล์ `:16-17`)
3. หน้า `pages/AdminAnalyticsPage.tsx` อ่านช่วงวันจาก URL (`?days=7|30|90` ค่าเริ่มต้น 30 `lib/adminParams.ts`) ปุ่มเลือกช่วง (`:47-57`) → `setSearchParams`
4. `useAdminSummary(days)` (`api/queries.ts:81`) → `api/admin.ts:23-25` **`GET /admin/analytics/summary?days=30`** (แนบ `Authorization: Bearer ...` โดย `http.ts` ไม่ส่ง `X-Client-Id` เพราะไม่ใช่เรื่อง session) key ของแคชมี identity (`['admin', identity, 'summary', days]`)
5. แสดงผลจาก `AdminSummary` ตรงๆ ไม่คำนวณเอง: การ์ดตัวเลข (`:83-103`) การตรวจทั้งหมด/จบแล้ว/กำลังเดิน/เดินค้างแล้วหมดอายุ · **การ์ด "ความเห็น 👍 / 👎"** (`:92-96`) และ **"อัตราความพอใจ"** (`:97`) ที่ใช้ข้อมูลจากช่วง 8 · ความมั่นใจเฉลี่ย (`:98-102`) · แยกตามเจ้าของ (`:105-116`) · กราฟรายวัน `DailyBars` (`:118`) · `BarList` ผลการตรวจ/ประเภทเครื่อง/อาการยอดนิยม (`:120-142`) ค่า `null` (อัตราพอใจ, ความมั่นใจเฉลี่ย) แสดงเป็น "-" ไม่ใช่ 0

### ฝั่งเซิร์ฟเวอร์
1. คำขอ → `cors` → `express.json` → router `/admin` (`app.ts:75`) → `backend/src/admin/admin.routes.ts:34-41`
2. **ด่านสิทธิ์ก่อนเสมอ:** `requireAuth` (`:36`) → `requireAdmin` (`:37`) (ตรวจสิทธิ์ก่อน parse query) ไม่มี/บัตรเสีย → 401 · ล็อกอินแล้วไม่ใช่ admin → 403 `FORBIDDEN` (`auth/auth.middleware.ts:59-80`) ติดทีละ route ไม่ครอบทั้ง path
3. ตรวจ query: `parseSummaryQuery` (`admin/admin.dto.ts:140`): `days` 1–90 ค่าเริ่มต้น 30 ผิด → 400 `INVALID_ADMIN_QUERY`
4. `AdminService.summary` (`admin/admin.service.ts:52`):
   - คิดช่วงเวลาตามเวลาไทย: เลขวันนี้ (`thaiDayIndex`) ย้อน `days-1` วัน แล้วแปลงเป็น epoch (`:53-55`)
   - **ยิง 5 query พร้อมกัน** ด้วย `Promise.all` (`:57-63`): `sessionTotals`, `feedbackTotals`, `graphCounts`, `completedEndNodes`, `perDay`
   - ประกอบผล: นับผลลัพธ์ตามชนิด (`:66-77`), อันดับอาการ/ประเภทเครื่อง ตัดเหลือ `TOP_LIMIT` (`:80-100`), เติมวันที่ไม่มีข้อมูลเป็น 0 (`:103-108`), อัตราความพอใจ `helpful / total` หรือ `null` ถ้า `total === 0` (`:123`)
5. `AdminStore` (`admin/admin.store.ts`) SQL อ่านอย่างเดียว ทุกคำสั่งใช้ช่วงเวลา `window` เดียวกัน:
```sql
-- feedbackTotals  :140-148   ← ข้อมูลจากช่วง 8 เข้ามาที่นี่
SELECT COUNT(*) AS total, SUM(helpful = 1) AS helpful_count
  FROM session_feedback
 WHERE UNIX_TIMESTAMP(created_at) >= ? AND UNIX_TIMESTAMP(created_at) < ?
-- sessionTotals  :111-138   (นับหลายแบบในคำสั่งเดียวด้วย SUM(เงื่อนไข))
SELECT COUNT(*) AS total,
       SUM(status = 'completed') AS completed,
       SUM(status = 'in_progress' AND expires_at > NOW()) AS in_progress,
       SUM(status = 'in_progress' AND expires_at <= NOW()) AS expired_unfinished,
       SUM(user_id IS NOT NULL) AS by_user,
       SUM(user_id IS NULL AND client_id IS NOT NULL) AS by_guest,
       SUM(user_id IS NULL AND client_id IS NULL) AS by_none,
       AVG(confidence) AS avg_confidence, COUNT(confidence) AS confidence_samples
  FROM sessions WHERE UNIX_TIMESTAMP(created_at) >= ? AND UNIX_TIMESTAMP(created_at) < ?
-- graphCounts :150-159   อาการยอดนิยม (จัดอันดับใน service)
SELECT graph_id, COUNT(*) AS n FROM sessions
 WHERE UNIX_TIMESTAMP(created_at) >= ? AND UNIX_TIMESTAMP(created_at) < ? GROUP BY graph_id
-- completedEndNodes :161-175   ที่ไหนจบกี่ครั้ง (service แปลงเป็นชนิดผลลัพธ์จากผังปัจจุบัน)
SELECT graph_id, current_node_id, COUNT(*) AS n FROM sessions
 WHERE status = 'completed' AND UNIX_TIMESTAMP(created_at) >= ? AND UNIX_TIMESTAMP(created_at) < ?
 GROUP BY graph_id, current_node_id
-- perDay :177-192   ยอดเริ่ม/จบรายวัน (25200 = 7 ชั่วโมง เวลาไทย)
SELECT FLOOR((UNIX_TIMESTAMP(created_at) + 25200) / 86400) AS day_idx,
       COUNT(*) AS started, SUM(status = 'completed') AS completed
  FROM sessions WHERE UNIX_TIMESTAMP(created_at) >= ? AND UNIX_TIMESTAMP(created_at) < ?
 GROUP BY day_idx
```
6. ตอบ:
```json
{ "window": { "days": 30, "from": "2026-09-23", "to": "2026-10-22" },
  "sessions": { "total": 40, "completed": 25, "inProgress": 3, "expiredUnfinished": 12, "byOwner": { "user": 10, "guest": 30, "none": 0 } },
  "feedback": { "total": 8, "helpful": 6, "notHelpful": 2, "satisfactionRate": 0.75 },
  "confidence": { "average": 0.79, "sampleSize": 20 },
  "outcomes": { "user_fixed": 15, "normal_behavior": 1, "handoff_informed": 8, "handoff_unknown": 1, "unknown": 0 },
  "topGraphs": [ { "graphId": "...", "entrySymptomTh": "...", "count": 7 } ], "topDevices": [ ... ], "perDay": [ { "date": "...", "started": 3, "completed": 2 } ] }
```

## ข. รายการความเห็น `/admin/feedback`
1. `pages/AdminFeedbackPage.tsx` ตัวกรอง 👍/👎 + ช่วงวันที่ (`:50-92`) เก็บใน URL → `useAdminFeedback(params)` (`api/queries.ts:72`) → `api/admin.ts:12-20` **`GET /admin/feedback?helpful=&from=&to=&page=&pageSize=20`**
2. Backend: `admin.routes.ts:24-31` ด่าน `requireAuth` → `requireAdmin` → `parseFeedbackQuery` (`admin.dto.ts:122`): `helpful` ต้องเป็นข้อความ `'true'`/`'false'` · `from`/`to` เป็น `YYYY-MM-DD` เวลาไทย (ช่วงไม่เกิน 366 วัน, `from` ไม่หลัง `to`) · `page` ≥ 1 · `pageSize` 1–100 (ค่าเริ่มต้น 20)
3. `AdminService.feedback` (`admin.service.ts:30-49`) → `AdminStore.listFeedback` (`admin.store.ts:52-107`) ซึ่งต่อ `WHERE` จากตัวกรองที่ส่งมาเท่านั้น (ข้อความเงื่อนไขตายตัวในไฟล์ ค่าเข้าทาง `?`) แล้วยิง 2 คำสั่ง: `COUNT(*)` ทั้งหมด และรายการหน้านี้:
```sql
SELECT f.session_id, f.helpful, f.`comment`,
       UNIX_TIMESTAMP(f.created_at) AS created_epoch, UNIX_TIMESTAMP(f.updated_at) AS updated_epoch,
       s.graph_id,
       CASE WHEN s.user_id IS NOT NULL THEN 'user' WHEN s.client_id IS NOT NULL THEN 'guest' ELSE 'none' END AS owner_type
  FROM session_feedback f JOIN sessions s ON s.session_id = f.session_id
 [WHERE f.helpful = ? AND UNIX_TIMESTAMP(f.created_at) >= ? AND ... < ?]
 ORDER BY f.created_at DESC, f.session_id
 LIMIT ? OFFSET ?
```
4. **ความเป็นส่วนตัว:** ไม่แตะตาราง `users` ไม่ SELECT อีเมล/ชื่อ/user_id/client_id รู้เจ้าของแค่ชนิด user/guest/none ผ่าน `CASE` และ service หยิบทีละช่อง ไม่ copy แถวจาก DB ทั้งก้อน (`admin.service.ts:33-46`)
5. หน้าจอแสดงแต่ละแถว (`FeedbackRow` `AdminFeedbackPage.tsx:139-167`): ป้าย 👍/👎, เวลา, ชนิดเจ้าของ, ข้อความ ("(ไม่มีข้อความ)" ถ้า `null`), ประเภทเครื่อง/ยี่ห้อ

## ค. ฐานข้อมูลของช่วงนี้
- อ่าน `session_feedback` และ `sessions` (migrations `005_session_feedback.sql`, `004_sessions.sql`) · **ไม่แตะ `users`** · ไม่มีการเขียน

## ข้อสังเกตช่วง 9
- feedback **ถูกใช้ในแดชบอร์ดจริง** (จำนวน 👍/👎 และอัตราความพอใจ) แต่ **ไม่ย้อนกลับไปปรับระบบ** (ไม่มีการเรียนรู้จาก feedback ในโค้ด)
- ตัวเลขนับจากตาราง `sessions` ซึ่งเอกสารเดิมบันทึกว่าเคย "ใช้ร่วมกับโปรเจกต์เก่า" (ผู้พัฒนายืนยันตอนล้าง DB ว่าฐานข้อมูลเก่าไม่ใช้แล้ว ข้อจำกัดนี้อาจเลิกเป็นจริง ยังไม่ได้ตรวจคอมเมนต์ให้ตรงกัน)
- "ยกเลิก" นับไม่ได้ (ยกเลิก = ลบแถวทิ้ง) มีแต่ "เดินค้างแล้วหมดอายุ"
- `AdminRoute` ฝั่งหน้าจอเป็น UX อย่างเดียว ตัวบังคับจริง `requireAdmin` (แก้ role ใน localStorage ได้หน้า แต่ API ตอบ 403 และ `/auth/me` ตอนเปิดเว็บแก้ role กลับตามเซิร์ฟเวอร์)
- ไม่มี dashboard ฝั่งผู้ใช้ทั่วไป (ค้นแล้ว มีเฉพาะ `/admin/*`)

## เฉลยคำถามช่วง 9
- **ผู้ใช้ธรรมดาเรียก `/admin/analytics/summary` ตรงๆ:** 403 `FORBIDDEN` จาก `requireAdmin` (`auth.middleware.ts:70-80`) ก่อนถึงขั้น parse query
- **ไม่มีใครให้คะแนนในช่วงที่เลือก อัตราพอใจเป็นเท่าไร:** `null` (แสดง "-") ไม่ใช่ 0 เพราะ `feedback.total === 0` (`admin.service.ts:123`) 0 กับ "ไม่มีข้อมูล" ต่างความหมาย
- **ทำไมยิง 5 query พร้อมกันด้วย `Promise.all`:** ไม่ขึ้นต่อกัน รอพร้อมกันเร็วกว่ารอทีละตัว และใช้ช่วงเวลา `window` เดียวกัน ตัวเลขจึงสอดคล้องกัน
- **ทำไม `to` ในตัวกรองวันที่ไม่รวมปลาย:** `toEpoch` = เที่ยงคืนเวลาไทยของวันถัดไป ใช้ `<` จึงได้ข้อมูลครบทั้งวัน `to`
- **admin เห็นอีเมลของผู้ให้ความเห็นไหม:** ไม่เห็น ไม่มี SELECT อีเมล/user_id รู้แค่ชนิด user/guest/none

## โน้ตของฉัน (ช่วง 9)
-

---

## ภาพรวมไฟล์ที่แตะในช่วง 6–9 (เรียงตามลำดับการเรียก)
- **ช่วง 6:** `SessionPage.tsx` → `OutcomeForm.tsx` / `SessionHeader.tsx` → `api/queries.ts` → `api/traversal.ts` → `traversal.routes.ts` → `traversal.dto.ts` → `traversal.service.ts` → `session.store.ts` → `migrations/004_sessions.sql`
- **ช่วง 7:** `AppShell.tsx` → `HistoryPage.tsx` / `HistoryRow.tsx` / `HistoryDetailPage.tsx` → `api/queries.ts` → `api/history.ts` → `lib/clientHeaders.ts` → `history.routes.ts` → `auth/session-owner.ts` → `history.dto.ts` → `history.service.ts` → `history.store.ts` → `migrations/004_sessions.sql`, `005_session_feedback.sql`
- **ช่วง 8:** `HistoryDetailPage.tsx` → `FeedbackButtons.tsx` → `lib/textInput.ts` → `api/queries.ts` → `api/history.ts` → `history.routes.ts` → `history.dto.ts` → `history.service.ts` → `history.store.ts` → `migrations/005_session_feedback.sql`
- **ช่วง 9:** `AppShell.tsx` → `AdminRoute.tsx` → `AdminAnalyticsPage.tsx` / `AdminFeedbackPage.tsx` → `api/queries.ts` → `api/admin.ts` → `admin.routes.ts` → `auth/auth.middleware.ts` → `admin.dto.ts` → `admin.service.ts` → `admin.store.ts` → `migrations/004_sessions.sql`, `005_session_feedback.sql`
