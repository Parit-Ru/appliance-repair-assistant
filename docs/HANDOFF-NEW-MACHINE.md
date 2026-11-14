# Handoff: ย้ายเครื่อง (5 พ.ย. 2569)

เอกสารนี้แทนความจำของ Claude ที่ติดอยู่บนเครื่องเก่า ให้ Claude บนเครื่องใหม่อ่านไฟล์นี้ก่อนเริ่มงาน

## 1. สถานะโค้ด

- `main` = Express + mysql2 (ไม่ใช่ NestJS แล้ว) และรวมงานทั้งหมดแล้ว: express-migration, flow-state-rename, ฟีเจอร์ admin flow (ดู/แก้ข้อความ/ลบ-กู้คืน), resume session
- branch อื่นทั้งหมด (`admin-flow-management`, `flow-state-rename`, `express-migration`, `simplify`, `refactor/cleanup`, `backup/nestjs`, `resume-session`) merge เข้า `main` แล้ว ไม่ต้อง push ก็ไม่เสียงาน
- `backup/nestjs` + tag `nestjs-final` = จุดย้อนกลับของ NestJS
- ผู้ใช้ push `main` ขึ้น GitHub แล้ว (5 พ.ย.) repo: `Parit-Ru/appliance-repair-assistant`
- ศัพท์ในโค้ด/DB เปลี่ยนแล้ว: graph/node → **flow/state**, ตาราง `state_transitions` ไม่มี migration 007 แบบเดิม (แก้ 002/004/006 ตรง) ต้องสร้าง DB ใหม่ ดู `docs/ops/DEPLOY.md`
- UI ภาษาไทยห้ามใช้คำว่า "กราฟ" ให้ใช้ "แผนผังขั้นตอน"

## 2. สิ่งที่ git ไม่เก็บ (ต้องก๊อปเอง)

| ไฟล์ | หมายเหตุ |
|---|---|
| `backend/.env` | ชี้ Aiven (DB จริง fixbot_eval) ห้ามอ่านค่า/ห้ามพิมพ์ |
| `fixbot-admin-test.env` (โฟลเดอร์ `499/`) | env สำหรับ DB ทดสอบ `fixbot_admin_test` บน localhost |
| `data/pdf/` | PDF คู่มือต้นฉบับ |
| `backend/backups/` | ไฟล์ backup |
| `499/project-study-guide.pdf` | |

เครื่องใหม่: ติดตั้ง Node, git, MySQL 8 → `git clone` → `npm install` ทั้ง `backend/` และ `frontend/` → วาง `.env` → รัน migration (`node scripts/run-migrations.js --status` ใน backend; อย่าใช้ `npm run migrate -- --status` บน PowerShell 5.1 เพราะตัด `--`)

## 3. กำหนดการ

- **สอบป้องกัน 7 พ.ย. 2569** (ไม่ใช่ 2 พ.ย.) `docs/exam-prep/19-study-guide.pdf` ยังพิมพ์วันเก่า ต้อง export ใหม่จาก `.html`
- เดโมทำจากเครื่องตัวเอง (ดู `docs/exam-prep/17`) ไม่ใช่ Render
- Render deploy จาก `main`

## 4. ข้อตกลงการทำงาน (ต้องทำตามทุกเซสชัน)

- ผู้ใช้ commit/push เอง ห้ามทำให้ (เว้นแต่สั่งชัด)
- ห้ามอ่านค่าใน `backend/.env` และ `frontend/.env*`
- ห้ามแตะ `package.json`/lock ห้ามเปลี่ยนเวอร์ชันไลบรารี (`npm ci` บน Render จะล้ม)
- ผู้ใช้รันสคริปต์ที่เรียก Groq เอง Claude ตีความผล
- แก้โค้ดเฉพาะเมื่อผู้ใช้สั่ง ("ใส่ให้", "ทำเลย") ไม่งั้นอธิบายแล้วให้ผู้ใช้พิมพ์เอง
- อธิบายภาษาไทยง่ายๆ พร้อมผลทดลองจริง โค้ดสั้น คำสั่งตัวอย่างห้ามใช้ `<placeholder>`
- ห้าม migrate/seed/ต่อ DB จริง (Aiven) เอง · ข้อความด้านความปลอดภัย ผู้ใช้เป็นคนตัดสิน
- ผู้ใช้เป็นนักศึกษา ต้องอธิบายโค้ดกรรมการเอง และแก้/ลบคอมเมนต์เอง ก่อนอ้างเลขบรรทัดให้เปิดไฟล์จริงใหม่เสมอ

## 5. งานที่ค้าง / ยังไม่ได้ทดสอบ

**admin flow management** (ทำเสร็จ merge แล้ว) · เอกสารแบบ `docs/design/admin-flow-management.md`
- ตรวจ API ด้วยสคริปต์ผ่านหมด (A 23, B 40, C 47 ข้อ) แต่ **ยังไม่ได้ดูในเบราว์เซอร์** (checklist ข้อ 2–7, 15–17, 20–25, 33–34)
- backend อ่าน `deleted_at` ตอนบูต → รันบน DB ที่ยังไม่ migrate 007/008 จะบูตไม่ขึ้น (Aiven ยังไม่ migrate) อย่ารัน `start:dev` โดยไม่ชี้ test env
- ใช้ `DOTENV_CONFIG_PATH` ชี้ `fixbot-admin-test.env` + ตรวจว่า host = localhost และ DB_NAME = `fixbot_admin_test` ก่อนทุกครั้ง
- เลื่อนหลังสอบ: เพิ่ม/ลบ state, แก้เส้นเชื่อม, แก้ระดับผัง, validator เต็ม, `POST /validate`, migrate Aiven, deploy

**ฟีเจอร์ค้างอื่น**
- LLM rephrase (Groq): โค้ดครบ ปิดบน Render รอผู้ใช้เลือก A คงเดิม / B เรียบเรียงมากขึ้น / C ปิดไว้เปิดตอนสาธิต · อย่าเปิดหรือแก้ prompt เอง · ตรวจสถานะจริงที่ `/symptom-search/status` ไม่ใช่ `render.yaml` · prompt v2 (key flows/states) ยังไม่เคยลองกับ Groq จริง
- เลือกรุ่นก่อนค้น (ประเภท→รุ่น→อาการ) และหน้าประวัติการซ่อม `/history` · เขียนครบ ผ่านเครื่องตรวจ แต่ **ยังไม่ดูด้วยตา**; ยังไม่ทดสอบ `POST /sessions` + `modelSelection` กับ DB จริง · ต้อง `display_name`/`model_aliases` ในไฟล์คู่มือที่เป็นรหัสเอกสาร (ทีวี 5 ไฟล์ + ตู้เย็น DA68-02676A) · `seed-equipment.js` ปฏิเสธเพราะ `reviewed_by_author: false` ห้ามแก้ธงเอง
- ระบบบัญชี + ร่างผังจาก PDF (Step 5): เขียนครบ ยังไม่ทดสอบจริง (Groq จริง, migration, publish) ตาม `docs/authoring/authoring-step5.md` หัวข้อ 6 · publish ต้องส่ง `acknowledgedWarnings` · ผังทดสอบใช้ `manual_id` ขึ้นต้น `demo_` · dump DB ก่อน publish ครั้งแรก
- ปัญหาเล็กจาก READING_ROADMAP: ข้อ 1 DELETE ตรวจเจ้าของ เสร็จ · ข้อ 2 `/health` รั่วข้อความ error MySQL ยังไม่แก้ · ข้อ 3 `DEPLOY.md` บอก 13 ผัง (จริง 22 คู่มือ / 644 ผัง ตามไฟล์ข้อมูล) ยังไม่แก้
- frontend review (`docs/FRONTEND_REVIEW.md`): กลุ่ม 1–3 ทำแล้ว, 4 ไม่ทำ, 5+ หยุดไว้ · `docs/reference/` ห้ามแก้ถ้าไม่ถาม (FILE-MAP ยังเขียนตาม Nest)
- lint frontend มี error เดิมที่ `lib/clientId.ts:31` (ไม่ใช่ของงานล่าสุด)

## 6. ความคืบหน้าอ่านโค้ดเตรียมสอบ

- รอบ PDF→publish อ่านครบ ค้างกลับมาอ่านซ้ำ `graph-validator` ทีละกฎ (flow เต็ม `docs/study/FLOW-PDF-TO-PUBLISH.md`)
- รอบอ่านจากแกนกลาง (Express): อ่านแล้ว `app.ts`, `main.ts`, `error-handler.ts` (⭐ สำคัญ), กำลังอ่าน `auth/token.ts` → `auth.middleware.ts` · 🔖 ต้องกลับมาทวน: `traversal.dto.ts`, `traversal.routes.ts`, `embedding.service.ts` (⭐ คู่กับ `docs/study/EXPLAIN-MODEL-SLIM.md`)
- ถัดไป: rephrase, history/admin, authoring, frontend · ความคืบหน้าละเอียด `docs/study/READING-PROGRESS.md` · สรุปไฟล์ backend `docs/study/BACKEND-FILES-EXPRESS.md`

## 7. ข้อเท็จจริงที่ไม่เห็นจากโค้ด

- เหตุที่ย้ายจาก NestJS: ผู้ใช้อ่าน decorator/guard/DI แล้วอธิบายกรรมการไม่ได้ ไม่ใช่เรื่องประสิทธิภาพ (STUDY_GUIDE §5.7)
- ใช้คำ "retrieval-guided troubleshooting state machine" ทุกเอกสาร
- ผลตรวจ author_note 1,264 โหนด: ไม่มีในคู่มือเลยจริงๆ ~36 ทั้งก้อน + ~45 บางส่วน (ไม่ใช่ 81) ตัวเลขที่จัดด้วยกฎต้องบอกว่า "ประมาณ"
- DB บน Aiven ใช้ร่วมกับโปรเจกต์ FixStep ลบ/ล้างตารางแล้ว FixStep หาย
- โควตา Groq ของ key นี้ ~12–16 คำขอ/นาที ใช้ได้เฉพาะ `openai/gpt-oss-20b`
- ทดสอบ DB แยก: เปิด `mysqld --no-defaults --datadir=<scratch> --port=3399` อย่าแตะ mysqld พอร์ต 3306 ของผู้ใช้
- ไฟล์ frontend ปน CRLF/LF ตรวจด้วย `tr -cd '\r' | wc -c` เทียบ `wc -l`
- สคริปต์ตรวจ admin (harness.js, check-a/b/c.js) อยู่ใน scratchpad เครื่องเก่า ไม่ได้อยู่ใน repo ถ้าต้องใช้ให้เขียนใหม่

## 8. ข้อความเริ่มต้นสำหรับเครื่องใหม่

> อ่าน `docs/HANDOFF-NEW-MACHINE.md` ก่อน แล้วสรุปให้ฟังสั้นๆ ว่าอยู่ตรงไหน ถามผมก่อนแก้ไฟล์ใดๆ
