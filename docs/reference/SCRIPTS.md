# สคริปต์ทั้งโปรเจกต์ — ไว้ทำอะไร ยังจำเป็นไหม ลบได้ไหม

> ตรวจเมื่อ 20 ต.ค. 2569 จากหัวไฟล์/โค้ดของสคริปต์ + การค้นว่ามีโค้ดหรือคำสั่งไหนเรียกใช้ (`package.json`, `backend/src`, `render.yaml`, เอกสาร) · **ไม่ได้รันสคริปต์ Python ทีละตัวในรอบนี้** คำว่า "ยังใช้ได้" จึงมาจากการอ่านโค้ดและเช็กไฟล์ที่มันพึ่ง ไม่ใช่การทดสอบ
> ไม่มีโค้ดใน `backend/src`, `frontend/src`, `render.yaml` เรียกสคริปต์ใดเลย — สคริปต์ทั้งหมดรันด้วยมือ (บาง `.js` ผ่าน `npm run`) ลบแล้วระบบที่รันอยู่ไม่พัง ยกเว้นตัวที่ระบุว่า "จำเป็น" เพราะเป็นทางเดียวที่ใส่ข้อมูลเข้า DB

## สรุป 1 หน้า

| สคริปต์ | ที่อยู่ | ไว้ทำอะไร | สถานะ |
|---|---|---|---|
| `run-migrations.js` | backend/scripts | สร้างตารางจาก `migrations/*.sql` | ✅ **จำเป็น** |
| `seed-graphs.js` | backend/scripts | โหลดผัง `data/manuals/*.json` เข้า DB | ✅ **จำเป็น** |
| `seed-equipment.js` | backend/scripts | โหลดอุปกรณ์ `data/equipment/equipment.json` เข้า DB | ✅ **จำเป็น** |
| `seed-admin.js` | backend/scripts | สร้าง/ยกเป็น admin (ทางเดียว) | ✅ **จำเป็น** |
| `backup-graph-tables.js` | backend/scripts | สำรองตารางผังเป็น `.sql` | 🟡 ควรเก็บ (ผังที่ admin publish ไม่มีไฟล์ต้นทาง) |
| `reset-database.js` | backend/scripts | ลบตารางทั้งหมดเพื่อเริ่มใหม่ | 🟡 เก็บไว้ตอนยังปรับ schema · ลบได้เมื่อ schema นิ่ง |
| `try-rephrase.js` | backend/scripts | ลองเรียก Groq/ดูรายชื่อโมเดล | 🟡 เครื่องมือแก้ปัญหา ลบได้ |
| `study-measure.js` | backend/scripts | วัดผลประกอบ `STUDY_GUIDE.md` | 🟡 เก็บจนสอบเสร็จ แล้วลบได้ |
| `validate_graph.py` | scripts | ตรวจไฟล์ผัง `data/manuals` ก่อน seed | ✅ ควรเก็บ (ต้นแบบของตัวตรวจใน backend) |
| `convert_chunks_to_graphs.py` | scripts | แปลง chunk → ผัง (ร่าง) | 🟡 เก็บถ้ายังจะทำผังจาก chunk · ไม่งั้นลบได้ |
| `simulate_paths.py` | scripts | เดินทุกเส้นทางของผังหาจุดผิดปกติ | 🟡 เครื่องมือ QA ลบได้ |
| `check_chunk_pdf.py` | scripts | เทียบ chunk กับ PDF เป็นหน้า HTML | 🟡 เครื่องมือ QA ลบได้ |
| `inspect_vocab.py` | scripts | สำรวจคำศัพท์โมเดล (ขั้นเตรียมตัดโมเดล) | 🔴 **ลบได้** ทำงานเสร็จแล้ว · ตอนนี้ใช้ไม่ได้ |
| `slim_model.py` | scripts | ตัดโมเดล → `backend/model/` | 🔴 **ลบได้** ทำงานเสร็จแล้ว · ตอนนี้ใช้ไม่ได้ |
| `verify_chunks_against_pdf.py`, `verify_graphs_against_pdf.py`, `visualize_chunks_vs_pdf.py` | scripts/old | ตรวจ chunk/ผังเทียบ PDF (รุ่นเก่า) | 🔴 ลบได้ (อยู่ใน `old/` ตามแผนย้ายออกอยู่แล้ว) |
| `data/runseed.txt` | data | รายการคำสั่ง seed ผังทั้ง 21 คู่มือ | 🟡 ไฟล์โน้ต ไม่ใช่สคริปต์ — เก็บไว้ใช้ตอน seed |
| `scripts/__pycache__/*.pyc` | scripts | ไฟล์แคชที่ Python สร้าง | 🔴 **ลบได้** และไม่ควรอยู่ใน git |

---

## 1. `backend/scripts/` (Node.js)

ทุกตัวอ่านค่าเชื่อมต่อจาก `backend/.env` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL_CA`) รันจากโฟลเดอร์ `backend`

### `run-migrations.js` — `npm run migrate` ✅ จำเป็น
รันไฟล์ `.sql` ใน `backend/migrations/` ตามลำดับชื่อ (001→006) เฉพาะไฟล์ที่ยังไม่เคยรัน โดยจำไว้ในตาราง `schema_migrations`
- `npm run migrate -- --status` = แค่ดูว่าไฟล์ไหนรันแล้ว ไม่รันอะไร
- ข้อจำกัด: ไม่มี transaction ถ้าไฟล์ล้มกลางทางอาจเหลือตารางครึ่งๆ
- **ห้ามลบ:** ไม่งั้นสร้างตารางไม่ได้ (นอกจากจะสร้างด้วยมือ)

### `seed-graphs.js` — `npm run seed` ✅ จำเป็น
โหลดไฟล์ผัง 1 คู่มือ (`data/manuals/<ไฟล์>.json`) เข้า `manuals` + `graphs` + `nodes`
- ตรวจไฟล์ก่อนเขียน (มีตัวตรวจ `validateManual` ในสคริปต์เอง) ไม่ผ่านจะหยุดและบอกเหตุผล
- รันซ้ำได้: `manuals`/`graphs` ใช้ upsert, `nodes` ของผังนั้นลบแล้ว insert ใหม่ (ผังที่ admin publish ผ่านหน้าเว็บไม่โดนแตะ เพราะไม่อยู่ในไฟล์)
- `--verify` = ตรวจอย่างเดียว ไม่เขียน DB
- ไม่ใส่ชื่อไฟล์ → ใช้ผังไมโครเวฟ GE83MDT เป็นค่าเริ่มต้น
- คำสั่งครบ 21 คู่มืออยู่ใน `data/runseed.txt`
- **ห้ามลบ** เป็นทางเดียวที่ใส่ผังชุดหลักเข้า DB (ผังที่ admin publish เพิ่มได้เองผ่านหน้าเว็บ แต่ 21 คู่มือแรกมาจากสคริปต์นี้)
- หมายเหตุ: กฎตรวจในสคริปต์นี้ซ้ำกับ `backend/src/authoring/graph-validator.ts` บางส่วน (เป็นสองสำเนา) — ถ้าแก้กฎต้องดูทั้งสองที่ ผมไม่ได้เทียบว่ากฎทุกข้อตรงกัน

### `seed-equipment.js` — `npm run seed:equipment` ✅ จำเป็น
โหลด `data/equipment/equipment.json` เข้า `equipment` + `equipment_usage` (แผง "อุปกรณ์ที่ต้องใช้") ตรวจก่อนเขียน, รันซ้ำได้, มี `--verify`
- **ห้ามลบ** ถ้ายังอยากให้แผงอุปกรณ์มีข้อมูล

### `seed-admin.js` — `npm run seed:admin` ✅ จำเป็น
สร้างบัญชี admin คนแรกจาก `ADMIN_EMAIL` / `ADMIN_PASSWORD` (และ `ADMIN_DISPLAY_NAME`) ใน `.env` — รันซ้ำได้ (มีอีเมลเป็น user อยู่แล้วจะยกเป็น admin โดยไม่เปลี่ยนรหัสผ่าน)
- **ห้ามลบ** `/auth/register` สร้างได้แต่ user ถ้าไม่มีสคริปต์นี้จะไม่มี admin ใช้หน้า admin ไม่ได้ (ต้องเขียน SQL เอง)
- ต้องใช้ bcrypt rounds เท่ากับ `auth.service.ts` (10)

### `backup-graph-tables.js` 🟡 ควรเก็บ
สำรอง `manuals`, `graphs`, `nodes` (+ `graph_drafts`) เป็นไฟล์ `.sql` (INSERT ล้วน) ลง `backend/backups/` อ่านอย่างเดียว ไม่ต้องมี `mysqldump`
- มีค่าเพราะผังที่ admin publish ผ่านหน้าเว็บ **ไม่มีไฟล์ต้นทางใน `data/`** ถ้า DB หายจะกู้จาก seed ไม่ได้
- ลบได้ถ้ามีวิธีสำรองอื่น (เช่น backup ของ Aiven) แต่ไม่แนะนำให้ลบก่อนล้าง DB

### `reset-database.js` 🟡 ชั่วคราว
ลบตารางของโปรเจกต์ทั้งหมด + `schema_migrations` (ค่าเริ่มต้น = dry run ต้องใส่ `--yes`) เขียนไว้สำหรับตอนรวม migration ใหม่
- เก็บไว้ได้ตราบที่ยังปรับ schema บ่อย · **อันตรายถ้ารันพลาดบน DB จริง** — ลบได้เมื่อ schema นิ่งแล้ว เพื่อไม่ให้มีของที่ลบข้อมูลทั้งฐานอยู่ในรีโป

### `try-rephrase.js` 🟡 ลบได้
ลองเรียก rephrase กับข้อความจากผัง (ค่าเริ่มต้นผัง GE83MDT) ดูผลก่อน/หลังและผ่าน guard ไหม; `--models` = ดูรายชื่อโมเดลที่ API key เรียกได้ (ใช้ตอนเจอ 404/400 เพราะชื่อโมเดลผิด); รับ `--model=` `--effort=`
- ต้อง build ก่อน (อ่านจาก `backend/dist/rephrase`) และต้องมี `GROQ_API_KEY`
- ลบได้ ไม่กระทบระบบ · มีประโยชน์ตอนเปลี่ยนโมเดล Groq เท่านั้น

### `study-measure.js` 🟡 เก็บจนสอบเสร็จ
วัดพฤติกรรมโค้ดจริงให้ได้ตัวเลขใน `STUDY_GUIDE.md` ส่วนที่ 3 (`engine` = เดินผังรวมกรณีถูกปฏิเสธ, `guard` = ลองตัวกัน rephrase, `search` = คะแนน cosine ด้วยโมเดลจริง ~1 นาที) ไม่ต่อ DB ไม่อ่าน `.env`
- ต้อง `npm run build` ก่อน (ใช้ `backend/dist`) · อ่านผังจาก `data/manuals`
- ⚠️ ตัวเลขในส่วนที่ 3 ของ STUDY_GUIDE (644 ผัง, 3,850 ข้อความ ฯลฯ) วัดตอนยังมีแอร์ — รันซ้ำตอนนี้จะได้ตัวเลขต่างจากเอกสาร (631 ผัง)
- ลบได้หลังสอบ

---

## 2. `scripts/` (Python — รันนอกระบบ ตอนเตรียมข้อมูล)

ต้องมี Python 3 (ไม่มี `requirements.txt` — แต่ละตัวบอกวิธีติดตั้งในหัวไฟล์) ไม่มีโค้ดตอนรันระบบเรียกสคริปต์เหล่านี้

### `validate_graph.py` ✅ ควรเก็บ
ตรวจไฟล์ผังใน `data/manuals` ด้วย JSON Schema (`data/schemas/troubleshooting-graph.v2.schema.json`) + กฎธุรกิจ (โหนดเข้าถึงไม่ได้, ทางตัน, ตำแหน่ง safety ฯลฯ)
- `python scripts/validate_graph.py --all` หรือระบุไฟล์
- เป็น **ต้นแบบของ `graph-validator.ts`** และเป็นตัวตรวจผังที่ใช้งานอยู่แล้ว (ตัวใน backend ตรวจเฉพาะร่างตอน publish ตามคอมเมนต์หัวไฟล์) · `types.ts` ก็อ้างชื่อไฟล์นี้ในข้อความ error
- ควรรันก่อน seed ทุกครั้งที่แก้ไฟล์ผัง · ผม **ยังไม่ได้รันหลังเอาแอร์ออก** (JSON Schema ถูกแก้แล้ว)

### `convert_chunks_to_graphs.py` 🟡
แปลงไฟล์ chunk คู่มือ (`data/chuck/*.json`, 23 ไฟล์) เป็นผัง schema v2 แบบ deterministic ไม่ใช้ LLM → ได้ "ร่าง" ที่ต้องตรวจก่อนใช้ · `python scripts/convert_chunks_to_graphs.py <input> <output>`
- ไฟล์ผังใน `data/manuals` ถูกสร้างไปแล้ว ไม่มีอะไรเรียกสคริปต์นี้อีก
- เก็บไว้ถ้าจะทำผังเพิ่มจาก chunk ทางนี้ (แต่ตอนนี้มีทาง admin อัปโหลด PDF ให้ LLM ร่างอยู่แล้ว) · ลบได้ถ้าเลิกใช้ทาง chunk — แต่มันเป็นหลักฐานว่าผังชุดหลักสร้างอย่างไร ถ้าต้องอธิบายตอนสอบให้เก็บไว้

### `simulate_paths.py` 🟡 ลบได้
เดินทุกเส้นทางของแต่ละผัง รายงานจำนวนเส้นทาง/ความยาวสูงสุด/ทางที่จบด้วย resolution หรือ escalation/ด่าน safety ครอบทุกทางอันตรายไหม · `python scripts/simulate_paths.py --all`
- เครื่องมือ QA ล้วน ไม่มีอะไรพึ่ง · ลบได้

### `check_chunk_pdf.py` 🟡 ลบได้
เทียบ chunk ของคู่มือ 1 เล่มกับ PDF แล้วสร้างหน้า HTML (PASS/WARN/FAIL วาดกรอบเขียวบนคำที่ตรง) ให้ตรวจด้วยตา · ต้อง `pip install pymupdf`
- ผลลัพธ์ HTML คือไฟล์ใน `data/check/` · หน้าที่ซ้อนกับชุดตรวจเก่าใน `old/`
- ลบได้ ถ้าตรวจ chunk เสร็จแล้ว

### `inspect_vocab.py` + `slim_model.py` 🔴 ลบได้ (เป็นคู่)
สองขั้นของการ "ตัดคำศัพท์โมเดล embedding ให้เล็ก": `inspect_vocab.py` สำรวจว่าคำศัพท์ส่วนไหนใช้ได้, `slim_model.py` ตัดแล้วเขียน `backend/model/` (ที่ backend โหลดอยู่ตอนนี้)
- **งานเสร็จแล้ว** ผลคือโฟลเดอร์ `backend/model/` ซึ่งอยู่ใน git อยู่แล้ว
- **ตอนนี้ใช้ไม่ได้อยู่แล้ว (2 เหตุผล):** (1) อ่านผังแอร์ `data/manuals/samsung_ac_ar70h.json` ที่ลบไปแล้ว และคำค้นตัวอย่างเป็นเรื่องแอร์ (2) ต้องมีโฟลเดอร์ `backend/model-cache/` (โมเดลต้นฉบับ) ซึ่งไม่มีในเครื่อง/รีโป และสคริปต์ที่เคยดาวน์โหลดมาให้ (`measure-embedding.js`) ก็ไม่มีแล้ว
- ลบได้ทั้งคู่ · ข้อเสียเดียวคือเสียหลักฐานว่า model ตัดมาอย่างไร (ถ้าต้องอธิบายตอนสอบ เก็บไว้เป็นเอกสารได้ แต่ควรแก้ path ก่อนถ้าจะรัน)

### `scripts/old/` 🔴 ลบได้
`verify_chunks_against_pdf.py` (882 บรรทัด), `verify_graphs_against_pdf.py`, `visualize_chunks_vs_pdf.py` — ชุดตรวจ chunk/ผังเทียบ PDF รุ่นเก่า ตามแผนที่คุณจะย้ายออกจาก repo เอง
- ข้อควรรู้: `docs/ops/VERIFY-CHUNKS-AGAINST-PDF.md` และ `BRIEF-VERIFY-CHUNKS-FOR-CLAUDE.md` ยังอธิบายการใช้ `verify_chunks_against_pdf.py` — ลบสคริปต์แล้วควรลบ/ย้ายสองเอกสารนั้นด้วย

### `scripts/__pycache__/` 🔴 ลบได้
ไฟล์ `.pyc` ที่ Python สร้างอัตโนมัติ (เป็นของ `verify_chunks_against_pdf` ตามชื่อ) **ถูก track ใน git อยู่** ควร `git rm` แล้วใส่ `__pycache__/` ใน `.gitignore`

---

## 3. สิ่งที่แนะนำ

**ลบได้ทันที ไม่กระทบอะไร:** `scripts/__pycache__/`, `scripts/inspect_vocab.py`, `scripts/slim_model.py`, `scripts/old/*` (+ เอกสาร VERIFY-CHUNKS 2 ไฟล์ใน `docs/ops/` ที่อ้างถึง)

**ลบได้ถ้าไม่ใช้งาน (เครื่องมือ QA):** `simulate_paths.py`, `check_chunk_pdf.py`, `try-rephrase.js`

**เก็บไว้:** `run-migrations.js`, `seed-graphs.js`, `seed-equipment.js`, `seed-admin.js`, `backup-graph-tables.js`, `validate_graph.py`, `data/runseed.txt`

**เก็บชั่วคราว:** `reset-database.js` (จนกว่า schema นิ่ง), `study-measure.js` (จนสอบเสร็จ), `convert_chunks_to_graphs.py` (ถ้ายังอาจต้องอธิบายที่มาของผัง)

**ปัญหาที่พบระหว่างตรวจ (ยังไม่ได้แก้):**
1. `inspect_vocab.py` / `slim_model.py` ชี้ไฟล์แอร์ที่ถูกลบ → รันไม่ได้
2. `STUDY_GUIDE.md` §1.4 ยังเขียนถึง `try-rephrase.js` และ migration เดิม; ภาคผนวกข้อ 6 บอกให้รัน `study-measure.js` เพื่อเทียบเลข ซึ่งตอนนี้จะไม่ตรง (ผังหายไป 13)
3. `seed-graphs.js` มีตัวตรวจผังซ้ำกับ `graph-validator.ts` (ดูหมายเหตุข้างบน)
