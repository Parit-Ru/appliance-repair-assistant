# QA_REPORT — appliance-repair-assistant

ตรวจเมื่อ 12 พ.ย. 2026 · branch `main` ตามสภาพปัจจุบัน (รวมไฟล์ที่ยังไม่ commit) · โหมดตรวจและรายงานเท่านั้น ไม่ได้แก้โค้ด ไม่ได้ commit
ทดสอบบน MySQL localhost ฐาน `fixbot_qa_test` เท่านั้น (ยืนยัน `SELECT DATABASE(), @@hostname` = fixbot_qa_test / Parits ก่อนเขียนข้อมูลทุกครั้ง) ไม่ได้ต่อ DB อื่น ไม่ได้เปิด `fixbot-admin-test.env` ไม่ได้แก้ `.env`

## ตารางบั๊ก (เรียงตามความรุนแรง)

| # | ระดับ | สถานะ | ไฟล์:บรรทัด | อาการ | วิธีทำซ้ำ | แนวทางแก้ |
|---|---|---|---|---|---|---|
| 1 | **Critical** | ยืนยัน · **อยู่ในไฟล์ที่ยังไม่ commit** | `backend/src/execution/execution.service.ts:105` เรียก `sessionStore.findModelSelection` ที่ถูกลบออกจาก `backend/src/execution/session.store.ts` (ช่วงบรรทัด ~178 ของ HEAD) | `tsc` ของ backend ไม่ผ่าน (TS2339) และ `GET /execution/sessions/:id` ตอบ **500** `this.sessionStore.findModelSelection is not a function` ผลคือรีเฟรชหน้า `/session/:id` และกด "ทำต่อ" จากหน้าประวัติใช้ไม่ได้ (หน้าแชตเริ่มใหม่ผ่านเพราะ POST ใส่ cache ไว้ที่ `frontend/src/api/queries.ts:101`) ถ้า deploy จะ `npm run build` ล้ม | `cd backend && npx tsc --noEmit` / เรียก GET session ผ่านสคริปต์ `qa-tests/api-qa.mjs` | คืน method `findModelSelection` (และ `ModelSelectionRow`) กลับใน session.store.ts หรือ `git checkout` ไฟล์นั้นถ้าการแก้ไขไม่ได้ตั้งใจ |
| 2 | Medium | ยืนยัน · อยู่ในไฟล์ที่ยังไม่ commit | `backend/src/execution/session.store.ts:8` | `SESSION_TTL_HOURS` ถูกเปลี่ยนจาก 7 วัน (`7 * 24`) เป็น 24 ชม. และคอมเมนต์ที่อธิบายเหตุผล (ทำต่อจากหน้าประวัติ) หายไป session ที่ค้างจะหมดอายุใน 1 วัน ขัดกับฟีเจอร์ resume | `git diff backend/src/execution/session.store.ts` | ตัดสินใจว่าตั้งใจหรือไม่ น่าจะ revert พร้อมกับข้อ 1 (diff ของไฟล์นี้ดูเหมือนย้อนกลับไปเป็นเวอร์ชันเก่าทั้งไฟล์: ลบ `findModelSelection`, `isOwnedBy`/`delete` คอมเมนต์) |
| 3 | Medium | ยืนยัน (ตัวโค้ด) · สถานะค่าใน .env ไม่ทราบ | `backend/src/rephrase/groq-llm.client.ts:50`, `backend/src/app.ts:38-41` | `GROQ_MODEL` **ไม่มี default** และไม่มีคีย์นี้ใน `backend/.env` (ดูเฉพาะชื่อคีย์) ถ้า `GROQ_MODEL` ว่าง `createGroqClientFromEnv()` คืน null → rephrase ปิดตลอด fallback เป็นข้อความต้นฉบับเงียบ ๆ (เตือนใน log เฉพาะเมื่อ `REPHRASE_ENABLED=true`) | อ่านโค้ดตามบรรทัดที่ระบุ | ตั้ง `GROQ_MODEL` ก่อนเปิดฟีเจอร์ หรือบอกกรรมการว่าปิดเป็นค่าเริ่มต้น (ตามที่ .env.example ระบุ) |
| 4 | Low | ยืนยัน | `frontend/src/lib/clientId.ts:31` | ESLint error `no-empty` (catch ว่าง) ฝั่ง frontend ไม่มี script `lint` ให้รัน | `cd frontend && npx eslint src` | ใส่คอมเมนต์ในบล็อก เช่น `/* localStorage ใช้ไม่ได้ ข้ามไป */` |
| 5 | Low | ยืนยัน (ตามที่โค้ดเขียนไว้เอง) | `backend/src/auth/session-owner.ts` | session/ประวัติของ guest ยืนยันตัวตนด้วย `X-Client-Id` (UUID) อย่างเดียว ใครรู้ UUID ก็อ่านและลบประวัติของ guest นั้นได้ (ทดสอบว่า UUID อื่นอ่านไม่ได้ = ผ่าน) | — | ยอมรับเป็นข้อจำกัดของการออกแบบได้ และควรตอบกรรมการได้ |
| 6 | Low | ยืนยัน | `backend/package.json`, `frontend/package.json` | ไม่มี test ที่เป็นของโปรเจกต์ทั้งสองฝั่ง (ตั้ง jest/vitest ไว้แต่ไม่มีไฟล์), ไม่มี script lint, backend ไม่มี eslint | — | ไม่ต้องแก้ก่อนสอบ |
| 7 | Low (สงสัย) | สงสัย | `states` ผัง `smoke_smell_initial` state `n1` | checkpoint ถามเรื่องควัน/กลิ่นเหม็น ไม่ได้ตั้ง `safety_critical` (ทั้งผังมีแค่ 11 state ที่ตั้งไว้) ส่วนข้อความเตือนถอดปลั๊กอยู่ที่ `n_escalate` ซึ่งเป็นขั้นหลัง | SQL ค้นคีย์เวิร์ดควัน/ไหม้/ไฟฟ้า ใน state ที่ `safety_critical=0` | ให้เจ้าของข้อมูลตัดสินว่าต้องใส่ safety gate ที่ n1 หรือไม่ |

ไฟล์ที่ยังไม่ commit 4 ไฟล์: บั๊กที่อยู่ใน `session.store.ts` คือข้อ 1–2 ส่วน `draft-llm.client.ts`, `HomePage.tsx`, `.env.example` คอมไพล์ผ่าน (HomePage build ผ่าน) ไม่พบบั๊กจากการทดสอบที่ทำ แต่ `draft-llm.client.ts` ยังไม่ได้ทดสอบกับ LLM จริง

## สรุปจำนวน
Critical 1 · High 0 · Medium 2 · Low 4 (ในนี้ 1 รายการเป็น "สงสัย")

## สิ่งที่ตรวจแล้วปกติ
- **Static:** frontend `tsc -b` + `vite build` ผ่าน · migration 001–008 รันบน DB ว่างได้ครบ ตารางตรงกับที่ store ใช้ · ไม่พบ SQL ต่อสตริงจากข้อมูลผู้ใช้ (ที่ใช้ template มีเฉพาะชื่อคอลัมน์จากค่าคงที่ใน flow-admin.store/drafts.store) · pool ตั้ง `utf8mb4` · ไม่พบ unused locals/params ใน backend · ไม่มี `any` เสี่ยง
- **Auth:** register/login/me ผ่าน (อีเมลซ้ำ 409, รหัสผิดข้อความเดียวกับอีเมลไม่มี, token หมดอายุ/secret ผิด/alg=none/token อ้าง admin ปลอม → 401/403, JSON พัง 400, ชื่อมีอีโมจิ/HTML เก็บถูก) · user ธรรมดาเข้า `/admin/*` ได้ 403 ทุกเส้นที่ลอง
- **Chat/Safety:** เดินผังจนจบได้, guest ใช้ได้, ส่ง action ผิดชนิด/หลังจบ/เข้า session คนอื่นถูกปฏิเสธ, ข้าม safety gate ด้วย `continue` ไม่ได้, 11 state ที่ safety_critical มี warning ครบ, escalation 11/11 ส่งต่อ Samsung Customer Care
- **History/Feedback:** เห็นเฉพาะของตัวเอง (guest อื่น/user อื่น 404), pagination ตรวจ query ผิดได้ 400, 👍/ซ้ำ/เปลี่ยนใจ 👎, comment อักขระพิเศษ/SQL/อีโมจิเก็บครบ, 501 ตัว → 400, ลบของคนอื่นไม่ได้
- **Admin flows:** list/filter/validation, แก้ข้อความ, revision เก่า → 409, ลบ (soft) ทั้งที่มี session ค้าง แล้วหายจากฝั่งผู้ใช้ และกู้คืนได้, ลบ/กู้ซ้ำไม่ 500 · **Drafts:** ไม่มีไฟล์ / ไฟล์ว่าง / ไม่ใช่ PDF (415) / 11MB (413) / หน้าผิด / ประเภทเครื่องผิด / manualId ซ้ำ (409) ถูกปฏิเสธ draft ที่ไม่ publish ไม่โผล่ฝั่งผู้ใช้
- **Equipment:** ส่งมากับ session (ผ่านการเริ่ม session) โหลดครบ 4 ประเภท

หมายเหตุผลการทดสอบ: `GET /history?page=999` คืนหน้าสุดท้ายแทนรายการว่าง (clamp ใน `history.service.ts:38`) ผมตัดสินว่าเป็นการออกแบบ ไม่ใช่บั๊ก

## สิ่งที่ตรวจไม่ได้ + เหตุผล
- **Groq rephrase จริง** และ **LLM draft จริง**: ไม่มี `GROQ_MODEL`/`AUTHORING_LLM_MODEL` ที่ใช้ได้ (ไม่ได้เปิดอ่านค่าใน .env) จึงไม่ได้เรียก LLM เลย ไม่ได้ทดสอบ timeout/rate limit/JSON พัง/การเปลี่ยนความหมาย (อ่านโค้ดแล้ว: `rephrase.service.ts` ข้าม safety/resolution/escalation, มี guard ตรวจตัวเลข/ความยาว/markdown และ fallback เมื่อ error ซึ่งดูถูกต้องแต่ยังไม่ได้พิสูจน์ด้วยการรัน)
- **PDF จริง → draft → review → publish** ครบวงจร: ต้องใช้ LLM
- **Frontend ในเบราว์เซอร์** (route guard, token หมดอายุแล้ว redirect, empty/loading state ทุกหน้า, form validation, refresh หน้า): ยังไม่ได้เปิดดูหรือรัน Playwright ตรวจจากโค้ดเฉพาะบางส่วน จึงไม่รายงานว่าผ่าน
- **ตัวเลข Dashboard เทียบข้อมูลจริง:** เห็นแค่ `/admin/analytics/summary` ตอบรูปแบบถูกบนข้อมูลน้อย ไม่ได้เทียบทีละตัวเลข
- **การแก้ `safety_warning` ให้ว่างผ่าน admin PUT:** สคริปต์ `admin-qa.mjs` มีเคสนี้ แต่ทำเฉพาะเมื่อพบ state ที่ `safety_critical` ใน response ของ detail ผมไม่ได้ยืนยันว่าเคสนี้รันจริง ควรตรวจซ้ำ
- **ค้นหาอาการด้วยภาษาธรรมชาติ:** ปิดอยู่ (`SYMPTOM_SEARCH_ENABLED=false`) ตอบ 503 ตามที่ออกแบบ · **ข้อความภาษาไทยพิมพ์ผิด**: ไม่เข้าข่ายเพราะระบบเลือกผัง ไม่ได้รับข้อความอิสระ
- ข้อมูลมีแค่ 1 คู่มือ (Samsung GE83MDT, 9 ผัง) จึงไม่ได้ทดสอบหลายยี่ห้อ/ประเภทเครื่อง · race condition แก้พร้อมกันทดสอบแค่ revision ซ้ำ ไม่ได้ยิงขนาน

## Top 5 ที่ควรแก้ก่อนสอบ
1. **ข้อ 1** คืน `findModelSelection` ใน `session.store.ts` (ไม่งั้น build ล้มและรีเฟรช/ทำต่อหน้าแชตพัง)
2. **ข้อ 2** ตัดสินใจเรื่อง TTL 24 ชม. กับ 7 วัน (เช็กว่า diff ของ session.store.ts ย้อนเวอร์ชันโดยไม่ตั้งใจหรือไม่)
3. หลังแก้ ให้รัน `npm run build` ของ backend และชุด `qa-tests/` ซ้ำ แล้วรีเฟรชหน้าแชตดูด้วยตา
4. **ข้อ 3** เตรียมคำตอบเรื่อง `GROQ_MODEL`/rephrase (เปิดหรือปิดในวันสอบ) และลอง rephrase จริง 1–2 ครั้งก่อนสอบ
5. **ข้อ 4** แก้ ESLint error 1 จุด (แก้ได้ในนาทีเดียว) และเปิดดูหน้า frontend ในเบราว์เซอร์ตรวจ route guard/refresh

## ไฟล์ที่ผมสร้าง/สิ่งที่ทิ้งไว้
- `qa-tests/api-qa.mjs` (99 เคส: ผ่าน 95 ในรอบแรก ที่เหลือ = ข้อ 1 สองเคส + เคสที่ผมคาดผิดสองเคส), `qa-tests/admin-qa.mjs` (33 เคส ผ่านทั้งหมด) · รันด้วย `BASE`/`ADMIN_EMAIL`/`ADMIN_PASSWORD`/`JWT_SECRET` และบังคับให้ BASE เป็น localhost เท่านั้น
- ฐานข้อมูล `fixbot_qa_test` บน localhost (มีข้อมูล test ของผม) ยังอยู่ สั่งลบได้ถ้าไม่ต้องการ · server ทดสอบปิดแล้ว · ไม่ได้แตะ `dist/` ของคุณ (build ไปที่ scratchpad)

ข้อเสนอ commit (ยังไม่ได้ทำ): `fix: restore findModelSelection and 7-day session TTL in session store` ไฟล์: `backend/src/execution/session.store.ts` · และแยกอีกอัน `test: add QA api scripts` ไฟล์: `qa-tests/*`
