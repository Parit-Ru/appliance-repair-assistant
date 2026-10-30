# 00 — Cheat Sheet (อ่านคืนก่อนสอบ)

> ทุก path ในชุดเอกสารนี้นับจากรากโปรเจกต์ `appliance-repair-assistant/` · อ้างอิงโค้ดจาก working tree วันที่ 29 ต.ค. 2569 (branch `express-migration`)
> คำเรียกระบบที่ใช้ทุกไฟล์: **retrieval-guided troubleshooting state machine**
> (ใช้ embedding "ค้นหาผังที่ใช่" → แล้วให้ state machine "พาเดินทีละขั้นตามคู่มือ")

---

## Elevator pitch — 1 นาที

"เวลาเครื่องใช้ไฟฟ้าที่บ้านมีปัญหา คนส่วนใหญ่ไม่เปิดคู่มือ หรือไปถาม ChatGPT ซึ่งอาจแต่งคำตอบที่ไม่มีในคู่มือ และไม่บอกว่าขั้นไหนอันตราย
ระบบของผมแปลงส่วน Troubleshooting ของคู่มือ Samsung 21 เล่ม เป็น **ผังขั้นตอน 631 ผัง** ผู้ใช้เลือกรุ่น แล้วพิมพ์อาการเป็นภาษาพูด ระบบใช้ **embedding รันในเครื่อง** หาอาการในผังที่ใกล้ที่สุดไม่เกิน 3 อัน ให้ผู้ใช้เลือกเอง
จากนั้น **state machine** ถามทีละข้อ ใช่/ไม่ใช่ ตามคู่มือ ทุกขั้นแสดงชื่อคู่มือและหน้า ขั้นที่อันตรายต้องติ๊กยืนยันคำเตือนก่อน และถ้าคู่มือไม่ได้บอกทางแก้ ระบบจะส่งต่อศูนย์บริการแทนการเดา
LLM ไม่ได้เป็นคนคิดคำตอบ ใช้แค่เรียบเรียงภาษา (มีด่านตรวจ) และช่วย admin ร่างผังจาก PDF ที่คนต้องตรวจก่อนเผยแพร่"

## Elevator pitch — 3 นาที (เพิ่มจากแบบ 1 นาที)

1. **ปัญหา:** คู่มือยาว ภาษาอังกฤษ ค้นยาก · LLM ทั่วไปตอบลื่นแต่ตรวจสอบย้อนกลับไม่ได้ และอาจข้ามคำเตือนความปลอดภัย
2. **แนวคิด:** แยก "การหา" ออกจาก "การตอบ"
   - การหา = embedding + cosine similarity (`backend/src/symptom-search/`)
   - การตอบ = ผังที่มาจากคู่มือ เดินด้วยโค้ดแบบ deterministic (`backend/src/traversal-engine/traversal-engine.ts`)
   คำตอบทุกคำจึงอยู่ในฐานข้อมูลก่อนผู้ใช้ถาม ไม่ได้ถูกสร้างตอนถาม
3. **ความปลอดภัย:** โหนดที่ `safety_critical` จะถูก engine ปฏิเสธ action `continue` ต้องเป็น `confirm_safety` เท่านั้น (`traversal-engine.ts:90-96`) หน้าจอบังคับติ๊ก "อ่านคำเตือนแล้ว" (`frontend/src/components/step/SafetyGateStep.tsx:25-32`)
4. **ส่วนผู้ใช้:** บัญชี/guest, ประวัติการซ่อม, feedback 👍/👎
5. **ส่วน admin:** dashboard + อัปโหลด PDF → LLM ร่างผัง → validator 24 กฎ error / 5 กฎ warning → คนแก้ → publish ใน transaction เดียว → ค้นหาเจอทันทีโดยไม่ต้องรีสตาร์ต
6. **ข้อจำกัดที่ยอมรับ:** ยังไม่มีผลประเมินกับผู้ใช้จริง, ครอบคลุมเฉพาะ 21 คู่มือ, ค้นหาเป็น in-memory brute force (พอสำหรับ ~3,800 ข้อความ)

---

## ตัวเลขสำคัญ (ทุกตัวมีที่มา)

| เรื่อง | ค่า | ที่มา |
|---|---|---|
| คู่มือ / ผัง / โหนด | 21 / 631 / 4,739 | นับจาก `data/manuals/*.json` (ตรงกับ log บูตใน `docs/STUDY_GUIDE.md` §5.7) |
| ประเภทเครื่อง | Microwave 6 · Refrigerator 5 · Television 5 · Washing Machine 5 | `data/manuals/*.json` · enum ใน `backend/migrations/002_graphs.sql:11` |
| โหนด safety_critical | 368 | นับจาก `data/manuals/*.json` |
| โหนดที่ผู้พัฒนาเขียนเพิ่ม (`author_note`) | 1,264 จาก 4,739 (27%) | นับจาก `data/manuals/*.json` |
| ข้อความในดัชนีค้นหา | 3,814 (ไม่ซ้ำ 1,936 → embed 1,936 ครั้ง) | `buildSymptomTexts` `backend/src/symptom-search/symptom-matcher.ts:43` · dedupe `symptom-search.service.ts:78-88` |
| Embedding model | `Xenova/paraphrase-multilingual-MiniLM-L12-v2` · quantized `q8` · **384 มิติ** · mean pooling + normalize | `backend/src/embedding/embedding.service.ts:5-6, 45-52` |
| ไฟล์โมเดล | ~55.9 MB (`model_quantized.onnx`) อยู่ใน repo · ห้ามโหลดจากเน็ต (`allowRemoteModels = false`) | `backend/model/…/onnx/` · `embedding.service.ts:34` |
| Threshold | **0.55** | `backend/src/symptom-search/symptom-search.service.ts:11` |
| จำนวนผลสูงสุด | **3** | `symptom-search.service.ts:12` |
| ความยาวคำค้น | ≤ 200 ตัวอักษร | `backend/src/symptom-search/symptom-search.dto.ts:4` |
| LLM | Groq (OpenAI-compatible API) · **temperature 0** · ชื่อโมเดลมาจาก env `GROQ_MODEL` / `AUTHORING_LLM_MODEL` (ไม่มีค่าในโค้ด) | `backend/src/rephrase/groq-llm.client.ts:27` · `backend/src/authoring/draft-llm.client.ts:95` |
| Rephrase | max_tokens 1000 · timeout เริ่มต้น 3000 ms · ปิดเป็นค่าเริ่มต้น | `groq-llm.client.ts:28` · `backend/src/app.ts:41` |
| ร่างผังจาก PDF | ส่ง LLM ทีละ **2 หน้า** · เลือกได้ ≤ 10 หน้า · PDF ≤ 200 หน้า, ≤ 10 MB · max_tokens 6000 · timeout 60 s | `drafts.service.ts:19` · `pdf-text.ts:3-5` · `drafts.routes.ts:22` · `draft-llm.client.ts:7-8` |
| JWT | HS256 · อายุเริ่มต้น **7d** · secret ≥ 32 ตัวอักษร | `backend/src/auth/token.ts:4-6, 33` |
| bcrypt | 10 rounds · รหัสผ่าน 8–72 ตัวอักษร (≤ 72 ไบต์) | `auth.service.ts:10` · `auth.dto.ts:5-7` |
| อายุ session | เดินอยู่ 24 ชม. (ต่ออายุทุกขั้น) · จบแล้ว 90 วัน | `backend/src/traversal/session.store.ts:8-10` |
| ประวัติต่อคน | ดึงสูงสุด 50 รายการ · หน้าละ 10 (สูงสุด 50) | `history.store.ts:10` · `history.dto.ts:6-7` |
| Feedback comment | ≤ 500 ตัวอักษร | `history.dto.ts:8` |
| DB pool | 5 connections · `utf8mb4` | `backend/src/database/pool.ts:39-41` |
| Chunk size / overlap | **ไม่พบในโค้ด** — chunk ทำนอกระบบ (คัดข้อความ PDF ให้ LLM จัดรูป) | `docs/ops/VERIFY-CHUNKS-AGAINST-PDF.md:7` |
| Top-K แบบ RAG | **ไม่มี** — ค่าที่ใกล้เคียงคือ `MAX_RESULTS = 3` (ผังให้ผู้ใช้เลือก ไม่ใช่ chunk ป้อน LLM) | `symptom-search.service.ts:12` |

---

## Tech stack + เหตุผล (บรรทัดละข้อ)

- **React 19 + Vite + TypeScript** — SPA เบา deploy บน GitHub Pages ได้ฟรี · type ช่วยจับ bug ตอน build
- **TanStack Query** — cache ข้อมูลจาก server, จัดการ loading/error, invalidate หลัง mutation ไม่ต้องเขียน state เอง
- **React Router 7** — routing ฝั่ง client (มี 404.html fallback สำหรับ GitHub Pages `frontend/vite.config.ts:10-17`)
- **Tailwind CSS** — style ได้เร็ว ไม่ต้องดูแลไฟล์ CSS แยก
- **Express 4 (เดิม NestJS)** — อ่านจากบนลงล่างได้ อธิบายกรรมการได้เอง ไม่มี decorator/DI ซ่อนกลไก (`docs/STUDY_GUIDE.md` §5.7)
- **mysql2 + raw SQL (ไม่มี ORM)** — เห็น SQL ทุกบรรทัด, ใช้ placeholder `?` กัน SQL injection, ไม่ต้องเรียนรู้ ORM
- **MySQL (utf8mb4)** — ภาษาไทย/อีโมจิครบ, ผู้พัฒนาคุ้นเคย, ใช้ Aiven ฟรีได้, ข้อมูลเป็นตารางสัมพันธ์ (ผัง → โหนด, session → history)
- **Transformers.js + ONNX (MiniLM multilingual)** — รันในเครื่อง ไม่มีค่า API, ไม่ส่งข้อความผู้ใช้ออกนอก server, รองรับไทย/อังกฤษในโมเดลเดียว
- **Groq LLM** — มี free tier และเร็ว, API แบบ OpenAI (เปลี่ยนผู้ให้บริการง่าย), รองรับ JSON mode สำหรับร่างผัง
- **bcryptjs + jsonwebtoken** — มาตรฐานของ hash รหัสผ่านและ stateless auth, เป็น pure JS ไม่มี native build
- **multer (memoryStorage) + unpdf** — รับ PDF ในหน่วยความจำ ไม่เขียนดิสก์, unpdf เป็น pdf.js แบบ pure JS
- **Render (free) + GitHub Pages + Aiven MySQL** — ฟรีทั้งหมด เหมาะกับโปรเจกต์นักศึกษา (แลกกับ cold start ~1 นาที `docs/ops/DEPLOY.md:35`)

---

## 5 ประโยคที่ต้องพูดได้ทันที

1. "ระบบไม่ได้ให้ LLM แต่งคำตอบ คำแนะนำทุกขั้นอยู่ในผังที่มาจากคู่มือก่อนผู้ใช้ถาม"
2. "คะแนนความคล้ายคือ cosine similarity ระหว่างข้อความ **ไม่ใช่ความน่าจะเป็นที่วินิจฉัยถูก** และไม่ได้ใช้ตัดสินขั้นตอนใดๆ"
3. "ถ้าไม่มีผังไหนได้คะแนนถึง 0.55 ระบบตอบว่าไม่พบ และไม่เดาให้"
4. "ขั้นตอนอันตรายถูกบังคับด้วยโค้ดฝั่ง server ไม่ใช่แค่ปุ่มบนหน้าจอ"
5. "ยังไม่มีผลประเมินกับผู้ใช้จริง สิ่งที่มีคือการตรวจข้อมูลกับ PDF อัตโนมัติ และแผนวัด hit rate ที่ทำได้ทันที"

## ⚠ ก่อนเดโม (รายละเอียดอยู่ในไฟล์ 14, 15)

- Render deploy จาก **`main` ซึ่งยังเป็น NestJS** (`f9b7e09`) ไม่ใช่ Express ที่กำลังจะเปิดโค้ดโชว์
- หน้าเว็บบน GitHub Pages build ล่าสุด **14 ต.ค.** ซึ่งยังไม่มีหน้า login / ประวัติ / admin (ตรวจจาก bundle บน branch `gh-pages`)
