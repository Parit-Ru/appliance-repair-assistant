# ROADMAP — แผนพอร์ต FixStep → appliance-repair-assistant (พิมพ์โค้ดใหม่ด้วยมือ)

> สร้างเมื่อ 6 ต.ค. 2569 · เอกสารนี้คือ **แผน** ไม่ใช่โค้ด
> **โปรเจกต์ใหม่:** `appliance-repair-assistant` ยังว่างเปล่า และไม่ใช่ git repository → **ยังไม่มี commit hash ของโปรเจกต์ใหม่** (ผมไม่ได้ `git init` ตามกฎ) ให้ใส่ hash ตอนคุณ commit ไฟล์แรก
> **ต้นแบบ:** `troubleshoot-assistantv2` (FixStep) สาขา `main` commit `23a0d7f` · `git status` ของต้นแบบมีเฉพาะ `ROADMAP.md` (ไฟล์เอกสารของ FixStep ที่แก้ค้างอยู่ก่อนผมเริ่ม) ไม่มีการแก้ไฟล์ใน `backend/src` หรือ `frontend/src`
> **เทสของต้นแบบ (รันวันนี้):** backend **183/183** ผ่าน (10 ไฟล์) · frontend **84/84** ผ่าน (8 ไฟล์) · ผมรันโดยตั้ง cache ของ jest ไว้นอก repo และตรวจ `git status` หลังรัน ไม่พบไฟล์ใหม่ที่ git มองเห็น
> ถ้าเอกสารเก่าของ FixStep ขัดกับโค้ด **ยึดโค้ด** · ถ้าคำตอบของคุณ (ข้อ A.1) ขัดกับโค้ด ให้บอกผม

**เป้าหมาย:** บอกว่าควรพิมพ์ไฟล์ไหนก่อน เรียงอย่างไร และแต่ละไฟล์ใช้อะไรจากของเก่า · ต้นแบบห้ามแก้ ห้ามลบ ห้าม commit/push จากโฟลเดอร์นี้

สารบัญ: [0 อ่านก่อน](#0-อ่านก่อน-นิยามตัวเลขและข้อตกลง) · [A ต่างจาก FixStep อย่างไร](#a-โปรเจกต์ใหม่ต่างจาก-fixstep-อย่างไร) · [B จัดประเภทไฟล์เก่า](#b-จัดประเภทไฟล์เก่าทุกไฟล์) · [C ลำดับพิมพ์](#c-ลำดับพิมพ์ไฟล์ใหม่) · [D ส่วนที่เขียนใหม่ทั้งหมด](#d-ส่วนที่ต้องเขียนใหม่ทั้งหมด-แนวคิดและคำถามอาจารย์) · [E เฟส 0](#e-เฟส-0--ตั้งต้นโปรเจกต์) · [F ที่ยังไม่แน่ใจ](#f-สิ่งที่ยังไม่แน่ใจหรือสมมติ)

---

## 0. อ่านก่อน: นิยามตัวเลขและข้อตกลง

**ที่มาของตัวเลขในเอกสารนี้**

- **"บรรทัดโค้ด"** = บรรทัดที่ไม่ว่างและไม่ขึ้นต้นด้วย `//`, `*`, `/*` · **"รวม"** = จำนวนบรรทัดทั้งหมดของไฟล์ (`wc -l`) ผมนับด้วยสคริปต์จากไฟล์จริงของ FixStep ตอนสร้างเอกสาร (นับแบบหยาบ: บรรทัดคอมเมนต์ท้ายโค้ดและ SQL `--` นับเป็นโค้ด)
- **จำนวนเทส** = ผลจาก `jest --json` / `vitest --reporter=json` ที่รันจริงวันนี้ (นับรวมเคสที่ `it.each` แตกออก)
- **เลขบรรทัดที่อ้าง** (เช่น `types.ts:108`) ผมเปิดไฟล์จริงตรวจแล้ว
- **ไฟล์ใหม่ไม่มีเลขบรรทัด** (ยังไม่มีไฟล์) ใช้ "ขนาดอ้างอิง" = จำนวนบรรทัดโค้ดของไฟล์เก่าที่หน้าที่ใกล้เคียงที่สุด เพื่อประเมินเวลาเท่านั้น **ไม่ใช่การทำนายขนาดไฟล์ใหม่**
- **เวลา** เป็น **ช่วงประเมิน** ไม่ใช่ค่าที่วัดจากคุณ สูตร: `(บรรทัดโค้ดอ้างอิง ÷ อัตรา) × ตัวคูณ + เวลาเผื่อ` อัตรา (บรรทัดโค้ด/ชม.) ใช้ค่าสมมติชุดเดียวกับ ROADMAP ของ FixStep §3.3 ซึ่งเป็นค่าสมมติที่ไม่ได้วัดเช่นกัน: ประกาศ type 120 · ตรรกะ 70 · SQL 90 · เชื่อมโมดูล 110 · frontend ตรรกะ 80 · JSX 90 · สคริปต์ JS 70 ตัวคูณ: ไฟล์ที่พิมพ์ตามของเก่า 0.85–1.5 · ไฟล์ใหม่ 1.2–2.2 · ไฟล์ใหม่ที่ต้องเขียนเทสด้วย 1.6–2.6 เวลาเผื่อ: MUST 0.4 ชม. OPT 0.25 ชม. (ฟังคำอธิบาย + ตอบคำถามหลังพิมพ์)
- **หลังจบ #01–#02 ให้วัดเวลาจริง** แล้วคูณ k = เวลาจริง ÷ ช่วงที่ประเมิน ปรับทุกช่วงด้วย k (วิธีเดียวกับ FixStep)

**ข้อตกลงที่ใช้ซ้ำจาก FixStep (§0.1–0.3 ของ ROADMAP เดิม)**

1. ต้นแบบอ่านอย่างเดียว คัดลอกออกไปได้ ห้ามแก้
2. ทำใน `appliance-repair-assistant/` (ต่อไปเรียก `<NEW>`) โครงสร้างพี่น้อง `<NEW>/backend`, `<NEW>/frontend`, `<NEW>/data` ห้ามย้าย เพราะเทสของต้นแบบอ่าน `../../../data/...` และ frontend import `../../../backend/src/traversal-engine/types` (ดู §B แถว `api/types.ts`)
3. พิมพ์เอง ไม่ copy-paste · ทำทีละไฟล์ตามเลขลำดับ §C · หยุดรอ "ok" ก่อนไฟล์ถัดไป
4. วงจรต่อไฟล์: (1) อ่านคำอธิบาย/ให้ Claude อธิบายก่อนพิมพ์ (2) พิมพ์ (3) `tsc` + เทสที่ระบุ (4) ตอบคำถาม 2–3 ข้อโดยไม่ดูโค้ด (5) เทียบกับไฟล์เก่า ส่วนที่ต่างต้องอธิบายได้ (6) ติ๊ก `[x]` แล้วจดเวลาจริง
5. **คอมเมนต์:** ค่าตั้งต้นคือ พิมพ์เฉพาะโค้ด อ่านคอมเมนต์ภาษาไทยของต้นฉบับทุกบรรทัดแต่ไม่ต้องพิมพ์ (เวลาในเอกสารนี้นับเฉพาะบรรทัดโค้ด) เปลี่ยนได้ที่ §F.14
6. เทสของไฟล์เก่าที่ "ใช้ซ้ำได้ตรงๆ" คัดลอกจากต้นฉบับมาตรวจ ไม่ต้องพิมพ์ (ไม่งั้นไม่มีเฉลย) · เทสของไฟล์ **ใหม่** ไม่มีเฉลย ต้องเขียนเอง (ให้ Claude ช่วยร่างได้ แต่คุณต้องอธิบายได้ทุกเคส)
7. **เลื่อนเทสทั้งหมด (ตัดสินใจ 7 ต.ค. 2569):** ระหว่างพิมพ์เฟส 1–7 **ไม่ต้องคัดลอก ไม่ต้องรัน ไม่ต้องเขียน** เทส Jest/Vitest ใดๆ ให้ตรวจแต่ละไฟล์ด้วย `tsc` + เทียบกับต้นแบบ (วงจรข้อ 4 ข้อ 3) แล้วทำเทสทั้งหมดรวมที่ **เฟส T** หลังทุกอย่างเสร็จ (§C.1 ท้ายรายการ) · ทุกที่ในเอกสารนี้ที่เขียนว่า "ตรวจ: …เทส…" ให้อ่านเป็น "ตรวจด้วย `tsc` ก่อน เทสไปเฟส T" · ผลกระทบและความเสี่ยงอยู่ที่ §F.18

---

## A. โปรเจกต์ใหม่ต่างจาก FixStep อย่างไร

### A.1 การตัดสินใจที่คุณยืนยันแล้ว (6 ต.ค. 2569)

| เรื่อง | FixStep (ต้นแบบ) | โปรเจกต์ใหม่ (คำตอบของคุณ) |
|---|---|---|
| ฐานข้อมูล | MySQL 8.4 + `mysql2` เขียน SQL เอง ไม่ใช้ ORM | **คงเดิม** MySQL + `mysql2` |
| เก็บ/ค้นเวกเตอร์ | คำนวณ cosine เองในหน่วยความจำ (`symptom-matcher.ts`) | **คงเดิม** ในหน่วยความจำ + cosine เอง (แต่เวกเตอร์ของ **ข้อความคู่มือทั้งก้อน** ไม่ใช่แค่ชื่ออาการ) |
| LLM | ไม่มี (ไม่มี SDK ของ LLM ใน `backend/package.json`; `.env.example` มี `GEMINI_API_KEY`/`GROQ_API_KEY` ที่ไม่มีโค้ดใช้) | **Groq API** (เดิมคุยไว้ว่า Claude API แต่คุณเปลี่ยนเป็น Groq เมื่อ 6 ต.ค. 2569; รุ่นโมเดลและไลบรารีเรียกใช้ยังไม่ตัดสินใจ §F.9) |
| Embedding | `Xenova/paraphrase-multilingual-MiniLM-L12-v2` q8 ผ่าน `@huggingface/transformers` 4.3.0 | **คงเดิม** (ใช้ `embedding.service.ts` และ `backend/model-slim/` ได้) |
| การกันแต่งคำตอบ | ไม่ต้องกัน เพราะไม่มี LLM (ขั้นตอนมาจากผัง) | **ตอบเฉพาะจาก chunk ที่ดึงมา + อ้างหน้าคู่มือ + ปฏิเสธถ้าคะแนนต่ำกว่าเกณฑ์** |
| ข้อมูลคู่มือ | JSON ผังที่ LLM ร่าง + มือตรวจ จาก chunk สำเร็จรูป (`data/chunks/`, `data/manuals/`) | **PDF คู่มือจริง** → ต้องมีตัวดึงข้อความและ chunk ตามหน้า |
| ประเภทเครื่อง | 4 ประเภท (README ต้นแบบ บรรทัด 79: Samsung แอร์, ตู้เย็น, เครื่องซักผ้า, โทรทัศน์) แต่ข้อมูลที่มีใน repo มีแค่แอร์ (13 ผังในดัชนี `data/index.json`) กับเครื่องซักผ้า (29 ผัง สถานะ `pending_manual_review` ทั้งหมด) | **4 ประเภท** |
| แนวผังขั้นตอน | engine ผัง + session + ด่านความปลอดภัย | **คงแนว session + ผังขั้นตอน + ด่านความปลอดภัย** |
| frontend | React 19 + Vite + Tailwind v3 + TanStack Query + HashRouter | **คงเหมือนเดิมทั้งชุด** |

> ⚠️ ข้อที่ผมต้อง "ตีความ": คำตอบ "4 ประเภท เป็นผังขั้นตอนคงแนว session + มีด่านความปลอดภัย" **ไม่ได้บอกว่า RAG ไปต่ออยู่ตรงไหนของการใช้งาน** ผมวางแผนไว้แบบเดียวที่ไม่ล้มของเดิม (A.3) แต่ **ต้องให้คุณยืนยันใน §F.1 ก่อนเริ่มเฟส 5**

### A.2 ชั้นไหนใช้ซ้ำ ชั้นไหนเขียนใหม่

| ชั้น | สถานะ | หมายเหตุ |
|---|---|---|
| engine (`traversal-engine/`) | **ใช้ซ้ำ** | แก้เล็กน้อย: `types.ts` (ประเภทเครื่อง ดู §B) |
| DB ผัง/session/outcome (migration 001–005) | **ใช้ซ้ำ** | อาจแก้ ENUM ประเภทเครื่อง |
| `graph.repository`, `session.store`, `database.*` | **ใช้ซ้ำ** | ตรรกะไม่ผูกกับแอร์ |
| ค้นหาอาการ → เลือกผัง (`symptom-search/`) | **ใช้ซ้ำ** | ย้าย `embedding.service` ไปเป็นโมดูลกลาง เพราะ RAG ต้องใช้ตัวเดียวกัน |
| REST ของ traversal + filter | **ใช้ซ้ำ** | |
| **ingest PDF → chunk** | **เขียนใหม่** | D.1 |
| **ตาราง chunk + ดัชนี chunk ในหน่วยความจำ + จัดอันดับ chunk** | **เขียนใหม่** (หลักการเดียวกับ `graph.repository` / `symptom-search.service` / `symptom-matcher`) | D.2–D.3 |
| **prompt, ตัวเรียก LLM (Groq), ด่านกันแต่งคำตอบ, คะแนนความมั่นใจ, แหล่งอ้างอิง** | **เขียนใหม่** | D.4–D.8 |
| frontend ชั้นข้อมูล/ผัง/step/หน้า | **ใช้ซ้ำ** (ตัด mock ดู §F.10) | |
| frontend หน้าถามตอบ + รายการอ้างอิง | **เขียนใหม่** | D.7 |

### A.3 สถาปัตยกรรมที่วางแผนไว้ (ตีความของผม — ยืนยันที่ §F.1)

```
ผู้ใช้ ──► (เลือกอาการ / พิมพ์เล่าอาการ) ──► ผังขั้นตอน + session + ด่านความปลอดภัย   [engine เดิม ตัดสินขั้นตอนเอง 100%]
   │
   └──► ถามเป็นข้อความอิสระ ──► ดึง chunk คู่มือที่คล้ายที่สุด ──► (ต่ำกว่าเกณฑ์ → ปฏิเสธ ไม่เรียก LLM)
                                                                  └─► LLM (Groq) สรุป "เฉพาะจาก chunk" ──► คำตอบ + แหล่งอ้างอิง (หน้า) จาก metadata ของ chunk
```

กฎที่ต้องรักษาจาก FixStep: **LLM ไม่มีอำนาจตัดสินขั้นถัดไปหรือข้ามด่านความปลอดภัย** (engine เป็นจุดตัดสินใจเดียว) และ **แหล่งอ้างอิงมาจากข้อมูล ไม่ใช่ข้อความที่โมเดลพิมพ์** (หลักเดียวกับ `types.ts:217–218` ของ FixStep)

---

## B. จัดประเภทไฟล์เก่าทุกไฟล์

ไฟล์ทั้งหมดใน `backend/src` + `frontend/src` = **86** (backend 34, frontend 52; นับจาก `git ls-files`) · ใช้ซ้ำตรงๆ **66** · ดัดแปลง **18** · เขียนใหม่ (ไฟล์เก่าที่ต้องทิ้งแล้วเขียนใหม่) **0** · ตัด **2** (รวมบรรทัดโค้ด: ซ้ำ 4755 · ดัดแปลง 1372 · ตัด 427) · ส่วนที่เขียนใหม่จริงคือ **ไฟล์ใหม่ใน §C เฟส 5–7** (ไม่มีตัวเลขบรรทัด)

คอลัมน์ "บรรทัดโค้ด/รวม" และ "เทส" มาจากไฟล์จริง · ป้าย: **ซ้ำ** = ใช้ซ้ำได้ตรงๆ (พิมพ์ตามเดิม หรือคัดลอกถ้าเป็นเทส/ UI) · **ดัดแปลง** = ใช้ได้แต่ต้องแก้ตามที่ระบุ · **ใหม่** = ไม่เหมาะกับโปรเจกต์ใหม่ ต้องเขียนใหม่ (ไม่มีไฟล์เก่าที่เข้าข่าย — ส่วนที่เขียนใหม่คือไฟล์ใหม่ใน §C เฟส 5–7) · **ตัด** = ตัดทิ้ง (พร้อมเหตุผล)

| ไฟล์ | บรรทัดโค้ด / รวม | เทส | ป้าย | หมายเหตุ / สิ่งที่ต้องแก้ |
|---|--:|--:|---|---|
| `backend/app.module.ts` | 14 / 16 |  | **ดัดแปลง** | รอบแรกเหมือนเดิม · รอบสอง (#47) เพิ่ม `KnowledgeModule`, `AnswerModule` |
| `backend/database/database.constants.ts` | 1 / 17 |  | **ซ้ำ** |  |
| `backend/database/database.module.ts` | 60 / 77 |  | **ซ้ำ** | ค่า `DB_*` มาจาก `.env` |
| `backend/health/health.controller.ts` | 26 / 39 |  | **ดัดแปลง** | บรรทัด 32 `service: 'fixbot-backend'` เป็นชื่อเก่า |
| `backend/health/health.module.ts` | 6 / 7 |  | **ซ้ำ** |  |
| `backend/main.ts` | 14 / 18 |  | **ดัดแปลง** | บรรทัด 15 ข้อความ log "FixBot backend running" |
| `backend/symptom-search/embedding.service.ts` | 49 / 91 |  | **ดัดแปลง** | ย้ายไป `embedding/` (ลึกเท่าเดิม เพราะบรรทัด 30 อ้าง `../../model-slim`); ตรรกะไม่เปลี่ยน |
| `backend/symptom-search/symptom-matcher.spec.ts` | 150 / 186 | 19 | **ซ้ำ** | คัดลอก · อ่านข้อมูลแอร์ที่บรรทัด 112 |
| `backend/symptom-search/symptom-matcher.ts` | 82 / 139 |  | **ซ้ำ** | `cosineSimilarity` ถูกใช้ซ้ำโดย `chunk-matcher.ts` |
| `backend/symptom-search/symptom-search.controller.ts` | 23 / 42 |  | **ซ้ำ** |  |
| `backend/symptom-search/symptom-search.dto.spec.ts` | 58 / 76 | 10 | **ซ้ำ** | คัดลอก |
| `backend/symptom-search/symptom-search.dto.ts` | 56 / 138 |  | **ซ้ำ** |  |
| `backend/symptom-search/symptom-search.exception.filter.spec.ts` | 37 / 45 | 4 | **ซ้ำ** | คัดลอก |
| `backend/symptom-search/symptom-search.exception.filter.ts` | 34 / 62 |  | **ซ้ำ** | import ชนิดจาก `traversal.exception.filter` |
| `backend/symptom-search/symptom-search.module.ts` | 12 / 24 |  | **ดัดแปลง** | `imports` เพิ่ม `EmbeddingModule` แทนการ provide `EmbeddingService` เอง |
| `backend/symptom-search/symptom-search.service.spec.ts` | 241 / 312 | 13 | **ดัดแปลง** | คัดลอกแล้วแก้ path import `./embedding.service`; อ่านข้อมูลแอร์ที่บรรทัด 38 |
| `backend/symptom-search/symptom-search.service.ts` | 146 / 242 |  | **ดัดแปลง** | แก้ path import `EmbeddingService` |
| `backend/traversal-engine/path-coverage.spec.ts` | 210 / 328 | 45 | **ซ้ำ** | คัดลอก · ถ้าข้อมูลผังเปลี่ยน ค่าคงที่บรรทัด 54–56 (13 / 95 / 106) ต้องแก้ตาม |
| `backend/traversal-engine/traversal-engine.confidence.spec.ts` | 28 / 41 | 4 | **ซ้ำ** | คัดลอก |
| `backend/traversal-engine/traversal-engine.spec.ts` | 505 / 676 | 37 | **ซ้ำ** | คัดลอก |
| `backend/traversal-engine/traversal-engine.ts` | 181 / 261 |  | **ซ้ำ** | ตรรกะไม่ผูกกับชนิดเครื่อง |
| `backend/traversal-engine/types.ts` | 156 / 266 |  | **ดัดแปลง** | `DeviceCategory` บรรทัด 104–109 (มี `Microwave`); คอมเมนต์บรรทัด 141 "Phase 8" |
| `backend/traversal/equipment.repository.ts` | 50 / 113 |  | **ซ้ำ** | OPT |
| `backend/traversal/graph.module.ts` | 7 / 24 |  | **ซ้ำ** |  |
| `backend/traversal/graph.repository.ts` | 239 / 337 |  | **ซ้ำ** | โหลดทุกผังจาก DB ตอนบูต ไม่ผูกกับแอร์ |
| `backend/traversal/session.store.ts` | 178 / 297 |  | **ซ้ำ** |  |
| `backend/traversal/traversal.controller.ts` | 46 / 95 |  | **ซ้ำ** |  |
| `backend/traversal/traversal.dto.spec.ts` | 96 / 121 | 15 | **ซ้ำ** | คัดลอก |
| `backend/traversal/traversal.dto.ts` | 123 / 279 |  | **ซ้ำ** |  |
| `backend/traversal/traversal.exception.filter.spec.ts` | 40 / 55 | 5 | **ซ้ำ** | คัดลอก |
| `backend/traversal/traversal.exception.filter.ts` | 71 / 119 |  | **ซ้ำ** |  |
| `backend/traversal/traversal.module.ts` | 13 / 29 |  | **ซ้ำ** |  |
| `backend/traversal/traversal.service.spec.ts` | 397 / 605 | 31 | **ซ้ำ** | คัดลอก · อ่านข้อมูลแอร์/อุปกรณ์ (บรรทัด 59–60) และอ้าง graph id `samsung_ac_ar70h_*` (บรรทัด 220–222) → ต้องมีข้อมูลชุดเดิม |
| `backend/traversal/traversal.service.ts` | 130 / 252 |  | **ซ้ำ** | ด่านความปลอดภัยอยู่ที่นี่ (เรียก engine ก่อนบันทึก) |
| `frontend/App.tsx` | 32 / 48 |  | **ดัดแปลง** | เพิ่ม route `/ask` |
| `frontend/api/http.test.ts` | 64 / 88 | 5 | **ซ้ำ** | คัดลอก |
| `frontend/api/http.ts` | 53 / 90 |  | **ซ้ำ** |  |
| `frontend/api/queries.ts` | 83 / 162 |  | **ดัดแปลง** | บรรทัด 45 `VITE_USE_MOCK` (ตัด mock) + เพิ่ม mutation ถามตอบ |
| `frontend/api/traversal.ts` | 78 / 134 |  | **ดัดแปลง** | ลบสาขา mock (`VITE_USE_MOCK` บรรทัด 40/56/68/85/97/115/127 + dynamic import mockServer) + เพิ่มฟังก์ชันถามตอบ |
| `frontend/api/types.ts` | 64 / 167 |  | **ดัดแปลง** | เพิ่มชนิดคำตอบ/แหล่งอ้างอิง |
| `frontend/components/EquipmentPanel.tsx` | 76 / 107 |  | **ซ้ำ** | คัดลอก |
| `frontend/components/OutcomeForm.tsx` | 102 / 143 |  | **ซ้ำ** |  |
| `frontend/components/SessionErrorNotice.tsx` | 35 / 48 |  | **ซ้ำ** |  |
| `frontend/components/SessionHeader.tsx` | 46 / 54 |  | **ซ้ำ** |  |
| `frontend/components/SymptomRow.tsx` | 61 / 87 |  | **ซ้ำ** | คัดลอก |
| `frontend/components/SymptomSearchForm.tsx` | 53 / 69 |  | **ซ้ำ** | คัดลอก |
| `frontend/components/SymptomSearchResults.tsx` | 46 / 61 |  | **ซ้ำ** | คัดลอก |
| `frontend/components/TerminalActions.tsx` | 23 / 31 |  | **ซ้ำ** |  |
| `frontend/components/layout/AppShell.tsx` | 63 / 95 |  | **ดัดแปลง** | บรรทัด 21 `APP_NAME = 'FixStep'` + คอมเมนต์บรรทัด 17–18 |
| `frontend/components/layout/ServerStatus.tsx` | 37 / 60 |  | **ซ้ำ** | คัดลอก (สถานะ `mock` จะไม่ถูกใช้ถ้าตัด mock) |
| `frontend/components/step/CheckpointStep.tsx` | 36 / 45 |  | **ซ้ำ** | OPT |
| `frontend/components/step/InputStep.tsx` | 49 / 78 |  | **ซ้ำ** | OPT |
| `frontend/components/step/InstructionStep.tsx` | 21 / 29 |  | **ซ้ำ** | OPT |
| `frontend/components/step/OutcomeStep.tsx` | 44 / 71 |  | **ซ้ำ** | OPT |
| `frontend/components/step/PathRail.tsx` | 68 / 113 |  | **ซ้ำ** | คัดลอก |
| `frontend/components/step/ReferenceLine.tsx` | 26 / 42 |  | **ซ้ำ** | OPT |
| `frontend/components/step/SafetyGateStep.tsx` | 48 / 74 |  | **ซ้ำ** | UX ของด่านความปลอดภัย (ตัวบังคับจริงอยู่ที่ engine) |
| `frontend/components/step/StepCard.tsx` | 45 / 73 |  | **ซ้ำ** | OPT |
| `frontend/components/step/StepView.tsx` | 34 / 64 |  | **ซ้ำ** |  |
| `frontend/components/step/stepProps.ts` | 7 / 24 |  | **ซ้ำ** |  |
| `frontend/components/ui/Button.tsx` | 41 / 47 |  | **ซ้ำ** | คัดลอก |
| `frontend/components/ui/Icon.tsx` | 145 / 172 |  | **ซ้ำ** | คัดลอก |
| `frontend/components/ui/Notice.tsx` | 31 / 54 |  | **ซ้ำ** | คัดลอก |
| `frontend/env.d.ts` | 7 / 25 |  | **ดัดแปลง** | ตัด `VITE_USE_MOCK` ถ้าตัด mock |
| `frontend/index.css` | 8 / 10 |  | **ซ้ำ** |  |
| `frontend/lib/errors.test.ts` | 146 / 176 | 21 | **ดัดแปลง** | เพิ่มเคสของรหัส error ใหม่ |
| `frontend/lib/errors.ts` | 112 / 168 |  | **ดัดแปลง** | เพิ่ม `case` ของรหัส error ถามตอบ (กำหนดตอน #44) |
| `frontend/lib/labels.ts` | 27 / 72 |  | **ดัดแปลง** | บรรทัด 24 `Microwave` ตาม §F.2 |
| `frontend/lib/outcome.test.ts` | 43 / 53 | 9 | **ซ้ำ** | คัดลอก |
| `frontend/lib/outcome.ts` | 14 / 47 |  | **ซ้ำ** |  |
| `frontend/lib/reference.test.ts` | 27 / 33 | 4 | **ซ้ำ** | คัดลอก |
| `frontend/lib/reference.ts` | 11 / 38 |  | **ซ้ำ** |  |
| `frontend/lib/search.test.ts` | 30 / 37 | 6 | **ซ้ำ** | คัดลอก |
| `frontend/lib/search.ts` | 14 / 43 |  | **ซ้ำ** |  |
| `frontend/lib/symptoms.test.ts` | 76 / 96 | 5 | **ซ้ำ** | คัดลอก |
| `frontend/lib/symptoms.ts` | 33 / 80 |  | **ซ้ำ** |  |
| `frontend/lib/trail.test.ts` | 62 / 71 | 6 | **ซ้ำ** | คัดลอก (ต้องมี `mocks/fixtures.ts`) |
| `frontend/lib/trail.ts` | 25 / 59 |  | **ซ้ำ** |  |
| `frontend/main.tsx` | 9 / 10 |  | **ซ้ำ** |  |
| `frontend/mocks/fixtures.ts` | 48 / 72 |  | **ซ้ำ** | คัดลอก (HomePage กับ trail.test ใช้) |
| `frontend/mocks/mockServer.test.ts` | 211 / 300 | 28 | **ตัด** | ตัดพร้อม mockServer (เทส 28 ข้อ) |
| `frontend/mocks/mockServer.ts` | 216 / 350 |  | **ตัด** | โหมดจำลองต้องปลอมคำตอบ LLM เพิ่ม และ import ข้อมูลจาก `data/` ของ backend ตรงๆ (บรรทัด 45–46 import JSON จาก data/) — §F.10 ยืนยันได้ |
| `frontend/pages/HomePage.tsx` | 102 / 165 |  | **ดัดแปลง** | บรรทัด 96 "ไม่ได้ให้ AI เดาเอาเอง" ไม่จริงแล้ว · ตัวอย่าง Samsung AR70H บรรทัด 59–60 |
| `frontend/pages/NotFoundPage.tsx` | 23 / 35 |  | **ซ้ำ** | คัดลอก |
| `frontend/pages/SessionPage.tsx` | 160 / 236 |  | **ซ้ำ** |  |
| `frontend/pages/SymptomsPage.tsx` | 160 / 235 |  | **ซ้ำ** | OPT |

---

## C. ลำดับพิมพ์ไฟล์ใหม่

### C.0 หลักการเรียง

เรียงจาก **กราฟ import ที่วางแผนไว้** ของโปรเจกต์ใหม่ (ไม่มีวงกลม) ไฟล์ที่ไม่ import อะไรมาก่อน โครงกราฟเกือบทั้งหมดเหมือนของ FixStep (ผมสร้างจากการอ่าน `import` ทุกไฟล์) ต่างกัน 3 จุด:

1. `embedding.service.ts` ย้ายไปอยู่โมดูลกลาง (`embedding/`) เพราะ `symptom-search` กับ `knowledge` ใช้ร่วมกัน
2. เพิ่มกลุ่ม **knowledge** (ingest, chunk) และ **answer** (RAG) ต่อท้ายหลัง backend แบบ FixStep ใช้ได้ครบแล้ว เพื่อให้ได้ "ของที่รันได้" ก่อน แล้วค่อยเพิ่มส่วนที่เสี่ยง
3. ตัด `mockServer.ts` ทำให้ `api/traversal.ts` ไม่ต้องรอ mock (ใน FixStep ต้องมี mock ก่อนจึง `tsc` ผ่าน)

### ⭐ ไฟล์แรกที่ต้องเริ่มพิมพ์: `backend/src/traversal-engine/types.ts`

**เหตุผล (จากกราฟ import จริงของต้นแบบ):**

- ไม่ import อะไรเลย (`import` แบบ relative = 0) จึง `tsc --noEmit` ตรวจได้ทันทีโดยไม่ต้องมีไฟล์อื่น
- เป็นคำศัพท์ที่ไฟล์อื่นพึ่งมากที่สุด: **backend 10 ไฟล์** import ตรง (engine, graph.repository, session.store, traversal.dto, traversal.service, traversal.exception.filter, equipment.repository, symptom-matcher, symptom-search.dto, symptom-search.service) + frontend 2 ไฟล์ (`api/types.ts`, `mockServer.ts` ของเก่า) · โมดูล RAG ใหม่ก็จะ import `DeviceCategory` จากที่นี่
- ถัดไป #02 `traversal-engine.ts` import เฉพาะ `types.ts` และเทสเดิม 86 ข้อ (37 + 4 + 45) ตรวจได้ทันทีโดยไม่ต้องมี DB → ได้ "ด่านตรวจ 1" เร็วที่สุด และวัด k ได้เร็วที่สุด
- ไฟล์ใหม่ที่ไม่มี import (เช่น `chunker.ts`) ก็เริ่มได้ แต่พิมพ์ก่อนไม่ได้ประโยชน์: ยังไม่มีอะไรให้ตรวจร่วมกับของที่ใช้ซ้ำ และเสี่ยงที่สุด (ยังไม่มีการตัดสินใจเรื่อง PDF ที่ §F.3–F.4)

### C.1 รายการ

ป้าย **MUST** = ต้องอธิบายได้ตอนสอบ · **OPT** = ข้ามพิมพ์ได้ (คัดลอกแทน แต่ต้องมีไฟล์ก่อนไปต่อ) · ทุกบรรทัดมี "ขนาดอ้างอิง" และ "เวลา (ค่าประมาณ)" ตามสูตร §0

#### เฟส 1 — Engine · ด่านตรวจ 1: `npx tsc --noEmit` ผ่าน (เทส Jest 86 ข้อ **เลื่อนไปเฟส T**)

- [ ] **01** · MUST · `backend/src/traversal-engine/types.ts` · **ดัดแปลง** · อ้างอิง `types.ts` (156 บรรทัดโค้ด / 266 รวม) · เปลี่ยน: `DeviceCategory` (บรรทัด 104–109 มี `Microwave`; ปรับตามข้อ §F.2) และคอมเมนต์ที่อ้าง "retrieval (Phase 8)" (บรรทัด 141) · ตรวจ: `npx tsc --noEmit` · เวลา ≈ 1.5–2.4 ชม. (ค่าประมาณ)
- [ ] **02** · MUST · `backend/src/traversal-engine/traversal-engine.ts` · **ซ้ำ** · อ้างอิง (181 บรรทัดโค้ด / 261 รวม) · เปลี่ยน: ไม่มี · ตรวจ: `tsc` (เลื่อนเทสไปเฟส T: ภายหลังคัดลอก `traversal-engine.spec.ts` (37 เทส) + `traversal-engine.confidence.spec.ts` (4 เทส) + `path-coverage.spec.ts` (45 เทส) และต้องมี `data/manuals/samsung_ac_ar70h.json` (path-coverage อ่านไฟล์นี้) — ไฟล์นี้คัดลอกมาแล้ว) · เวลา ≈ 2.6–4.3 ชม. (ค่าประมาณ)

#### เฟส 2 — ฐานข้อมูลและชั้นเก็บข้อมูล · ด่านตรวจ 2: `npm run migrate` ครบ 001–005 + `npm run seed` ได้ "13 กราฟ · 95 โหนด" (ตัวเลขนี้คือของ FixStep ตามข้อมูลแอร์ที่คัดลอกมา)

- [ ] **03** · MUST · `backend/migrations/001_create_graph_tables.sql` · **ซ้ำ** · อ้างอิง (98 บรรทัดโค้ด / 131 รวม) · เปลี่ยน: ไม่มี (ตาราง `manuals/graphs/nodes`) · ตรวจ: `npm run migrate` กับ DB ทดลอง + `SHOW CREATE TABLE nodes` · เวลา ≈ 1.3–2.0 ชม. (ค่าประมาณ)
- [ ] **04** · MUST · `backend/migrations/002_create_session_tables.sql` · **ซ้ำ** · อ้างอิง (63 บรรทัดโค้ด / 82 รวม) · เปลี่ยน: ไม่มีทางตรรกะ แต่คอมเมนต์บรรทัด 30 เขียน "2 ชั่วโมง" ขัดกับค่าจริง 24 ชม. ใน `session.store.ts` (ดู §F.13) · เวลา ≈ 1.0–1.4 ชม. (ค่าประมาณ)
- [ ] **05** · OPT · `backend/migrations/003_create_equipment_tables.sql` · **ดัดแปลง** · อ้างอิง (35 บรรทัดโค้ด / 45 รวม) · เปลี่ยน: ENUM ประเภทเครื่อง (มี `Microwave`) ให้ตรง §F.2 · ต้องมีก่อนบูต (`equipment.repository` อ่านตารางนี้) · เวลา ≈ 0.6–0.8 ชม. (ค่าประมาณ)
- [ ] **06** · MUST · `backend/migrations/004_add_session_confidence.sql` · **ซ้ำ** · อ้างอิง (21 บรรทัดโค้ด / 22 รวม) · เปลี่ยน: ไม่มี (คอมเมนต์บรรทัด 3 อ้าง "ขั้น 1.8" ของ FixStep) · เวลา ≈ 0.6–0.8 ชม. (ค่าประมาณ)
- [ ] **07** · MUST · `backend/migrations/005_add_session_outcome.sql` · **ซ้ำ** · อ้างอิง (49 บรรทัดโค้ด / 50 รวม) · ตรวจ: `npm run migrate` ครบ 001–005 · เวลา ≈ 0.9–1.2 ชม. (ค่าประมาณ)
- [ ] **08** · MUST · `backend/src/database/database.constants.ts` · **ซ้ำ** · (1 บรรทัดโค้ด / 17 รวม) · เวลา ≈ 0.4–0.4 ชม. (ค่าประมาณ)
- [ ] **09** · MUST · `backend/src/database/database.module.ts` · **ซ้ำ** · (60 บรรทัดโค้ด / 77 รวม) · ตรวจ: `tsc` (บูตจริงตอนจบเฟส 4) · เวลา ≈ 0.9–1.2 ชม. (ค่าประมาณ)
- [ ] **10** · MUST · `backend/src/traversal/graph.repository.ts` · **ซ้ำ** · (239 บรรทัดโค้ด / 337 รวม) · ไม่มีเทสของไฟล์นี้ (เหมือนต้นแบบ) พิสูจน์ด้วยการบูต · เวลา ≈ 3.3–5.5 ชม. (ค่าประมาณ)
- [ ] **11** · MUST · `backend/src/traversal/session.store.ts` · **ซ้ำ** · (178 บรรทัดโค้ด / 297 รวม) · ไม่มีเทสของไฟล์นี้ · เวลา ≈ 2.6–4.2 ชม. (ค่าประมาณ)

สคริปต์ seed/migrate (คัดลอกแทนพิมพ์ เป็นเครื่องมือ ไม่ใช่ตัวระบบ): `backend/scripts/run-migrations.js` (83 บรรทัดโค้ด / 140 รวม), `seed-graphs.js` (222 บรรทัดโค้ด / 314 รวม), `seed-equipment.js` (209 บรรทัดโค้ด / 265 รวม)

> **จุดตัดสินใจที่ 1:** จบเฟส 2 เทียบเวลาจริงกับช่วงประเมิน ถ้าเกินช่วงบนมาก ให้ตัดขอบเขตเฟส 7 (ตัดไฟล์ OPT)

#### เฟส 3 — ค้นหาอาการเพื่อเลือกผัง · ด่านตรวจ 3: `npx tsc --noEmit` ผ่าน (Jest **เลื่อนไปเฟส T** เทสเดิมที่จะรันตอนนั้น: dto 10 เทส + matcher 19 เทส + service 13 เทส = 42 ข้อ)

- [ ] **12** · MUST · `backend/src/symptom-search/symptom-search.dto.ts` · **ซ้ำ** · (56 บรรทัดโค้ด / 138 รวม) · ตรวจ: `symptom-search.dto.spec.ts` · เวลา ≈ 1.1–1.6 ชม. (ค่าประมาณ)
- [ ] **13** · MUST · `backend/src/symptom-search/symptom-matcher.ts` · **ซ้ำ** · (82 บรรทัดโค้ด / 139 รวม) · ตรวจ: `symptom-matcher.spec.ts` (เทสนี้อ่านไฟล์ข้อมูลแอร์ที่บรรทัด 112) · **ฟังก์ชัน `cosineSimilarity` จะถูกใช้ซ้ำโดย `chunk-matcher.ts` (#36)** · เวลา ≈ 1.4–2.2 ชม. (ค่าประมาณ)
- [ ] **14** · MUST · `backend/src/embedding/embedding.service.ts` · **ดัดแปลง** (ย้ายจาก `symptom-search/`) · อ้างอิง `embedding.service.ts` (49 บรรทัดโค้ด / 91 รวม) · เปลี่ยน: ย้ายโฟลเดอร์ (ลึกเท่าเดิม `src/<โฟลเดอร์>/` เพื่อให้ `path.resolve(__dirname, '../../model-slim')` ที่บรรทัด 30 ยังถูก) ตรรกะไม่เปลี่ยน · ตรวจ: `tsc` (ไม่มีเทส ต้องโหลดโมเดลจริง) · เวลา ≈ 1.0–1.4 ชม. (ค่าประมาณ)
- [ ] **15** · MUST · `backend/src/embedding/embedding.module.ts` · **ใหม่ (เล็ก)** · ขนาดอ้างอิง `graph.module.ts` (7 บรรทัดโค้ด / 24 รวม) · หน้าที่: provide + export `EmbeddingService` ให้ `symptom-search` และ `knowledge` ใช้ตัวเดียวกัน (โหลดโมเดลครั้งเดียว) · เวลา ≈ 0.5–0.5 ชม. (ค่าประมาณ)
- [ ] **16** · MUST · `backend/src/symptom-search/symptom-search.service.ts` · **ดัดแปลง** · อ้างอิง (146 บรรทัดโค้ด / 242 รวม) · เปลี่ยน: path ของ import `embedding.service` (บรรทัด 24–28 ของเก่า) · ตรวจ: `symptom-search.service.spec.ts` (ต้องแก้ import ของเทสด้วย ดู §B) · เวลา ≈ 2.2–3.5 ชม. (ค่าประมาณ)

#### เฟส 4 — REST API ของผังขั้นตอน (ได้ backend เทียบเท่า FixStep) · ด่านตรวจ 4: `npx tsc --noEmit` + บูตได้ + smoke test (Jest 183 ข้อ **เลื่อนไปเฟส T**)

- [ ] **17** · MUST · `backend/src/traversal/traversal.dto.ts` · **ซ้ำ** · (123 บรรทัดโค้ด / 279 รวม) · ตรวจ: `traversal.dto.spec.ts` (15 เทส) · เวลา ≈ 1.9–3.0 ชม. (ค่าประมาณ)
- [ ] **18** · OPT · `backend/src/traversal/equipment.repository.ts` · **ซ้ำ** · (50 บรรทัดโค้ด / 113 รวม) · ต้องมีก่อน #19 · เวลา ≈ 0.9–1.3 ชม. (ค่าประมาณ)
- [ ] **19** · MUST · `backend/src/traversal/traversal.service.ts` · **ซ้ำ** · (130 บรรทัดโค้ด / 252 รวม) · ตรวจ: `traversal.service.spec.ts` (31 เทส; เทสนี้อ่าน `data/manuals/samsung_ac_ar70h.json` และ `data/equipment/equipment.json` และอ้าง graph id `samsung_ac_ar70h_*` บรรทัด 220–222) · **ด่านความปลอดภัยอยู่ที่ไฟล์นี้: เรียก engine ก่อนบันทึกเสมอ** · เวลา ≈ 2.0–3.2 ชม. (ค่าประมาณ)
- [ ] **20** · MUST · `backend/src/traversal/traversal.exception.filter.ts` · **ซ้ำ** · (71 บรรทัดโค้ด / 119 รวม) · ตรวจ: `traversal.exception.filter.spec.ts` (5 เทส) · เวลา ≈ 1.3–1.9 ชม. (ค่าประมาณ)
- [ ] **21** · MUST · `backend/src/traversal/traversal.controller.ts` · **ซ้ำ** · (46 บรรทัดโค้ด / 95 รวม) · ไม่มีเทส · เวลา ≈ 0.8–1.0 ชม. (ค่าประมาณ)
- [ ] **22** · MUST · `backend/src/traversal/graph.module.ts` · **ซ้ำ** · (7 บรรทัดโค้ด / 24 รวม) · เวลา ≈ 0.5–0.5 ชม. (ค่าประมาณ)
- [ ] **23** · OPT · `backend/src/symptom-search/symptom-search.exception.filter.ts` · **ซ้ำ** · (34 บรรทัดโค้ด / 62 รวม) · ตรวจ: `...filter.spec.ts` (4 เทส) · (ไฟล์นี้ import ชนิด `ApiErrorBody` จาก `traversal.exception.filter` จึงต้องมาหลัง #20) · เวลา ≈ 0.7–1.0 ชม. (ค่าประมาณ)
- [ ] **24** · OPT · `backend/src/symptom-search/symptom-search.controller.ts` · **ซ้ำ** · (23 บรรทัดโค้ด / 42 รวม) · เวลา ≈ 0.4–0.6 ชม. (ค่าประมาณ)
- [ ] **25** · MUST · `backend/src/symptom-search/symptom-search.module.ts` · **ดัดแปลง** · (12 บรรทัดโค้ด / 24 รวม) · เปลี่ยน: `imports` เพิ่ม `EmbeddingModule` แทนการ provide `EmbeddingService` เอง (ของเก่าอยู่ในรายการ providers) · เวลา ≈ 0.5–0.6 ชม. (ค่าประมาณ)
- [ ] **26** · MUST · `backend/src/traversal/traversal.module.ts` · **ซ้ำ** · (13 บรรทัดโค้ด / 29 รวม) · เวลา ≈ 0.5–0.6 ชม. (ค่าประมาณ)
- [ ] **27** · OPT · `backend/src/health/health.controller.ts` · **ดัดแปลง** · (26 บรรทัดโค้ด / 39 รวม) · เปลี่ยน: `service: 'fixbot-backend'` (บรรทัด 32) เป็นชื่อโปรเจกต์ใหม่ (ค่านี้เป็นส่วนของ response `/health` ที่หน้าเว็บอ่านหรือไม่ ให้เช็คก่อนเปลี่ยน) · เวลา ≈ 0.5–0.6 ชม. (ค่าประมาณ)
- [ ] **28** · OPT · `backend/src/health/health.module.ts` · **ซ้ำ** · (6 บรรทัดโค้ด / 7 รวม) · เวลา ≈ 0.3–0.3 ชม. (ค่าประมาณ)
- [ ] **29** · MUST · `backend/src/app.module.ts` · **ดัดแปลง** (รอบแรกยังเหมือนเดิม; รอบสองที่ #47 เพิ่มโมดูลใหม่) · (14 บรรทัดโค้ด / 16 รวม) · เวลา ≈ 0.5–0.6 ชม. (ค่าประมาณ)
- [ ] **30** · MUST · `backend/src/main.ts` · **ดัดแปลง** · (14 บรรทัดโค้ด / 18 รวม) · เปลี่ยน: ข้อความ log "FixBot backend running…" (บรรทัด 15) · ตรวจ: `npm run build` + `npm run start` + smoke test (ภาคผนวก ค) · เวลา ≈ 0.5–0.6 ชม. (ค่าประมาณ)

> **จุดเห็นผลที่ 1:** ตอนนี้ backend เท่ากับ FixStep (เฉพาะส่วนผังขั้นตอน) ที่คุณพิมพ์เอง เปิด `frontend` ต้นแบบของ FixStep (ไม่แก้) ชี้ `VITE_API_URL` มาที่ backend ใหม่ได้ (ต้องปิด backend ต้นฉบับก่อน เพราะพอร์ตชน และ `.env` ของต้นฉบับชี้ฐานจริง) เพื่อยืนยันก่อนเริ่มส่วนเสี่ยง · **จุดตัดสินใจที่ 2:** จบเฟส 4 → ตัดสินใจ §F.1–F.4 ให้เรียบร้อยก่อนเริ่มเฟส 5

#### เฟส 5 — Knowledge: ingest PDF → chunk → ดัชนีในหน่วยความจำ (**ใหม่ทั้งหมด**)

> ไม่มีไฟล์เก่าให้เทียบตรงๆ ชุดหลักการอ้างอิงจากของเก่า: `graph.repository.ts` (โหลดทั้งหมดตอนบูต), `symptom-search.service.ts` (สร้างดัชนี + สถานะ), `symptom-matcher.ts` (ฟังก์ชันล้วน + cosine), `seed-graphs.js` (นำเข้าแบบ upsert) · ตัวอย่างรูปร่างข้อมูล chunk ที่มีอยู่แล้วในต้นแบบ: `data/chunks/manual_samsung_Air_conditioner_AR70H_troubleshooting.json` (13 chunk) และ `manual_Samsung_WashingMachine_OID84209.json` (29 chunk) ฟิลด์: `chunk_id, device_category, brand, model, source, page, content, metadata{symptom, possible_cause, solution, severity, difficulty, safety_warning}` (ไฟล์เครื่องซักผ้ามี `embedding` และ `created_at` เพิ่มด้วย) — เป็น chunk **ระดับ "อาการ"** ไม่ใช่ข้อความดิบรายหน้า (ดู D.1)

- [ ] **31** · MUST · `backend/migrations/006_create_manual_chunks.sql` · **ใหม่** · ขนาดอ้างอิง `002_create_session_tables.sql` (63 บรรทัดโค้ด / 82 รวม) · หน้าที่: ตารางเก็บ chunk (id, manual_id → FK `manuals`, เลขหน้า, ลำดับใน หน้า, ข้อความ, metadata ที่ต้องแสดง เช่น คำเตือนความปลอดภัย) **ไม่เก็บเวกเตอร์** ตามที่คุณเลือก (embed ตอนบูต) · ตรวจ: `npm run migrate` + `SHOW CREATE TABLE` · เวลา ≈ 1.2–1.9 ชม. (ค่าประมาณ)
- [ ] **32** · MUST · `backend/src/ingest/chunker.ts` (+ `chunker.spec.ts`) · **ใหม่** · ขนาดอ้างอิง `symptom-matcher.ts` (82 บรรทัดโค้ด / 139 รวม) · ฟังก์ชันล้วน: ข้อความราย "หน้า" เข้า → chunk ออก (ขนาดและการซ้อนทับ ดู D.1, §F.4) · เวลา ≈ 2.3–3.4 ชม. (ค่าประมาณ)
- [ ] **33** · MUST · `backend/src/ingest/pdf-text.ts` · **ใหม่** · ขนาดอ้างอิง `embedding.service.ts` (49 บรรทัดโค้ด / 91 รวม) · ดึงข้อความจาก PDF แยกตามเลขหน้า (ไลบรารีที่ใช้ **ยังไม่ตัดสินใจ** §F.3) · เวลา ≈ 1.2–1.9 ชม. (ค่าประมาณ)
- [ ] **34** · MUST · `backend/src/knowledge/chunk.repository.ts` · **ใหม่** · ขนาดอ้างอิง `graph.repository.ts` (239 บรรทัดโค้ด / 337 รวม) · โหลด chunk ทั้งหมดจาก MySQL ตอนบูต · เวลา ≈ 4.5–7.9 ชม. (ค่าประมาณ)
- [ ] **35** · MUST · `backend/scripts/ingest-manuals.js` (หรือ `.ts` ตาม §F.3) · **ใหม่** · ขนาดอ้างอิง `seed-graphs.js` (222 บรรทัดโค้ด / 314 รวม) · รัน: PDF → chunker → upsert ลง MySQL (upsert ด้วยเหตุผลเดียวกับ seed-graphs: ไม่ลบข้อมูลที่ถูกอ้างอยู่) · เวลา ≈ 4.2–7.4 ชม. (ค่าประมาณ)
- [ ] **36** · MUST · `backend/src/knowledge/chunk-matcher.ts` (+ spec) · **ใหม่** · ขนาดอ้างอิง `symptom-matcher.ts` (82 บรรทัดโค้ด / 139 รวม) · ฟังก์ชันล้วน: จัดอันดับ chunk ด้วย cosine (import `cosineSimilarity` จาก #13) + กรองตามประเภท/รุ่น + เลือก top-k ที่ผ่านเกณฑ์ · เวลา ≈ 2.3–3.4 ชม. (ค่าประมาณ)
- [ ] **37** · MUST · `backend/src/knowledge/knowledge-index.service.ts` (+ spec แบบตัวแปลงข้อความปลอม) · **ใหม่** · ขนาดอ้างอิง `symptom-search.service.ts` (146 บรรทัดโค้ด / 242 รวม) · สร้างดัชนี chunk ตอนบูต (ไม่รอ: ใช้ pattern `onApplicationBootstrap(): void` เดียวกับของเก่า) · สถานะ `disabled/loading/ready/failed` · เวลา ≈ 3.7–5.8 ชม. (ค่าประมาณ)
- [ ] **38** · MUST · `backend/src/knowledge/knowledge.module.ts` · **ใหม่** · ขนาดอ้างอิง `symptom-search.module.ts` (12 บรรทัดโค้ด / 24 รวม) · เวลา ≈ 0.5–0.6 ชม. (ค่าประมาณ)

> **จุดเห็นผลที่ 2:** รัน `ingest` กับ PDF จริง 1 เล่ม → ดูแถวใน `manual_chunks` → บูต → `GET .../status` ว่าดัชนีพร้อมและจำนวน chunk ตรงกับตาราง **วัดเวลาโหลดดัชนีบนเครื่องคุณจริง** (โค้ด embed ทีละข้อความ ที่ `symptom-search.service.ts:160–162` จึงเวลาโตตามจำนวน chunk)

#### เฟส 6 — Answer: RAG + ด่านกันแต่งคำตอบ (**ใหม่ทั้งหมด**)

- [ ] **39** · MUST · `backend/src/answer/prompt-builder.ts` (+ spec) · **ใหม่** · ขนาดอ้างอิง `symptom-search.dto.ts` (56 บรรทัดโค้ด / 138 รวม) · ฟังก์ชันล้วน: คำถาม + chunk → ข้อความที่ส่ง LLM (D.4) · เวลา ≈ 1.7–2.5 ชม. (ค่าประมาณ)
- [ ] **40** · MUST · `backend/src/answer/grounding-guard.ts` (+ spec) · **ใหม่** · ขนาดอ้างอิง `symptom-matcher.ts` (82 บรรทัดโค้ด / 139 รวม) · ฟังก์ชันล้วน: ตัดสินว่า "ตอบ / ปฏิเสธ" จากคะแนน และประกอบแหล่งอ้างอิงจาก metadata (D.5–D.7) · เวลา ≈ 2.3–3.4 ชม. (ค่าประมาณ)
- [ ] **41** · MUST · `backend/src/answer/llm.client.ts` · **ใหม่** · ขนาดอ้างอิง `embedding.service.ts` (49 บรรทัดโค้ด / 91 รวม) (ตัวห่อไลบรารีภายนอก) · ห่อไคลเอนต์เรียก Groq (ไลบรารี/วิธีเรียกยังไม่ตัดสินใจ §F.9) ให้ service ฉีดตัวปลอมในเทสได้ (D.8) · เวลา ≈ 1.2–1.9 ชม. (ค่าประมาณ)
- [ ] **42** · MUST · `backend/src/answer/answer.dto.ts` (+ spec) · **ใหม่** · ขนาดอ้างอิง `symptom-search.dto.ts` (56 บรรทัดโค้ด / 138 รวม) (ตัวตรวจ body + ชนิด response) · เวลา ≈ 1.7–2.5 ชม. (ค่าประมาณ)
- [ ] **43** · MUST · `backend/src/answer/answer.service.ts` (+ spec ด้วย llm ปลอม) · **ใหม่** · ขนาดอ้างอิง `traversal.service.ts` (130 บรรทัดโค้ด / 252 รวม) (ต่อชิ้นส่วน ไม่มีตรรกะของตัวเอง) · เวลา ≈ 3.4–5.2 ชม. (ค่าประมาณ)
- [ ] **44** · MUST · `backend/src/answer/answer.exception.filter.ts` (+ spec) · **ใหม่** · ขนาดอ้างอิง `symptom-search.exception.filter.ts` (34 บรรทัดโค้ด / 62 รวม) · เวลา ≈ 1.2–1.7 ชม. (ค่าประมาณ)
- [ ] **45** · OPT · `backend/src/answer/answer.controller.ts` · **ใหม่** · ขนาดอ้างอิง `symptom-search.controller.ts` (23 บรรทัดโค้ด / 42 รวม) · เวลา ≈ 0.5–0.7 ชม. (ค่าประมาณ)
- [ ] **46** · OPT · `backend/src/answer/answer.module.ts` · **ใหม่** · ขนาดอ้างอิง `symptom-search.module.ts` (12 บรรทัดโค้ด / 24 รวม) · เวลา ≈ 0.4–0.5 ชม. (ค่าประมาณ)
- [ ] **47** · MUST · `backend/src/app.module.ts` (รอบสอง) · เพิ่ม `KnowledgeModule`, `AnswerModule` ใน `imports` · ตรวจ: `npx jest` ทั้งหมด + บูต + smoke ถามตอบ (D.8) · เวลา ≈ 0.2–0.5 ชม. (ค่าประมาณ)

> **ด่านตรวจ 5 (backend ครบ):** `npx tsc --noEmit` ผ่าน + บูตได้ + smoke test ถามตอบ (เทสเดิม 183 ข้อและเทสใหม่ของ #32, 36, 37, 39, 40, 42, 43, 44 เลื่อนไปเฟส T · จำนวนเทสใหม่ **ยังไม่มีตัวเลข** จะรู้เมื่อเขียนเสร็จ)

#### เฟส 7 — Frontend · ด่านตรวจ 6: `npx tsc -b` + `npm run build` ผ่าน (`npm test` **เลื่อนไปเฟส T** เทสเดิมที่ยังใช้ได้: 56 ข้อ ไม่รวม `mockServer.test.ts` ที่ตัด)

**0B — ตั้งต้น frontend** ดู §E.3 (ทำก่อน #48)

- [ ] **48** · MUST · `frontend/src/api/types.ts` · **ดัดแปลง** · (64 บรรทัดโค้ด / 167 รวม) · เปลี่ยน: เพิ่มชนิดของคำตอบ RAG (answer, citation, confidence) · ไฟล์เก่า import ตรงจาก `../../../backend/src/traversal-engine/types` (จุดเดียวของ frontend ปกติ) · ตรวจ: `npx tsc -b` · เวลา ≈ 0.9–1.2 ชม. (ค่าประมาณ)
- [ ] **49** · MUST · `frontend/src/api/http.ts` · **ซ้ำ** · (53 บรรทัดโค้ด / 90 รวม) · ตรวจ: `http.test.ts` (5 เทส) · เวลา ≈ 1.0–1.4 ชม. (ค่าประมาณ)
- [ ] **50** · MUST · `frontend/src/lib/outcome.ts` · **ซ้ำ** · (14 บรรทัดโค้ด / 47 รวม) · `outcome.test.ts` (9 เทส) · เวลา ≈ 0.5–0.7 ชม. (ค่าประมาณ)
- [ ] **51** · MUST · `frontend/src/lib/errors.ts` · **ดัดแปลง** · (112 บรรทัดโค้ด / 168 รวม) · เปลี่ยน: เพิ่ม `case` ของรหัส error ใหม่ของ endpoint ถามตอบ (เช่น ปฏิเสธเพราะคะแนนต่ำ, LLM ไม่พร้อม — รหัสจริงกำหนดตอน #44) · `errors.test.ts` (21 เทส) ต้องเพิ่มเคส · เวลา ≈ 1.6–2.5 ชม. (ค่าประมาณ)
- [ ] (คัดลอก `frontend/src/mocks/fixtures.ts` (48 บรรทัดโค้ด / 72 รวม) — `trail.test.ts` และ HomePage ใช้)
- [ ] **52** · MUST · `frontend/src/lib/trail.ts` · **ซ้ำ** · (25 บรรทัดโค้ด / 59 รวม) · `trail.test.ts` (6 เทส) · เวลา ≈ 0.7–0.9 ชม. (ค่าประมาณ)
- [ ] **53** · OPT · `frontend/src/lib/reference.ts` · **ซ้ำ** · (11 บรรทัดโค้ด / 38 รวม) · `reference.test.ts` (4 เทส) · เวลา ≈ 0.4–0.5 ชม. (ค่าประมาณ)
- [ ] **54** · OPT · `frontend/src/lib/symptoms.ts` · **ซ้ำ** · (33 บรรทัดโค้ด / 80 รวม) · `symptoms.test.ts` (5 เทส) · เวลา ≈ 0.6–0.9 ชม. (ค่าประมาณ)
- [ ] **55** · OPT · `frontend/src/lib/search.ts` · **ซ้ำ** · (14 บรรทัดโค้ด / 43 รวม) · `search.test.ts` (6 เทส) · เวลา ≈ 0.4–0.5 ชม. (ค่าประมาณ)
- [ ] **56** · OPT · `frontend/src/lib/labels.ts` · **ดัดแปลง** · (27 บรรทัดโค้ด / 72 รวม) · เปลี่ยน: ป้ายประเภทเครื่อง (บรรทัด 24 มี `Microwave`) ตาม §F.2 · เวลา ≈ 0.5–0.8 ชม. (ค่าประมาณ)
- [ ] **57** · MUST · `frontend/src/lib/citation.ts` (+ test) · **ใหม่** · ขนาดอ้างอิง `lib/reference.ts` (11 บรรทัดโค้ด / 38 รวม) · ฟังก์ชันล้วนจัดข้อความอ้างอิง (ชื่อคู่มือ + หน้า) จากรายการ citation ของ backend · เวลา ≈ 0.6–0.8 ชม. (ค่าประมาณ)
- [ ] **58** · MUST · `frontend/src/api/traversal.ts` · **ดัดแปลง** · (78 บรรทัดโค้ด / 134 รวม) · เปลี่ยน: **ลบสาขา mock** (`VITE_USE_MOCK` ที่บรรทัด 40, 56, 68, 85, 97, 115, 127 และ `import('../mocks/mockServer')`) + เพิ่มฟังก์ชันเรียก endpoint ถามตอบ · เวลา ≈ 1.2–1.9 ชม. (ค่าประมาณ)
- [ ] **59** · MUST · `frontend/src/api/queries.ts` · **ดัดแปลง** · (83 บรรทัดโค้ด / 162 รวม) · เปลี่ยน: ตัด `enabled: VITE_USE_MOCK !== 'true'` (บรรทัด 45) + เพิ่ม mutation ถามตอบ (ใช้ `useMutation` ด้วยเหตุผลเดียวกับการค้นหาของเก่า: ทำเมื่อผู้ใช้กด และไม่ควรจำผลเก่า) · เวลา ≈ 1.3–2.0 ชม. (ค่าประมาณ)

คัดลอกก่อนเฟส 7 ส่วนกล่อง: `components/ui/Icon.tsx` (145 บรรทัดโค้ด / 172 รวม), `Button.tsx` (41 บรรทัดโค้ด / 47 รวม), `Notice.tsx` (31 บรรทัดโค้ด / 54 รวม)

- [ ] **60** · MUST · `frontend/src/components/step/stepProps.ts` · **ซ้ำ** · (7 บรรทัดโค้ด / 24 รวม) · เวลา ≈ 0.5–0.5 ชม. (ค่าประมาณ)
- [ ] **61** · OPT · `.../step/ReferenceLine.tsx` · **ซ้ำ** · (26 บรรทัดโค้ด / 42 รวม) · เวลา ≈ 0.5–0.7 ชม. (ค่าประมาณ)
- [ ] **62** · OPT · `.../step/StepCard.tsx` · **ซ้ำ** · (45 บรรทัดโค้ด / 73 รวม) · เวลา ≈ 0.7–1.0 ชม. (ค่าประมาณ)
- [ ] **63** · OPT · `.../step/CheckpointStep.tsx` · **ซ้ำ** · (36 บรรทัดโค้ด / 45 รวม) · เวลา ≈ 0.6–0.9 ชม. (ค่าประมาณ)
- [ ] **64** · OPT · `.../step/InstructionStep.tsx` · **ซ้ำ** · (21 บรรทัดโค้ด / 29 รวม) · เวลา ≈ 0.4–0.6 ชม. (ค่าประมาณ)
- [ ] **65** · MUST · `.../step/SafetyGateStep.tsx` · **ซ้ำ** · (48 บรรทัดโค้ด / 74 รวม) · เวลา ≈ 0.9–1.2 ชม. (ค่าประมาณ)
- [ ] **66** · OPT · `.../step/OutcomeStep.tsx` · **ซ้ำ** · (44 บรรทัดโค้ด / 71 รวม) · เวลา ≈ 0.7–1.0 ชม. (ค่าประมาณ)
- [ ] **67** · OPT · `.../step/InputStep.tsx` · **ซ้ำ** · (49 บรรทัดโค้ด / 78 รวม) · เวลา ≈ 0.7–1.1 ชม. (ค่าประมาณ)
- [ ] **68** · MUST · `.../step/StepView.tsx` · **ซ้ำ** · (34 บรรทัดโค้ด / 64 รวม) · เวลา ≈ 0.7–1.0 ชม. (ค่าประมาณ)
- [ ] **69** · MUST · `frontend/src/components/OutcomeForm.tsx` · **ซ้ำ** · (102 บรรทัดโค้ด / 143 รวม) · เวลา ≈ 1.4–2.1 ชม. (ค่าประมาณ)
- [ ] **70** · OPT · `SessionHeader.tsx` (46 บรรทัดโค้ด / 54 รวม) + `TerminalActions.tsx` (23 บรรทัดโค้ด / 31 รวม) + `SessionErrorNotice.tsx` (35 บรรทัดโค้ด / 48 รวม) · **ซ้ำ** · เวลา ≈ 1.2–2.0 ชม. (ค่าประมาณ)
- [ ] **71** · MUST · `frontend/src/components/CitationList.tsx` · **ใหม่** · ขนาดอ้างอิง `ReferenceLine.tsx` (26 บรรทัดโค้ด / 42 รวม) · แสดงรายการอ้างอิง (ชื่อคู่มือ + หน้า) · เวลา ≈ 0.7–1.0 ชม. (ค่าประมาณ)
- [ ] **72** · MUST · `frontend/src/components/AnswerPanel.tsx` · **ใหม่** · ขนาดอ้างอิง `OutcomeForm.tsx` (102 บรรทัดโค้ด / 143 รวม) (ฟอร์ม + สถานะ + error) · แสดงคำตอบ + คะแนน + รายการอ้างอิง หรือข้อความปฏิเสธ · เวลา ≈ 1.8–2.9 ชม. (ค่าประมาณ)

คัดลอกก่อน #73: `components/EquipmentPanel.tsx` (76 บรรทัดโค้ด / 107 รวม), `components/step/PathRail.tsx` (68 บรรทัดโค้ด / 113 รวม)

- [ ] **73** · MUST · `frontend/src/pages/SessionPage.tsx` · **ซ้ำ** · (160 บรรทัดโค้ด / 236 รวม) · เวลา ≈ 1.9–3.1 ชม. (ค่าประมาณ)

คัดลอกก่อน #74: `SymptomRow.tsx` (61 บรรทัดโค้ด / 87 รวม), `SymptomSearchForm.tsx` (53 บรรทัดโค้ด / 69 รวม), `SymptomSearchResults.tsx` (46 บรรทัดโค้ด / 61 รวม)

- [ ] **74** · OPT · `frontend/src/pages/SymptomsPage.tsx` · **ซ้ำ** · (160 บรรทัดโค้ด / 235 รวม) · เวลา ≈ 1.8–2.9 ชม. (ค่าประมาณ)
- [ ] **75** · MUST · `frontend/src/pages/AskPage.tsx` · **ใหม่** · ขนาดอ้างอิง `SymptomsPage.tsx` (160 บรรทัดโค้ด / 235 รวม) (หน้าที่มีช่องพิมพ์ + เรียก mutation + แสดงผล) · เวลา ≈ 2.5–4.3 ชม. (ค่าประมาณ)

คัดลอก/ดัดแปลงก่อน #76: `components/layout/AppShell.tsx` (63 บรรทัดโค้ด / 95 รวม; **แก้** `APP_NAME = 'FixStep'` บรรทัด 21 และคอมเมนต์บรรทัด 17–18), `ServerStatus.tsx` (37 บรรทัดโค้ด / 60 รวม), `pages/HomePage.tsx` (102 บรรทัดโค้ด / 165 รวม; **แก้** ข้อความบรรทัด 96 "ไม่ได้ให้ AI เดาเอาเอง" ซึ่งไม่จริงแล้วสำหรับโปรเจกต์ใหม่ + ตัวอย่าง Samsung AR70H บรรทัด 59–60 ถ้าเปลี่ยนข้อมูล), `pages/NotFoundPage.tsx` (23 บรรทัดโค้ด / 35 รวม)

- [ ] **76** · MUST · `frontend/src/App.tsx` · **ดัดแปลง** · (32 บรรทัดโค้ด / 48 รวม) · เปลี่ยน: เพิ่ม route `/ask` · เวลา ≈ 0.7–1.0 ชม. (ค่าประมาณ)
- [ ] **77** · MUST · `frontend/src/main.tsx` · **ซ้ำ** · (9 บรรทัดโค้ด / 10 รวม) · ตรวจ: `npm run build` + `npm test` + ลองจริงกับ backend (ผัง → ด่านคำเตือน → จบ → บันทึกผล และหน้าถามตอบ) · เวลา ≈ 0.5–0.6 ชม. (ค่าประมาณ)

#### เฟส 8 — Deploy · **ยังไม่ตัดสินใจ** (ผู้ให้บริการ/โฮสต์ยังไม่ได้คุย) §F.11 — เอกสารนี้ไม่ใส่ขั้นตอน deploy เพราะ stack ส่วนนี้ผมไม่ได้รับคำตอบ

#### เฟส T — เทส (เลื่อนมาทำท้ายสุด ตามข้อตกลง §0 ข้อ 7)

ทำเมื่อเฟส 1–7 พิมพ์ครบและ `tsc`/บูต/smoke test ผ่านแล้ว ลำดับ: **(1) เทสเดิมที่คัดลอกได้** (ไม่ต้องพิมพ์ ใช้เป็นเฉลย) → **(2) เทสของไฟล์ใหม่** (ต้องเขียนเอง)

- [ ] **T1** · คัดลอกเทส backend เดิม 10 ไฟล์ (183 ข้อ) ไปไว้โฟลเดอร์เดียวกับไฟล์ที่ทดสอบ แก้ path import ของ `symptom-search.service.spec.ts` (ย้าย `embedding.service`) แล้ว `npx jest` · ถ้ามีข้อพัง ให้ไล่ดูทีละข้อ เพราะอาจเป็นบั๊กที่พิมพ์ผิดตอนเฟส 1–4 (ผลที่ต้องการ: 183 ผ่าน เท่ากับต้นแบบ ยกเว้นข้อที่เกี่ยวกับค่าที่คุณเปลี่ยนเอง เช่น ตัด `Microwave`)
- [ ] **T2** · คัดลอกเทส frontend เดิม 7 ไฟล์ (ไม่รวม `mockServer.test.ts`) แล้ว `npm test` (ผลที่ต้องการ 56 ผ่าน หลังแก้ `errors.test.ts` ให้ตรงรหัส error ใหม่)
- [ ] **T3** · เขียนเทสของไฟล์ใหม่: `chunker`, `chunk-matcher`, `knowledge-index.service`, `prompt-builder`, `grounding-guard`, `answer.dto`, `answer.service` (ใช้ llm ปลอม), `answer.exception.filter`, `lib/citation` · ทุกเคสต้องอธิบายได้
- เวลา: T1–T2 ≈ 1–2 ชม. (คัดลอก + แก้ path + ไล่ข้อที่พัง · ค่าประมาณ ไม่ได้วัด) · T3 ≈ **3.9 ชม.** (ค่าประมาณ: ส่วนของเวลาเขียนเทสที่ถูกนับรวมอยู่ในช่วงเวลาของไฟล์ใหม่ใน §C.1 ตามตัวคูณ 1.6–2.6 เทียบกับ 1.2–2.2 ของไฟล์ใหม่ที่ไม่มีเทส · ตัวเลขนี้ **ย้ายมาทีหลัง ไม่ได้หายไป**)

### C.2 สรุปเวลา (ค่าประมาณ ตามสูตร §0)

| ส่วน | MUST (ไฟล์) | ชม. MUST (ช่วง) | OPT (ไฟล์) | ชม. OPT (ช่วง) |
|---|--:|--:|--:|--:|
| เฟส 0 ตั้งต้น (§E) | — | ≈ 4–7 (ประมาณจาก FixStep 4.7) | — | — |
| เฟส 1 Engine | 2 | 4.1–6.6 | 0 | 0.0–0.0 |
| เฟส 2 ฐานข้อมูล/ชั้นเก็บข้อมูล | 8 | 10.9–16.8 | 1 | 0.6–0.8 |
| เฟส 3 ค้นหาอาการ→ผัง | 5 | 6.1–9.3 | 0 | 0.0–0.0 |
| เฟส 4 REST ของผัง (backend เท่า FixStep) | 9 | 8.4–12.0 | 5 | 2.7–3.8 |
| เฟส 5 Knowledge (ingest/chunk/ดัชนี) | 8 | 20.0–32.5 | 0 | 0.0–0.0 |
| เฟส 6 Answer (RAG + ด่านกันแต่ง) | 7 | 11.6–17.7 | 2 | 0.9–1.2 |
| เฟส 7 Frontend | 18 | 19.4–28.9 | 12 | 8.5–12.7 |
| **รวมเฟส 1–7** | | **80.5–123.8** | | 12.6–18.5 |
| **MUST + เฟส 0 + อ่านเทส/เอกสาร 4 + ซ้อมตอบ 6** | | **≈ 94.5–140.8** | | (OPT ถ้าพิมพ์ครบ บวกอีก 12.6–18.5) |

- รวมงานที่ไม่ใช่การพิมพ์ (ประเมินคร่าวๆ จากของเก่า ไม่ใช่ค่าที่วัด): อ่านเทส/เอกสาร ≈ 4 ชม. · ซ้อมตอบปากเปล่า ≈ 6 ชม. (สองตัวเลขนี้คือที่ ROADMAP เก่าของ FixStep ตั้งไว้ ผมไม่มีข้อมูลใหม่ที่ดีกว่า) · เขียนเทสของไฟล์ใหม่รวมอยู่ในช่วงเวลาของไฟล์ (ตัวคูณ 1.6–2.6) ซึ่งตอนนี้ **เลื่อนไปทำที่เฟส T** (ประมาณ 3.9 ชม. ของช่วงเวลา MUST ข้างบนคือเวลาเขียนเทส ไม่ใช่เวลาพิมพ์ไฟล์) · ตั้งต้นโปรเจกต์ (เฟส 0) ดู §E · **ไม่รวม** การหา/เตรียม PDF, การตั้งชุดคำถามวัดผล (D.9), เฟส 8
- ถ้าเวลาไม่พอ ลำดับตัดตามแบบ FixStep: ตัดไฟล์ OPT ก่อน (คัดลอกแทน) แล้วตัดเฟส 7 ส่วน UI ของกล่องขั้นตอนที่ไม่ใช่ SafetyGate · **เฟส 5–6 (ส่วนใหม่) ไม่ควรตัด** เพราะเป็นหัวใจที่อาจารย์ถาม

---

## D. ส่วนที่ต้องเขียนใหม่ทั้งหมด (แนวคิดและคำถามอาจารย์)

ไม่มีโค้ดในส่วนนี้ รูปแบบ: แนวคิด → ทางเลือกที่ผมแนะนำ → **คำถามอาจารย์** → ข้อจำกัดที่ต้องพูดเอง · ข้อที่เป็นข้อเสนอของผม (ไม่ใช่สิ่งที่คุณตัดสินใจแล้ว) ติดป้าย **[ข้อเสนอ]**

### D.1 การ ingest และ chunking ของคู่มือ

- **แนวคิด:** PDF → ข้อความรายหน้า (เก็บเลขหน้าไว้เสมอ เพราะต้องอ้างหน้า) → แบ่งเป็น chunk → เก็บ `(manual, หน้า, ลำดับ, ข้อความ)` ลง MySQL **ทำนอกเวลาตอบผู้ใช้** (สคริปต์ ไม่ใช่ endpoint) แบบเดียวกับ `seed-graphs.js`
- **สิ่งที่ผมพบในข้อมูลเก่า (ใช้ตัดสินใจได้):** chunk ที่มีอยู่แล้วใน `data/chunks/` เป็น chunk ระดับ "แถวของตารางแก้ปัญหา" 1 chunk ต่อ 1 อาการ (แอร์ 13 chunk หน้า 43–44 ตาม `data/INDEX.md`; เครื่องซักผ้า 29 chunk กระจาย **5 หน้า** เนื้อเฉลี่ยราว 356 ตัวอักษรต่อ chunk — ผมคำนวณจากไฟล์ `manual_Samsung_WashingMachine_OID84209.json`) ดังนั้นหนังสือคู่มือ PDF ดิบ **จะได้ chunk คนละแบบ** — ต้องตัดสินใจ §F.4 ว่าจะ chunk ตามหน้า/ย่อหน้า/หัวข้อ
- **[ข้อเสนอ]** chunk ต้องไม่ข้ามหน้า (ไม่งั้นอ้างหน้าไม่ได้) เก็บ `page` ต่อ chunk · ตารางแก้ปัญหา (symptom → cause → solution) ควรอยู่ใน chunk เดียวกัน ไม่ถูกตัดกลางแถว · ข้อความ "คำเตือนความปลอดภัย" ต้องไม่ถูกตัดแยกจากขั้นตอนที่มันเตือน
- **คำถามอาจารย์:** (1) ทำไมแบ่ง chunk ขนาดนี้ มีผลต่อคุณภาพการค้นหาอย่างไร? (2) ทำไมไม่ให้ LLM อ่าน PDF ทั้งเล่ม? (ต้นทุน ความช้า ข้อจำกัด context และอ้างหน้าไม่แน่นอน) (3) PDF ที่เป็นภาพสแกน/ตาราง/รูป ทำอย่างไร? (4) ข้อความภาษาอังกฤษแต่ผู้ใช้ถามไทย ทำอย่างไร? (D.2)
- **ข้อจำกัดที่ต้องพูดเอง:** ตัวดึงข้อความจาก PDF ทำตารางและเลย์เอาต์หลายคอลัมน์เพี้ยนได้ ต้องสุ่มตรวจด้วยตา

### D.2 Embedding ของ chunk

- **แนวคิด:** ใช้โมเดลเดิม (MiniLM 384 มิติ, mean pooling + normalize, `embedding.service.ts`) กับ **ข้อความ chunk** แทนข้อความอาการสั้นๆ; embed ตอนบูตแล้วเก็บในหน่วยความจำ (ตามที่คุณเลือก) · เวกเตอร์ normalize แล้ว แต่โค้ดเดิมยังหาร norm ใน cosine (`symptom-matcher.ts:67–68`) ผลถูกต้องทั้งสองกรณี
- **ความเสี่ยงที่ต้องวัด ไม่ใช่เดา:** (ก) `tokenizer_config.json` ของโมเดลในโปรเจกต์ระบุ `model_max_length: 512` แต่ข้อความที่ยาวเกินความยาวที่โมเดลถูกฝึกอาจถูกตัดทิ้งเงียบๆ (ผมไม่ได้ตรวจในโค้ดว่า `embedding.service.ts` ตั้ง truncation หรือไม่ — ไฟล์เรียก `extractor(text, {pooling, normalize})` อย่างเดียว บรรทัด 85–88) → ต้องวัดว่า chunk ขนาดเท่าไรยังคงความหมาย (§F.5) (ข) คู่มืออังกฤษ vs คำถามไทย: โมเดลเป็น multilingual จึงค้นข้ามภาษาได้ในทางทฤษฎี แต่ **คุณภาพจริงยังไม่ได้วัด** (ค) embed ทีละข้อความ เวลาบูตโตตามจำนวน chunk (`symptom-search.service.ts:160–162`)
- **คำถามอาจารย์:** (1) embedding คืออะไร ทำไมใช้ cosine? (ตอบได้จากเฟส 3) (2) ทำไมไม่เก็บเวกเตอร์ใน DB? — เลือกในหน่วยความจำเพราะหลักเดียวกับ FixStep (MySQL ที่ใช้ไม่มีชนิดเวกเตอร์ ตามเอกสารเก่า §2.6) แต่ **จำนวน chunk จะมากกว่ามาก** จึงเป็นข้อเสี่ยงที่ต้องวัดเวลาบูตและหน่วยความจำ (3) โมเดลเดียวกันใช้ทั้งค้นผังและค้น chunk ได้ไหม? ได้ ดัชนีแยกกัน
- **ข้อจำกัดที่ต้องพูดเอง:** ถ้าเปลี่ยนโมเดล embedding ต้อง embed ใหม่ทั้งหมด และ `cosineSimilarity` โยน error ถ้ามิติไม่ตรง (`symptom-matcher.ts:52–56`)

### D.3 Retrieval (ดึง chunk)

- **แนวคิด:** embed คำถาม → cosine กับทุก chunk (เฉพาะประเภท/ยี่ห้อ/รุ่นที่ผู้ใช้เลือกถ้ามี) → เรียง → เอา top-k ที่ผ่านเกณฑ์ · ใช้หลักเดียวกับ `rankGraphs` + `selectMatches` แต่ผลคือ chunk ไม่ใช่ผัง
- **[ข้อเสนอ]** ให้ผลการค้นหากลับไปถึงผังได้: ในข้อมูลเก่า ผังทุกอันมี `source_chunk_id` ที่ตรงกับ `chunk_id` ของ chunk (ผมตรวจ: แอร์ 13/13, เครื่องซักผ้า 29/29) จึงเชื่อม "chunk ที่ตรง → ผังที่ควรเริ่ม" ได้ — **ถ้า chunk ใหม่จาก PDF ใช้ `chunk_id` รูปแบบต่างจากเดิม ลิงก์นี้จะขาด** (§F.6)
- **คำถามอาจารย์:** (1) top-k เลือกอย่างไร? (2) ถ้าคำตอบอยู่ข้าม chunk ทำอย่างไร? (3) ทำไมไม่ใช้คำค้นแบบ keyword (BM25)? (ไม่ได้ใช้ ยังไม่ได้เปรียบเทียบ — ต้องตอบตามจริง)
- **ข้อจำกัดที่ต้องพูดเอง:** ค้นด้วยความหมายอย่างเดียว คำที่เฉพาะเจาะจง (รหัส error เช่น E1, ตัวเลขรุ่น) อาจหลุด

### D.4 Prompt

- **แนวคิด:** ส่งให้ LLM 3 อย่าง: คำสั่งระบบ (บทบาท กฎการตอบ), chunk ที่ดึงมา (แต่ละอันมีรหัสอ้างอิง), คำถามผู้ใช้ · กฎ: ตอบเฉพาะจากข้อความที่ให้ · ถ้าไม่มีคำตอบในข้อความให้บอกว่าไม่พบ ห้ามเดา · ตอบเป็นภาษาไทย (คู่มือเป็นอังกฤษ → มีความเสี่ยงแปลผิด §F.5) · **ข้อความ chunk และคำถามผู้ใช้เป็นข้อมูล ไม่ใช่คำสั่ง** ต้องแยกให้ชัดใน prompt (กัน prompt injection จากข้อความใน PDF/คำถาม)
- **[ข้อเสนอ]** prompt สร้างด้วยฟังก์ชันล้วน (`prompt-builder.ts`) เทสได้โดยไม่เรียก API
- **คำถามอาจารย์:** (1) prompt นี้กัน LLM แต่งคำตอบได้จริงหรือ? (ตอบ: **ไม่รับประกัน** prompt เป็นแค่ด่านหนึ่ง D.5) (2) prompt injection คืออะไร กันอย่างไร? (3) ทำไมต้องกำหนดรูปแบบคำตอบ?

### D.5 การกัน LLM แต่งคำตอบ (หลายด่าน)

| ด่าน | ทำอะไร | สถานะ |
|---|---|---|
| 1. **ปฏิเสธก่อนเรียก LLM** | ถ้า chunk ที่คล้ายที่สุดมีคะแนนต่ำกว่าเกณฑ์ → ตอบว่า "ไม่พบในคู่มือ" ไม่เรียก LLM | **คุณเลือกแล้ว** |
| 2. **ตอบเฉพาะจาก chunk** | prompt บังคับ (D.4) | **คุณเลือกแล้ว** |
| 3. **แหล่งอ้างอิงมาจากข้อมูล** | หน้าที่แสดงมาจาก `page` ใน chunk ที่ส่งให้โมเดล ไม่ใช่เลขหน้าที่โมเดลพิมพ์เอง | **[ข้อเสนอ]** สอดคล้องหลัก FixStep (`types.ts:217–218`) |
| 4. **ตรวจว่าที่โมเดลอ้างอยู่ในชุดที่ให้** | ถ้าให้โมเดลระบุรหัส chunk ที่ใช้ ตรวจว่ารหัสนั้นอยู่ในชุดที่ส่งไป | **ยังไม่ตัดสินใจ** (§F.8) คุณเลือกแบบที่ไม่มีข้อนี้ |
| 5. **คำตอบว่าง/ถูกตัด/ถูกปฏิเสธจากผู้ให้บริการ** | ต้องจัดการเป็นกรณีหนึ่ง ไม่ใช่ error 500 (ชื่อฟิลด์/เหตุผลที่ Groq ส่งกลับ **ผมยังไม่ได้ตรวจเอกสาร** ต้องอ่านตอนเขียน `llm.client.ts`) | **[ข้อเสนอ]** |

- **คำถามอาจารย์:** (1) ถ้าคะแนนผ่านเกณฑ์แต่ chunk ไม่ตอบคำถามจริงๆ ระบบแต่งไหม? — **อาจแต่ง/ตอบคลาดเคลื่อนได้** ต้องยอมรับตรงๆ ด่านที่มีลดความเสี่ยง ไม่ได้ขจัด (2) ทำไมไม่ให้ LLM บอกความมั่นใจเอง? (D.6) (3) ทดสอบว่ากันแต่งได้จริงอย่างไร? (D.9)
- **ข้อจำกัดที่ต้องพูดเอง:** ไม่มีวิธีพิสูจน์ว่า LLM ไม่แต่ง มีแต่วัดอัตราจากชุดคำถามทดสอบ (D.9)

### D.6 ที่มาของคะแนนความมั่นใจ (confidence score)

- **แนวคิด:** FixStep ใช้ **คะแนนความคล้าย (cosine)** ไม่ใช่ความน่าจะเป็น และเป็น `null` ถ้าไม่มีให้วัด (ไม่แต่งตัวเลข) · โปรเจกต์ใหม่: **[ข้อเสนอ]** ใช้ cosine ของ chunk ที่ดึงมาเป็นคะแนน (ปัด 3 ตำแหน่ง) เรียกว่า "คะแนนความคล้าย" ไม่ใช่ "มั่นใจ x%" · **ไม่ใช้ตัวเลขความมั่นใจที่ LLM พิมพ์เอง** (ไม่ได้ผ่านการสอบเทียบ)
- **เกณฑ์ 0.55 ของ FixStep เอามาใช้ไม่ได้:** มันถูกเลือกสำหรับคำค้นสั้นเทียบกับชื่ออาการสั้นๆ ด้วยชุด 56 ข้อที่ AI ร่างและยังไม่ตรวจแก้ (ตามคอมเมนต์ `symptom-search.service.ts:46–51`) ความยาวข้อความและการกระจายคะแนนของ chunk ยาวต่างกัน **ต้องตั้งเกณฑ์ใหม่จากข้อมูลจริง** (§F.7, D.9)
- **คำถามอาจารย์:** (1) คะแนนนี้คืออะไร ใช้ตัดสินอะไร? (2) เกณฑ์มาจากไหน แม่นเท่าไร? — ตอบตามจริงว่าตั้งจากชุดทดสอบที่ผมทำเอง และ (ถ้าไม่ได้ตรวจโดยคนอื่น) ห้ามอ้างความแม่นยำ (3) ทำไมไม่ใช้ความมั่นใจของโมเดลเอง?

### D.7 การแสดงแหล่งอ้างอิง

- **แนวคิด:** คำตอบแสดงควบคู่รายการ "ชื่อคู่มือ · หน้า" ของ chunk ที่ใช้จริง (backend ประกอบจาก metadata ส่งมาเป็นโครงสร้าง frontend แค่แสดง เหมือน `ReferenceLine` ของเก่า) · แสดงคะแนนความคล้ายและคำเตือนความปลอดภัยของ chunk (ถ้า chunk มี `safety_warning` ในข้อมูล — ฟิลด์นี้มีใน chunk เก่า) **แสดงตามที่เก็บไว้ ไม่ให้ LLM เรียบเรียงใหม่**
- **คำถามอาจารย์:** (1) ทำไมแสดงหน้าคู่มือ? (ให้ผู้ใช้ตรวจย้อนได้) (2) ถ้าอ้างหน้าผิดเกิดอะไร? (3) ผู้ใช้เปิดคู่มือได้ไหม? (ตอนนี้ไม่ได้วางแผน เก็บแค่ชื่อไฟล์/หน้า)

### D.8 ตัวเรียก LLM (Groq) และขอบเขตความปลอดภัย

- **ตัวเรียก:** เรียก Groq API ผ่านไลบรารี/วิธีที่ **ยังไม่ได้เลือกและยังไม่ได้ตรวจเอกสาร** (§F.9) ห่อไว้ใน `llm.client.ts` เพื่อใส่ตัวปลอมในเทส · **API key เก็บฝั่ง backend เท่านั้น** (ห้ามขึ้นต้น `VITE_` เพราะถูกฝังลง JS ที่ผู้ใช้เปิดดูได้ — กฎเดียวกับ `.env.development` ของ FixStep) · จัดการ error ตามชนิดของ SDK (rate limit / connection / bad request) ไม่จับกว้างๆ · รหัสโมเดล/พารามิเตอร์ยังไม่ตัดสินใจ §F.9
- **ขอบเขตกับด่านความปลอดภัยของผัง:** ⚠️ ถ้า endpoint ถามตอบอธิบายขั้นตอนซ่อม (เช่น เปิดฝา/ถอดปลั๊ก) ผู้ใช้จะ **ข้ามด่าน `confirm_safety` ของ engine ได้ทั้งหมด** โดยถามตรงๆ นี่คือช่องโหว่เชิงออกแบบเดียวที่ใหญ่ที่สุดของแผนนี้ → ต้องตัดสินใจ §F.12 ก่อนเริ่มเฟส 6
- **คำถามอาจารย์:** (1) ถ้า LLM ล่ม ระบบยังใช้ได้ไหม? (ผังขั้นตอนต้องใช้ได้เสมอ — แยกโมดูลและทำให้ LLM เป็นส่วนเสริม เหมือนที่ระบบค้นหาของ FixStep เป็นส่วนเสริม) (2) ต้นทุนต่อคำถาม? (ยังไม่ได้วัด) (3) ข้อมูลผู้ใช้ถูกส่งออกนอกระบบอย่างไร?

### D.9 การวัดผล (ต้องมีก่อนอ้างอะไร)

- ชุดคำถามทดสอบที่ **คนตรวจแล้ว** (ต่างจาก FixStep ที่ชุด 56 ข้อ AI ร่างยังไม่ตรวจ และชุดรายงานผล `data/eval/queries_report.json` ว่าง `queries: []`) · วัด: เอา chunk ถูกขึ้นมาไหม (retrieval) · ตอบถูกจากข้อความไหม · ปฏิเสธถูกเมื่อไม่มีคำตอบไหม · คำถามนอกขอบเขต
- **คำถามอาจารย์:** ระบบแม่นแค่ไหน? — ตอบเฉพาะตัวเลขที่วัดจากชุดที่ตรวจแล้ว

---

## E. เฟส 0 — ตั้งต้นโปรเจกต์

ตาม stack ที่คุณเลือก: **NestJS 10 + mysql2 (MySQL) + `@huggingface/transformers` + Groq API (ไลบรารีเรียกใช้ยังไม่ตัดสินใจ §F.9) / React 19 + Vite + Tailwind v3 + TanStack Query + HashRouter** เวลา: ผม **ไม่มี** ค่าที่วัด · FixStep ตั้งไว้ 4.7 ชม. (0A 2.0 + 0B 2.0 + 0C 0.7) เป็นค่าประมาณเช่นกัน · คาดช่วง ≈ **4–7 ชม.** (บวกอีกถ้าตั้งฐานข้อมูลฝึกครั้งแรก)

### E.1 backend (0A) — ทำก่อน #01

1. สร้าง `<NEW>/backend`: `npx @nestjs/cli@10 new backend --skip-git --package-manager npm` (`@10` เพราะต้นแบบใช้ `@nestjs/*` ^10.4.0)
2. ลบสิ่งที่ต้นแบบไม่มี: `src/app.controller*`, `src/app.service*`, `src/app.module.ts`, `src/main.ts` (พิมพ์เองที่ #29–#30), `test/`, eslint/prettier
3. พิมพ์ `package.json` ให้ตรงต้นแบบ: ชื่อ/คำอธิบายของต้นแบบ (`fixgraph-backend`, "FixBot backend …") **ให้เปลี่ยนเป็นชื่อใหม่** · scripts: `build`, `start`, `start:dev`, `start:prod`, `test`, `migrate`, `seed`, `seed:equipment` (+ `ingest` ใหม่ที่ #35) · dependencies: `@huggingface/transformers` **4.3.0 (ปักเวอร์ชันตรงๆ ไม่ใช้ `^`)**, `@nestjs/cli|common|core|platform-express|schematics` ^10, `dotenv`, `mysql2`, `reflect-metadata`, `rxjs`, `ts-node` · devDependencies: `@types/express|jest|node`, `jest`, `ts-jest`, `typescript` ^5.6 · `engines.node >=20`
4. **ลำดับเรื่อง lockfile (สำคัญ):** คัดลอก `package-lock.json` ของต้นแบบมา → `npm ci` (ได้ต้นไม้แพ็กเกจที่ผ่าน 183 เทส) → **แล้วจึง** ติดตั้งแพ็กเกจใหม่ (ไลบรารีเรียก Groq §F.9 และไลบรารี PDF §F.3) ซึ่งจะอัปเดต lockfile ถ้าเพิ่มก่อน `npm ci` จะไม่ตรงกับ lockfile
5. `tsconfig.json` (ต่างจากค่าเริ่มต้นของ Nest: `types: ["node","jest"]`, `rootDir: ./src`, `strictNullChecks: true`, `incremental: false`, `forceConsistentCasingInFileNames: true`; `noImplicitAny: false`, `strictBindCallApply: false`), `tsconfig.build.json` (include `src/**/*`, exclude `**/*spec.ts`), `nest-cli.json` (`deleteOutDir: true`), `jest.config.js` (`ts-jest`, `rootDir: 'src'`, `testRegex: .spec.ts`, `testTimeout: 30000`) — ผมอ่านไฟล์เหล่านี้ของต้นแบบจริงแล้ว ค่าตรงตามนี้
6. `.gitignore` (ต้นแบบมี `node_modules/`, `dist/`, `build/`, `.env`, `.env.local`, `__pycache__/`, `*.pyc`, `.DS_Store`, `*.log`, `model-cache/`) · `.env.example`: คัดลอกโครงจากต้นแบบแล้วแก้ — `DB_NAME=fixbot` เปลี่ยนชื่อ, **ตัด** `GEMINI_API_KEY` (ไม่มีโค้ดใช้), **คง** `GROQ_API_KEY` (ต้นแบบมีชื่อนี้อยู่แล้ว ตอนนี้จะมีโค้ดใช้จริงที่ #41) และสวิตช์เปิด/ปิดฟีเจอร์ถามตอบ (ตั้งชื่อเองได้ ตามแบบ `SYMPTOM_SEARCH_ENABLED`) · ไฟล์ `.env.example` ของต้นแบบเป็น UTF-8 + CRLF (ตรวจด้วย `file`) ให้พิมพ์ใหม่ตามรายการข้างบน ไม่ต้องคัดลอกตรงๆ
7. ตรวจ: `npx tsc --noEmit` (src ว่าง) · `npx jest --passWithNoTests`

### E.2 ฐานข้อมูลฝึกและข้อมูล (0C) — ทำก่อน #01

1. MySQL ในเครื่อง (ชื่อ database ใหม่ ห้ามชี้ฐานของต้นแบบ/ฐานจริงใดๆ) · `backend/.env` สร้างเอง (ห้ามคัดลอก `.env` ของต้นแบบ — มีความลับ ผมไม่ได้เปิดอ่านไฟล์นั้น)
2. คัดลอก `data/` เท่าที่ต้อง: `manuals/samsung_ac_ar70h.json`, `equipment/equipment.json`, `schemas/troubleshooting-graph.v2.schema.json`, และ chunk/ข้อมูลที่จะใช้เทียบ (`chunks/`) · `washing_machine_clf.json` (29 ผัง) **ทุกผังสถานะ `pending_manual_review`** (ตรวจแล้วจากไฟล์) และไม่อยู่ใน `data/index.json` อย่านำเข้าก่อนตรวจ
3. คัดลอก `backend/scripts/run-migrations.js`, `seed-graphs.js`, `seed-equipment.js` · `backend/model-slim/` (ไฟล์โมเดล ใช้เมื่อจะรันค้นหา) พร้อม `LICENSE-APACHE-2.0.txt` และ `MODEL_NOTICE.md` (ใบอนุญาตของโมเดล)
4. PDF คู่มือ: **ต้องหาเอง** ไม่มีไฟล์ PDF ใน repo ต้นแบบ (ตรวจ `git ls-files` ไม่พบ `.pdf`) §F.3

### E.3 frontend (0B) — ทำก่อน #48

1. `npm create vite@latest frontend -- --template react-ts` → พิมพ์ `package.json` ให้ตรงต้นแบบ: scripts `dev`, `build` (`tsc -b && vite build`), `preview`, `test` (`vitest run`), `test:watch`, `deploy` (ตัดสินที่ §F.11) · dependencies `@tanstack/react-query` ^5, `react` ^19, `react-dom` ^19, `react-router-dom` ^7 · devDependencies รวม `vite` ^8, `typescript` ~6.0.2, `vitest` ^4, `tailwindcss` ^3.4 (**v3**), `postcss`, `autoprefixer`, `eslint` 10 ฯลฯ · คัดลอก `package-lock.json` ต้นแบบ → `npm ci`
2. `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` (เทียบกับ template); `vite.config.ts`: ต้นแบบมี `base: '/troubleshoot-assistantv2/'` → **เปลี่ยนเป็นชื่อ repo ใหม่** (ตัดสินที่ §F.11 ถ้าไม่ deploy ที่ GitHub Pages อาจไม่ต้องมี `base`)
3. Tailwind v3: `tailwind.config.js` (`theme.extend` สี/ฟอนต์), `postcss.config.js`, `src/index.css`; `index.html` (`lang="th"`, ชื่อ/คำอธิบายใหม่ — ต้นแบบเขียน "FixStep ผู้ช่วยตรวจอาการเครื่องใช้ไฟฟ้า"); `src/env.d.ts` (ตัด `VITE_USE_MOCK` ถ้าตัด mock); `.env.development` (`VITE_API_URL=http://localhost:3000`); `.env.production` (URL backend ใหม่ — ยังไม่มี); คัดลอก `public/favicon.svg`
4. ตรวจ: `npx tsc -b` ผ่าน (src ว่าง)

### E.4 โครงที่ผมแนะนำให้ทำเพิ่ม (ไม่มีในต้นแบบ)

- `git init` ใน `<NEW>` แล้ว commit ไฟล์แรกก่อนเริ่มพิมพ์ เพื่อให้ ROADMAP นี้ใส่ commit hash ของโปรเจกต์ใหม่ได้ (ตอนนี้ยังไม่มี)

---

## F. สิ่งที่ยังไม่แน่ใจหรือสมมติ

เรียงตามความเสี่ยงต่อแผน · ★ = ต้องตัดสินใจก่อนเริ่มเฟสที่ระบุ

| # | เรื่อง | สถานะ |
|---|---|---|
| F.1 ★เฟส 5 | **RAG อยู่ตรงไหนของการใช้งาน** — แผนนี้ตีความว่า: ผังขั้นตอน/session/ด่านความปลอดภัยคงเดิมทั้งหมด และ RAG เป็น endpoint "ถามเป็นข้อความอิสระ" แยกต่างหาก (หน้า `/ask`) ที่ตอบจาก chunk ผู้ใช้อาจต้องการแบบอื่น เช่น ใช้ RAG เลือกผังแทนระบบค้นหาอาการเดิม หรือสอดแทรกคำอธิบายในแต่ละขั้นของ session | **สมมติ — ต้องยืนยัน** |
| F.2 ★เฟส 1 | **4 ประเภทคืออะไร** — `types.ts:104–109` ของต้นแบบมี 5 ค่า (แอร์ ตู้เย็น เครื่องซักผ้า **ไมโครเวฟ** โทรทัศน์) README ต้นแบบ บรรทัด 79 ระบุ 4 ประเภทและ "ตัดไมโครเวฟออก" ผมจึงสมมติว่า "4 ประเภท" ของคุณคือชุดเดียวกัน (แอร์/ตู้เย็น/เครื่องซักผ้า/โทรทัศน์) **แต่คุณยังไม่ได้ยืนยันชุดนี้** · ข้อมูลที่มีจริงใน repo ต้นแบบมีเพียง **แอร์ (13 chunk / 13 ผังในดัชนี)** และ **เครื่องซักผ้า (29 chunk / 29 ผังฉบับร่าง)** — **ตู้เย็นและโทรทัศน์ไม่มีข้อมูลเลย** | สมมติ |
| F.3 ★เฟส 5 | **ไลบรารีดึงข้อความ PDF** และ **ไฟล์ PDF** — ผมไม่ได้เลือกให้ (ไม่มีการตรวจเวอร์ชัน/การใช้งานจริง) ไม่มี PDF ใน repo ต้นแบบ · ต้องตัดสินว่า script เป็น `.js` (เหมือน `seed-graphs.js`) หรือ `.ts` (นำ `chunker.ts` มาใช้ซ้ำได้ตรงๆ — แต่ `tsconfig` ตั้ง `rootDir: ./src` จึงต้องวางไว้ใน `src/`) | **ยังไม่ตัดสินใจ** |
| F.4 ★เฟส 5 | **ขนาด chunk / การซ้อนทับ / ตัดตามหน้า-หัวข้อ** — ยังไม่มีตัวเลข ต้องทดลองกับ PDF จริงและวัด retrieval (D.9) | ยังไม่ตัดสินใจ |
| F.5 | **คุณภาพ embedding กับข้อความยาว + ข้ามภาษา** (คู่มืออังกฤษ/คำถามไทย) · การตัดข้อความยาวของโมเดล (`model_max_length` 512 ใน `tokenizer_config.json` แต่ความยาวที่ฝึกจริงของโมเดลผมยังไม่ได้ยืนยันจากไฟล์ในโปรเจกต์) · **เวลาบูต/หน่วยความจำเมื่อ chunk มีจำนวนมาก** (ต้นแบบมีข้อความแค่หลักสิบ ไม่มีตัวเลขสำหรับ chunk จำนวนมาก) | **ยังไม่ได้วัด** |
| F.6 | **ลิงก์ chunk → ผัง** ผ่าน `source_chunk_id` (D.3) ใช้ได้กับ chunk เก่าเท่านั้น (รูปแบบ id เดิม) chunk จาก PDF ใหม่ต้องกำหนดรูปแบบ id ให้ชน หรือเลิกใช้ลิงก์นี้ | ข้อเสนอ |
| F.7 | **เกณฑ์ปฏิเสธ (threshold)** ของ chunk — ต้องตั้งจากชุดทดสอบที่ตรวจแล้ว ห้ามยก 0.55 ของ FixStep มา | ยังไม่ตัดสินใจ |
| F.8 | **ด่านตรวจว่าโมเดลอ้างเฉพาะ chunk ที่ให้** (D.5 ข้อ 4) — คุณเลือกแบบไม่มีข้อนี้ ผมแค่ชี้ว่าเป็นช่องที่ยังเปิดอยู่ ตัดสินใจทีหลังได้ | คุณเลือกไม่ใส่ (บันทึกไว้) |
| F.9 | **Groq: รุ่นโมเดล, ไลบรารีเรียกใช้, พารามิเตอร์, ข้อจำกัดอัตราการเรียก/โควตา, ต้นทุน, ฟอร์แมตตอบ** — ผมยังไม่ได้ตรวจเอกสารของ Groq เลย (เดิมโหลดเอกสาร Claude มา ใช้กับ Groq ไม่ได้) ต้องอ่านเอกสารจริงก่อนเขียน `llm.client.ts` (#41) · ผมไม่เดาชื่อแพ็กเกจ/รุ่น/ชื่อฟิลด์ผลตอบกลับ · ผลต่อแผนที่รู้แน่: ไม่ต้องจัดการ `stop_reason: "refusal"` แบบ Claude · ข้อมูลที่ผู้ใช้พิมพ์และ chunk คู่มือจะถูกส่งไปยังผู้ให้บริการภายนอก (ต้องบอกผู้ใช้/อาจารย์) | ยังไม่ตัดสินใจ |
| F.10 | **ตัด mock ใน frontend** — ผมจัดให้ "ตัด" (`mockServer.ts` 216 บรรทัดโค้ด + เทส 28 ข้อ) เพราะโหมด mock ต้องปลอมคำตอบ LLM เพิ่ม และทำให้ frontend ต้องอ่าน `data/` ของ backend ข้อเสีย: เดโมหน้าเว็บโดยไม่เปิด backend ไม่ได้ ถ้าต้องการ เก็บไว้ได้ (เสียเวลา ≈ ตามช่วงของมัน) | **ข้อเสนอ — ต้องยืนยัน** |
| F.11 | **การ deploy** — ผู้ให้บริการ/ฐานข้อมูลโฮสต์/โดเมน ยังไม่ได้คุย `vite.config.ts` `base`, `deploy` script, `.env.production`, `ONNXRUNTIME_NODE_INSTALL`, หน่วยความจำของเครื่องฟรี (ต้นแบบวัดบน Render ว่าเปิดค้นหาแล้วใช้ ~279–312 MB ตามเอกสารเก่า — ตัวเลขนี้ **ยังไม่ได้ตรวจใหม่** และจะสูงขึ้นเมื่อมีดัชนี chunk) | ยังไม่ตัดสินใจ |
| F.12 ★เฟส 6 | **ช่องโหว่ข้ามด่านความปลอดภัยผ่านหน้าถามตอบ** (D.8) · ทางเลือก: (ก) endpoint ถามตอบ "อธิบาย/ค้นข้อมูล" เท่านั้น ถ้าคำถามเป็นขั้นตอนซ่อมให้พาไปเริ่มผัง (ข) แนบ `safety_warning` ของ chunk ทุกครั้ง (ค) ทั้งสองอย่าง · ผมแนะนำ (ค) แต่ **ยังไม่ได้ออกแบบวิธีตรวจว่า "คำถามเป็นขั้นตอนซ่อม"** | ยังไม่ตัดสินใจ |
| F.13 | **ข้อความเก่าในต้นแบบที่จะติดมาถ้าพิมพ์ตามตรงๆ** (ผมตรวจแล้ว): migration 002 บรรทัด 30 เขียน "2 ชั่วโมง" แต่ค่าจริง 24 ชม. (`session.store.ts:37`) · `types.ts:141` "retrieval (Phase 8)" · migration 004 บรรทัด 3 "(ขั้น 1.8)" · `main.ts:15` และ `health.controller.ts:32` ใช้ชื่อ FixBot · `AppShell.tsx:21` ชื่อแอป FixStep · `.env.example` มี key ของ LLM ที่ไม่มีโค้ดใช้ | พิมพ์แก้ตอนทำ |
| F.14 | **คอมเมนต์ในโค้ด** — ค่าตั้งต้น: อ่านทั้งหมด พิมพ์เฉพาะโค้ด (§0) ถ้าอยากพิมพ์คอมเมนต์ด้วย ต้องบวกเวลาเพิ่ม · ผมไม่ได้นับบรรทัดคอมเมนต์ทั้งหมดของต้นแบบในรอบนี้ (ROADMAP เก่าระบุ MUST ของ FixStep มีคอมเมนต์ 1,470 บรรทัด ใช้เทียบไม่ได้กับชุดไฟล์ใหม่) | ค่าตั้งต้น |
| F.15 | **อัตราการพิมพ์ในสูตรเวลา** เป็นค่าสมมติจากต้นแบบ ยังไม่วัดจากคุณ (§0) | สมมติ |
| F.16 | **วันสอบ/ชั่วโมงต่อวัน** ของโปรเจกต์ใหม่ — ผมไม่มีข้อมูล จึงไม่ได้คำนวณตารางวันที่ (ของ FixStep: สอบ 18 ต.ค. 2569, 6 ชม./วัน — ใช้กับโปรเจกต์ใหม่ไม่ได้โดยอัตโนมัติ) | ไม่มีข้อมูล |
| F.17 | **ความสอดคล้องกับ ROADMAP เก่า** ของ FixStep ใน working tree ที่แก้ค้างอยู่: ผมไม่ได้เทียบเนื้อหาไฟล์นั้นกับที่ commit — ผมใช้เป็นแค่ต้นแบบรูปแบบ ตัวเลขทั้งหมดในเอกสารนี้มาจากโค้ดและการรันเทสโดยตรง | หมายเหตุ |

---

**F.18 — ผลของการเลื่อนเทส (ตัดสินใจ 7 ต.ค.):** ความเสี่ยงที่ผมเห็นจากโค้ดต้นแบบ (ไม่ใช่ข้อห้าม ตัดสินใจเป็นของคุณ): (1) เทสเดิมคือ "เฉลย" ของ engine และ session ที่ใช้ซ้ำ ถ้าพิมพ์ผิดเล็กน้อย (เช่น สลับ `on_yes`/`on_no`) `tsc` ไม่จับ จะรู้ตอนเฟส T เท่านั้น และต้องย้อนหาว่าผิดไฟล์ไหน (2) ด่านความปลอดภัยอยู่ใน `traversal-engine.ts` #02 ซึ่งเทสเดิมครอบอยู่ ระหว่างเลื่อนเทส ไม่มีอะไรยืนยันว่าด่านทำงานจนกว่าจะถึง smoke test ที่ #30 (ส่ง `continue` ให้โหนดต้องยืนยันคำเตือนต้องได้ 400) จึง **ห้ามข้ามขั้น smoke test นั้น** (3) การรันเทสเดิมไม่ต้องพิมพ์โค้ด ถ้าอยากได้ความมั่นใจเร็วขึ้นโดยไม่เขียนเทส ให้เรียกใช้ T1 เฉพาะ `traversal-engine/` ครั้งเดียวหลัง #02 ก็ได้ (ใช้เวลาไม่กี่นาที) · `jest.config.js` และ jest ที่ติดตั้งแล้วยังอยู่ `npm test` จะผ่านโดยไม่พบเทส ไม่ต้องแก้อะไร

## ภาคผนวก ก: ตารางบันทึกเวลาจริง

| # | ไฟล์ | ช่วงประเมิน (ชม.) | เวลาจริง (ชม.) | เสร็จเมื่อ | ตอบคำถามผ่านรอบที่ | หมายเหตุ |
|---|---|---|---|---|---|---|
| 01 | types.ts | (ดู §C) | | | | |
| 02 | traversal-engine.ts | (ดู §C) | | | | |
| ... | | | | | | |

**ตัวคูณ k** = (เวลาจริงรวมของ #01–#02) ÷ (ช่วงประเมินรวมของสองไฟล์นี้) = ______ (ใช้ค่ากลางของช่วง)

## ภาคผนวก ข: ตรวจที่ผมรันจริงตอนสร้างเอกสารนี้

| รายการ | ผล |
|---|---|
| `git log -1` ของต้นแบบ | `23a0d7f` (main) |
| `jest --ci` backend | 10 suites · **183 passed** |
| `vitest run` frontend | 8 files · **84 passed** |
| เทสต่อไฟล์ backend | symptom-matcher 19 · path-coverage 45 · engine 37 · traversal.dto 15 · confidence 4 · symptom-search.dto 10 · traversal.service 31 · symptom-search.service 13 · symptom-search.exception.filter 4 · traversal.exception.filter 5 |
| เทสต่อไฟล์ frontend | http 5 · errors 21 · outcome 9 · reference 4 · search 6 · symptoms 5 · trail 6 · mockServer 28 |
| `git status` ต้นแบบหลังรัน | เหมือนก่อนรัน (เฉพาะ `ROADMAP.md` ที่แก้ค้างอยู่ก่อน) |

## ภาคผนวก ค: คำสั่งที่ใช้บ่อย (PowerShell)

```powershell
# backend (ใน <NEW>\backend)
npx tsc --noEmit
npx jest src/traversal-engine
npx jest                      # ทั้งหมด
npm run migrate ; npm run seed ; npm run seed:equipment
npm run build ; npm run start

# frontend (ใน <NEW>\frontend)
npx tsc -b
npm test
npm run build
npm run dev

# เทียบไฟล์ที่พิมพ์กับต้นแบบ (อ่านอย่างเดียว; exit code 1 = มีส่วนต่าง ซึ่งปกติ)
git diff --no-index --ignore-cr-at-eol --ignore-blank-lines "<ต้นแบบ>\backend\src\traversal-engine\types.ts" "<NEW>\backend\src\traversal-engine\types.ts"
```

Smoke test หลัง #30 (backend รันที่ `http://localhost:3000`): เหมือน ROADMAP ของ FixStep ภาคผนวก ค — `GET /health`, `GET /traversal/graphs`, เริ่ม session, ส่ง `continue` ให้โหนดที่ต้องยืนยันคำเตือน ต้องได้ 400 `SAFETY_CONFIRMATION_REQUIRED`
