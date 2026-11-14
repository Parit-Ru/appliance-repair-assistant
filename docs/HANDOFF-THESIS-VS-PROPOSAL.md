# Handoff: เทียบ Proposal (สอบโครงการ) กับโปรเจกต์จริง — ใช้เขียนเล่มจบ

> ตรวจเมื่อ 5 พ.ย. 2569 บน `main` (commit `d8a93f0` "add flow admin") · ตรวจโดยอ่านโค้ด/migration/ข้อมูล/ผลประเมินจริง ไม่ได้รันระบบ
> ต้นฉบับที่เทียบ: `Proposal_01418499_6621600372_ปริตต์_รุ่งเรือง (1).pdf` (30 หน้า, ปีการศึกษา 2569)
> ไฟล์นี้ตอบแค่ "proposal พูดไว้ว่าอะไร แต่ของจริงเป็นอะไร" — ข้อตกลงการทำงานอยู่ใน §0 ด้านล่าง

## 0. อ่านก่อน (สำหรับ Claude ที่จะช่วยเขียนเล่มจบ)

- ผู้ใช้จะเอา proposal มาต่อเป็นเล่มจบ ห้ามคัดลอกข้อความ proposal ลงเล่มโดยไม่เทียบกับไฟล์นี้ — มีหลายจุดที่ proposal **พูดไม่ตรงของจริงแล้ว**
- **ข้อตกลงการทำงาน (ทำตามทุกเซสชัน):** ผู้ใช้ commit/push เอง ห้ามทำให้ · ห้ามอ่านค่าใน `backend/.env` และ `frontend/.env*` · ห้ามแตะ `package.json`/lock และห้ามเปลี่ยนเวอร์ชันไลบรารี (`npm ci` บน Render จะล้ม) · ผู้ใช้รันสคริปต์ที่เรียก Groq เอง Claude ตีความผล · ห้าม migrate/seed/ต่อ DB จริง (Aiven) เอง · แก้ไฟล์เฉพาะเมื่อผู้ใช้สั่ง ไม่งั้นอธิบายแล้วถามก่อน · ข้อความด้านความปลอดภัยผู้ใช้เป็นคนตัดสิน · อธิบายภาษาไทยง่ายๆ โค้ดสั้น คำสั่งตัวอย่างห้ามใช้ `<placeholder>` · UI ไทยห้ามใช้คำว่า "กราฟ" ให้ใช้ "แผนผังขั้นตอน" · ผู้ใช้เป็นนักศึกษาต้องอธิบายโค้ดกรรมการเอง ก่อนอ้างเลขบรรทัดให้เปิดไฟล์จริงใหม่เสมอ
- ตัวเลขทุกตัวด้านล่างมีที่มา (ไฟล์/คำสั่ง) ถ้าจะใช้ในเล่มให้เปิดไฟล์นั้นเช็กใหม่ก่อน อย่าเชื่อเอกสารเก่าใน `docs/` (ดู §7)
- ส่วนที่ผมตรวจไม่ได้/ไม่แน่ใจ แยกไว้ใน §6 — อย่าเขียนลงเล่มเป็นข้อเท็จจริงจนกว่าผู้ใช้ยืนยัน

## 1. สรุปสั้น (6 บรรทัด)

1. **หัวใจเหมือนเดิม:** state machine ตัดสินขั้นตอนถัดไป, LLM แค่เรียบเรียงถ้อยคำ, บังคับยืนยันคำเตือนก่อนไปต่อ, ค้นอาการด้วย embedding + cosine → engine ไม่มี LLM (`backend/src/state-machine/state-machine.ts` import แค่ `./types`)
2. **เปลี่ยนจาก proposal:** NestJS → Express · "ไม่มีการยืนยันตัวตน" → มี register/login/JWT/role · admin "CLI อย่างเดียว" → มีหน้าเว็บ admin · Python (pdfplumber/pandas/NumPy/sentence-transformers) → ฝั่ง Node · เวกเตอร์ "เก็บใน MySQL" → คำนวณตอนบูตเก็บในหน่วยความจำ
3. **เพิ่มใหม่ (ไม่มีใน proposal):** เลือกรุ่นก่อนค้น · หน้าประวัติ + feedback · กลับมาทำต่อ (resume) · admin อัปโหลด PDF → LLM ร่างผัง → validator → publish · admin ดู/แก้ข้อความ/ลบ-กู้คืนผัง · dashboard/analytics · ชุดประเมิน `eval/` 99 เคส
4. **หายไป:** ชุดต้นแบบแอร์ AR70H (13 ผัง/95 สถานะ) ถูกลบจาก repo · ไม่มีประเภท "เครื่องปรับอากาศ" ใน DB
5. **ไม่ตรง scope:** proposal ว่าข้อมูลหลักคือ "คู่มือซ่อม SelfRepair" แต่ข้อมูลจริง **20 จาก 25 คู่มือที่เข้า DB เป็นคู่มือผู้ใช้/e-Manual** (ที่เหลือ 5 เป็น service manual)
6. **ชุดประเมิน:** มี `eval/` (99 เคส, วัดขั้นค้นอาการ→ผัง) ผลดิบอยู่ที่ `eval/results/` — handoff นี้ไม่สรุปตัวเลข ให้เปิดไฟล์ผลโดยตรง

## 2. ตารางเทียบ: Proposal พูดว่า → ของจริง

สถานะ: ✅ ตรง · ⚠ เปลี่ยน (ต้องแก้เล่ม) · ➕ เพิ่ม · ➖ ลบ/ไม่มี · ❓ ตรวจไม่ได้

| # | หัวข้อ (หน้า proposal) | Proposal พูดว่า | ของจริง | สถานะ | หลักฐาน |
|---|---|---|---|---|---|
| 1 | สถาปัตยกรรมหลัก (น.1, 18) | state machine ตัดสินลำดับ, LLM เรียบเรียงเท่านั้น, engine ไม่เรียก LLM | ตรง. engine เป็น TS ล้วน ไม่มี import LLM. LLM ถูกเรียกที่ `execution.service.ts` หลัง render state | ✅ | `state-machine/state-machine.ts:1-2`, `execution/execution.service.ts:200` |
| 2 | ชนิดสถานะ (ตาราง 4, น.13) | checkpoint / instruction / input / resolution / escalation + `safety_critical` เป็นธงบน instruction | ตรง 5 ชนิด. แต่ธง `safety_critical` อยู่ได้กับ **ทุกชนิด** (BaseState) ไม่ใช่แค่ instruction · เพิ่ม `outcome_kind` 4 แบบ (`user_fixed/normal_behavior/handoff_informed/handoff_unknown`) บน resolution/escalation | ⚠ เล็กน้อย | `state-machine/types.ts:1-28` |
| 3 | Σ ของออโตมาตา (ตาราง 4) | ตอบใช่/ไม่ใช่, ยืนยันทำแล้ว, ยืนยันรับทราบคำเตือน, ค่าที่กรอก (ผ่าน/ไม่ผ่านตรวจ) | ตรง. DB เก็บ δ เป็นตาราง `state_transitions` (PK = flow_id+from+symbol → deterministic) สัญลักษณ์ `yes/no/next/invalid` | ✅ | `migrations/002_flows.sql` |
| 4 | Backend framework (น.14 §2.5) | **NestJS** | **Express 4 + mysql2 (SQL ตรง)** ย้ายแล้ว (commit `129f256`). เหตุผล: ผู้ใช้อธิบาย decorator/guard/DI ให้กรรมการไม่ได้ ไม่ใช่เรื่องประสิทธิภาพ. tag `nestjs-final` + branch `backup/nestjs` ย้อนได้ | ⚠ **ต้องแก้** | `backend/package.json`, `src/app.ts` |
| 5 | การยืนยันตัวตน (ขอบเขต ข้อ 5, น.3) | **"ไม่มีส่วนติดต่อผู้ใช้... ยังไม่มีการยืนยันตัวตน ใช้รหัสเซสชันแทน"** | มี `users` (bcrypt, JWT, role `user/admin`), `/auth/register|login|me`. ยังมี guest ผ่าน `X-Client-Id` (UUID ในเบราว์เซอร์, ไม่ใช่การยืนยันตัวตน). สมัครสาธารณะได้เฉพาะ `user` — admin สร้างได้ทางเดียวคือ `seed-admin.js` | ⚠ **ต้องแก้ scope** | `migrations/001_users.sql`, `auth/*`, `auth/session-owner.ts` |
| 6 | ผู้ดูแลข้อมูล (ขอบเขต ข้อ 5, ขั้นที่ 1,14) | ใช้ **เครื่องมือบรรทัดคำสั่ง** นำเข้า PDF และดูสถิติ | ยังมี CLI (`run-migrations`, `seed-flows`, `seed-equipment`, `seed-admin`, `backup-flow-tables`, `study-measure`) **แต่เพิ่มหน้าเว็บ admin**: `/admin/analytics`, `/feedback`, `/drafts`(+`/:id`), `/flows`(+`/:id`, `/:id/edit`) | ⚠ **ต้องแก้** | `frontend/src/App.tsx:49-56`, `backend/scripts/` |
| 7 | การแปลงคู่มือ (น.15 ขั้น 2–3, §2.1) | แปลง PDF → Chunk JSON → state machine แบบ offline ต่อเล่ม แล้วมนุษย์ตรวจก่อนเผยแพร่ | ยังทำได้แบบเดิม (`scripts/convert_chunks_to_flows.py`, `validate_flow.py`, `data/chuck/` = chunk JSON) **และเพิ่มทางใหม่:** admin อัปโหลด PDF ทางเว็บ → `unpdf` ดึงข้อความเฉพาะช่วงหน้า → LLM (Groq, env `AUTHORING_LLM_MODEL`) ร่างผัง → `flow-validator.ts` → admin ตรวจ/แก้ → publish (INSERT ใน transaction, ไม่ทับของเดิม) เก็บร่างแยกในตาราง `flow_drafts` | ➕ | `src/authoring/*`, `migrations/006_flow_drafts.sql` |
| 8 | Python libs (น.14–15 §2.9) | jsonschema, **pandas, NumPy, pdfplumber, Sentence-transformers** | สคริปต์ Python จริงใช้แค่ **`pymupdf`** (PDF) + **`jsonschema`** (optional) + stdlib. ไม่มี pandas/NumPy/pdfplumber/sentence-transformers เลย. ฝั่ง Node ใช้ `@huggingface/transformers` 4.3.0 (embedding), `unpdf` (PDF ในระบบ authoring) | ⚠ **ต้องแก้** | `scripts/*.py` (grep import), `backend/package.json` |
| 9 | Embedding (น.13–14, §2 ทฤษฎี) | Sentence-BERT [10] + cosine, **ฐานข้อมูล MySQL เก็บเวกเตอร์ของอาการตั้งต้น**, คำนวณ cosine ใน application code | cosine ใน app code ✅ แต่โมเดลคือ `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (q8, 384 มิติ, ONNX บน CPU ผ่าน Node). **DB ไม่มีตาราง/คอลัมน์เวกเตอร์เลย** (ตรวจครบทั้ง 8 migration) — embed ตอนบูตเก็บใน `index` ในหน่วยความจำ (docs/exam-prep/12 §1.4: ~3,800 ข้อความ, RAM ~250–310MB) | ⚠ **ต้องแก้** | `embedding/embedding.service.ts:6-7`, `symptom-search/symptom-search.service.ts:29,79-80` |
| 10 | เกณฑ์ความคล้าย (น.14) | "ต่ำกว่าเกณฑ์ → ข้อมูลไม่เพียงพอ แจ้งติดต่อศูนย์บริการ" (ไม่ระบุตัวเลข) | เกณฑ์ **0.55**, คืนไม่เกิน `MAX_RESULTS` ผัง. ไม่มีผัง ≥ เกณฑ์ → หน้าเว็บแนะนำศูนย์บริการ. ที่มาของ 0.55 = ชุดคำค้นแอร์ที่ AI ร่างเอง (ไม่ใช่ชุดข้อมูลปัจจุบัน) | ✅ (เติมตัวเลข) | `symptom-search.service.ts:11`, `docs/exam-prep/12` §1.5 |
| 11 | LLM เรียบเรียง (น.19 §2.3) | แบบจำลองภาษาขนาดเล็ก, รับเฉพาะข้อความสถานะปัจจุบัน, ถ้าไม่พร้อมแสดงต้นฉบับ | Groq, model จาก env (เท่าที่ key ของผู้ใช้เรียกได้ = `openai/gpt-oss-20b`). **ข้าม** state ที่ `safety_critical`/resolution/escalation, มีด่านตรวจ (`rephrase-guard.ts` ตัวเลข/รหัส/จำนวนคำว่า "ไม่"), timeout 3 วิ, cache, fallback เป็นต้นฉบับ. **ปิดเป็นค่าเริ่มต้น** (`REPHRASE_ENABLED`). ผลจริง: เปลี่ยนแค่ถ้อยคำเล็กน้อย ด่านตรวจจับ "ตัดคำ/เติมกริยา" ไม่ได้ | ⚠ เติมรายละเอียด | `rephrase/rephrase.service.ts:35-38`, `rephrase/groq-llm.client.ts` |
| 12 | รายการอุปกรณ์ (น.19 §2.4, ขอบเขต ข้อ 6) | 2 ตาราง (ชื่ออุปกรณ์ไม่ซ้ำ + ความสัมพันธ์ประเภท↔อุปกรณ์พร้อมคำอธิบาย), ทุกรายการระบุที่มา หรือเป็นของผู้พัฒนา | ตรง: `equipment` + `equipment_usage`, มี `CHECK (source_page IS NOT NULL OR author_note IS NOT NULL)` บังคับที่มา. ข้อมูล AI ร่างเมื่อ 14 ต.ค. ผู้ใช้สั่งเปิดใช้ 17 ต.ค. **"ยังไม่ได้ตรวจทีละรายการ"** (ตามข้อความใน `equipment.json`) | ✅ (+ข้อควรระวัง) | `migrations/003_equipment.sql`, `data/equipment/equipment.json` |
| 13 | บันทึกผลลัพธ์ (น.19 §2.5) | ช่อง input text หลังถึงสถานะสิ้นสุด, ตรวจที่ server, เก็บกับ session, **ไม่มีผลต่อการเปลี่ยนสถานะ**, (Fig.11 แทนปุ่ม "Was this helpful?") | ตรง: `sessions.outcome_text` + `outcome_at`, บันทึกได้ครั้งเดียว. **แต่เพิ่ม** 👍/👎 + ความเห็น ≤500 ตัวอักษรอีกชุด (`session_feedback`) ในหน้าประวัติ → proposal บอกว่าเอา "helpful" ออกแล้ว ของจริงมีกลับมา (คนละที่) | ⚠ เล็กน้อย | `migrations/004,005`, `history/*` |
| 14 | ประวัติ (ขั้น 13, ภาพที่ 1) | ผู้ใช้เรียกดูประวัติของ **เซสชันที่ตนใช้งาน โดยอ้างอิงด้วยรหัสเซสชัน** | หน้า `/history` + `/history/:sessionId`: guest ใช้ `client_id`, ผู้ล็อกอินใช้ `user_id` (guest เห็น/ลบของ user ไม่ได้), แบ่งหน้า, ลบได้, ให้ feedback. จำกัด 50 รายการ | ⚠ | `history/*`, `auth/session-owner.ts` |
| 15 | อายุเซสชัน | ไม่ระบุ | เดินอยู่ **7 วัน** (`SESSION_TTL_HOURS = 7*24`), จบแล้ว **90 วัน**. ⚠ คอมเมนต์ใน `004_sessions.sql` ยังเขียน "24 ชม." — **ผิด/ล้าสมัย** ยึดค่าจาก `session.store.ts` | ➕ | `execution/session.store.ts:9-11` |
| 16 | ประเภทเครื่อง (ขอบเขต ข้อ 1) | ซัมซุง 4 ประเภท: ไมโครเวฟ ตู้เย็น โทรทัศน์ เครื่องซักผ้า (AR70H แอร์ = ต้นแบบ อยู่นอก 4 ประเภท) | DB ENUM = `Microwave, Refrigerator, Television, Washing Machine` (ตรง 4). ข้อมูลใน repo มีเพิ่ม **Range (เตา/ induction) 2 ไฟล์** แต่ **seed ไม่ได้** เพราะ ENUM ไม่รองรับ. แอร์ไม่มีใน DB | ⚠ | `002_flows.sql:23`, `eval/README.md` (ข้อจำกัด) |
| 17 | แหล่งข้อมูล (ขอบเขต ข้อ 1, §2.1, [11]) | คู่มือซ่อม **SelfRepair** (Samsung Parts) = แหล่งหลัก, ยังไม่ได้แปลง | ข้อมูลจริง 27 ไฟล์: **user manual/e-Manual 20 ไฟล์ใน DB** + **service manual 5 ในDB (+2 Range นอก DB)**. ชื่อใน `source_manual` ไม่ได้บอกว่า service manual มาจาก SelfRepair/Samsung Parts จริงหรือไม่ (มี `SVC_manual_*.pdf` ใน `data/pdf/` เฉพาะ Range) | ⚠ **สำคัญ** / ❓ | `data/manuals/*.json` (`source_manual`), `data/pdf/` |
| 18 | ปริมาณข้อมูล | ต้นแบบ 13 ผัง/95 สถานะ (แอร์) | **ใน DB: 25 คู่มือ / 722 ผัง / 6,322 สถานะ** (Microwave 7/108/875, Refrigerator 7/159/1,193, Television 5/288/2,167, Washing Machine 6/167/2,087). ใน repo ทั้งหมด 27 ไฟล์ / 754 ผัง / 6,543 สถานะ (รวม Range 32 ผัง/221) | ➕ | นับจาก `data/manuals/*.json` + `eval/results/real-cases-20261101.json` meta |
| 19 | เลือกอาการ (ขอบเขต ข้อ 2, ขั้น 5–8) | พิมพ์อิสระ **หรือ** เลือกประเภทแล้วเลือกอาการจากรายการ | ทำทั้งสอง **และเพิ่มขั้น "เลือกรุ่น (คู่มือ)" ก่อนค้น**: ประเภท → รุ่น → อาการ (พิมพ์ค้นเฉพาะในรุ่นนั้น). มีทางเลือก "ไม่ทราบรุ่น" (บันทึก `model_selection = unknown`) และหน้า "อาการทั้งหมด" ข้ามรุ่น (`/symptoms/all`). ผังไม่อยู่ในรุ่น → `400 FLOW_MANUAL_MISMATCH` (`execution.service.ts:20`) | ➕ | `pages/DevicesPage.tsx`, `SymptomsPage.tsx`, `AllSymptomsPage.tsx`, `manuals` table |
| 20 | Resume | ไม่มี | session ที่ยังไม่จบกลับมาทำต่อได้, เห็นในประวัติ, เส้นทางที่ผ่านมากู้จาก DB | ➕ | `docs/features/resume-session.md` (commit `1906807`) |
| 21 | Admin จัดการผัง | ไม่มี | ดูรายการ/รายละเอียด, **แก้ข้อความ state** (`text_content`, `safety_warning` ที่ safety_critical ห้ามว่าง), ลบแบบ soft-delete + กู้คืน, กันแก้ชนกันด้วย `revision`, เก็บ snapshot ใน `flow_revisions`. เพิ่ม/ลบ state, แก้เส้นเชื่อม, แก้ระดับผัง = **ยังไม่ทำ** | ➕ | `src/flow-admin/*`, `migrations/007,008`, `docs/design/admin-flow-management.md` |
| 22 | Terminology (ตาราง 6, น.21) | Graph→เครื่องสถานะ/ผังขั้นตอนวินิจฉัย, Node→สถานะ, "RAG ASSISTANT — ไม่ใช้ เพราะไม่ใช่ RAG", FixBot = ชื่อชั่วคราว | โค้ด/DB เปลี่ยนเป็น flow/state/state_transitions แล้ว, endpoint `/execution/*` (เดิม `/traversal`), UI ไทยใช้ "แผนผังขั้นตอน" ห้ามใช้ "กราฟ". `FixBot` ยังอยู่ในชื่อ DB/env บางที่ (`fixbot_eval`, `fixbot_admin_test`) | ✅ | grep ใน `backend/src` |
| 23 | Frontend stack (น.14) | React, Vite, Tailwind | ตรง (React 19, Vite 8, Tailwind 3.4) + TanStack Query 5, React Router 7 (ไม่ได้ระบุใน proposal) | ✅ | `frontend/package.json` |
| 24 | Deploy / DB | MySQL 8.4 บน Aiven | Backend บน Render (free), frontend บน GitHub Pages (`npm run deploy`), DB Aiven. **DB ใช้ร่วมกับโปรเจกต์ FixStep เก่า** (ลบ/ล้างตารางแล้ว FixStep หาย). Render deploy จาก `main` — migration 007/008 **ยังไม่เคยรันบน Aiven** | ➕ | `render.yaml`, `docs/ops/DEPLOY.md` |
| 25 | การประเมินผล (§3 น.19–20) | เปรียบเทียบเชิงกระบวนการ **เชิงคุณภาพ** (ตาราง 5) กับแชทบอท LLM ล้วน — **ไม่มีตัวเลข**; ระยะนี้ไม่ประเมินกับข้อมูล SelfRepair | มี `eval/` วัดเชิงปริมาณ **เฉพาะขั้นค้นหาอาการ** (ผลดิบใน `eval/results/`) ยัง **ไม่มี**: การวัด state machine เทียบแชทบอท, การทดสอบกับผู้ใช้จริง, ผลเดิน flow ครบ | ➕ / ❓ | `eval/README.md`, `eval/results/` |
| 26 | Safety gate | บังคับยืนยันก่อนไปต่อ | ตรง: `safety_critical` ต้องส่ง `confirm_safety` (ส่ง `continue` → `SafetyConfirmationRequiredError`). ⚠ ข้อจำกัด: ยืนยัน = ติ๊ก checkbox ระบบไม่รู้ว่าทำจริง | ✅ | `state-machine.ts:93-95` |
| 27 | การอ้างอิงแหล่งที่มา (ขอบเขต ข้อ 6, ตาราง 5) | "สร้างจากสถานะที่กำลังดำเนินอยู่จริง ไม่มีโอกาสสร้างขึ้นเอง" | จริงเฉพาะ **ระดับผัง** (ชื่อคู่มือ + ช่วงหน้า `page_start–page_end`). **ไม่มี citation รายสถานะ** เป็นฟิลด์ (บางข้อความมี "(คู่มือหน้า N)" ในเนื้อหา 1,785/4,739 สถานะ ตามเอกสารเก่า). `author_note` (ข้อความที่ผู้พัฒนาเพิ่ม) **เก็บใน DB แต่ไม่แสดงให้ผู้ใช้เห็น** | ⚠ **ระวังเขียนเกินจริง** | `docs/exam-prep/12` §1.3, `docs/exam-prep/18` |

## 3. สิ่งที่ "ลบ/หายไป" (ต้องจัดการในเล่ม)

| รายการ | รายละเอียด | ทำอะไรได้ |
|---|---|---|
| **ชุดต้นแบบแอร์ AR70H** (13 ผัง, 95 สถานะ, ภาพที่ 13–14, ผล "การทดลองเบื้องต้น" น.25–28) | ไฟล์ `data/manuals/samsung_ac_ar70h.json` **ไม่อยู่ใน HEAD** (หายใน commit `35e35d7` "refactor: simplify code"). ไม่มี `Air Conditioner` ใน ENUM. `data/runseed.txt` ยังอ้างไฟล์นี้ + สคริปต์ชื่อเก่า `seed-graphs.js` (ตอนนี้คือ `seed-flows.js`) | กู้ได้จาก git: `git show c36a703:data/manuals/samsung_ac_ar70h.json` (ผมยืนยันว่า commit นี้แตะไฟล์นั้น แต่**ยังไม่ได้เปิดดูเนื้อหา**) · ในเล่มควรเขียนเป็น "การทดลองเบื้องต้นช่วงเริ่มโครงงาน" และไม่อ้างว่าเป็นส่วนหนึ่งของระบบปัจจุบัน |
| `Range` (เตา/ induction) 2 ไฟล์, 32 ผัง | อยู่ใน `data/manuals/` แต่ seed ไม่ได้ (ENUM 4 ค่า, validator รับ 4 ค่า) | อย่านับรวมใน "ครอบคลุม 4 ประเภท" · ถ้าจะใช้ ต้องแก้ schema (ผู้ใช้ตัดสิน) |
| ศัพท์ graph/node/traversal | ลบหมดจากโค้ด/DB แล้ว | — (ตรงตาม proposal ตาราง 6) |
| Python deps ที่ proposal ระบุ | pandas, NumPy, pdfplumber, sentence-transformers ไม่มีใน repo | แก้รายการเครื่องมือในเล่มให้ตรง |
| เทสต์อัตโนมัติ | `docs/README.md`: เทสต์ทั้งหมด**ถูกลบตามคำสั่งผู้ใช้** เหลือ config (jest/vitest) · `exam-prep/12` ว่าเหลือ 1 ไฟล์ | **อย่าอ้างจำนวนเทสต์/coverage ในเล่ม** · เอกสารเก่าที่เขียนว่า "jest ผ่าน N เคส" ไม่เป็นจริงแล้ว |
| NestJS | แทนที่ด้วย Express | เก็บไว้เป็นหัวข้อ "การตัดสินใจทางสถาปัตยกรรม" ได้ (เหตุผลจริง + `STUDY_GUIDE §5.7`) |

## 4. สิ่งที่ "เพิ่ม" (proposal ไม่มี) — เล่มต้องมีหัวข้อรองรับ

### 4.1 ฟีเจอร์ (เรียงตามความน่าจะเป็นที่กรรมการถาม)
1. **ระบบบัญชี + role** (`users`, JWT, bcrypt) — กระทบ **ขอบเขต ข้อ 5**, DFD (ภาพที่ 1: เพิ่ม actor/กระบวนการ login), และหัวข้อ "ผู้ใช้งานสองบทบาท" (ตอนนี้มี guest / user / admin)
2. **หน้า admin บนเว็บ** — กระทบ DFD ระดับ 1 กระบวนการ 1 "จัดการข้อมูล" (ภาพที่ 2) และกระบวนการ 4 "สรุปประวัติ" (ภาพที่ 5)
3. **Authoring (PDF → LLM ร่าง → validator → ตรวจ → publish)** — เป็นเวอร์ชัน "บนเว็บ" ของขั้นที่ 1–4 ใน proposal. มี `acknowledgedWarnings` ตอน publish, ผังทดสอบใช้ `manual_id` ขึ้นต้น `demo_`, ร่างแยกตาราง `flow_drafts` (ผู้ใช้มองไม่เห็นจนกว่า publish)
4. **Admin flow management** (ดู/แก้ข้อความ/ลบ-กู้คืน) + `flow_revisions` — ทำตามที่อาจารย์ขอก่อนสอบ **ยังไม่ได้ดูในเบราว์เซอร์** (checklist ข้อ 2–7, 15–17, 20–25, 33–34 ใน `docs/design/admin-flow-management.md`)
5. **เลือกรุ่นก่อนค้น** + "ไม่ทราบรุ่น" + อาการทั้งหมดข้ามรุ่น
6. **ประวัติ + feedback + resume + ลบ session** (เจ้าของตรวจที่ backend)
7. **Analytics/feedback dashboard สำหรับ admin** (`/admin/analytics/summary`, `/admin/feedback`)
8. **ชุดประเมิน `eval/`** (วัดขั้นค้นอาการ→ผัง เท่านั้น ไม่ได้วัดการเดิน flow)

### 4.2 ตาราง DB: proposal คร่าวๆ → จริง 12 ตาราง
`users` · `manuals` · `flows` · `states` · `state_transitions` · `equipment` · `equipment_usage` · `sessions` · `session_history` · `session_feedback` · `flow_drafts` · `flow_revisions` (+ ตาราง tracking ของ migration runner). ฟิลด์ที่ proposal ไม่เคยพูดถึง: `flows.severity/difficulty/revision/deleted_at/edited_by`, `states.author_note/outcome_kind/safety_warning`, `manuals.display_name/model_aliases`, `sessions.confidence/model_selection/client_id/user_id`.
> ข้อควรจำ: state machine เก็บเป็น **ตารางเชิงสัมพันธ์** (`states` + `state_transitions` มี FK ปิดทั้งสองปลาย) ไม่ใช่ JSON ก้อนเดียว — backend อ่านตอนบูตแล้ว "พับ" กลับเป็น `on_yes/on_no/next/on_invalid` (`execution/flow.repository.ts`)

### 4.3 ชุดประเมิน `eval/`
มี `eval/run-real-cases.ts` + `eval/real-cases.json` (99 เคส) + ผลใน `eval/results/real-cases-20261101.*` (DB `fixbot_eval`, เกณฑ์ 0.55) · คำอธิบายตัวชี้วัดและข้อจำกัดอยู่ใน `eval/README.md` — handoff นี้ตั้งใจไม่สรุปตัวเลขซ้ำ ถ้าจะใช้ในเล่มให้เปิดไฟล์ผลโดยตรงและระบุว่าวัดอะไร (ขั้นค้นอาการ→ผัง เท่านั้น)

## 5. ข้อเสนอการแก้ proposal → เล่ม (เรียงตามบท)

| บท/หัวข้อใน proposal | ต้องทำ |
|---|---|
| ที่มา/วัตถุประสงค์ | คงได้. ตรวจคำว่า "คู่มือซ่อมของผู้ผลิต" ให้ตรงข้อมูลจริง (§2 แถว 17) |
| **ขอบเขต ข้อ 1** (ซัมซุง 4 ประเภท, SelfRepair, AR70H) | เขียนใหม่: ระบุ 25 คู่มือ/722 ผัง, สัดส่วน user manual vs service manual, ไม่รวม Range, AR70H = การทดลองเบื้องต้น (ถอดออกจากระบบ) |
| **ขอบเขต ข้อ 5** (ผู้ใช้สองบทบาท/ไม่มียืนยันตัวตน) | เขียนใหม่ทั้งข้อ: guest / user / admin, JWT, admin ผ่านเว็บ + CLI |
| ทบทวนวรรณกรรม | คงได้ทั้งหมด (ไม่ขึ้นกับโค้ด). ตาราง 2 คอลัมน์ "วิธีที่นำเสนอ" ต้องตรวจซ้ำ: "ใช้ได้กับหลายยี่ห้อ ✗" ยังจริง; "ใช้เนื้อหาคู่มือฉบับทางการ ✓" ต้องระวังเรื่อง user manual |
| ทฤษฎี/เครื่องมือ (DFA, cosine) | DFA ตาราง 4 คงได้. แก้ §2 "MySQL ไม่มีฟังก์ชันเวกเตอร์ ระบบจึงคำนวณในโค้ด" ให้เป็น "embed ตอนบูตเก็บใน memory" (ข้อ 9) |
| **อุปกรณ์ที่ใช้พัฒนา** | แก้ NestJS→Express, ตัดรายการ Python ที่ไม่มี, เพิ่ม `@huggingface/transformers`, `unpdf`, `bcryptjs`, `jsonwebtoken`, `multer`, TanStack Query, GitHub Pages/Render |
| วิธีการที่นำเสนอ §1.1 ขั้นตอน 1–14 + §1.2 กลุ่มกระบวนการ + DFD | เพิ่ม: login/สมัคร, เลือกรุ่น, resume, authoring บนเว็บ, ลบ-แก้ผัง. DFD ภาพที่ 1–5 ต้องวาดใหม่ (actor + data store เปลี่ยน) |
| §2.3 การเรียบเรียงถ้อยคำ | เติม: ข้าม safety/terminal, guard, cache, ผลทดลองจริง ("ได้แต่ข้อความเดิมๆ"), ปิดเป็นค่าเริ่มต้น |
| §3 การประเมินผล | เขียนใหม่ตามหลักฐานที่มีจริง (`eval/results/` + `eval/README.md`) และระบุว่าวัดอะไร. ตาราง 5 (เชิงกระบวนการ) ยังใช้ได้ **แต่ต้องมีหลักฐานจริง** เช่นรันเดโมแชทบอทเทียบ (ยังไม่มีใน repo) |
| ตัวอย่าง UI (ภาพที่ 6–13) | mockup Figma ไม่ตรงหน้าจริงแล้ว (ภาพ 12 ยังมีแอร์ ไม่มีทีวี) → เปลี่ยนเป็น screenshot จริงจากเดโมในเครื่อง (runbook: `docs/exam-prep/17-local-demo-runbook.md`) |
| การทดลองเบื้องต้น (AR70H) | คงเป็นหัวข้อ "ที่มาของวิธีแปลงข้อมูล" ได้ แต่ต้องระบุว่าไม่ใช่ข้อมูลระบบปัจจุบัน และข้อสังเกตเดิม ("เงื่อนไขแยกทางเป็นการออกแบบของผู้พัฒนา = การแปลงรูปแบบ ไม่ใช่การสกัด") **ใช้กับข้อมูลทั้งหมดได้เช่นกัน** |
| แผนการดำเนินการ (มิ.ย.–ต.ค. 2569) | ตรวจว่าตรงกับที่ทำจริงหรือไม่ (ผมไม่ได้ตรวจ) |
| เอกสารอ้างอิง | [11] "accessed Oct. 2, 2026" — ถ้า service manual ในระบบไม่ได้มาจาก SelfRepair ต้องเพิ่มแหล่งที่มาจริงของแต่ละเล่ม |

## 6. สิ่งที่ผม **ตรวจไม่ได้ / ไม่แน่ใจ** (ห้ามเขียนเป็นข้อเท็จจริงจนกว่าผู้ใช้ยืนยัน)

1. **service manual 5 เล่มใน DB มาจาก Samsung SelfRepair จริงไหม** — โค้ดไม่บอก (`source_manual` เป็นแค่ชื่อไฟล์/รุ่น)
2. **สถานะ LLM rephrase บน Render** — `render.yaml` ตอนนี้เขียน `REPHRASE_ENABLED: "true"` และ `SYMPTOM_SEARCH_ENABLED: "true"` แต่ความจำก่อนหน้า (14 ต.ค.) บอกปิดไว้ + ค่าที่ตั้งในแดชบอร์ด Render มีผลเหนือไฟล์ → ต้องเช็ก `GET /symptom-search/status` หรือแดชบอร์ดจริง
3. **LLM ฝั่ง authoring ยังไม่เคยทดสอบกับ Groq จริงหลังย้าย Express + rename** (`PROMPT_VERSION = 'v1'` ในไฟล์ปัจจุบัน — ความจำเก่าบอกว่าขยับเป็น v2 → ไม่ตรงกัน ต้องเช็กก่อนอ้าง)
4. **ฟีเจอร์ที่ "เขียนครบ ผ่านเครื่องตรวจ แต่ยังไม่ดูด้วยตา":** admin flow management, เลือกรุ่น, ประวัติ, Step 5 (upload/publish), login ผ่านหน้าเว็บ, CORS จาก GitHub Pages, deploy Render หลัง Express
5. **ตัวเลข 631 ผัง/4,739 สถานะ/22 คู่มือ/644 ผัง/13 ผัง ในเอกสารเก่า** — ไม่ตรงข้อมูลปัจจุบัน (722/6,322/25) ผมนับใหม่จากไฟล์และ meta ของ eval แล้ว แต่ **ไม่ได้ต่อ DB จริงนับ**
6. **ผลตรวจข้อมูลเทียบ PDF** (`docs/ops/VERIFY-GRAPHS-AGAINST-SOURCE.md`): ตามเอกสารเก่า 48 ผังตรวจไม่ได้ + คำแปลไทย/ลำดับขั้นยังไม่ผ่านคนตรวจ + `author_note` 13 จุดใช้เครื่องหมายคำพูดเหมือนอ้างคู่มือทั้งที่เป็นการสรุป — ผมไม่ได้เปิดตรวจซ้ำ
7. **ความถูกต้องของ validator เมื่อเทียบกับ proposal §2.1** (ทุกสถานะถึงได้จาก q0, ทุกสถานะไปถึง F ได้, safety ต้องมีคำเตือน) — เห็นว่ามี `flow-validator.ts` + `validate_flow.py` (เคยรายงาน 629/631 ผ่าน, `rs5000fc` 2 ผังตก schema) แต่ผมไม่ได้ไล่อ่านกฎทีละข้อ ซึ่งผู้ใช้เองก็ยังอ่านค้างอยู่ (ค้างอ่านซ้ำ `flow-validator` ทีละกฎ ดู `docs/study/FLOW-PDF-TO-PUBLISH.md`)
8. **ข้อความด้านความปลอดภัย** — ผู้ใช้เป็นผู้ตัดสินถ้อยคำ (เช่น "ขั้นตอนที่มีข้อควรระวังด้านความปลอดภัย ต้องอ่านและกดยืนยันก่อนทุกครั้ง") ห้ามเขียนทับเอง

## 7. เอกสารใน `docs/` ที่ล้าสมัย (อย่าใช้เป็นแหล่งตัวเลขในเล่ม)

| ไฟล์ | ปัญหา |
|---|---|
| `docs/exam-prep/12-limitations-and-future-work.md` และชุด exam-prep ที่เขียนก่อน rename | อ้าง `002_graphs.sql`, `traversal-engine`, `graph-validator.ts`, 631 ผัง/21 รุ่น — ชื่อไฟล์/ตัวเลขเก่า. **เนื้อหา/เหตุผลยังใช้ได้** ใช้เป็นแหล่งข้อจำกัดได้ แต่ต้องเปิดไฟล์จริงเช็กเลขบรรทัดก่อนอ้าง |
| `docs/reference/*` (FILE-MAP, FILES-*.md) | เขียนตอนเป็น NestJS — ผู้ใช้ห้ามแก้ถ้าไม่ถาม |
| `docs/ops/DEPLOY.md` | บอก "13 ผัง" (จริง 722 ผัง/25 คู่มือ) · ข้อ 3 ใน readme-fixes ยังไม่แก้ |
| `docs/exam-prep/19-study-guide.pdf` | พิมพ์วันสอบเก่า (2 พ.ย.) — วันสอบจริง **7 พ.ย. 2569** ต้อง export ใหม่จาก `.html` |
| `docs/archive/*` | เอกสารประวัติ (พอร์ตจาก FixStep, NestJS) |
| `backend/migrations/004_sessions.sql` (คอมเมนต์) | บอกอายุ session 24 ชม. — โค้ดจริง 7 วัน |
| `data/runseed.txt` | อ้างสคริปต์/ไฟล์ที่ไม่มีแล้ว (`seed-graphs.js`, `samsung_ac_ar70h.json`) |

## 8. ข้อเสนอลำดับงานถัดไป (ผู้ใช้เลือก)

1. ตัดสินใจ **นิยามแหล่งข้อมูล** (user manual vs service manual vs SelfRepair) — กระทบถ้อยคำทั้งเล่ม
2. กู้/ตัดสินใจเรื่อง AR70H (เก็บเป็นประวัติหรือถอดจากเล่ม)
3. วางแผน "ประเมินกระบวนการ" จริง (state machine vs แชทบอท LLM ล้วน) ที่ตาราง 5 ของ proposal สัญญาไว้ — ตอนนี้ไม่มีหลักฐานใน repo
4. ดูฟีเจอร์ที่ยังไม่ดูด้วยตา (§6 ข้อ 4) ก่อนใส่ screenshot ลงเล่ม
5. วาด DFD/ผังสถาปัตยกรรมใหม่ให้ตรงกับของจริง
