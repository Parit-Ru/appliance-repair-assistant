# กลับมาทำต่อ (Resume session)

เอกสารนี้อธิบายว่าทำไม session ที่เดินผังไม่จบถึง "หาย" ก่อนแก้ แก้อย่างไร และมีพฤติกรรมที่ต้องรู้อะไรบ้าง
เขียนไว้สำหรับอธิบายอาจารย์ ลำดับตามขั้นที่ลงมือทำ (2.1–2.5)

## 1. ปัญหา

ผู้ใช้เริ่มเดินผัง (flow) แล้วออกกลางทาง (ยังไม่ถึงสถานะสิ้นสุด resolution/escalation) แล้วกลับมาไม่ได้ ไม่เห็นในหน้าประวัติ

**ข้อมูลไม่ได้หาย** session ถูกเก็บลง DB ตั้งแต่ตอนเริ่ม (`SessionStore.create`) และบันทึกทุกขั้น (`sessions` + `session_history`)
state ปัจจุบันอยู่ในคอลัมน์ `current_state_id` ไม่ใช่หน่วยความจำ จึงรอด server restart (เช่น Render free plan หลับ)
สาเหตุที่ "หาย" มี 4 ชั้น:

| # | สาเหตุเดิม | แก้ที่ขั้น |
|---|---|---|
| 1 | หน้าประวัติกรอง `status = 'completed'` ใน SQL | 2.2 |
| 2 | ไม่มีลิงก์กลับไป `/session/:id` | 2.4 |
| 3 | อายุ session ที่ยังไม่จบ 24 ชม. แล้ว query ทุกตัวกรอง `expires_at > NOW()` | 2.2 |
| 4 | เส้นทางที่ผ่านมา (trail) เก็บใน React state เท่านั้น กลับมาแล้วว่าง | 2.3 + 2.5 |

และมีช่องโหว่ที่เกี่ยวกับ "เห็นเฉพาะของตัวเอง": `authorize()` เดิมตรวจแค่ `user_id` session ของ guest (user_id เป็น NULL) ใครมี id ก็เปิดและเดินต่อได้ → แก้ที่ 2.1

## 2. หลักการที่ยึด

- **ไม่แตะ engine** (`state-machine.ts` ยังเป็น pure TypeScript ไม่ผูก framework) resume ทำแค่ "อ่าน state เดิมจาก DB แล้ว render" ทุก action ที่ส่งต่อยังผ่าน `submitAction` ของ engine เหมือนเดิม
- **LLM ไม่มีอำนาจตัดสินการเดินผัง** ข้อความ rephrase ยังเป็นแค่ข้อความแสดงผล
- **ไม่มี migration ใหม่** ใช้คอลัมน์ `status` (`in_progress`/`completed`), `model_selection`, `client_id`, `user_id` ที่มีอยู่แล้ว
- **ไม่เพิ่มสถานะ `abandoned`** ใช้ "in_progress ที่หมดอายุ" แทน (ผู้ใช้เลือก: เรียบง่ายที่สุด)

## 3. สิ่งที่แก้แต่ละขั้น

### 2.1 ตรวจเจ้าของให้ครบ (ช่องโหว่ guest)
- `SessionStore.isOwnedBy(sessionId, owner)` ใช้ `ownerWhere()` ตัวเดียวกับหน้าประวัติ: user เทียบ `user_id` · guest เทียบ `client_id AND user_id IS NULL`
- `ExecutionService.authorize` ถ้าไม่ใช่เจ้าของ → 404 `SESSION_NOT_FOUND` (เหมือนไม่มี session นั้น ไม่เปิดเผยว่ามีจริง)
- route `GET /sessions/:id`, `POST …/actions`, `POST …/outcome` ใช้ `resolveRequiredOwner` (ต้องล็อกอิน หรือส่ง `X-Client-Id`)
- frontend `getSession` / `submitAction` / `submitOutcome` ส่ง `ownerHeaders()`
- session ที่ไม่มีเจ้าของเลย (ไม่ล็อกอิน ไม่ส่ง client id ตอนเริ่ม) เปิดไม่ได้อีก

### 2.2 ลิสต์ประวัติรวม in_progress + อายุ 7 วัน
- `HistoryStore.listSessions` ดึงทั้งสองสถานะ เรียง `in_progress` ก่อน แล้วใหม่สุดก่อน (`ORDER BY (status='in_progress') DESC, created_at DESC`)
- `HistoryListItemDto` เพิ่ม `status` ส่วน `outcomeKind` เป็น null เองเมื่อยังไม่ถึงสถานะสิ้นสุด
- ลบจากหน้าประวัติ: `deleteSession` ลบได้ทุกสถานะ (ยังตรวจเจ้าของ) ส่วนรายละเอียด/feedback ยังเป็นของ completed เท่านั้น
- `SESSION_TTL_HOURS` 24 → `7 * 24` (ต่ออายุทุกขั้นเหมือนเดิม) ค่าที่จบแล้วยัง 90 วัน

### 2.3 ข้อมูลสำหรับ resume ฝั่ง backend
- `GET /execution/sessions/:id` คืนเพิ่ม `trail` (`{state, action}` ของขั้นที่ผ่านมา สร้างจาก `session_history` ด้วย `getCurrentState` ซึ่งเป็นการ render อย่างเดียว) และ `modelSelection`
- ถ้าผังถูกแก้จนหา state เก่าไม่เจอ → `trail: []` (เดินต่อจาก state ปัจจุบันได้ตามปกติ)
- ฟิลด์ทั้งสองมีเฉพาะผลของ `GET` ไม่ส่งใน start/actions/outcome

### 2.4 หน้าประวัติ
- แถว in_progress: ป้าย "กำลังดำเนินการ", ข้อความ "ทำต่อ", ลิงก์ไป `/session/:id` (ไม่ใช่ `/history/:id` เพราะรายละเอียดมีเฉพาะที่จบแล้ว), ยังมีปุ่มลบ

### 2.5 หน้าเดินผัง
- `SessionPage` อ่าน `trail`/`modelSelection` จากผลของ `GET` ครั้งแรกครั้งเดียว แล้วตั้งเป็น state (ตั้งทับ ไม่ต่อท้าย)
  เหตุที่ต้องเก็บเอง: ผลของ `POST actions` ถูกเขียนทับ cache ของ `GET` และไม่มีสองฟิลด์นี้
- `modelSelection` ใช้ค่าจาก navigate state ก่อน ไม่มีจึงใช้ค่าจากเซิร์ฟเวอร์ ถ้า DB เป็น NULL ปล่อยเป็น undefined (ไม่เติม 'selected' เอง)
- ตอนโหลดเส้นทางเดิมไม่เลื่อนหน้า/ไม่ย้ายโฟกัส

## 4. Safety gate ตอน resume

ไม่มีโค้ดพิเศษ เพราะ gate ถูกบังคับที่ engine ทุก action:
- state ปัจจุบันมาจาก DB หยุดที่ gate (`instruction` + `safety_critical`) กลับมาจะเห็น gate เดิมพร้อมปุ่มยืนยัน (`requiresSafetyConfirmation`)
- `resolveNextState` ปฏิเสธ `continue` ที่ gate ด้วย `SafetyConfirmationRequiredError` ต้องส่ง `confirm_safety` เท่านั้น
- resume จึงข้าม gate ไม่ได้ และ server ไม่ได้เชื่อ frontend

## 5. session ที่สร้างตอนเป็น guest แล้วผู้ใช้ล็อกอินทีหลัง

**เปิดไม่ได้** session ผูกกับ `client_id` ของเบราว์เซอร์ (`user_id` เป็น NULL) เมื่อล็อกอิน คำขอถูกตีความเป็น owner แบบ user และ `ownerWhere` เทียบ `user_id` จึงไม่ตรง → 404
- ตรงกับคำเตือนเดิมในหน้าประวัติ: ประวัติก่อนล็อกอินยังผูกกับเบราว์เซอร์ ดูได้เมื่อออกจากระบบ
- ออกจากระบบแล้ว (guest เดิมในเบราว์เซอร์เดิม) กลับมาเปิดและทำต่อได้ถ้ายังไม่หมดอายุ
- ไม่มีการย้ายเจ้าของตอนล็อกอิน (ไม่อยู่ในขอบเขต ถ้าต้องการเป็นงานแยก)
- ผู้ใช้อีกบัญชีหนึ่งหรือ guest คนอื่นเปิดไม่ได้เช่นกัน

## 6. ผลต่อส่วนอื่น

- **admin analytics**: `expired_unfinished` นับ in_progress ที่ `expires_at <= NOW()` ตอนนี้เกินช้าลงเป็น 7 วัน ตัวเลข `inProgress` จะมากขึ้นชั่วคราว ไม่ผิด แต่ความหมายของกราฟเปลี่ยน
- **คอมเมนต์ใน migration 004** ยังเขียน "24 ชม." (ไม่แก้ไฟล์ migration เก่า) ค่าจริงอยู่ที่ `SESSION_TTL_HOURS` ใน `session.store.ts`
- **ไม่มีงานล้างแถวหมดอายุ** (เหมือนเดิม) แถวที่หมดอายุค้างใน DB แต่ query มองไม่เห็น
- **deploy**: backend กับ frontend ต้องขึ้นพร้อมกัน ถ้า backend ใหม่คู่ frontend เก่า การเปิด/เดิน session ของ guest จะได้ 400 (ไม่มี `X-Client-Id`)
- session เก่าที่สร้างก่อนแก้ยังมี `expires_at` เดิม (24 ชม.) จนกว่าจะเดินขั้นถัดไปจึงต่อเป็น 7 วัน
- ประวัติจำกัดสูงสุด 50 รายการ (`MAX_HISTORY_ROWS`) รวมทั้งสองสถานะ

## 7. สิ่งที่ยังไม่ได้ทำ / ข้อจำกัด

- **ยังไม่มีเทสต์อัตโนมัติ** (ร่างเทสต์ 3 ข้อเคยเขียนและผ่านแล้ว แต่ถูกลบออกตามที่ผู้ใช้สั่ง) ยังไม่ได้ทดสอบ SQL ของ `isOwnedBy`/`listSessions` กับ MySQL จริง
- ถามก่อนเริ่มผังใหม่เมื่อมี session เดิมของอาการเดียวกันค้างอยู่ (D7): ไม่ได้ทำ เริ่มใหม่ได้เสมอ รายการอาจซ้ำ
- ยังไม่ได้ดูหน้าจอจริง

## 8. รายการลองมือกับ DB ทดสอบ (ก่อน deploy)

ใช้ DB ทดสอบเท่านั้น (ไม่ใช่ Aiven) แล้วรัน backend + frontend:
1. เป็น guest เริ่มตรวจอาการ ตอบ 1–2 ข้อ แล้วปิดแท็บ → เปิด `/history` ต้องเห็นรายการ "กำลังดำเนินการ" อยู่บนสุด → กด "ทำต่อ" ต้องกลับมา state เดิมพร้อมเส้นทางที่ผ่านมา
2. ตอบจนถึง safety gate แล้วออก → กลับมาต้องเจอ gate เดิม ปุ่ม "ไปต่อ" ธรรมดาต้องไม่มี/ส่ง `continue` ด้วย curl ต้องได้ error
3. เปิดลิงก์ `/session/<id>` ใน private window (client id อื่น) ต้องได้ "ไม่พบ session"
4. ล็อกอินแล้วเปิดลิงก์ session ที่สร้างตอนเป็น guest ต้องได้ "ไม่พบ session"
5. กดลบรายการ "กำลังดำเนินการ" จากหน้าประวัติ → รายการหาย
6. ตรวจ `expires_at` ของ session ที่เพิ่งเดินขั้นล่าสุด ควรอยู่ห่างจากปัจจุบัน ~7 วัน

## 9. ไฟล์ที่เกี่ยวข้อง

Backend: `execution/{session.store,execution.service,execution.routes,execution.dto}.ts`, `history/{history.store,history.service,history.dto}.ts`
Frontend: `api/{execution,types}.ts`, `pages/{SessionPage,HistoryPage}.tsx`, `components/history/HistoryRow.tsx`, `lib/historyView.ts`
