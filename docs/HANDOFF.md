# HANDOFF — appliance-repair-assistant (อัปเดต 9 ต.ค. 2569)

เอกสารส่งต่อสำหรับเริ่มรอบถัดไป อ่านไฟล์นี้ก่อน แล้วเปิด [ROADMAP.md](ROADMAP.md) (แผนพอร์ต ลำดับไฟล์ เวลาประเมิน คำถามอาจารย์)

## 1) สถานะตอนนี้

ผู้ใช้ **พิมพ์โค้ดเอง** ทีละไฟล์ตามต้นแบบ `../troubleshoot-assistantv2` (FixStep) งานของ Claude: อธิบายก่อนพิมพ์ → ผู้ใช้พิมพ์ → ตรวจ (`tsc` + เทียบกับต้นแบบแบบไม่สนคอมเมนต์/ช่องว่าง) → ถามคำถามอาจารย์ **พร้อมเฉลยทุกข้อ** (ผู้ใช้ขอ) → หยุดรอผู้ใช้บอกก่อนไปไฟล์ถัดไป

| ลำดับ | ไฟล์ | สถานะ |
|---|---|---|
| 0A | backend scaffold + `package.json`, `tsconfig*.json`, `nest-cli.json`, `jest.config.js`, `.gitignore`, `npm ci` | ✅ เสร็จ (`package-lock.json` ตรงต้นแบบทุกไบต์) |
| 0A | `backend/.env.example` | ⬜ **ยังว่าง 0 ไบต์** (ต้องพิมพ์: ดู §5) |
| 0C | คัดลอก `data/{manuals,equipment,schemas}`, `scripts/{run-migrations,seed-graphs,seed-equipment}.js` | ✅ |
| 0C | `backend/.env` (ชี้ฐาน Aiven เดิม) | ✅ ผู้ใช้สร้างเอง **ผมไม่เคยเปิดอ่านค่า** (เคยดูเฉพาะชื่อตัวแปร) |
| #01 | `src/traversal-engine/types.ts` | ✅ ตรงต้นแบบ ยกเว้นตัด `'Microwave'` ออกจาก `DeviceCategory` (ผู้ใช้ตัดเอง) |
| #02 | `src/traversal-engine/traversal-engine.ts` | ✅ **ใช้ `graph.nodes.find(...)` แทน `buildNodeIndex`** (ตั้งใจ ดู §3) 171 บรรทัดโค้ด ตรงต้นแบบที่แก้แล้วทุกบรรทัด · smoke test ผังแอร์ 13 ผังผ่าน ด่านความปลอดภัยทำงาน |
| #03–#07 | `migrations/001–005_*.sql` | ✅ ตรงต้นแบบ (005 ผู้ใช้เขียน `COMMENT '...'` ย่อ ไม่กระทบ) · `003` คง `'Microwave'` ใน ENUM ตามต้นแบบ |
| #08 | `src/database/database.constants.ts` | ✅ ตรงต้นแบบ |
| #09 | `src/database/database.module.ts` | ✅ ตรงต้นแบบ ยกเว้นผู้ใช้สั่งให้ผม **refactor 2 จุด** (ลูป `for` แทน `.filter` และตัวแปร `message`) ตั้งใจ ไม่ใช่ข้อผิด |
| #10 | `src/traversal/graph.repository.ts` | 🔶 **ไฟล์ครบแล้ว แต่ส่วนใหญ่ผู้ใช้ copy-paste ไม่ได้พิมพ์เอง — ต้องกลับมาทำอีกที (ผู้ใช้สั่ง 9 ต.ค.)** · ตรวจ 9 ต.ค.: **239 บรรทัดโค้ด ตรงต้นแบบทุกบรรทัด (diff ตัดคอมเมนต์ = 0) · `tsc` ผ่าน** · ที่พิมพ์เองและตรวจแล้ว: บล็อก 1–2 (import, `GraphRow`, `NodeRow`, `GraphSummary`, `GraphDataIntegrityError` = 69 บรรทัดโค้ด ตรวจ 10:16 น.) · ที่ผู้ใช้แจ้งว่า copy-paste: ส่วนที่เหลือ (บล็อก 3–7: คลาส `GraphRepository`, `loadAll`, `buildGraph`, `buildNode`, `required`, `parseJsonColumn`) ไฟล์ครบ 239 บรรทัดโค้ดเมื่อ 10:25 น. · อธิบายแล้ว: บล็อก 2 และ 3 เท่านั้น · **บล็อก 4–7 ยังไม่ได้อธิบาย/ยังไม่ได้ทดลองกับผู้ใช้** → ดู ⭐8 · ผลทดลองกับ pool ปลอม (13 ผัง/95 โหนด) ดู ⭐8 · ปลดล็อก #16/#19/#21/#22 แล้ว |
| #11 | `src/traversal/session.store.ts` | ✅ **ตรงต้นแบบทุกบรรทัด 178 บรรทัดโค้ด** (ต้นแบบไม่ถูก clean up) · `tsc` ผ่าน · ⭐ **ผู้ใช้มาร์กว่า "ต้องกลับมาอ่านอีกรอบ"** (ดู ⭐4) · ⚠️ ผู้ใช้เขียนคอมเมนต์ `//Need to read this again later` ไว้ท้ายไฟล์ (บรรทัด 207) เป็นตัวช่วยจำ ไม่กระทบการทำงาน แต่ **ลบก่อนส่งงาน/อวดอาจารย์** ถ้าไม่ต้องการ · ยังไม่ได้ทดลองรันกับฐานจริง (จะทำที่ "จุดเห็นผลที่ 1" โดยขออนุญาตก่อน เพราะเขียนลงตาราง `sessions` ร่วม) |
| #12 | `src/symptom-search/symptom-search.dto.ts` | ✅ ตรงต้นแบบทุกบรรทัด (56 บรรทัดโค้ด) · `tsc` ผ่าน · `parseSearchBody` ทดลอง 16 กรณีแล้ว |
| #13 | `src/symptom-search/symptom-matcher.ts` | ✅ 82 บรรทัดโค้ด ต่างต้นแบบแค่การขึ้นบรรทัดของ `Pick<…>` · `rankGraphs`/`selectMatches` เทียบกับต้นแบบด้วยเวกเตอร์จริง 6 คำค้น + สุ่ม 2,000 กรณี ต่าง 0 · ⭐ ดู "จุดสำคัญ" ด้านล่าง |
| #14 | `src/embedding/embedding.service.ts` | ✅ ตรงต้นแบบ **46 บรรทัดโค้ด** (ต้นแบบหลัง clean up ไม่มี getter `isLoaded` และแก้ช่องว่างหลัง `=`) · ⚠️ `model-slim/` ยังไม่ได้คัดลอกมาโปรเจกต์ใหม่ รัน `load()` จริงไม่ได้จนกว่าจะคัดลอก · ⭐ ดู "embed ตรงไหน" ด้านล่าง |
| #15 | `src/embedding/embedding.module.ts` | ⬜ (ใหม่ ไม่มีในต้นแบบ ขนาดอ้างอิง `graph.module.ts` 7 บรรทัด) |
| #16 | `src/symptom-search/symptom-search.service.ts` | ⬜ **ปลดล็อกแล้ว** (#10 มีไฟล์ครบ) · ต้นแบบ 146 บรรทัดโค้ด / 242 รวม · ดัดแปลง 1 จุด: path import `EmbeddingService` เป็น `'../embedding/embedding.service'` · ผู้ใช้กำลังจะพิมพ์ (9 ต.ค.) |
| #17 | `src/traversal/traversal.dto.ts` | ✅ **ตรงต้นแบบทุกบรรทัด 123 บรรทัดโค้ด** (diff แบบตัดคอมเมนต์ = 0) · `tsc` ผ่าน (9 ต.ค.) · อธิบายครบ 6 บล็อก · ทดลองตัวตรวจ body 3 ตัวด้วยข้อมูล 32 กรณี (กับต้นแบบ) · ⭐ ผู้ใช้ขอมาร์กจุดที่ยังงง: ดู ⭐5 · ยังไม่ได้บันทึกเวลาจริง |
| #18 | `src/traversal/equipment.repository.ts` (OPT) | ✅ **ตรงต้นแบบทุกบรรทัด 50 บรรทัดโค้ด** (diff แบบตัดคอมเมนต์ = 0) · `tsc` ผ่าน (9 ต.ค.) · ทดลองกับ pool ปลอม · ⭐ **ผู้ใช้มาร์ก 9 ต.ค.: "อ่านครบแล้วแต่ยังไม่เข้าใจทั้งหมด ต้องกลับมาอ่าน"** ดู ⭐7 · หัวข้อที่ต้องไปดูเพิ่ม ดู ⭐6 · ยังไม่ได้ทดลองกับฐานจริง |
| เฟส 4 | #19–#30 (REST API ของผังขั้นตอน ต่อจาก #18) | ⬜ ขอบเขตปัจจุบัน |
| เฟส 7 | frontend ส่วนที่พอร์ตจาก FixStep (เฟส 0B + #48–#56, #58–#70, #73, #74, #76, #77) | ⬜ ขอบเขตปัจจุบัน |
| เฟส T | T1–T2 เทสเดิม (backend 183 / frontend 56 ไม่รวม mock) | ⬜ ขอบเขตปัจจุบัน |
| เฟส 5–6 + ไฟล์ frontend ใหม่ (#31–#47, #57, #71, #72, #75) + T3 | RAG / knowledge / answer / หน้า `/ask` | ⏸ **เลื่อนเป็นงานอนาคต** (ผู้ใช้สั่ง 8 ต.ค. 2569) ดู "ขอบเขตงาน" ด้านล่าง |
| เฟส 8 | deploy | ยังไม่ตัดสินใจ (ROADMAP §F.11) |

**ยังไม่ได้บันทึกเวลาจริงต่อไฟล์** (ภาคผนวก ก ของ ROADMAP) ผู้ใช้ยังไม่ได้แจ้งเวลา ค่า k ยังไม่มี

**จุดตรวจที่ทำแล้ว:** `npx tsc --noEmit` ผ่านที่ #01–#09 · `npm run migrate` (ไม่ทำอะไร เพราะ FixStep รันไว้แล้ว) · `npm run seed` ได้ "13 กราฟ · 95 โหนด" (ซ้ำข้อมูลเดิม)

## 1.5) ขอบเขตงาน (ผู้ใช้สั่ง 8 ต.ค. 2569): RAG เลื่อนเป็นงานอนาคต

**ขอบเขตปัจจุบัน = พอร์ต FixStep ให้ครบ** (เฟส 0–4, เฟส 7 ส่วนที่ใช้ซ้ำ, เฟส T1–T2) **เลื่อน:** เฟส 5 knowledge (#31–#38), เฟส 6 answer (#39–#47), ไฟล์ frontend ใหม่ #57 `lib/citation.ts`, #71 `CitationList`, #72 `AnswerPanel`, #75 `AskPage`, เทสใหม่ T3 · ไฟล์ที่ต้องพิมพ์ตามต้นแบบ **โดยไม่ใส่ส่วน RAG:** #48 `api/types.ts`, #51 `lib/errors.ts`, #58 `api/traversal.ts`, #59 `api/queries.ts`, #76 `App.tsx` (ส่วนเพิ่มของ `/ask` เลื่อนไปด้วย) · ROADMAP.md สร้างใหม่แล้วให้ตรงนี้ (เพิ่ม §G "งานในอนาคต" และแยกตารางเวลาเป็นสองกลุ่ม; ตัวเลขบรรทัดของไฟล์ต้นแบบที่ถูก clean up รอบก่อน ถูกนับใหม่จากไฟล์ปัจจุบันแล้ว เช่น #02 = 171 บรรทัดโค้ด)
**สิ่งที่ไม่ต้องทำตอนนี้:** ติดตั้งไลบรารี Groq/PDF, หา PDF คู่มือ, ตั้ง `GROQ_API_KEY`, ตั้งชุดคำถามวัดผล, ตัดสินใจ F.3/F.4/F.7/F.9/F.12 (ยังบันทึกไว้ใน §F และ §G ของ ROADMAP)
**สิ่งที่ทำไว้แล้วและรองรับงานอนาคต:** `EmbeddingService` เป็นโมดูลกลาง `src/embedding/` (#14, #15) · `cosineSimilarity` export ใน `symptom-matcher.ts` (#13)
**ความคืบหน้าล่าสุด (9 ต.ค. หลัง #17 + #18 ผ่าน; สูตรเดิมเป๊ะ ตรวจแล้วว่าสูตรนี้ให้ตัวเลขชุดก่อนหน้าซ้ำได้ทุกตัว):** ไฟล์ MUST **14/38 (36.8%)** · ไฟล์ทั้งหมด **16/56 (28.6%)** · **ชั่วโมง MUST 21.95/53.8 = 40.8%** (รวม #10 ที่พิมพ์ค้างอยู่ 33 จาก 239 บรรทัดโค้ด = **41.9%**) · ชั่วโมง MUST+OPT 23.75/68.3 = **34.8%** · เหลือราว **32 ชม.** (ช่วงกลางของ MUST ที่ยังไม่ทำ 31.8) · ตามเฟส (MUST): เฟส 1 2/2, เฟส 2 7/8 (เหลือ #10), เฟส 3 4/5 (เหลือ #16 รอ #10), เฟส 4 **1/9** (#17 ✅, #18 OPT ✅), เฟส 7 (พอร์ต) 0/14 · **ลำดับที่ติดกัน:** #19, #20, #21, #22, #25, #26 ต่อสายกับ #10 → #16 → #19 (ตรวจ import จากต้นแบบแล้ว) ยกเว้น #27–#28 (health, OPT) ที่พิมพ์ได้เลย → ควรกลับไปทำ #10 ก่อน · ตัวเลขนี้ไม่รวมเฟส 0 / เฟส T / อ่านเทส / ซ้อมตอบ (ซึ่งรวมกันราว 15–19 ชม. = เฟส 0 ≈ 4–7 + T1–T2 ≈ 1–2 + อ่านเทส 4 + ซ้อมตอบ 6 ตาม ROADMAP)
**ปรับความคืบหน้า (9 ต.ค. หลัง #10 มีไฟล์ครบ):** แยกสองฐาน เพราะผู้ใช้ copy-paste #10 บล็อก 3–7 · **ฐาน "พิมพ์เอง" (นับเฉพาะส่วนที่พิมพ์เองจริง 69/239 บรรทัดของ #10 = 1.27 ชม.):** ชั่วโมง MUST 23.22/53.8 = **43.2%** · MUST+OPT 25.02/68.3 = **36.6%** · ไฟล์ MUST 14/38 (36.8%) · **ฐาน "ไฟล์มีครบ" (นับ #10 เต็ม 4.4 ชม.):** ชั่วโมง MUST 26.35/53.8 = **49.0%** · MUST+OPT 28.15/68.3 = **41.2%** · ไฟล์ MUST 15/38 (39.5%) · ใช้ฐานแรกเมื่อต้องการสะท้อน "ผู้ใช้เข้าใจและพิมพ์เอง" และเมื่อผู้ใช้กลับมาทำ #10 บล็อก 3–7 จนครบ ตัวเลขจะเท่าฐานที่สอง
**ความคืบหน้าก่อนหน้า (8 ต.ค. หลัง #11):** ไฟล์ MUST 13/38 (34.2%) · ไฟล์ทั้งหมด 14/56 (25.0%) · **ชั่วโมง MUST 19.5/53.8 = 36.2%** (รวม #10 ที่พิมพ์ค้างอยู่ 33 จาก 239 บรรทัดโค้ด = 37.4%) · ชั่วโมง MUST+OPT 29.6% · เหลือราว **34 ชม.** (ช่วงกลางของ MUST ที่ยังไม่ทำ) · ตามเฟส: เฟส 1 2/2, เฟส 2 7/8 (เหลือ #10), เฟส 3 4/5 (เหลือ #16 ซึ่งรอ #10), เฟส 4 0/9, เฟส 7 (พอร์ต) 0/14 · (ก่อน #11: 29.9% / 31.1%) · อัตราเป็นค่าสมมติ ยังไม่ได้วัดเวลาจริงจากผู้ใช้

## 2) ข้อตกลงที่ใช้อยู่

1. ต้นแบบ `troubleshoot-assistantv2` โดยหลักคืออ่านอย่างเดียว ห้าม commit/push จากที่นี่ (ดูข้อยกเว้น §3) · ผู้ใช้เป็นคนสร้าง/พิมพ์ไฟล์ในโปรเจกต์ใหม่ ผมแก้ไฟล์ในโปรเจกต์ใหม่ **เมื่อผู้ใช้สั่งตรงๆ เท่านั้น** (เคย: `package.json`, refactor `database.module.ts`)
2. เลขบรรทัด/จำนวนบรรทัด/จำนวนเทสต้องมาจากไฟล์หรือการรันจริง ห้ามเดา ไฟล์ใหม่ไม่ให้เลขบรรทัด
3. ห้ามสมมติ stack (ไม่ใช่ Prisma/Supabase/pgvector) · **ไม่เปลี่ยนชื่อ `graph`** (ตัดสินใจ 7 ต.ค. เพราะเสียเวลา: `graph` ใน `src` 863 ครั้ง ใน 44 ไฟล์) · ถ้าอาจารย์ถาม: DFA คือกราฟมีทิศทางชนิดหนึ่ง (สถานะ = โหนด เส้น = การเปลี่ยนสถานะ) `graph` ในโค้ดคือโครงข้อมูลของเครื่องสถานะ 1 อาการ
4. **เลื่อนเทส Jest/Vitest ไปเฟส T** (ท้ายสุด) ระหว่างนี้ตรวจด้วย `tsc` + เทียบต้นแบบ + smoke test · **ห้ามข้าม smoke test ด่านความปลอดภัยที่ #30** (ส่ง `continue` ให้โหนดที่ `requiresSafetyConfirmation` ต้องได้ 400 `SAFETY_CONFIRMATION_REQUIRED`) · ความเสี่ยง: ROADMAP §F.18
5. อ่านไฟล์ที่มีภาษาไทยด้วย Read/Grep/`cat` ใน Bash ไม่ใช่ PowerShell 5.1 (แสดงเพี้ยน)

## 3) การเปลี่ยนแปลงที่ทำนอกแผนเดิม (ต้องรู้)

- **แก้ FixStep 2 ไฟล์ตามที่ผู้ใช้สั่ง** (ขัดกฎ "อ่านอย่างเดียว" ที่ตั้งตอนแรก): (1) `troubleshoot-assistantv2/backend/src/traversal-engine/traversal-engine.ts` ลบ `buildNodeIndex` ใช้ `graph.nodes.find(...)` 4 จุด (2) `backend/src/database/database.module.ts` (7 ต.ค. รอบ "clean up draft") ใช้ลูป `for` + ตัวแปร `message` เหมือนที่ทำในโปรเจกต์ใหม่ — ทั้งสองไฟล์ **ไม่ได้ commit/push** (ค้างใน working tree) · ผลตรวจรอบ clean up: โค้ดเดิมสะอาดอยู่แล้ว (ไม่มี import/ตัวแปรที่ไม่ใช้ ไม่มีโค้ดที่ถูก comment ทิ้ง ไม่มี debug log นอกจากข้อความเริ่มต้นเซิร์ฟเวอร์ใน `main.ts:15`) จึงแก้เพิ่มแค่ไฟล์ (2) ยืนยันแล้ว: Jest 183/183, Vitest 84/84, `tsc` ผ่านทั้งหลังแก้ · ย้อนได้ด้วย `git checkout -- backend/src/traversal-engine/traversal-engine.ts` · เลขบรรทัดในเอกสารของ FixStep ที่อ้างไฟล์นี้เก่าแล้ว (เช่น `resolveNextNode` เดิมบรรทัด 126 ตอนนี้ 123, `SafetyConfirmationRequiredError` ที่ 144) — **ยังไม่ได้แก้ `ROADMAP.md` ของ FixStep** (ผู้ใช้ยังไม่ตอบ) และ ROADMAP ของโปรเจกต์ใหม่ยังบอก #02 = 181 บรรทัดโค้ด/261 รวม (ตอนนี้ **171 / 249**)
- **ฐานข้อมูล: ใช้ฐานจริง Aiven (`defaultdb`) ร่วมกับ FixStep ที่ deploy อยู่** ผู้ใช้ตัดสินใจเอง กติกา: (1) ดูสถานะ migration ด้วย `node scripts/run-migrations.js --status` **ห้าม** `npm run migrate -- --status` บน PowerShell 5.1 (ตัด `--` แล้วรัน migration จริง) (2) ตัวรัน migration จำด้วยชื่อไฟล์ในตาราง `schema_migrations` ที่ใช้ร่วม → ตั้งชื่อไฟล์ migration ใหม่ไม่ให้ชนกับที่ FixStep อาจเพิ่ม (3) เพิ่มได้เฉพาะตาราง/คอลัมน์ `NULL` ใหม่ **ห้าม** `ALTER/DROP/DELETE` ของเดิม (เช่นห้ามตัด `'Microwave'` ออกจาก ENUM `manuals.device_category` ในฐานนี้) (4) `seed` ซ้ำได้เฉพาะข้อมูลแอร์ชุดเดิม ห้าม seed เครื่องซักผ้า (29 ผัง `pending_manual_review`) (5) session ทดลองอยู่ตาราง `sessions` ร่วมกับผู้ใช้จริง ลบเฉพาะของตัวเอง (6) pool 5 เชื่อมต่อต่อแอป ถ้าเปิดพร้อม FixStep รวม 10 (ขีดจำกัด Aiven ยังไม่ทราบ) · ทางเลือกที่แนะนำถ้ากังวล: สร้างฐานใหม่ชื่ออื่นบน Aiven ตัวเดิม เปลี่ยนแค่ `DB_NAME` · `backend/.env` มีรหัสฐานจริง ระวังตอน `git init`
- **เคยวางไฟล์ผิดที่:** `database/` เคยอยู่นอก `src/` (ทำให้ `tsc` ฟ้อง TS6059 เพราะ `rootDir: ./src`) แก้แล้ว ไฟล์ทั้งหมดต้องอยู่ใต้ `backend/src/<โฟลเดอร์>/` (`traversal-engine/`, `database/`, `traversal/`, `symptom-search/`, `embedding/`, `health/`, ฯลฯ ตาม ROADMAP §C)

## 4) stack ที่ผู้ใช้ตัดสินใจแล้ว

| เรื่อง | คำตอบ |
|---|---|
| ฐานข้อมูล | คง MySQL + `mysql2` (SQL เขียนเอง ไม่มี ORM) · ใช้ Aiven ร่วมกับ FixStep (§3) · เครื่องมี MySQL 8.0 ในเครื่องด้วย (`MySQL80` รันอยู่ `mysql.exe` ที่ `C:\Program Files\MySQL\MySQL Server 8.0\bin\`) ยังไม่ได้ใช้ |
| เวกเตอร์ | ในหน่วยความจำ + cosine เอง (embed chunk ตอนบูต) |
| LLM | **Groq API** (เปลี่ยนจาก Claude 6 ต.ค.) รุ่น/ไลบรารี/โควตายังไม่เลือก ยังไม่ได้ตรวจเอกสาร Groq → ต้อง WebFetch อ่านก่อนเขียน `llm.client.ts` (#41) |
| Embedding | MiniLM `Xenova/paraphrase-multilingual-MiniLM-L12-v2` q8 เดิม |
| กันแต่งคำตอบ | ตอบเฉพาะจาก chunk + อ้างหน้าคู่มือ + ปฏิเสธถ้าคะแนนต่ำกว่าเกณฑ์ (ไม่มีด่านตรวจ citation) |
| ข้อมูลคู่มือ | PDF จริง ต้องมีตัวดึงข้อความและ chunk ตามหน้า |
| RAG อยู่ตรงไหน | **หน้า `/ask` แยกจากผังขั้นตอน** (ผู้ใช้ยืนยัน 7 ต.ค. = F.1 ปิดแล้ว) |
| ประเภทเครื่อง | 4 ประเภท (ผู้ใช้ **จะมาบอกทีหลัง** ว่าคือชุดไหน = F.2 ยังเปิด) · คงผังขั้นตอน + session + ด่านความปลอดภัย |
| frontend | คงเดิมทั้งชุด · **ตัด mock** (ผู้ใช้ยืนยัน = F.10 ปิดแล้ว) |

## 5) ที่ยังค้าง / ต้องทำต่อ

**ผู้ใช้ต้องทำ:**
- พิมพ์ `backend/.env.example` (ตอนนี้ว่าง): `DB_HOST=localhost`, `DB_PORT=3306`, `DB_USER=root`, `DB_PASSWORD=`, `DB_NAME=<ชื่อ>`, `DB_SSL_CA=`, `PORT=3000`, `NODE_ENV=development`, `CORS_ORIGIN=http://localhost:5173`, `SYMPTOM_SEARCH_ENABLED=false`, `GROQ_API_KEY=` (ค่าว่างหมด ห้ามใส่ความลับจริง) · `.env` จริงของผู้ใช้มีตัวแปร `GEMINI_API_KEY` ติดมาจากต้นแบบ ไม่มีโค้ดใช้ ลบได้
- พิมพ์ #10 `graph.repository.ts` แล้วบอก ผมเทียบกับต้นแบบ

**รอผู้ใช้ตัดสินใจ (ROADMAP §F):** F.2 ชุด 4 ประเภท (กระทบ `types.ts` `DeviceCategory`, migration 003 ENUM, `labels.ts`) · F.3 PDF คู่มือและไลบรารีดึงข้อความ · F.4 ขนาด chunk · F.7 เกณฑ์ปฏิเสธใหม่ (0.55 ของ FixStep ใช้ไม่ได้) · F.9 Groq · F.11 deploy · **F.12 ช่องโหว่ใหญ่สุด:** หน้า `/ask` อาจอธิบายขั้นตอนซ่อมโดยข้ามด่าน `confirm_safety` ต้องออกแบบก่อนเฟส 6 · ชั่วโมงต่อวัน/วันสอบของโปรเจกต์นี้ยังไม่รู้

**ผมค้างอยู่ (ถามผู้ใช้แล้วยังไม่ตอบ):** (ก) ปรับตัวเลข #02 ใน ROADMAP ของโปรเจกต์ใหม่ให้ตรงไฟล์ปัจจุบัน (ตัวสร้าง `template.md`+`build.js` อยู่ใน scratchpad ของ session นี้ อาจหาย; ถ้าหาย แก้ `ROADMAP.md` ตรงๆ) (ข) ปรับเลขบรรทัดใน `ROADMAP.md` ของ FixStep 3 จุด (บรรทัด 202, 209, 216 ที่อ้าง `traversal-engine.ts:...`) · ยังไม่ได้ทำ ไม่ทำจนกว่าผู้ใช้สั่ง

## 5.5) เรื่องที่อธิบายไปแล้วระหว่าง #10 และเรื่องค้าง (อ่านก่อนกลับมาพิมพ์ต่อ)

- `import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common'`: `Inject/Injectable/Logger` เป็นฟังก์ชัน (มีจริงตอนรัน) ส่วน `OnModuleInit` เป็น **interface** (ตรวจแล้ว `typeof` = `undefined` ถูกลบตอนคอมไพล์) รวมใน `import` เดียวได้เพราะ backend ไม่มี `verbatimModuleSyntax`
- `RowDataPacket` (mysql2 3.24.3) = ชนิดของ "แถวหนึ่ง" จาก `SELECT` มี `[column: string]: any` · `GraphRow`/`NodeRow` ต้อง `extends RowDataPacket` เพราะ `pool.query<T extends QueryResult>` ถ้าถอดออกแล้วยังใช้ `query<GraphRow[]>` → **`tsc` TS2344** (ทดลองจริง) · ⚠️ **คำแก้ของผมเอง:** ผมเคยบอกว่า `extends` ทำให้ชื่อคอลัมน์พิมพ์ผิดถูกจับได้ — **ไม่จริง** (ทดลองแล้ว `rows[0].graph_idd` ไม่ error เพราะ index signature คืน `any`) ชนิดตรวจเฉพาะฟิลด์ที่ประกาศเอง และ `SELECT` กับ interface ต้องตรงกันเอง
- **คำถามค้าง: NestJS งง** ผู้ใช้ถามว่าเปลี่ยน framework ได้ไหม ผมให้ตัวเลข: backend ไม่รวมเทส 1,703 บรรทัดโค้ด ผูกกับ Nest 1,118 (66%, 18 ไฟล์) ไม่ผูก 589 (6 ไฟล์: `types.ts`, `traversal-engine.ts`, `symptom-matcher.ts`, `symptom-search.dto.ts`, `traversal.dto.ts`, `database.constants.ts`) · **ผมแนะนำอยู่ต่อ** · ผู้ใช้ยังไม่เลือก: (ก) อยู่ต่อ + ให้ผมทำสรุป Nest 1 หน้าใน `docs/` (ข) อยู่ต่อแล้วพิมพ์ต่อ (ค) พิจารณาเปลี่ยน framework (ต้องประเมินก่อนพิมพ์มากขึ้น)
- ไฟล์ที่ **รอ #10** (import `graph.repository`): `symptom-search.service.ts` (#16), `graph.module.ts` (#22), `traversal.controller.ts` (#21), `traversal.service.ts` (#19) → พิมพ์ได้แต่ `tsc` จะ error จนกว่า #10 จะครบ
- ไฟล์ที่ **ไม่ต้องรอ #10** (ผมเช็ค import จากต้นแบบแล้ว) ทำก่อนได้: **#11** `session.store.ts` (import เฉพาะ `@nestjs/common`, `mysql2/promise`, `database.constants`, `types`) · **#12** `symptom-search.dto.ts` และ **#13** `symptom-matcher.ts` (import แค่ `types`) · #14 `embedding.service.ts` (ไม่ import ไฟล์ในโปรเจกต์) · ลำดับที่ผมเสนอ: #11 → #12 → #13 → (กลับมา #10) · และเติม `.env.example`

## ⭐ จุดสำคัญที่ต้องกลับมาทบทวนอีกรอบ (ผู้ใช้สั่งมาร์ก 7 ต.ค.)

### ⭐1 `cosineSimilarity` ใน `src/symptom-search/symptom-matcher.ts` (#13, บรรทัด 48–69 ของต้นแบบ)
**ทำไมสำคัญ:** เป็นหัวใจของระบบค้นหา/จับคู่ ใช้ทั้งเลือกผังจากคำค้น (เฟส 3) และ **ถูกใช้ซ้ำใน RAG** (`chunk-matcher.ts` #36 ต้อง import `cosineSimilarity` จากไฟล์นี้ จึงต้อง `export`) และเป็นข้อที่อาจารย์น่าจะถาม ("ระบบค้นหาอย่างไร ทำไมใช้ cosine คะแนนนี้คืออะไร")
**ต้องตอบได้เมื่อกลับมาทบทวน:**
- สูตร cos = (a·b) ÷ (|a| × |b|) ในโค้ดคือลูปเดียวสะสม `dot`, `normA`, `normB` แล้ว `dot / (Math.sqrt(normA) * Math.sqrt(normB))` · ช่วงค่า −1..1 · ตัวอย่างที่ตรวจแล้ว: `[1,2,3]` vs `[2,4,6]` = 1, `[1,0]` vs `[0,1]` = 0, `[1,2]` vs `[-1,-2]` = −1, `[1,0]` vs `[1,1]` = 0.7071
- ความยาวเวกเตอร์ไม่เท่ากัน → **throw** (โมเดลคนละตัวปนกัน = บั๊ก) · เวกเตอร์ศูนย์ → **return 0** (กัน 0÷0)
- เป็น **"คะแนนความคล้าย" ไม่ใช่ความน่าจะเป็น** ห้ามแสดงเป็น "มั่นใจ x%" · เกณฑ์ 0.55 ของ FixStep ตั้งจากชุดคำค้น 56 ข้อที่ AI ร่างและยังไม่ตรวจแก้ → ห้ามอ้างเป็นความแม่นยำ (ROADMAP §D.6/§F.7)
- เวกเตอร์จาก MiniLM ตั้ง `normalize: true` (ความยาว 1) → `dot` อย่างเดียวเท่ากับ cosine (ทดลองแล้ว 0.983870 ทั้งคู่) ฟังก์ชันยังหารไว้เสมอเพื่อรับเวกเตอร์ที่ไม่ normalize (เหตุผลนี้ **[อนุมาน]** ต้นแบบไม่ได้บันทึก)
- `ArrayLike<number>` รับทั้ง `number[]` และ `Float32Array`
**เวลากลับมาดู:** เปิด `symptom-matcher.ts` พิมพ์/อ่านทวน แล้วลองตอบคำถามข้างบนโดยไม่ดูโค้ด · ผมมีสคริปต์ทดลอง cosine (นอกโปรเจกต์ ใน scratchpad `cos-demo.js` อาจหาย) ถ้าหาย ให้ขอผมทำใหม่

### ⭐4 `session.store.ts` (#11) — ผู้ใช้สั่งมาร์ก 8 ต.ค.: "ต้องกลับมาอ่านอีกรอบ"
ผู้ใช้ไม่ได้ระบุว่าส่วนไหนที่ยังไม่เข้าใจ (มาร์กท้ายไฟล์ บรรทัด 207 หลัง `parseVariables`) ให้ถามผู้ใช้ตอนกลับมาว่าส่วนไหน หัวข้อสำคัญของไฟล์ที่อาจารย์ชอบเจาะ (ยังไม่ได้อธิบายละเอียดครบ ยกเว้น constructor/`@Inject` ที่อธิบายและทดลองแล้ว): (1) **เวลาทำใน SQL ด้วย `NOW()`** ไม่ใช้ `Date` ของ JS (time zone ของ connection ทำให้ `TIMESTAMP` เพี้ยน) · อายุ 24 ชม. `SESSION_TTL_HOURS` (2) **`update()` ใน transaction**: `UPDATE sessions` + `INSERT session_history` บน connection เดียว, `rollback` เมื่อพลาด, `release()` ใน `finally` เสมอ (pool มี 5 เส้น) · `step_order = history.length - 1` · `UNIQUE (session_id, step_order)` กันซ้ำ (3) **`saveOutcome`**: `UPDATE … WHERE outcome_text IS NULL AND status='completed'` คำสั่งเดียว → บันทึกได้ครั้งเดียว ผู้ชนะคนเดียวเมื่อมาพร้อมกัน, `affectedRows === 1` (4) **`find()` ซ่อน session หมดอายุ** ด้วย `expires_at > NOW()` แล้วค่อยอ่านประวัติเรียงตาม `step_order` (5) **`confidence`**: `DECIMAL` ส่งมาเป็นข้อความ → `Number(...)` · `null` คงเป็น `null` (6) ฟังก์ชันท้ายไฟล์: `actionValueOf` ↔ `rowToAction` ย้อนกลับกัน, `default` ที่มี `never` (7) `findOutcome` แยกจาก `find` โดยตั้งใจ เพื่อให้ `SessionState` ที่เข้า engine ไม่มีค่า outcome ปน · ตั้งใจ: ไม่มีตัวกวาด session หมดอายุ (แถวค้างในตาราง แต่ `find()` มองไม่เห็น)

### ⭐3 **การ embed เกิดขึ้นที่ไหนของโค้ด** — ผู้ใช้บอก 8 ต.ค. ว่า "สำคัญ ยังไม่ค่อยเข้าใจ" (กลับมาทบทวน)
**แนวคิดสองจังหวะ:** (1) **ตอนบูต** แปลงข้อความอาการของทุกผังเป็นเวกเตอร์ เก็บเป็น "ดัชนี" ในหน่วยความจำ ทำครั้งเดียว (2) **ทุกครั้งที่ผู้ใช้ส่งคำค้น** แปลงคำค้นสดแล้วเทียบกับดัชนี (ข้อความอาการไม่ถูกแปลงซ้ำ) · ตัวเลขที่วัดบนเครื่องผู้ใช้ (ข้อมูลแอร์ 36 ข้อความ, โมเดล q8): `load()` ≈ 1.5 วินาที · embed 36 ข้อความ ≈ 1.1 วินาที (≈ 30 ms/ข้อความ ทีละข้อความ ไม่ขนาน) · embed คำค้น ≈ 14–21 ms · เทียบกับดัชนี 36 แถว ≈ 0–4 ms · วัดบนเครื่องผู้ใช้ ไม่ใช่ Render (ซึ่ง CPU น้อยกว่ามาก)
**แผนที่โค้ดของต้นแบบ (เลขบรรทัดหลัง clean up 7 ต.ค.; ถ้าไฟล์ถูกแก้อีก เลขอาจเลื่อน อ้างด้วยชื่อฟังก์ชันได้):**
- **จุดที่ลงมือแปลงจริง (ที่เดียว):** `embedding.service.ts` บรรทัด **68** `pipeline('feature-extraction', …)` (โหลดโมเดลใน `load()`) และบรรทัด **81** `this.extractor(text, { pooling: 'mean', normalize: true })` (แปลงข้อความใน `embed()`)
- **จุดที่เรียก `embed` (3 จุด ทั้งหมดใน `symptom-search.service.ts`):** บรรทัด **161** ใน `prepareIndex()` (ข้อความอาการ ในลูป ตอนบูต) · บรรทัด **186** ใน `search()` (คำค้นจาก `POST /symptom-search`) · บรรทัด **223** ใน `scoreGraph()` (คำค้น ตอนเริ่ม session ที่ส่ง `query`) · และบรรทัด **142** `await this.embedding.load()` สั่งเปิดโมเดล
- **เส้นทางเข้า:** บูต → `onApplicationBootstrap()` (:119) → `void this.prepareIndex()` (:127) → :142 `load()` + :161 `embed()` × จำนวนข้อความ · ค้นหา → `symptom-search.controller.ts:34` `search(query)` → :186 · เริ่ม session → `traversal.service.ts:97` `startSession(graphId, query)` → :99 `computeConfidence` → :247 `scoreGraph` → :223 (ถ้าไม่ส่ง `query` คืน `null` ที่ :244–245 **ไม่ embed**)
- **ไม่มี embed:** engine, `graph.repository`, `session.store`, frontend ทั้งหมด, ตอนตอบ yes/no/กรอกค่าในผัง (ตรวจด้วย regex) · สคริปต์รันมือ (`eval-symptom-search.js` :114,:122; `measure-embedding.mjs` :130–168) มีโค้ด embed ของตัวเอง ไม่ใช่ตัวระบบ
- **สถานะ:** `search()` ตอน `loading` โยน `SearchNotReadyError` (503) ตอน `disabled/failed` โยน `SearchUnavailableError` · `scoreGraph` ตอนไม่ `ready` คืน `null` (ไม่โยน)
- **โปรเจกต์ใหม่ (RAG):** จะมีจุดเรียก `embed` เพิ่ม 2 จุดแบบเดียวกัน: ใน `knowledge-index.service.ts` (#37) ตอนบูตสำหรับ chunk (เวลาบูตโตตามจำนวน chunk — ยังไม่ได้วัด §F.5) และตอนตอบคำถาม `/ask` สำหรับคำถามผู้ใช้ · จุดแปลงจริงยังเป็นบรรทัดเดียวใน `embedding.service.ts` (เหตุผลที่ย้ายเป็นโมดูลกลาง `src/embedding/`)
**ตอบให้ได้เมื่อทบทวน:** embed กี่จังหวะ ทำที่บรรทัดไหน · ทำไมข้อความอาการแปลงตอนบูตแต่คำค้นแปลงสด · เมื่อผู้ใช้เลือกอาการจากรายการ (ไม่มี `query`) มี embed ไหม (ไม่) · `pooling:'mean'` ทำอะไร (เฉลี่ยเวกเตอร์ชิ้นคำให้เหลือเวกเตอร์เดียวต่อประโยค; ถ้าใช้แค่ชิ้นแรก ประโยคไม่เกี่ยวกันได้ 0.73 เทียบ mean 0.331) · `normalize:true` ไม่เปลี่ยนคะแนน cosine (หารความยาวอยู่แล้ว) เปลี่ยนเฉพาะ `dot` ล้วน

### ⭐2 `SymptomSource = Pick<TroubleshootingGraph, ...>` (#13, บรรทัด 17–21 ของต้นแบบ) — ทบทวนแนวคิด `Pick` (หยิบเฉพาะบางฟิลด์ ชื่อใน `Pick` ถูกตรวจ สะกดผิด → TS2344)

*(รายการนี้ผมเพิ่มจากที่ผู้ใช้เพิ่งถามเรื่อง `Pick` — ลบได้ถ้าไม่ต้องการ)*

### ⭐5 `const raw = (body as Record<string, unknown>).text;` ใน `parseOutcomeBody` (#17, `traversal.dto.ts` บรรทัด 215 ของต้นแบบ) — ผู้ใช้บอก 9 ต.ค. ว่า "ยังงงอยู่" ขอให้มาร์กไว้กลับมาดู
**ตัวเดียวกันที่ซ่อนอยู่ใน `asObject`** (บรรทัด 105 `return body as Record<string, unknown>;`) ทบทวนที่เดียวได้ทั้งสองจุด
**อธิบายสั้นที่สุด:** ถ้าเป็น JavaScript บรรทัดนี้คือ `const raw = body.text;` (หยิบค่าช่อง `text` ของ `body`) ส่วน `(… as Record<string, unknown>)` มีไว้เอาใจ TypeScript อย่างเดียว
**ทีละส่วน:**
- `body` ชนิด `unknown` ("ไม่รู้ว่าคืออะไร") → ผ่านด่าน `typeof body !== 'object' || body === null || Array.isArray(body)` แล้ว TS รู้แค่ว่าเป็น `object` ("กล่องที่ไม่รู้ว่ามีช่องอะไร") → เขียน `body.text` ตรงๆ ได้ **`TS2339: Property 'text' does not exist on type 'object'`** (ทดลองแล้ว)
- `as Record<string, unknown>` = แปะป้ายใหม่ว่า "กล่องที่มีช่องชื่อข้อความอะไรก็ได้ ของในช่องยังไม่รู้ว่าคืออะไร" → เปิดช่อง `text` ได้ แต่ได้ค่าชนิด `unknown`
- วงเล็บ `( )` ให้แปะป้ายก่อน แล้วค่อย `.text`
- **`as` ไม่ตรวจและไม่เปลี่ยนอะไรตอนรัน** (ทดลองแล้ว: `{ text: 42 }` → `raw = 42` `typeof` = `number`) ใช้ได้ปลอดภัยเพราะด่านตรวจ object ก่อนหน้า
- ตัวที่ตรวจค่าจริงคือบรรทัดถัดไป `if (typeof raw !== 'string') throw …` หลังผ่านนี้ TS ถึงแคบ `raw` เป็น `string` (ถ้าไม่ตรวจ ใช้ `raw` เป็น string ตรงๆ ได้ `TS2322: Type 'unknown' is not assignable to type 'string'` ทดลองแล้ว)
- ทำไม `parseOutcomeBody` ไม่เรียก `asObject`: เพราะ `asObject` โยน `InvalidRequestBodyError` แต่ endpoint นี้ต้องโยน `InvalidOutcomeError` (รหัส `INVALID_OUTCOME`) จึงเขียนเช็ค object ซ้ำเองแล้ว `as` เอง
**ตอบให้ได้เมื่อทบทวน:** (1) ลบ `as …` แล้วผลคืออะไร เกิดตอนไหน (error ตอนคอมไพล์ ไม่ใช่ตอนรัน) (2) `as` กันไม่ให้ `text` เป็นตัวเลขไหม (ไม่ กันคือ `typeof raw !== 'string'`) (3) ไม่เช็ค `body === null` แล้วรับ `null` มา เกิดอะไร (`TypeError` → 500 แทน 400) (4) ถ้าไม่มีช่อง `text` ได้ค่าอะไร (`undefined` แล้วถูกจับที่ `typeof raw !== 'string'`)
**ถ้ายังไม่เข้าใจ:** ให้ถามผู้ใช้ว่าติดที่คำไหน (`as` / `Record` / `unknown` / วงเล็บ) แล้วอธิบายเฉพาะคำนั้น · ผมมีสคริปต์ทดลองใน scratchpad (`cast-demo.ts`, `cast-run.ts`, `narrow-demo.ts`, `err-demo.ts`, `dto-demo.ts` อาจหาย) ถ้าหายขอผมทำใหม่

### ⭐6 หัวข้อ NestJS / mysql2 ที่ต้องไปดูเพิ่มทีหลัง — ผู้ใช้สั่งมาร์ก 9 ต.ค. ตอนอ่าน `equipment.repository.ts` (#18): `@Injectable()`, `OnModuleInit`, `Logger`, `RowDataPacket`
ผู้ใช้ยังไม่ได้ถามรายละเอียด แค่ขอให้บันทึกไว้เป็นรายการ "กลับมาดู" ด้านล่างคือสิ่งที่ผมรู้แล้ว/ยังไม่ได้ทำ เพื่อให้รอบหน้าเริ่มได้เร็ว (ถามผู้ใช้ก่อนว่าอยากเริ่มจากตัวไหน)
- **`@Injectable()`** — ติดป้ายให้คลาสเป็น provider ที่ Nest สร้างและส่งให้คลาสอื่นผ่าน constructor (DI) · อยู่ใน `session.store.ts`, `embedding.service.ts`, `equipment.repository.ts` ฯลฯ · ส่วน `@Inject(MYSQL_POOL)` ใน constructor อธิบายและทดลองไปแล้วกับ `session.store.ts` (สคริปต์ `inject-demo.ts` ใน scratchpad เทียบ 4 แบบ: มี/ลืม `@Inject`, เขียนแบบยาว, ไม่มี `private readonly` · เหตุผลที่ลืม `@Inject` ไม่ได้: `Pool` เป็นชนิดล้วนไม่มีตัวตนตอนรัน Nest จึงไม่รู้ว่าต้องหยิบ provider ตัวไหน · ผลรันดูได้โดยรันสคริปต์ซ้ำ ถ้าไฟล์หาย ขอผมทำใหม่) · **ยังไม่ได้อธิบาย:** `@Injectable()` เฉพาะตัวเอง ทำอะไรได้/ถ้าลืมจะเป็นอย่างไร (เสนอทดลองแบบเดียวกับ `inject-demo.ts`)
- **`OnModuleInit`** (`implements OnModuleInit` + เมธอด `onModuleInit()`) — Nest เรียกให้เองหลังสร้าง module เสร็จ ก่อนเปิดรับ request · ใน #18 ใช้โหลดอุปกรณ์เข้าชั้นวางตอนบูต · ถ้า `throw` แอปไม่บูตขึ้น (ตั้งใจ ตามคอมเมนต์ในไฟล์) · **เชื่อมกับ ⭐3:** `symptom-search.service.ts` ใช้ `onApplicationBootstrap()` + `void this.prepareIndex()` แทน (**ทดลองยืนยันแล้ว 9 ต.ค.** ด้วยตัวแปลงข้อความปลอมช้าข้อความละ 40 ms กับ `symptom-search.service.ts` ของต้นแบบ: บูตเสร็จใน 4 ms ทั้งที่สร้างดัชนี 36 ข้อความใช้ 1,722 ms อยู่เบื้องหลัง state ทันทีหลังบูตเป็น `loading` ต่างจาก #18 ที่ `await this.loadAll()` ทำให้บูตต้องรอ) ควรไปดูควบคู่ว่าทำไมสองไฟล์เลือก hook คนละตัว · **ยังไม่ได้ทดลอง:** ลำดับ hook (`OnModuleInit` → `OnApplicationBootstrap` → `OnApplicationShutdown`) และพฤติกรรมเมื่อ `onModuleInit` โยน error (เสนอสคริปต์สาธิตนอกโปรเจกต์ ใช้ `abortOnError:false`)
- **`Logger`** (`new Logger(EquipmentRepository.name)` แล้ว `this.logger.log(...)`) — ตัวเขียน log ในตัวของ Nest, ใส่ชื่อคลาสเป็น context หน้าข้อความ ใน #18 ใช้พิมพ์จำนวนอุปกรณ์ที่โหลดตอนบูต · **ยังไม่ได้อธิบาย/ทดลอง:** ระดับ log (`log`/`warn`/`error`/`debug`), ทำไมใช้ `.name` ไม่พิมพ์ชื่อเอง, รูปแบบเอาต์พุตจริง
- **`RowDataPacket`** (`interface EquipmentRow extends RowDataPacket`) — ชนิดของ mysql2 สำหรับ "แถวที่ SELECT ได้" · **ทดลองแล้วในช่วงเรียนไฟล์ก่อนหน้า:** `extends RowDataPacket` มี index signature ทำให้ชื่อคอลัมน์ที่สะกดผิดอ่านได้เป็น `any` ไม่ถูกจับ (ผมเคยพูดผิดว่าจับได้ แล้วแก้) · ใน #18 ชื่อฟิลด์ใน `EquipmentRow` ต้องตรงกับคอลัมน์/alias ใน SQL ด้วยการตรวจเอง · ยังต่างกับ `ResultSetHeader` (ผลของ INSERT/UPDATE: `affectedRows`) ที่ใช้ใน `session.store.ts` · **ที่ควรสรุปตอนทบทวน:** `pool.query<EquipmentRow[]>` ใส่ชนิดตรงไหน และชนิดนั้นรับประกันอะไรจริง (แค่ช่วยให้เขียนโค้ดต่อได้ ไม่ได้ตรวจกับฐานข้อมูลจริง)
**ตอบให้ได้เมื่อทบทวน:** (1) DI คืออะไร Nest ส่ง `Pool` เข้า constructor ได้ยังไง (2) `onModuleInit` ต่าง `onApplicationBootstrap` อย่างไร (3) ทำไม `EquipmentRepository` โหลดตอนบูตครั้งเดียว (4) `RowDataPacket` ช่วยตรวจอะไร ไม่ช่วยตรวจอะไร

### ⭐7 `equipment.repository.ts` (#18) ทั้งไฟล์ — ผู้ใช้สั่งมาร์ก 9 ต.ค.: "อ่านครบแล้วแต่ยังไม่เข้าใจทั้งหมด ต้องกลับมาอ่าน"
ผู้ใช้ไม่ได้ระบุว่าส่วนไหนที่ยังไม่เข้าใจ → **ตอนกลับมา ให้ถามผู้ใช้ก่อนว่าส่วนไหน** (เหมือน ⭐4) แล้วอธิบายเฉพาะส่วนนั้น ไม่ต้องไล่ใหม่ทั้งไฟล์ · หัวข้อ NestJS ที่ผู้ใช้ขอให้ไปดูเพิ่ม (`@Injectable`, `OnModuleInit`, `Logger`, `RowDataPacket`) อยู่ใน ⭐6
**แผนที่ไฟล์ (ส่วนที่อธิบายไปแล้ว ตามต้นแบบบรรทัด 42–113):** A หัวคลาส `@Injectable()` + `implements OnModuleInit` · B `logger = new Logger(EquipmentRepository.name)` · C `byCategory` (`Map<DeviceCategory, EquipmentItemDto[]>`) · D constructor + `@Inject(MYSQL_POOL)` · E `onModuleInit` (`await this.loadAll()`) · F `findByCategory` (`[...(map.get(c) ?? [])]`) · G `loadAll` (G1 SQL, G2 `clear()`, G3 ลูปแปลงแถว→DTO, G4 จัดกลุ่มลง Map, G5 `logger.log`)
**ผลทดลองที่ได้ (9 ต.ค. ใช้ pool ปลอมที่ส่งแถวจาก `data/equipment/equipment.json` กับไฟล์ของต้นแบบ ไม่ได้แตะฐานข้อมูล สคริปต์ `equip-demo.ts` ใน scratchpad อาจหาย):**
- บูตรอ `onModuleInit`: pool ปลอมหน่วง 300 ms → บูตเสร็จ 338 ms (Nest รอ `await`) · ถ้า `loadAll` โยน error → การสร้าง app ล้มด้วย error นั้น (ทดลองกับ `abortOnError:false`; ค่าปกติปิดโปรเซสทันที)
- Logger พิมพ์ `[Nest] <pid> - <วันที่> LOG [EquipmentRepository] โหลดอุปกรณ์สำเร็จ 7 รายการ ใน 1 ประเภทเครื่อง` (ชื่อใน `[ ]` มาจาก `Logger(EquipmentRepository.name)`)
- ข้อมูลจริง: อุปกรณ์ 7 ชิ้น ประเภท `Air Conditioner` ประเภทเดียว · 2 ชิ้นมี `source_page` (usb_c_cable 43, notepad_or_phone 44) · 5 ชิ้นมี `author_note` · `Television` ได้ `[]`
- `source_page ?? undefined`: ใน JSON ฟิลด์ที่ไม่มีค่า **ไม่โผล่** (JSON.stringify ข้าม `undefined`) แต่ใน object เอง `'sourcePage' in item` ยังเป็น `true` ค่า `undefined`
- **สำเนา `[...]` เป็นสำเนาตื้น:** `push`/ล้างอาร์เรย์ที่ได้มาไม่กระทบชั้นวาง (เรียกใหม่ได้ 7) แต่แก้ฟิลด์ของ object ข้างใน (`a1[0].nameTh = …`) กระทบชั้นวางจริง (เรียกใหม่เห็นค่าที่แก้) จนกว่า `loadAll` รอบถัดไปสร้าง object ใหม่ → คอมเมนต์ "ไม่ให้ผู้เรียกเผลอแก้ข้อมูลกลาง" จริงเฉพาะการแก้อาร์เรย์ ไม่รวมการแก้ฟิลด์ (ในโปรเจกต์ผู้เรียกแค่ส่งต่อ ไม่แก้ จึงไม่เป็นปัญหาจริง)
- `loadAll` เรียกซ้ำได้ 7 ไม่ใช่ 14 (เพราะ `clear()`; `readonly` ของ `byCategory` ห้ามกำหนดตัวแปรใหม่ แต่ `.clear()/.set()` ยังทำได้) · ใส่แถว Refrigerator เพิ่ม 1 แถว → AC 7, Refrigerator 1, `byCategory.size` = 2
- **ยังไม่ได้ทดลอง:** `ORDER BY` กับฐานข้อมูลจริง (ลำดับในผลทดลองมาจากลำดับในไฟล์ข้อมูลที่ pool ปลอมส่ง) · พฤติกรรมของ `onModuleInit` ที่ไม่มี `await`
**ข้อสังเกต F.2 (ค้างรอผู้ใช้):** `EquipmentRow.device_category` ใช้ชนิด `DeviceCategory` ที่ผู้ใช้ตัด `'Microwave'` ออก แต่ ENUM ใน migration 003 ยังมี `'Microwave'` ตอนนี้ข้อมูลมีแค่ `Air Conditioner` จึงไม่มีผลจริง
**ตอบให้ได้เมื่อทบทวน:** (1) ทำไมโหลดตอนบูตครั้งเดียว ข้อเสียคืออะไร (ต้องเริ่มเซิร์ฟเวอร์ใหม่หลังรัน seed) (2) `readonly` กับ `Map` (3) `?? []` ทำไมต้องมี (4) สำเนาตื้นกันอะไร ไม่กันอะไร (5) `source_page ?? undefined` ทำไมไม่ปล่อย `null` (6) ทำไม `ORDER BY` ต้องมี `u.equipment_id` ท้ายสุด (7) ถ้า `loadAll` โยน error แอปเป็นอย่างไร ทำไมตั้งใจ

### ⭐8 `graph.repository.ts` (#10) บล็อก 3–7 — ผู้ใช้สั่งมาร์ก 9 ต.ค.: "ไฟล์นี้อ่านแล้ว copy-paste ต้องมาทำอีกที" (ยังไม่ได้พิมพ์เอง ยังไม่ได้เรียนละเอียด)
**สถานะ:** ไฟล์ตรงต้นแบบ 239 บรรทัดโค้ด `tsc` ผ่าน (ตรวจ 9 ต.ค.) แต่ **ผู้ใช้ไม่ได้พิมพ์เองบล็อก 3–7** และผมยังไม่ได้อธิบายบล็อก 4–7 · ตอนกลับมา: ถามผู้ใช้ว่าอยากพิมพ์เองใหม่ทีละบล็อก (ลบแล้วพิมพ์ใหม่ หรือพิมพ์ในไฟล์ชั่วคราวแล้วเทียบ) หรืออ่านทำความเข้าใจอย่างเดียว · ถ้าจะพิมพ์ใหม่ ทำตามตารางบล็อกใน §6
**อธิบายไปแล้ว (9 ต.ค.):** บล็อก 2 (`NodeRow` เทียบ DDL ตาราง `nodes` ตรงทั้ง 18 ฟิลด์ / `GraphSummary` camelCase / `GraphDataIntegrityError` ไม่ export) · บล็อก 3 (`GraphRepository`: `findById` คืนตัวจริงไม่ใช่สำเนา, `listAll` สร้างใหม่ทุกครั้ง)
**ยังไม่ได้อธิบาย (ใจความจากที่อ่านต้นแบบ ให้ใช้เป็นโครงตอนกลับมา):**
- **บล็อก 4 `loadAll`:** 2 query แยก ไม่ JOIN nodes (JOIN สามชั้นจะทำให้ข้อมูลระดับกราฟซ้ำตามจำนวนโหนด 95 แถวแทน 13) · `ORDER BY g.graph_id` และ `ORDER BY graph_id, display_order` · จัดกลุ่มโหนดตาม `graph_id` ด้วย `Map<string, NodeRow[]>` (ห้ามใช้ `node_id` อย่างเดียวเป็น key เพราะ PRIMARY KEY เป็นคู่ `(graph_id, node_id)` node_id ซ้ำข้ามผังได้) · `this.graphs.clear()` แล้ว `set` ทุกผัง · `nodesByGraph.get(...) ?? []` · log "โหลดกราฟสำเร็จ N กราฟ M โหนด"
- **บล็อก 5 `buildGraph`:** ตรวจ `schema_version !== 2` โยน `UnsupportedSchemaVersionError` (จาก types.ts) · ไม่มีโหนดเลย → `GraphDataIntegrityError` · `entry_node` ต้องมีจริงในโหนดที่สร้าง · ประกอบ `TroubleshootingGraph`: `page_range: [page_start, page_end]` · `?? undefined` แปลง NULL เป็น undefined · `parseJsonColumn<...>` สำหรับ `entry_symptom_aliases` กับ `config`
- **บล็อก 6 `buildNode`:** `base` ร่วม (แปลง `safety_critical === 1`, `has_image === 1`) · `switch (row.node_type)` 5 ชนิด · **ระวัง: โหนด `input` ใช้ `prompt` ไม่ใช่ `content`** · `pattern`/`on_invalid` เป็น optional โดยตั้งใจ · `default` มี `const unreachable: never = row.node_type` (ให้ TS ยืนยันว่าครอบคลุมครบ 5 ชนิด) · `parseJsonColumn<never>(row.external_reference)` (ใช้ `never` เพื่อให้ผ่านชนิดโดยไม่ระบุรูป)
- **บล็อก 7 (ท้ายไฟล์ นอกคลาส):** `required<T extends string>(value: T | null, column, row): T` (generic คืนชนิดเดิม ทั้ง string และ enum, โยนเมื่อ `null` หรือ `''`) · `parseJsonColumn<T>(value: unknown): T | undefined` (รับทั้ง object และ string, `trim` แล้ว `JSON.parse`)
**ผลทดลอง (9 ต.ค. pool ปลอมที่สร้างแถวจาก `data/manuals/samsung_ac_ar70h.json` ตามรูปแบบที่ `seed-graphs.js` เขียนลงตาราง ไม่ได้แตะฐานจริง; สคริปต์ `gr-demo.ts` / `gr-diff.ts` ใน scratchpad อาจหาย ถ้าหายขอผมทำใหม่; รันได้ทั้งกับต้นแบบและกับไฟล์ของผู้ใช้ — ผลเหมือนกัน):**
- โหลดได้ "13 กราฟ 95 โหนด" ตรงกับ §8 · `listAll()` 13 รายการ เรียงตาม graph_id · `findById` ตัวเดียวกัน (`===`) ทุกครั้ง · id ที่ไม่มีได้ `undefined` · แก้ผลที่ได้ (pop โหนด) กระทบการเรียกครั้งถัดไป
- **ไปกลับ JSON → แถว → GraphRepository เทียบกับ JSON เดิม:** ต่างแค่ 2 เรื่องตามออกแบบ: `has_image` (JSON ไม่มี repo เติม false ครบ 95 โหนด) และ `safety_critical` (JSON ไม่มี 29 โหนด repo เติม false; 3 โหนดที่เป็น true ตรงกัน) · ฟิลด์อื่นตรงทั้งหมด
- **ยังไม่ได้ทดลอง:** กับฐานข้อมูลจริง (SELECT อย่างเดียว) · `ORDER BY` จริง (ลำดับในการทดลองเรียงโดยสคริปต์) · กรณีข้อมูลเสีย (`required()` โยนเมื่อ NULL, ไม่มีโหนด, `entry_node` ไม่มี, schema_version ≠ 2) → เสนอทดลองด้วยแถวปลอมที่ตั้งใจให้เสีย
**ตอบให้ได้เมื่อทบทวน:** (1) ทำไมใช้ 2 query ไม่ JOIN (2) ทำไมจัดกลุ่มโหนดด้วย `graph_id` ไม่ใช้ `node_id` อย่างเดียว (3) `required()` แปลงอะไรเป็นอะไร ทำไมต้องล้มตอนบูต (4) `never` ใน `default` ทำอะไร (5) ทำไมโหนด `input` ใช้ `prompt` (6) `safety_critical === 1` ทำไมไม่ใช่ `boolean` ตรงๆ (7) `findById` คืนตัวจริง ข้อดีข้อเสีย

## 6) #10 `graph.repository.ts` — แผนบล็อก (ต้นแบบ `../troubleshoot-assistantv2/backend/src/traversal/graph.repository.ts`)

พิมพ์ตามต้นแบบ ไม่ต้องแก้ ชื่อ `graph*` ตามเดิม ประเมิน ≈ 3.3–5.5 ชม. (ค่าประมาณ ไม่ได้วัด)

| บล็อก | บรรทัดต้นแบบ | เนื้อหา |
|---|---|---|
| 1 | 13–27 | `import` (Nest, ชนิด `Pool, RowDataPacket` แบบ `import type`, `MYSQL_POOL` จาก `'../database/database.constants'`, ชนิดจาก `'../traversal-engine/types'`) |
| 2 | 29–90 | `GraphRow`, `NodeRow` (extends `RowDataPacket`), `GraphSummary` (export), `GraphDataIntegrityError` (ไม่ export) |
| 3 | 92–130 | คลาส `GraphRepository implements OnModuleInit`: `Map`, `constructor(@Inject(MYSQL_POOL) pool)`, `onModuleInit`, `findById`, `listAll` |
| 4 | 141–180 | `loadAll`: 2 query (ไม่ JOIN nodes), จัดกลุ่มโหนดตาม `graph_id`, `buildGraph` ทุกผัง, log |
| 5 | 182–222 | `buildGraph`: ตรวจ `schema_version === 2`, มีโหนด ≥ 1, `entry_node` มีจริง แล้วประกอบ `TroubleshootingGraph` |
| 6 | 232–303 | `buildNode`: `switch` 5 ชนิด (ระวัง: โหนด `input` ใช้ `prompt` ไม่ใช่ `content`), `default` มี `never` |
| 7 | 310–337 | `required<T extends string>`, `parseJsonColumn<T>` (ฟังก์ชันนอกคลาส ท้ายไฟล์) |

ข้อสังเกตที่อธิบายผู้ใช้ไว้แล้ว: `safety_critical === 1` (mysql2 ส่ง BOOLEAN เป็น 0/1) · อ่านอย่างเดียว (`SELECT`) จึงปลอดภัยกับฐานร่วม · ไม่มีเทสของไฟล์นี้ในต้นแบบ ตรวจจริงตอนบูต (log "โหลดกราฟสำเร็จ 13 กราฟ 95 โหนด") หรือด้วยสคริปต์ทิ้งหลัง #11 ("จุดเห็นผลที่ 1" ผมเขียนสคริปต์ชั่วคราวนอกโปรเจกต์)

**ถัดไปหลัง #10:** #11 `session.store.ts` (178 บรรทัดโค้ด: SQL เขียนเอง, transaction, `NOW()` ใน SQL, `saveOutcome` เป็น `UPDATE ... WHERE outcome_text IS NULL AND status='completed'` คำสั่งเดียว) → จุดเห็นผลที่ 1 → เฟส 3 ค้นหาอาการ (#12–#16) → เฟส 4 REST (#17–#30) → smoke test ด่านความปลอดภัย

## 7) วิธีที่ใช้เทียบไฟล์กับต้นแบบ (ใช้ซ้ำได้)

ตัดคอมเมนต์ `//`, `/* */`, `*` ช่องว่างท้ายบรรทัด และบรรทัดว่าง ออกจากทั้งสองไฟล์ แล้ว `diff` ส่วนต่างที่เหลือคือส่วนต่างของโค้ดจริง (ผมใช้สคริปต์ `awk` ใน Bash) · SQL: ตัดบรรทัดขึ้นต้น `--` · นับ "บรรทัดโค้ด" = ไม่ว่างและไม่ขึ้นต้น `//`, `*`, `/*`

## 8) ตัวเลขที่ตรวจแล้ว

- เทสต้นแบบ (6 ต.ค. และหลังแก้ `find` 7 ต.ค.): backend 183/183 (10 ไฟล์), frontend 84/84 (8 ไฟล์)
- ไฟล์ใน `backend/src` + `frontend/src` ของต้นแบบ = 86 (backend 34, frontend 52): ซ้ำ 66 · ดัดแปลง 18 · ตัด 2
- เวลาประเมิน (ROADMAP สร้างใหม่ 8 ต.ค. หลังเลื่อน RAG): **ขอบเขตปัจจุบัน** MUST ≈ 42.9–64.1 ชม. (รวมเฟส 0 ≈4–7, เทสเดิม T1–T2 ≈1–2, อ่านเทส 4, ซ้อมตอบ 6 ≈ **57.9–83.1 ชม.**) OPT เพิ่มอีก 11.6–17.1 ชม. · **งานอนาคต (RAG)** MUST ≈ 37.2–59.0 ชม. (ยังไม่นับ PDF/ชุดคำถามวัดผล/เฟส 8) · อัตราเป็นค่าสมมติ ยังไม่ได้วัดจากผู้ใช้ → วัดหลัง #01–#02 แล้วคูณ k
- ข้อมูล: แอร์ 13 ผัง/95 โหนด (checkpoint 41, instruction 24, escalation 17, resolution 12, input 1; โหนดความปลอดภัย 3) · เครื่องซักผ้า 29 ผัง ทั้งหมด `pending_manual_review` · ผังทุกอันมี `source_chunk_id` ตรงกับ `chunk_id` (13/13, 29/29)
