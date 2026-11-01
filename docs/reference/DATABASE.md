# ฐานข้อมูล (MySQL) — แต่ละตารางเก็บอะไร ใช้ทำอะไร

> schema อยู่ใน `backend/migrations/001–006_*.sql` แบ่งตามเรื่อง (รวมจาก migration เดิม 001–012 เมื่อ 20 ต.ค. 2569 โดยตัด ALTER ออก — ตารางเก่า→ไฟล์ใหม่ ดู `MIGRATION-MAP.md`)
> ศัพท์ผังขั้นตอนเปลี่ยนจาก graph/node เป็น flow/state (พ.ย. 2569) โดย **แก้ไฟล์ 002/004/006 ตรงๆ** ไม่มีไฟล์ migration เปลี่ยนชื่อ — ต้องสร้างฐานข้อมูลใหม่ (ฐานที่สร้างจากไฟล์เดิมใช้กับโค้ดนี้ไม่ได้)
>
> | ไฟล์ | ตาราง |
> |---|---|
> | `001_users.sql` | users |
> | `002_flows.sql` | manuals, flows, states, state_transitions |
> | `003_equipment.sql` | equipment, equipment_usage |
> | `004_sessions.sql` | sessions, session_history |
> | `005_session_feedback.sql` | session_feedback |
> | `006_flow_drafts.sql` | flow_drafts |
>
> เขียนจากไฟล์ SQL + โค้ดที่อ่าน/เขียนตารางจริง (`*.store.ts`, `*.repository.ts`, `backend/scripts/seed-*.js`) + ข้อมูลใน `data/`
> ตัวเลขข้อมูล (21 คู่มือ / 631 ผัง / 4,739 สถานะ ฯลฯ — หลังเอาเครื่องปรับอากาศออก 20 ต.ค. 2569) นับจากไฟล์ใน `data/` ไม่ใช่จากฐานข้อมูลสด

## 1. ภาพรวม: 11 ตาราง แบ่ง 4 กลุ่ม (+ `schema_migrations` ที่ตัวรัน migration สร้างเอง)

```
บัญชี          users
ผังขั้นตอน     manuals ──< flows ──< states ──< state_transitions   (ข้อมูลอ้างอิง: seed จากไฟล์ หรือ admin publish)
อุปกรณ์        equipment ──< equipment_usage         (ข้อมูลอ้างอิง)
การใช้งาน      sessions ──< session_history          (เกิดขึ้นเมื่อผู้ใช้เดินผัง)
               sessions ──  session_feedback
ร่างผัง        flow_drafts                           (ระบบ authoring ของ admin)
```
(ตาราง `schema_migrations` ถูกสร้างโดย `scripts/run-migrations.js` เพื่อจำว่ารันไฟล์ไหนแล้ว — ไม่อยู่ในไฟล์ migration)

| ความสัมพันธ์ (FK) | พฤติกรรมตอนลบ |
|---|---|
| `flows.manual_id → manuals` | ลบคู่มือ = ลบผังของคู่มือนั้น (CASCADE) |
| `states.flow_id → flows` | ลบผัง = ลบสถานะ (CASCADE) |
| `state_transitions (flow_id, from_state_id) → states` | ลบสถานะ = ลบเส้นเชื่อมที่ออกจากสถานะนั้น (CASCADE) |
| `state_transitions (flow_id, to_state_id) → states` | ลบสถานะ = ลบเส้นเชื่อมที่ชี้เข้าสถานะนั้น (CASCADE) |
| `sessions.flow_id → flows` | **RESTRICT** — ลบผังที่ยังมี session อ้างอยู่ไม่ได้ |
| `sessions.user_id → users` | ลบบัญชี = `user_id` ของ session เป็น NULL (SET NULL) แถว session ยังอยู่ |
| `session_history.session_id → sessions` | ลบ session = ลบประวัติขั้น (CASCADE) |
| `session_feedback.session_id → sessions` | ลบ session = ลบ feedback (CASCADE) |
| `equipment_usage.equipment_id → equipment` | ลบอุปกรณ์ = ลบแถวการใช้ (CASCADE) |
| `flow_drafts.created_by / reviewed_by → users` | ลบบัญชี = เป็น NULL (SET NULL) |

ทุกตารางใช้ InnoDB, `utf8mb4`, `utf8mb4_unicode_ci` (ต้องตรงกันทั้งหมดไม่งั้นสร้าง FK ไม่ได้)

---

## 2. กลุ่มบัญชี

### `users` — บัญชีผู้ใช้
**ไว้ทำอะไร:** ล็อกอิน/สมัคร (`/auth/*`) และแยกสิทธิ์ user / admin
**เขียนโดย:** `auth/users.store.ts` (สมัคร) · `scripts/seed-admin.js` (สร้าง/ยกเป็น admin) **อ่านโดย:** `auth.service`, `jwt-auth.guard`

| คอลัมน์ | เก็บอะไร |
|---|---|
| `id` (PK) | UUID v4 ที่ backend สร้าง — ใส่ใน JWT เป็น `sub` |
| `email` (UNIQUE) | อีเมลตัวพิมพ์เล็ก ใช้เป็นชื่อผู้ใช้ ซ้ำไม่ได้ (ชนแล้ว backend ตอบ 409 `EMAIL_TAKEN`) |
| `password_hash` | ผล bcrypt (10 rounds) — ไม่เก็บรหัสผ่านจริง |
| `display_name` | ชื่อที่แสดง 1–100 ตัวอักษร |
| `role` | `user` (ค่าเริ่มต้น) หรือ `admin` — สมัครผ่านหน้าเว็บได้เป็น user เท่านั้น |
| `created_at`, `updated_at` | เวลาสร้าง/แก้ |

**ข้อมูลในตาราง:** เริ่มต้นว่าง หลัง `npm run seed:admin` จะมี admin 1 คน จากนั้นเพิ่มตามคนสมัคร

---

## 3. กลุ่มผังขั้นตอน (ข้อมูลอ้างอิง ผู้ใช้อ่านอย่างเดียว)

> **ข้อมูลกลุ่มนี้มาจาก 2 ทาง:** (1) `npm run seed` โหลดไฟล์ `data/manuals/*.json` (2) admin กด publish ร่างผังจาก PDF
> ตอนบูต `FlowRepository` โหลด `flows` / `states` / `state_transitions` เข้าหน่วยความจำ (ผู้ใช้เดินผังโดยไม่ยิง SQL) และ `SymptomSearchService` ทำเวกเตอร์ค้นอาการจากข้อความในตารางนี้

### `manuals` — คู่มือ 1 เล่ม = 1 แถว
**ไว้ทำอะไร:** ทำรายการ "เลือกเครื่อง → เลือกรุ่น" (`GET /execution/manuals`) และผูกผังเข้ากับรุ่น

| คอลัมน์ | เก็บอะไร |
|---|---|
| `manual_id` (PK) | รหัสคู่มือ เช่น `samsung_ge83mdt_um_de68_04111e` (publish จาก admin ใช้ a-z0-9_ 3–60 ตัว) |
| `device_category` | ประเภทเครื่อง 4 แบบ: Microwave, Refrigerator, Television, Washing Machine (เครื่องปรับอากาศถูกเอาออกเพราะไม่อยู่ใน TOR) |
| `brand`, `model_pattern` | ยี่ห้อ (เช่น Samsung) และเลขรุ่น (เช่น GE83MDT) |
| `source_manual` | ชื่อคู่มือต้นฉบับ ใช้สร้างข้อความ "อ้างอิงหน้าคู่มือ" |
| `flow_count` | จำนวนผังของคู่มือนี้ (โชว์ "N อาการ" ในรายการรุ่น) |
| `display_name` | ชื่อรุ่นที่ผู้ใช้รู้จัก (NULL = แสดง `model_pattern`) |
| `model_aliases` | JSON array เลขรุ่น/ชื่อขายอื่นที่ใช้คู่มือเล่มเดียวกัน (ใช้จับคู่ชื่อรุ่นในหน้าเลือกรุ่น — `frontend/src/lib/models.ts` `manualMatches`) |

**ข้อมูลในตาราง:** 21 แถว (ไมโครเวฟ 6 · ตู้เย็น 5 · ทีวี 5 · เครื่องซักผ้า 5)

### `flows` — ผัง 1 ชุด = 1 อาการ
**ไว้ทำอะไร:** เป็น "หัว" ของผัง — ข้อมูลอาการที่ใช้แสดงในรายการและใช้ค้นด้วย embedding และบอกว่าเริ่มเดินที่สถานะไหน

| คอลัมน์ | เก็บอะไร |
|---|---|
| `flow_id` (PK) | รหัสผัง เช่น `samsung_ge83mdt_um_not_cooked_at_all` |
| `manual_id` (FK) | ผังนี้เป็นของคู่มือไหน |
| `entry_symptom`, `entry_symptom_th` | ชื่ออาการ อังกฤษ/ไทย (ใช้แสดงผล และ **เป็นข้อความที่ถูกแปลงเป็นเวกเตอร์** ตอนค้น) |
| `entry_symptom_aliases` | JSON array คำที่ผู้ใช้อาจพิมพ์ (คำพ้อง) — ถูกแปลงเป็นเวกเตอร์ด้วย |
| `source`, `page_start`, `page_end` | คู่มือและช่วงหน้าที่ผังนี้มาจาก |
| `source_chunk_id` | รหัส chunk ต้นทาง (ผังที่ publish จากร่างใช้รูป `draft:<draftId>:<flowId>` ย้อนกลับไปดูร่างได้) |
| `severity`, `difficulty` | ความรุนแรง (low–critical) / ความยาก (easy–hard) — ข้อมูลประกอบ |
| `config` | JSON เพิ่มเติม (ไม่บังคับ — ผมไม่ได้ตรวจว่าโค้ดฝั่งไหนอ่านค่านี้) |
| `initial_state` | `state_id` ของสถานะแรก |

**ข้อมูลในตาราง:** 631 แถว

### `states` — สถานะของผัง (จุดในแผนที่)
**ไว้ทำอะไร:** เนื้อหาขั้นตอนทั้งหมดที่ผู้ใช้เห็น (เซต Q ของออโตมาตา) — `state-machine` อ่านตารางนี้คู่กับ `state_transitions` เพื่อตัดสินขั้นถัดไป
PK = (`flow_id`, `state_id`) · **เส้นทางไปสถานะถัดไปไม่อยู่ในตารางนี้แล้ว** (เดิมก่อนเปลี่ยนศัพท์เป็นคอลัมน์ `on_yes`/`on_no`/`next_node`/`on_invalid` ของตาราง `nodes`) ดู `state_transitions` ด้านล่าง

| คอลัมน์ | เก็บอะไร |
|---|---|
| `state_type` | `checkpoint` (ถามใช่/ไม่ใช่) · `instruction` (ให้ทำ) · `input` (ให้กรอกค่า) · `resolution` (จบ แก้ได้/ปกติ) · `escalation` (จบ ส่งต่อช่าง) |
| `text_content` | ข้อความของสถานะ (คำถาม / คำสั่ง / ข้อความขอให้กรอก แล้วแต่ชนิด) |
| `input_type`, `input_pattern`, `store_as` | input: ชนิดค่า (error_code/model_number/number/text), regex ตรวจ, ชื่อตัวแปรที่เก็บลง `sessions.variables` |
| `outcome_kind` | สถานะจบเท่านั้น: `user_fixed` / `normal_behavior` / `handoff_informed` / `handoff_unknown` (ผู้เขียนผังกำหนด ต่างจากข้อความ outcome ที่ผู้ใช้พิมพ์) |
| `safety_critical`, `safety_warning` | ขั้นอันตราย: ต้องส่ง `confirm_safety` ถึงจะไปต่อได้ + ข้อความเตือน |
| `has_image`, `image_url` | เผื่อรูปประกอบ (ตัวตรวจผังของ admin ห้ามฟิลด์รูปในร่างจาก LLM) |
| `author_note` | หมายเหตุว่าข้อความนี้ผู้พัฒนาเพิ่มเอง ไม่ได้มาจากคู่มือ |
| `external_reference` | JSON อ้างอิงภายนอก (ไม่บังคับ — ตัวตรวจผังห้ามใช้ในร่างจาก LLM) |
| `display_order` | ลำดับแสดง |

**ข้อมูลในตาราง:** 4,739 แถว — checkpoint 2,146 · instruction 1,107 · resolution 706 · escalation 780 · input 0 (สถานะ input ชุดเดียวที่เคยมีอยู่ในผังแอร์) · มี `safety_critical` 368 สถานะ · outcome: user_fixed 514, normal_behavior 192, handoff_informed 150, handoff_unknown 630

### `state_transitions` — เส้นเชื่อมระหว่างสถานะ (δ)
**ไว้ทำอะไร:** บอกว่า "อยู่ที่สถานะนี้ แล้วได้รับสัญลักษณ์นี้ ให้ไปสถานะไหน" — 1 แถว = 1 เส้นเชื่อม · `FlowRepository` อ่านตารางนี้ตอนบูตแล้วพับกลับเป็น `on_yes`/`on_no`/`next`/`on_invalid` ของแต่ละสถานะในหน่วยความจำ (`GROUP BY` + `MAX(CASE WHEN input_symbol = ...)`) ตัว engine จึงไม่ต้องรู้ว่าแยกตาราง
PK = (`flow_id`, `from_state_id`, `input_symbol`) — สถานะหนึ่งมีทางไปได้ทางเดียวต่อสัญลักษณ์ (deterministic)

| คอลัมน์ | เก็บอะไร |
|---|---|
| `flow_id` | ผังที่เส้นเชื่อมนี้อยู่ (ทั้งสองปลายต้องอยู่ผังเดียวกัน) |
| `from_state_id` | สถานะต้นทาง |
| `input_symbol` | `yes` · `no` · `next` · `invalid` (ความหมายดูตารางเทียบด้านล่าง) |
| `to_state_id` | สถานะปลายทาง |

FK 2 เส้น: `(flow_id, from_state_id) → states` และ `(flow_id, to_state_id) → states` (ทั้งคู่ CASCADE) + INDEX `(flow_id, to_state_id)` — เส้นเชื่อมที่ชี้ไปสถานะที่ไม่มีจริง หรือข้ามผัง สร้างไม่ได้
**เขียนโดย:** `scripts/seed-flows.js` (INSERT หลัง `states` ครบทั้งผัง) และ `authoring/drafts.store.ts` ตอน publish (transaction เดียวกับ `states`)
**ข้อมูลในตาราง:** 5,399 แถว — yes 2,146 · no 2,146 · next 1,107 · invalid 0

#### ตารางเทียบกับออโตมาตา M = (Q, Σ, δ, q0, F)

| สัญลักษณ์ | ความหมายทางทฤษฎี | ในระบบนี้ |
|---|---|---|
| **Q** | เซตของสถานะ | ตาราง `states` — 1 แถว = 1 สถานะของผังหนึ่งผัง (`checkpoint` / `instruction` / `input` / `resolution` / `escalation`) |
| **Σ** | ตัวอักษรนำเข้า (input alphabet) | `state_transitions.input_symbol` มี 4 ตัว: `yes` = ผู้ใช้ตอบ "ใช่" · `no` = ตอบ "ไม่ใช่" · `next` = `continue` / `confirm_safety` ที่สถานะ instruction หรือ `input` ที่ผ่าน pattern · `invalid` = `input` ที่ไม่ผ่าน pattern |
| **δ** | ฟังก์ชันเปลี่ยนสถานะ Q × Σ → Q | ตาราง `state_transitions` — `(flow_id, from_state_id, input_symbol) → to_state_id` · **ถ้าไม่มีแถว `invalid` ของสถานะ input = วนอยู่สถานะเดิม** (engine ใช้ `on_invalid ?? state_id`) |
| **q0** | สถานะเริ่มต้น | `flows.initial_state` |
| **F** | เซตของสถานะรับ (สถานะสิ้นสุด) | `states` ที่ `state_type` เป็น `resolution` หรือ `escalation` — ไม่มี transition ออกเลย · session จบ (`completed`) เมื่อถึงสถานะใน F |

หนึ่งผัง (`flows`) = ออโตมาตา 1 ตัว · หนึ่ง session = การป้อนสัญลักษณ์ใน Σ ทีละตัวจากสถานะ q0 โดยมี `sessions.current_state_id` เป็นสถานะปัจจุบัน และ `session_history` เป็นสายสัญลักษณ์ที่ป้อนมาแล้ว

---

## 4. กลุ่มอุปกรณ์ (ข้อมูลอ้างอิง)

### `equipment` — รายการอุปกรณ์
**ไว้ทำอะไร:** ทะเบียนอุปกรณ์ (ไขควง, ผ้าแห้ง, ไฟฉาย ฯลฯ) ไม่ผูกกับเครื่องใด
**เขียนโดย:** `scripts/seed-equipment.js` จาก `data/equipment/equipment.json`

| คอลัมน์ | เก็บอะไร |
|---|---|
| `equipment_id` (PK) | รหัส เช่น `dry_cloth`, `usb_c_cable` |
| `name_th`, `name_en` | ชื่อไทย/อังกฤษ |

**ข้อมูลในตาราง:** 23 แถว

### `equipment_usage` — เครื่องประเภทนี้ใช้อุปกรณ์ชิ้นนี้ทำอะไร
**ไว้ทำอะไร:** แผง "อุปกรณ์ที่ต้องใช้" ในหน้าเดินผัง (`EquipmentPanel`) — อ่านโดย `equipment.repository.ts` เก็บใน Map ตามประเภทเครื่อง
PK = (`device_category`, `equipment_id`)

| คอลัมน์ | เก็บอะไร |
|---|---|
| `device_category` | ประเภทเครื่อง (ไม่ผูกรุ่น) |
| `purpose_th` | ใช้ทำอะไรกับเครื่องประเภทนี้ |
| `source_page` / `author_note` | **ต้องมีอย่างน้อยหนึ่งอย่าง** (CHECK): หน้าคู่มือที่อ้างได้ หรือหมายเหตุว่าผู้พัฒนาเพิ่มเอง |
| `display_order` | ลำดับแสดง |

**ข้อมูลในตาราง:** 29 แถว (ไมโครเวฟ 6 · ตู้เย็น 7 · เครื่องซักผ้า 7 · ทีวี 9)

---

## 5. กลุ่มการใช้งาน (ข้อมูลที่เกิดตอนผู้ใช้ใช้ระบบ)

### `sessions` — การตรวจ 1 ครั้ง
**ไว้ทำอะไร:** จำว่าผู้ใช้เดินผังไหนอยู่ที่สถานะไหน (สถานะอยู่ที่ DB ไม่ใช่หน้าจอ รีเฟรชแล้วต่อได้) และเป็นฐานของหน้า "ประวัติการซ่อม" กับสถิติ admin
**เขียนโดย:** `execution/session.store.ts` (สร้าง/อัปเดต/บันทึก outcome/ลบ) **อ่านโดย:** execution, `history.store.ts`, `admin.store.ts`

| คอลัมน์ | เก็บอะไร |
|---|---|
| `session_id` (PK) | UUID — เป็น "กุญแจ" เข้าถึง session ของ guest |
| `flow_id` (FK) | เดินผังไหน |
| `current_state_id` | ตอนนี้อยู่สถานะไหน (จบแล้ว = สถานะสิ้นสุด) |
| `status` | `in_progress` หรือ `completed` |
| `variables` | JSON ค่าที่ผู้ใช้กรอกที่สถานะ input เช่น `{"error_code":"E101"}` — ไว้แทน `{{ตัวแปร}}` ในข้อความ |
| `confidence` | คะแนน cosine ของผังที่เลือกเทียบคำค้น (แสดงผลอย่างเดียว) NULL = เลือกจากรายการ ไม่ได้ค้น |
| `outcome_text`, `outcome_at` | ข้อความผลลัพธ์ที่ผู้ใช้พิมพ์หลังจบ (≤1,000 ตัวอักษร บันทึกได้ครั้งเดียว) + เวลา |
| `model_selection` | `selected` (เลือกรุ่นเอง) · `unknown` (ไม่ทราบรุ่น เลือกใกล้เคียง) · NULL — ไว้แยกเคสตอนวัดผล ไม่กระทบขั้นตอน |
| `client_id` | UUID ของเบราว์เซอร์ guest (หัวข้อ `X-Client-Id`) ไว้ดึงประวัติของ guest |
| `user_id` (FK) | บัญชีเจ้าของ (ผู้ล็อกอิน) |
| `expires_at` | หมดอายุ: ยังเดินอยู่ = 24 ชม. นับจากขั้นล่าสุด · จบแล้ว = 90 วัน |

**กฎเจ้าของ:** มีได้แบบเดียวต่อ session — ล็อกอินเก็บ `user_id` (`client_id` = NULL) · guest เก็บ `client_id` (`user_id` = NULL) · ไม่ส่งทั้งคู่ = เดินได้แต่ไม่เข้าประวัติใคร (บังคับที่ `auth/session-owner.ts` ไม่ใช่ constraint)
**ข้อมูลในตาราง:** เริ่มว่าง เพิ่มตามการใช้งาน แถวที่หมดอายุจะไม่ถูกอ่านอีก (`expires_at > NOW()`)

### `session_history` — ทุก action ที่ผู้ใช้ส่งใน session
**ไว้ทำอะไร:** บันทึกเส้นทางที่เดินมาทีละขั้น — ใช้ให้ engine **replay** ตอนแสดงรายละเอียดประวัติ (ตรวจว่าผังยังพาไปจบสถานะเดิม) และตอนโหลด session

| คอลัมน์ | เก็บอะไร |
|---|---|
| `id` (PK) | เลขรันอัตโนมัติ |
| `session_id` (FK) | session ที่เป็นเจ้าของ |
| `step_order` | ลำดับขั้น 0,1,2,… — **UNIQUE คู่กับ `session_id`** เป็นตัวกันสองคำขอซ้อนกัน (คนแพ้ได้ error ข้อมูลไม่เสีย) |
| `state_id` | สถานะที่ผู้ใช้อยู่ตอนส่ง action |
| `action_type` | `answer` · `continue` · `confirm_safety` · `input` |
| `action_value` | ค่าของ action: `yes`/`no` (answer), ข้อความที่กรอก (input), NULL (continue, confirm_safety) |

**ข้อมูลในตาราง:** 1 แถวต่อขั้นที่ผู้ใช้ตอบ ถูกลบตาม session

### `session_feedback` — ให้คะแนนผลการตรวจ
**ไว้ทำอะไร:** ผู้ใช้กด 👍/👎 + ความเห็นสั้นๆ จากหน้ารายละเอียดประวัติ — admin ดูได้ที่ `/admin/feedback` และนับในสถิติ
PK = `session_id` (1 session = 1 คะแนน ส่งซ้ำ = แก้ค่าเดิม)

| คอลัมน์ | เก็บอะไร |
|---|---|
| `helpful` | 1 = 👍 ช่วยได้ · 0 = 👎 ไม่ช่วย |
| `comment` | ความเห็น ≤500 ตัวอักษร (ว่าง = NULL) — ไม่มีตัวกรองข้อมูลส่วนตัวฝั่งเซิร์ฟเวอร์ |
| `created_at`, `updated_at` | เวลาให้คะแนน/แก้ |

**ข้อมูลในตาราง:** ตามจำนวนผู้ที่กดให้คะแนน (admin มองไม่เห็นว่าเป็นใคร เห็นแค่ชนิด user/guest)

---

## 6. กลุ่มร่างผัง

### `flow_drafts` — ร่างผังจาก PDF ที่ยังไม่เผยแพร่
**ไว้ทำอะไร:** admin อัปโหลด PDF → LLM ร่างผัง → ตรวจ/แก้ → เผยแพร่ ตารางนี้เก็บร่างระหว่างทาง **แยกจาก `flows` โดยตั้งใจ** เพื่อให้ผู้ใช้ทั่วไปมองไม่เห็นจนกว่าจะ publish
**เขียนโดย:** `authoring/drafts.store.ts` (ตอน publish จะ INSERT ลง manuals/flows/states ใน transaction เดียว ไม่ทับของเดิม)

| คอลัมน์ | เก็บอะไร |
|---|---|
| `id` (PK) | UUID ของร่าง |
| `status` | `drafting` (LLM กำลังร่าง) · `ready` (รอตรวจ) · `failed` · `rejected` · `published` |
| `manual_id` | รหัสคู่มือที่ตั้งใจให้เป็น (ต้องไม่ซ้ำคู่มือเดิม) |
| `meta` | JSON ข้อมูลคู่มือที่ admin กรอก (ประเภทเครื่อง ยี่ห้อ รุ่น ชื่อคู่มือ ช่วงหน้า) — เซิร์ฟเวอร์ใช้ค่านี้ ไม่เชื่อค่าจาก LLM |
| `pages` | JSON `[{page, text}]` ข้อความของ **ช่วงหน้าที่เลือกเท่านั้น** (ไม่เก็บไฟล์ PDF) — ใช้ให้ validator ตรวจ `source_page` และให้หน้าจอแสดงข้อความต้นฉบับคู่สถานะ |
| `flows` | JSON ร่างผัง (NULL จนกว่า LLM จะตอบ) |
| `validation` | JSON รายงานล่าสุดของ validator (`errors`, `warnings`, `stats`) |
| `progress_done`, `progress_total` | ความคืบหน้า (ช่วงหน้าที่ร่างแล้ว / ทั้งหมด) — หน้าจอ poll ทุก 3 วิ ตอน `drafting` |
| `error_code`, `error_message` | เหตุผลถ้า failed/rejected |
| `llm_model`, `prompt_version` | โมเดลและเวอร์ชัน prompt ที่ใช้ร่าง |
| `created_by`, `reviewed_by` | admin ที่อัปโหลด/ตรวจ (user id ไม่ใช่อีเมล) |
| `created_at`, `updated_at`, `reviewed_at`, `published_at` | เวลาต่างๆ |

**ข้อมูลในตาราง:** เริ่มว่าง เพิ่มเมื่อ admin อัปโหลด PDF ตอนบูต ร่างที่ค้าง `drafting` จะถูกเปลี่ยนเป็น `failed` (`INTERRUPTED`)

---

## 7. ลำดับสร้างและใส่ข้อมูล

```
npm run migrate            # สร้างตารางจาก 001–006 ตามลำดับชื่อไฟล์ (+ schema_migrations)
npm run seed:equipment     # equipment + equipment_usage     ← จาก data/equipment/equipment.json
npm run seed               # manuals + flows + states + state_transitions ← ทีละคู่มือ ดูคำสั่งใน data/runseed.txt (21 ไฟล์)
npm run seed:admin         # users (admin 1 คน)               ← อ่าน ADMIN_EMAIL / ADMIN_PASSWORD จาก .env
```
`sessions`, `session_history`, `session_feedback`, `flow_drafts` ไม่ต้อง seed — เกิดจากการใช้งาน
หลัง seed ผัง ต้อง restart backend (โหลดผัง/ดัชนีค้นหาเข้าหน่วยความจำตอนบูต)

## 8. ข้อควรรู้
- **เพิ่มคอลัมน์/ตารางในอนาคต:** เพิ่มไฟล์ใหม่ต่อท้าย เช่น `007_*.sql` (ตัวรัน migration เรียงชื่อไฟล์และจำไฟล์ที่รันแล้วใน `schema_migrations`) อย่าแก้ไฟล์ 001–006 ถ้ามีฐานข้อมูลที่รันไปแล้ว — มันจะไม่ถูกรันซ้ำ (ครั้งเปลี่ยนศัพท์ flow/state แก้ตรงๆ ได้เพราะสร้างฐานข้อมูลใหม่ทั้งหมด)
- **ไม่มี transaction ใน migration runner** ไฟล์ที่มีหลายคำสั่งถ้าล้มกลางทางอาจเหลือตารางครึ่งๆ — ถ้าเกิด ให้รัน `scripts/reset-database.js` แล้ว migrate ใหม่
- **ข้อความอธิบายในโค้ด** ที่อ้าง "migration 008/011/012" (คอมเมนต์ใน `session.store.ts`, `users.store.ts`, `drafts.store.ts` ฯลฯ) หมายถึงไฟล์เดิมที่รวมแล้ว — ความหมายคือส่วนของตารางที่อธิบายในเอกสารนี้
- ผังที่ admin publish ผ่านหน้าเว็บ **ไม่อยู่ใน `data/manuals/`** — ถ้าล้างฐานข้อมูลแล้ว seed ใหม่ ผังเหล่านั้นหาย ให้ `node scripts/backup-flow-tables.js` ก่อนเสมอ
