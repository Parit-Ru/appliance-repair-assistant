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
| 2 | `traversal/traversal.controller.ts` | 🔖 | 7 endpoint "โง่ๆ" + guard (OptionalJwtAuthGuard, เจ้าของ optional vs required) — mark กลับมาอ่านซ้ำ |
| 3 | `symptom-search/symptom-matcher.ts` | ✅ | cosine, rankGraphs (คะแนนสูงสุดต่อผัง), selectMatches |
| 3 | `symptom-search/symptom-search.service.ts` | ✅ | ดัชนีเวกเตอร์ในหน่วยความจำ, 0.55 / top 3, กรองรุ่นก่อนจัดอันดับ, addGraphs |
| 3 | `embedding/embedding.service.ts` | 🔖⭐ | **สำคัญ** — ที่เดียวที่แตะโมเดล AI: load (allowRemoteModels=false, q8, 1 thread), embed (mean pooling + normalize) · ต้องอธิบายกรรมการได้ · คู่กับ `docs/study/EXPLAIN-MODEL-SLIM.md` |
| 4 | `common/api-error.ts`, `all-exceptions.filter.ts` | ✅ | ApiError + filter ตัวเดียว (5 ขั้นตัดสิน), log เฉพาะ 5xx, 500 ส่ง message ภายในออก |
| 5 | `auth/*` | ⬜ | session-owner, auth.service, guards |
| 6 | `rephrase/*` | ⬜ | |
| 7 | `history/*`, `admin/*` | ⬜ | |
| 8 | `authoring/*` | ⬜ | `graph-validator.ts` ค้างอ่านซ้ำทีละกฎ (จากรอบ PDF→publish) |

## Frontend
⬜ `App.tsx` → `pages/SessionPage.tsx` → `api/queries.ts` → `lib/errors.ts`

## รายการ 🔖 ที่ต้องกลับมาอ่าน
1. `traversal.dto.ts` (รอบ 2)
2. `traversal.controller.ts` (รอบ 2)
3. ⭐ `embedding/embedding.service.ts` (สำคัญ — เรื่องโมเดล) คู่กับ `EXPLAIN-MODEL-SLIM.md`
4. `graph-validator.ts` ทีละกฎ (ค้างจากรอบ PDF→publish)
