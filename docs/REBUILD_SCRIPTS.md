# REBUILD_SCRIPTS — สคริปต์ migrate และ seed ของ fixbot-rebuild

> เอกสารอ่านประกอบสำหรับสอบ · สร้าง 9 พ.ย. 2569 ระหว่าง Slice 2+3
> ไฟล์จริงอยู่ที่ `fixbot-rebuild/backend/scripts/` (ปริตต์ copy มาจากต้นแบบด้วย `Copy-Item` ไม่ได้พิมพ์เอง)
> ต้นฉบับ: `appliance-repair-assistant/backend/scripts/run-migrations.js`, `seed-flows.js`

## สถานะการอ่าน (mark ไว้)

| ไฟล์ | สร้างโดย | อธิบายแล้ว | หมายเหตุ |
|---|---|---|---|
| `scripts/run-migrations.js` | Copy-Item จากต้นแบบ | ✅ 9 พ.ย. (ไล่ทีละบรรทัด) | ยังมีโค้ด `DB_SSL_CA` ค้างอยู่ — ไม่มีผลเมื่อ `.env` ไม่ตั้งค่านี้ |
| `scripts/seed-flows.js` | Copy-Item จากต้นแบบ | ✅ 9 พ.ย. (ไล่ทีละฟังก์ชัน) | `guardManagedFlows` ไม่ทำงานใน rebuild (ไม่มีคอลัมน์ `revision`) |
| `migrations/001_flows.sql` | Copy-Item (เปลี่ยนชื่อจาก `002_flows.sql`) | ✅ สรุปแนวคิด (PK คู่, FK สองเส้น, CASCADE, ENUM) | |

ทั้งสองสคริปต์ **ไม่ใช่ส่วนของแอป** ไม่ถูก import จาก `app.ts` รันด้วยมือด้วย `node` เท่านั้น (ต่างจาก `pool.ts` ที่แอปใช้ตอนรัน)

---

## 1) `run-migrations.js` — จัดการ "โครงสร้าง" ของ DB

**ปัญหาที่แก้:** ตารางสร้างด้วย SQL แต่โปรเจกต์โตทีละ slice ต้องรู้ว่าไฟล์ SQL ไหนรันไปแล้ว ไม่งั้นรันซ้ำแล้ว error

```
1. ต่อ MySQL (เส้นเดียว, multipleStatements: true → 1 ไฟล์มีหลายคำสั่งได้)
2. CREATE TABLE IF NOT EXISTS schema_migrations   ← สมุดบันทึกชื่อไฟล์ที่รันแล้ว
3. applied = ชื่อไฟล์ที่เคยรัน   (Set)
4. files   = *.sql ใน migrations/ เรียงตามชื่อ     ← ลำดับมาจากชื่อไฟล์ (001_, 002_ …)
5. pending = files − applied
6. วนรันทีละไฟล์: conn.query(sql) แล้ว INSERT ชื่อไฟล์ลง schema_migrations
```

| จุดสำคัญ | เหตุผล |
|---|---|
| `schema_migrations` | รันกี่ครั้งก็ได้ ไฟล์เดิมไม่ถูกรันซ้ำ เพิ่มไฟล์ใหม่แล้วรันจะรันเฉพาะไฟล์ใหม่ |
| ชื่อไฟล์ขึ้นต้นเลข | `.sort()` ตามตัวอักษร → `003_users.sql` ต้องมาก่อนไฟล์ที่อ้างตาราง `users` |
| รัน SQL ก่อน แล้วจึงจดชื่อไฟล์ | ถ้าสลับ และ SQL ล้ม จะจดว่ารันแล้วทั้งที่ไม่ได้รัน |
| `multipleStatements: true` | เปิดเฉพาะสคริปต์นี้ ไม่เปิดใน `pool.ts` ของแอป (ลดความเสี่ยง SQL injection แบบต่อคำสั่ง) |
| `--status` | ดูว่าไฟล์ไหน ✅/⬜ โดยไม่รัน · PowerShell 5.1 ตัด `--` จึงต้องเช็ก `npm_config_status` ด้วย |
| `try … finally { conn.end() }` | ปิด connection เสมอ ไม่งั้นโปรเซสไม่จบ |

**จุดอ่อน:** ไม่มี "ย้อนกลับ" (down migration) และ `CREATE TABLE` ของ MySQL commit ทันที ถ้าไฟล์ที่มีหลายคำสั่งล้มกลางทาง ตารางที่สร้างไปแล้วไม่ rollback ต้องลบด้วยมือ

---

## 2) `seed-flows.js` — นำ "ข้อมูล" คู่มือ (JSON) เข้า 4 ตาราง

```
1. อ่านไฟล์ JSON ที่ระบุ (argument แรก)
2. validateManual → ตรวจก่อนแตะ DB (ไม่ผ่าน = ไม่เขียนอะไร, แจ้งปัญหาทั้งหมดทีเดียว)
3. (--verify → จบแค่นี้)
4. ต่อ MySQL → guardManagedFlows (ไม่ทำงานใน rebuild) → BEGIN
5. seedManual → COMMIT     (error → ROLLBACK ทั้งคู่มือ)
6. report → พิมพ์สรุปจำนวน
```

**`seedManual` ต่อ 1 คู่มือ:**
1. `INSERT … ON DUPLICATE KEY UPDATE` ลง `manuals` (seed ซ้ำได้ ไม่ซ้ำแถว)
2. วนทีละ flow: `INSERT … ON DUPLICATE KEY UPDATE` ลง `flows`
3. `DELETE FROM states WHERE flow_id = ?` แล้ว INSERT states ทั้งผังใหม่ (ให้ DB ตรงกับไฟล์เสมอ; transitions เดิมหายตาม `ON DELETE CASCADE`)
4. INSERT `state_transitions` **หลัง** states เสมอ (FK สองเส้นต้องการให้ from/to มีอยู่แล้ว)

**การแปลงไฟล์ → ตาราง:**
```
{ state_id:"n1", type:"checkpoint", question:"…", on_yes:"n2", on_no:"n1f" }
 → states            (flow, 'n1', 'checkpoint', "<question>", …)        1 แถว
 → state_transitions (flow,'n1','yes','n2') และ (flow,'n1','no','n1f')  2 แถว
```
`textOf()` เลือก field ข้อความตามชนิด (`question`/`content`/`prompt` → คอลัมน์ `text_content`) · `TRANSITION_FIELDS` จับคู่ `yes↔on_yes`, `no↔on_no`, `next↔next`, `invalid↔on_invalid` (นี่คือ Σ ของ state machine ในรูปโค้ด)

| จุดสำคัญ | เหตุผล |
|---|---|
| `validateManual` + FK | โค้ดบอกสาเหตุอ่านง่ายก่อนเขียน · FK เป็นด่านสุดท้ายที่ข้ามไม่ได้ ไม่ว่าข้อมูลเข้ามาทางไหน |
| `stateToRow` ลำดับ 15 ค่า | ต้องตรงกับลำดับคอลัมน์ใน INSERT ถ้าสลับ ค่าเข้าผิดช่องโดยไม่ error |
| `VALUES ?` + array ซ้อน | INSERT หลายแถวในคำสั่งเดียว · ใช้ได้กับ `conn.query()` ไม่ใช่ `conn.execute()` |
| `?? null` กับ `\|\| null` | `??` เปลี่ยนเฉพาะ null/undefined · `\|\|` เปลี่ยนสตริงว่างเป็น null ด้วย |
| transaction ต่อคู่มือ | ผังที่ 50 จาก 73 ล้ม → ผังที่ 1–49 ถูก ROLLBACK ไม่มีข้อมูลครึ่งเดียว |
| `flatMap` | แผ่ transitions ของทุก state เป็น array เดียว |
| `--verify` | ตรวจไฟล์ JSON โดยไม่แตะ DB |

**เทียบสองสคริปต์:** `run-migrations` = โครงสร้าง (ตาราง, เรียงตามชื่อไฟล์, จดว่ารันแล้ว) · `seed-flows` = ข้อมูล (แถว, รันซ้ำได้, ตรวจก่อนเขียน)

---

## 3) บทเรียน: `self-signed certificate in certificate chain`

- เกิดตอนรัน `migrate`/`seed` ครั้งแรก ทั้งที่ `/health` ผ่านมาแล้ว
- **สาเหตุ:** `backend/.env` ที่ copy มาจากต้นแบบมี `DB_SSL_CA` ติดมา → สองสคริปต์ส่ง `ssl: { ca }` → ตรวจใบรับรองของ MySQL ในเครื่อง (self-signed) ไม่ผ่าน · `/health` ผ่านเพราะ `pool.ts` ของ rebuild ไม่อ่าน `DB_SSL_CA` เลย
- **แก้:** ลบ/ทำให้ว่างบรรทัด `DB_SSL_CA` ใน `.env` (ให้ตรงกับ `.env.example`)
- **กฎกันซ้ำ:** สร้าง `.env` จาก `.env.example` เท่านั้น ห้าม copy `.env` ข้ามโปรเจกต์ (เจอมาแล้ว 2 ครั้งในวันเดียว: `CORS_ORIGIN=5173` และ `DB_SSL_CA`)

## 4) Q&A ที่เป็นไปได้

1. **รัน seed ซ้ำสองครั้งข้อมูลซ้ำไหม?** — ไม่ซ้ำ `manuals`/`flows` ใช้ `ON DUPLICATE KEY UPDATE` ส่วน `states` ลบของ flow นั้นแล้วใส่ใหม่
2. **ถ้า INSERT transitions ก่อน states?** — error foreign key เพราะ `from_state_id`/`to_state_id` ต้องมีอยู่ใน `states`
3. **ทำไมต้องมี `schema_migrations`?** — ต้องรู้ว่าไฟล์ไหนรันแล้วก่อนจะรันไฟล์ใด จึงต้องสร้างด้วยโค้ดของสคริปต์เอง (ไม่ใช่ไฟล์ migration ไม่งั้นเป็นไก่กับไข่)
4. **ทำไมตรวจทั้งในโค้ด (`validateManual`) และ FK?** — โค้ดให้ข้อความอ่านง่ายก่อนเปิด transaction · FK เป็นด่านสุดท้ายที่ข้ามไม่ได้
5. **ทำไมแยก migrate กับ seed?** — โครงสร้างเปลี่ยนไม่บ่อยและต้องเรียงลำดับ ข้อมูลเพิ่มเมื่อมีคู่มือใหม่และรันซ้ำได้
