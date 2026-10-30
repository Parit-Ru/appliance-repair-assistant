# ความคืบหน้าการอ่านโค้ด (รอบ "จากแกนกลางไปรอบนอก")

> เริ่ม 20 ต.ค. 2569 · ลำดับตาม `docs/reference/FILE-MAP.md` · ✅ อ่านแล้ว · 🔖 mark ไว้กลับมาอ่านซ้ำใน study · ⬜ ยังไม่อ่าน

## Backend

| รอบ | ไฟล์ | สถานะ | หมายเหตุ |
|---|---|---|---|
| 1 | `traversal-engine/types.ts` | ✅ | คำศัพท์: ผัง/โหนด 5 ชนิด/action 4 แบบ/error 4 ชนิด |
| 1 | `traversal-engine/traversal-engine.ts` | ✅ | ตัดสินขั้นถัดไป + ด่าน safety |
| 2 | `traversal/traversal.service.ts` | ✅ | engine ก่อน แล้วค่อยบันทึก (บ.146 → 150) |
| 2 | `traversal/session.store.ts` | ✅ | SQL + transaction + UNIQUE กัน race |
| 2 | `traversal/traversal.dto.ts` | 🔖 | อ่านผ่านรอบเดียว — **กลับมาอ่านซ้ำใน study** (ตรวจรูปร่าง input: client id, start body, action 4 แบบ, outcome) |
| 2 | `traversal/traversal.routes.ts` | 🔖 | 7 endpoint "โง่ๆ" + middleware `optionalAuth` (เจ้าของ optional vs required) — mark กลับมาอ่านซ้ำ · ตอนอ่านยังเป็น `traversal.controller.ts` (NestJS) |
| 3 | `symptom-search/symptom-matcher.ts` | ✅ | cosine, rankGraphs (คะแนนสูงสุดต่อผัง), selectMatches |
| 3 | `symptom-search/symptom-search.service.ts` | ✅ | ดัชนีเวกเตอร์ในหน่วยความจำ, 0.55 / top 3, กรองรุ่นก่อนจัดอันดับ, addGraphs |
| 3 | `embedding/embedding.service.ts` | 🔖⭐ | **สำคัญ** — ที่เดียวที่แตะโมเดล AI: load (allowRemoteModels=false, q8, 1 thread), embed (mean pooling + normalize) · ต้องอธิบายกรรมการได้ · คู่กับ `docs/study/EXPLAIN-MODEL-SLIM.md` |
| 4 | `common/api-error.ts`, `common/error-handler.ts` | 🔖⭐ | **สำคัญ — ต้องอธิบายกรรมการได้** (อ่านรอบ Express แล้ว 21 ต.ค.: ENGINE_ERRORS, hasHttpStatus, toBody) · ApiError + error handler ตัวเดียว, log เฉพาะ 5xx, 500 ส่ง message ภายในออก · ตอนอ่านยังเป็น `all-exceptions.filter.ts` ของ Nest — ลำดับตัดสินเหมือนเดิม แต่โค้ดเป็น Express แล้ว อ่านทวน |
| 5 | `app.ts`, `main.ts` | ⬜ | **ใหม่ (Express)**: ประกอบทุกอย่างในไฟล์เดียว ลำดับบูต และติด routes — อ่านก่อน auth |
| 5 | `auth/*` | ✅ | อ่านแล้ว 21 ต.ค.: token, auth.middleware, auth.routes, auth.service, role.enum, auth.dto, users.store · **🔖 `session-owner.ts` mark ไว้กลับมาอ่านซ้ำ** (เจ้าของ session: user/guest, ownerWhere/ownerColumns) · เดิมระบุ: session-owner, auth.service, `token.ts` (ออก/ตรวจ JWT), `auth.middleware.ts` (optionalAuth/requireAuth/requireAdmin) |
| 6 | `rephrase/*` | 🔖 | **ข้ามไปก่อน กลับมาอ่านทีหลัง** (ผู้ใช้ mark 21 ต.ค.) · ผมอธิบายภาพรวมไปแล้วรอบเดียว: service 7 ด่าน, guard 8 ข้อ, groq client · ยังไม่ได้ตอบคำถามเช็ก 3 ข้อ · อ่านคู่กับ STUDY_GUIDE §3.6 |
| 7 | `history/*` | ✅/🔖 | อ่านแล้ว 21 ต.ค.: routes, dto, service · **🔖⭐ `history.service.ts` สำคัญ กลับมาอ่านซ้ำ** (buildDetail → available:false, replayReaches, requireOwned 404) · **🔖 `history.dto.ts` mark ไว้กลับมาอ่าน** (optionalPositiveInt, ค่าเริ่มต้น/เพดาน, null ≠ 0) · **🔖 `history.store.ts` ผู้ใช้ยังงง mark ไว้กลับมาอ่านซ้ำ** (ทุกเมธอด SQL + ownerWhere + NULL ห้ามเป็น 0) · `MAX_HISTORY_ROWS` = 50 (ผู้ใช้ยืนยันตั้งใจ เดิม 500) — แก้ STUDY_GUIDE แล้ว |
| 7 | `admin/*` | 🔖 | อ่านแล้ว 21 ต.ค.: routes, service (ภาพรวม), dto · **🔖⭐ `admin.dto.ts` สำคัญ กลับมาอ่านซ้ำ** (เพดานทุกอย่าง, วันที่เวลาไทย↔epoch, to ไม่รวมปลาย, response ไม่มีข้อมูลส่วนตัว) · **🔖⭐ `admin.store.ts` สำคัญ กลับมาอ่านซ้ำ** (SUM(เงื่อนไข) นับหลายแบบในคำสั่งเดียว, COUNT แยกสำหรับแบ่งหน้า, owner_type ผ่าน CASE ไม่ดึง id, perDay 25200) · จบโมดูล admin ครบ 4 ไฟล์ |
| 8 | `authoring/*` | 🔖 | อ่านรอบ Express แล้ว: `drafts.routes.ts` · **🔖⭐ `drafts.routes.ts` สำคัญ กลับมาอ่านซ้ำ** (uploadPdf/multer, สิทธิ์ก่อนไฟล์, 202, แปลง error 413/400) · **🔖 `drafts.dto.ts` mark ไว้กลับมาอ่าน** (parseUploadFields, ปฏิเสธฟิลด์เกิน, ช่วงหน้า ≤10, metadata มาจาก admin ไม่ใช่ LLM) · **🔖⭐ `drafts.service.ts` สำคัญ กลับมาอ่านซ้ำ** (สถานะร่าง, runDrafting เบื้องหลัง, publish ตรวจซ้ำใน transaction, busy flag) · อ่านแล้ว `drafts.errors.ts` · **⭐ `pdf-text.ts` สำคัญ ผู้ใช้ยังไม่เคลียร์ ต้องกลับมาอ่านซ้ำ** (extract ทีละขั้น, normalizePageText, error 5 ชนิด, ข้อจำกัดไม่มี OCR) · อ่านแล้ว `drafts.store.ts` (transaction publish, FOR UPDATE, ประตูสถานะ AND status=) · **🔖 หัวข้อ "PDF ซ้ำ" mark ไว้ (ดูรายการด้านล่างข้อ 16)** · **🔖 `draft-llm.client.ts` mark ไว้กลับมาอ่าน** (SYSTEM_PROMPT กติกา 8 ข้อ, draft() ลำดับ 7 ขั้น, finish_reason=length, error 4 รหัส) · **🔖 `draft-schema.ts` อ่านผ่านๆ mark ไว้กลับมาอ่านเพิ่ม** (schema ≠ validator, allowlist NODE_KEYS, parseLlmOutput/parseDraftGraphs/assignGraphIds, ไม่ซ่อมเอง) · **⭐ `draft-manual.ts` สำคัญ ควรอ่านอีก** (assembleManual → manual JSON, toDbRows → แถว INSERT 3 ตาราง, ลำดับ *_COLUMNS ต้องตรงกัน, ลบเลข 7 ตกค้างบรรทัดแรกแล้ว) · **⭐⭐ `graph-validator.ts` ข้ามไว้ก่อน — สำคัญมาก ต้องอ่านเยอะ (502 บรรทัด) ต้องแบ่งอ่านทีละกฎ** (เคยอ่านรอบ A) (18 ต.ค.) ก่อนย้ายเป็น Express แต่ยังไม่อ่านรอบนี้ · | `graph-validator.ts` ค้างอ่านซ้ำทีละกฎ (จากรอบ PDF→publish) |

## Frontend
⬜ `App.tsx` → `pages/SessionPage.tsx` → `api/queries.ts` → `lib/errors.ts`

## รายการ 🔖 ที่ต้องกลับมาอ่าน
1. `traversal.dto.ts` (รอบ 2)
2. `traversal.routes.ts` (รอบ 2 · เดิม `traversal.controller.ts`)
3. ⭐ `embedding/embedding.service.ts` (สำคัญ — เรื่องโมเดล) คู่กับ `EXPLAIN-MODEL-SLIM.md`
4. `graph-validator.ts` ทีละกฎ (ค้างจากรอบ PDF→publish)
6. `auth/session-owner.ts` (รอบ 5)
7. `rephrase/*` ทั้ง 3 ไฟล์ (รอบ 6 · ข้ามไปก่อน)
8. `history/history.store.ts` (รอบ 7 · ยังงง)
9. `history/history.dto.ts` (รอบ 7)
10. ⭐ `history/history.service.ts` (รอบ 7 · สำคัญ — buildDetail + replayReaches)
11. ⭐ `admin/admin.dto.ts` (รอบ 7 · สำคัญ — วันที่เวลาไทย, เพดาน, ความเป็นส่วนตัว)
12. ⭐ `admin/admin.store.ts` (รอบ 7 · สำคัญ — SQL สถิติ, SUM(เงื่อนไข), owner_type)
13. ⭐ `authoring/drafts.routes.ts` (รอบ 8 · สำคัญ — uploadPdf/multer, สิทธิ์ก่อนไฟล์, 202)
14. `authoring/drafts.dto.ts` (รอบ 8)
15. ⭐ `authoring/drafts.service.ts` (รอบ 8 · สำคัญ — วงจรสถานะ, runDrafting, publish)
22. ⭐ `traversal/equipment.repository.ts` (รอบ 2 · สำคัญ ควรกลับมาอ่าน — โหลดครั้งเดียวตอนบูต, Map ตามประเภทเครื่อง, คืนสำเนา, ต้องรีสตาร์ตถึงเห็นข้อมูลใหม่)
21. ⭐ `authoring/draft-manual.ts` (รอบ 8 · สำคัญ ควรอ่านอีก)
20. ⭐⭐ `authoring/graph-validator.ts` (รอบ 8 · ข้ามไว้ก่อน — สำคัญมาก ต้องอ่านเยอะ แบ่งอ่านทีละกฎ)
19. 🔖 `authoring/draft-schema.ts` (รอบ 8 · อ่านผ่านๆ กลับมาอ่านเพิ่ม — แยก schema จาก validator ให้ออก)
18. 🔖 `authoring/draft-llm.client.ts` (รอบ 8 · กลับมาอ่าน — prompt, draft(), DraftLlmError)
17. ⭐ `authoring/pdf-text.ts` (รอบ 8 · สำคัญ — ยังไม่เคลียร์ อธิบายละเอียดแล้วรอบหนึ่ง · จุดที่งง: `extract` = ชื่อเมธอดของเราเอง (interface PdfTextExtractor) · `getTextContent()` = ของไลบรารี unpdf/PDF.js คืน "ชิ้นข้อความ" {str, hasEOL} ต้องต่อเอง · ทำไมมี interface · ทำไมมี finally cleanup)
16. 🔖 **หัวข้อ: ระบบเช็ก "PDF ซ้ำ" ยังไง** (คำตอบที่ใช้ตอบกรรมการ): "ระบบไม่เก็บไฟล์ PDF จึงไม่รู้ว่าไฟล์เดียวกันเคยอัปโหลด กันได้เฉพาะรหัสคู่มือและรหัสผังที่ซ้ำกับของที่เผยแพร่แล้ว ซึ่งตรวจตอนอัปโหลด ตอนตรวจร่าง และตอนเผยแพร่ใน transaction" · ช่องที่ไม่ได้กัน: PDF เดิมแต่ manualId ใหม่, manualId เดียวกันอัปโหลดซ้ำก่อนเผยแพร่ (ไปชนตอน publish ใบที่สอง) · โค้ด: `drafts.service.ts:61`, `:244-251`, `drafts.store.ts` assertNoConflicts
5. ⭐ `common/error-handler.ts` (รอบ 4 · สำคัญ — ทวนก่อนสอบ คู่กับ STUDY_GUIDE §4.7)

## สรุปความคืบหน้า backend/src (นับ 21 ต.ค. 2569 — 50 ไฟล์ / 6,321 บรรทัด)

| สถานะ | ไฟล์ | บรรทัด |
|---|---:|---:|
| อ่านแล้ว (รอบ Express นี้) | 46 | 5,639 (89%) |
| ข้าม/mark ไว้ก่อน (`rephrase/*` 3 ไฟล์ + `graph-validator.ts`) | 4 | 682 |
| ยังไม่ได้อ่านรอบนี้ | 0 | 0 |

ไม่มีไฟล์ที่ยังไม่ได้อ่านแล้ว (อ่านครบ 46 ไฟล์) · ที่เหลือคือไฟล์ที่ **ข้ามไว้ก่อน 4 ไฟล์**: `authoring/graph-validator.ts` (⭐⭐ สำคัญมาก ต้องอ่านเยอะ 502 บรรทัด) และ `rephrase/*` 3 ไฟล์ · อ่านล่าสุด: `traversal/graph.repository.ts` (อธิบายละเอียด 21 ต.ค.)

frontend/src (86 ไฟล์ / 5,935 บรรทัด ตรวจจากดิสก์ 26 ต.ค.) ยังไม่เริ่ม

## User Journey walkthrough (เดินตาม docs/USER_JOURNEY_WALKTHROUGH.md ทีละช่วง)

| ช่วง | หัวข้อ | สถานะ | ไฟล์บันทึก |
|---|---|---|---|
| 1 | สมัครสมาชิก | ✅ เดินแล้ว | `docs/study/JOURNEY-1-REGISTER.md` |
| 2 | เข้าสู่ระบบ + JWT + auth middleware | ✅ เดินแล้ว | `docs/study/JOURNEY-2-LOGIN.md` |
| 3 | เลือกเครื่อง/รุ่น | ✅ เดินแล้ว (ยังไม่มีไฟล์บันทึก) | – |
| 4 | พิมพ์อาการ → ค้นหา (embedding) → เริ่มตรวจ | ✅ เดินแล้ว (ยังไม่มีไฟล์บันทึก) | – |
| 5 | เดินผังทีละขั้น (engine, ด่านความปลอดภัย, แคช/พิกัด session) | 🔖⭐ **เดินแล้ว แต่ต้องกลับมาอ่านอีกรอบก่อนสอบ** (ผู้ใช้ยังงง: หน้าจอได้ข้อมูลจากไหน, รู้ได้ไงว่าอยู่ node ไหน/ไปไหนต่อ/ส่งกลับ frontend ยังไง) | – |
| 6 | บันทึกประวัติ | ✅ เดินแล้ว | `docs/study/JOURNEY-6-9-HISTORY-FEEDBACK-ADMIN.md` |
| 7 | หน้าประวัติ (รายการ/รายละเอียด/ลบ) | ✅ เดินแล้ว | (ไฟล์เดียวกับช่วง 6) |
| 8 | ให้คะแนน 👍/👎 | ✅ เดินแล้ว | (ไฟล์เดียวกับช่วง 6) |
| 9 | แดชบอร์ด admin | ✅ เดินแล้ว | (ไฟล์เดียวกับช่วง 6) |

> ⚠️ เลขบรรทัดของ `traversal.routes.ts`, `traversal.service.ts`, `api/queries.ts` ใน `USER_JOURNEY_WALKTHROUGH.md` เลื่อนแล้ว (ไฟล์ถูกลบคอมเมนต์) ยังไม่ได้รีเฟรช
