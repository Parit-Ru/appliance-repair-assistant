# HANDOFF — appliance-repair-assistant (อัปเดต 7 ต.ค. 2569)

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
| #10 | `src/traversal/graph.repository.ts` | ⏸ **พักไว้ (ผู้ใช้สั่ง 7 ต.ค. "ไปไฟล์อื่นก่อน เดี๋ยวกลับมาทำต่อ")** พิมพ์ไปแล้ว: บล็อก 1 (import) + `interface GraphRow` ครบ (ไฟล์ 34 บรรทัด / 912 ไบต์ ตรวจแล้ว ตรงต้นแบบเท่าที่พิมพ์) · **ยังไม่ได้พิมพ์:** `NodeRow`, `GraphSummary`, `GraphDataIntegrityError`, คลาส `GraphRepository`, ฟังก์ชันช่วยท้ายไฟล์ (บล็อก 2 ที่เหลือ → 7 ดู §6) · **ยังไม่ได้ตรวจเทียบ/รัน `tsc` เพราะไฟล์ยังไม่ครบ** (ไฟล์ที่พิมพ์ไม่ครบมี `tsc` error ตามที่คาดได้) |
| #11 | `src/traversal/session.store.ts` | ⬜ |
| #12 | `src/symptom-search/symptom-search.dto.ts` | ✅ ตรงต้นแบบทุกบรรทัด (56 บรรทัดโค้ด) · `tsc` ผ่าน · `parseSearchBody` ทดลอง 16 กรณีแล้ว |
| #13 | `src/symptom-search/symptom-matcher.ts` | ✅ 82 บรรทัดโค้ด ต่างต้นแบบแค่การขึ้นบรรทัดของ `Pick<…>` · `rankGraphs`/`selectMatches` เทียบกับต้นแบบด้วยเวกเตอร์จริง 6 คำค้น + สุ่ม 2,000 กรณี ต่าง 0 · ⭐ ดู "จุดสำคัญ" ด้านล่าง |
| #14 | `src/embedding/embedding.service.ts` | ✅ ตรงต้นแบบ **46 บรรทัดโค้ด** (ต้นแบบหลัง clean up ไม่มี getter `isLoaded` และแก้ช่องว่างหลัง `=`) · ⚠️ `model-slim/` ยังไม่ได้คัดลอกมาโปรเจกต์ใหม่ รัน `load()` จริงไม่ได้จนกว่าจะคัดลอก · ⭐ ดู "embed ตรงไหน" ด้านล่าง |
| #15 | `src/embedding/embedding.module.ts` | ⬜ (ใหม่ ไม่มีในต้นแบบ ขนาดอ้างอิง `graph.module.ts` 7 บรรทัด) |
| — | เฟส 3 ที่เหลือ (#16), เฟส 4–8, เฟส T | ⬜ |

**ยังไม่ได้บันทึกเวลาจริงต่อไฟล์** (ภาคผนวก ก ของ ROADMAP) ผู้ใช้ยังไม่ได้แจ้งเวลา ค่า k ยังไม่มี

**จุดตรวจที่ทำแล้ว:** `npx tsc --noEmit` ผ่านที่ #01–#09 · `npm run migrate` (ไม่ทำอะไร เพราะ FixStep รันไว้แล้ว) · `npm run seed` ได้ "13 กราฟ · 95 โหนด" (ซ้ำข้อมูลเดิม)

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
- เวลา MUST เฟส 1–7 ≈ 80.5–123.8 ชม. (รวมเฟส 0, อ่านเทส, ซ้อมตอบ ≈ 94.5–140.8) อัตราเป็นค่าสมมติ ยังไม่ได้วัดจากผู้ใช้
- ข้อมูล: แอร์ 13 ผัง/95 โหนด (checkpoint 41, instruction 24, escalation 17, resolution 12, input 1; โหนดความปลอดภัย 3) · เครื่องซักผ้า 29 ผัง ทั้งหมด `pending_manual_review` · ผังทุกอันมี `source_chunk_id` ตรงกับ `chunk_id` (13/13, 29/29)
