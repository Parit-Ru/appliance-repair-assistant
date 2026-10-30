# 09 — ประวัติการซ่อม, Feedback และ Dashboard

## 1. Repair History (list / detail)

### อธิบายแบบง่าย
ทุกครั้งที่ตรวจจนจบ รายการนั้นจะเข้าไปอยู่ในหน้า "ประวัติการซ่อม" กดเข้าไปดูได้ว่าตอบอะไรไปบ้าง จบแบบไหน มีคำเตือนอะไร และอ้างคู่มือหน้าไหน เก็บไว้ 90 วัน

### เชิงเทคนิค
- **ไม่มีตารางประวัติแยก:** ประวัติ = แถว `sessions` ที่ `status = 'completed'` และยังไม่หมดอายุ + ขั้นใน `session_history`
- ทุก endpoint ต้องรู้เจ้าของ: user จาก token หรือ guest จาก `X-Client-Id` (`backend/src/history/history.routes.ts:13-39` → `resolveRequiredOwner`)

**List — `GET /history?page=&pageSize=`**
```sql
-- backend/src/history/history.store.ts:48-60
SELECT session_id, graph_id, current_node_id, UNIX_TIMESTAMP(created_at) AS created_epoch
  FROM sessions
 WHERE <owner> AND status = 'completed' AND expires_at > NOW()
 ORDER BY created_at DESC
 LIMIT 50
```
- แบ่งหน้าใน Node (`backend/src/history/history.service.ts:24-44`) หน้าละ 10 (สูงสุด 50) (`history.dto.ts:6-7`)
- ⚠ เพราะ SQL ดึงแค่ 50 แถว **ผู้ใช้ที่มีประวัติเกิน 50 รายการจะเห็นแค่ 50 ล่าสุด และ `total` จะไม่เกิน 50** (`history.store.ts:10`)
- แต่ละรายการมี `outcomeKind` ซึ่งคำนวณจากโหนดสุดท้ายในผังปัจจุบัน (`history.service.ts:85-95`) และชื่ออาการ/รุ่น

**Detail — `GET /history/:id`** (`history.service.ts:47-55, 98-156`)
1. หา session ที่จบแล้วของเจ้าของนี้ ไม่ใช่ของตัวเองหรือไม่มี → 404 `HISTORY_NOT_FOUND` (ไม่บอกว่ามีอยู่)
2. อ่าน feedback และขั้นตอนที่บันทึกไว้
3. **เล่นซ้ำ (replay)** ทุกขั้นผ่าน engine บนผังปัจจุบัน ต้องไปจบที่โหนดเดิม (`history.service.ts:196-221`) ถ้าผังถูกแก้จนเส้นทางเปลี่ยน → `available: false` ไม่แสดงขั้นเก่าคู่กับข้อสรุปใหม่ที่ไม่เกี่ยวกัน
4. รวบรวมคำเตือนความปลอดภัยทั้งหมดที่ผ่านมา (ไม่ซ้ำ) และ reference ของโหนดสุดท้าย (`:141-154`)
5. คะแนนความคล้ายแสดงพร้อมคำกำกับ (`frontend/src/pages/HistoryDetailPage.tsx:138-142`)

**Delete — `DELETE /history/:id`** คำสั่งเดียว `DELETE … WHERE session_id = ? AND <owner> AND status = 'completed' AND expires_at > NOW()` (`history.store.ts:95-103`) · `session_history` และ `session_feedback` ถูกลบตามด้วย `ON DELETE CASCADE`

**อายุ:** session ที่จบแล้วต่ออายุเป็น 90 วันตอนถึงโหนดสิ้นสุด (`backend/src/traversal/session.store.ts:99-100`)

## 2. Feedback 👍/👎 + comment

### อธิบายแบบง่าย
ในหน้ารายละเอียดประวัติ ผู้ใช้กดได้ว่ามีประโยชน์ไหม พร้อมเขียนความเห็นสั้นๆ กดใหม่ได้ ระบบจะแก้ของเดิม ไม่สร้างซ้ำ

### เชิงเทคนิค
- body `{ helpful: boolean, comment?: string }` · comment ตัดช่องว่าง, ≤ 500, ว่าง = NULL (`backend/src/history/history.dto.ts:112-135`)
- ต้องเป็นเจ้าของ session ที่จบแล้วก่อน (`history.service.ts:65-73`)
- **Upsert:** 1 session มีได้ 1 แถว (PK = session_id)
  ```sql
  -- history.store.ts:105-112
  INSERT INTO session_feedback (session_id, helpful, `comment`) VALUES (?, ?, ?)
  ON DUPLICATE KEY UPDATE helpful = VALUES(helpful), `comment` = VALUES(`comment`)
  ```
- ตาราง: `backend/migrations/005_session_feedback.sql` (`helpful TINYINT(1)`, `created_at`, `updated_at`)
- frontend: `FeedbackButtons` ปุ่มส่งจะ disable ถ้ายังไม่เลือก, comment ยาวเกิน, กำลังส่ง หรือค่าเท่าเดิม (`frontend/src/components/history/FeedbackButtons.tsx:21-30`) · สำเร็จแล้วแก้ cache ตรงๆ (`frontend/src/api/queries.ts:159-170`)
- feedback ให้ได้เฉพาะ session ที่**จบแล้ว** และอยู่ในหน้าประวัติ (ไม่ใช่ทันทีที่หน้าผลลัพธ์)
- แยกจาก **outcome text** ซึ่งเป็นข้อความที่ผู้ใช้พิมพ์ตอนจบ (`sessions.outcome_text`) บันทึกได้ครั้งเดียว และแก้ไม่ได้

## 3. Admin Dashboard

### อธิบายแบบง่าย
admin เห็นว่าในช่วง N วันมีการตรวจกี่ครั้ง จบกี่ครั้ง ค้างกี่ครั้ง คนกดชอบกี่เปอร์เซ็นต์ คะแนนความคล้ายเฉลี่ยเท่าไร ผลจบแบบไหนมากที่สุด อาการ/เครื่องไหนถูกตรวจบ่อย และกราฟรายวัน

### เชิงเทคนิค — `GET /admin/analytics/summary?days=1..90` (ค่าเริ่มต้น 30, `backend/src/admin/admin.dto.ts:8-9`)
- ช่วงเวลา = N วันล่าสุดตาม**เวลาไทย** (นับวันนี้เป็นวันที่ N) (`backend/src/admin/admin.service.ts:52-55`)
- ยิง 5 query พร้อมกันด้วย `Promise.all` (`admin.service.ts:57-63`)

| Metric | ความหมาย | Query (ที่ `backend/src/admin/admin.store.ts`) |
|---|---|---|
| `sessions.total / completed / inProgress / expiredUnfinished` | ทั้งหมด / จบ / กำลังเดินและยังไม่หมดอายุ / ทิ้งกลางทางจนหมดอายุ | `SUM(status = 'completed')`, `SUM(status = 'in_progress' AND expires_at > NOW())` … (`:111-138`) |
| `sessions.byOwner.user / guest / none` | ใครเป็นคนตรวจ | `SUM(user_id IS NOT NULL)` … (`:117-119`) |
| `confidence.average / sampleSize` | ค่าเฉลี่ย cosine ของ session ที่มีคะแนน (NULL ไม่ถูกนับ) | `AVG(confidence)`, `COUNT(confidence)` (`:120-121`) |
| `feedback.total / helpful / notHelpful / satisfactionRate` | rate = helpful / total · ไม่มี feedback = `null` (ไม่ใช่ 0) | `COUNT(*)`, `SUM(helpful = 1)` (`:140-148`) · คำนวณ rate ที่ `admin.service.ts:119-124` |
| `outcomes` (user_fixed / normal_behavior / handoff_informed / handoff_unknown / unknown) | ผลจบ หาจาก `outcome_kind` ของโหนดสุดท้ายในผังปัจจุบัน หาไม่เจอ = unknown | `GROUP BY graph_id, current_node_id` (`:161-175`) + `getOutcomeKind` (`admin.service.ts:65-77`) |
| `topGraphs` (10) | อาการที่ถูกตรวจบ่อย | `GROUP BY graph_id` (`:150-159`) เรียงใน Node (`admin.service.ts:80-87`) |
| `topDevices` (10) | ประเภทเครื่องที่ถูกตรวจบ่อย | รวมจาก graphCounts ตามประเภทของผังใน RAM (`admin.service.ts:89-100`) |
| `perDay` | เริ่ม/จบต่อวัน · วันที่ไม่มีข้อมูลเติม 0 | `FLOOR((UNIX_TIMESTAMP(created_at) + 25200) / 86400)` คือเลื่อน +7 ชม. เป็นเวลาไทย (`:177-192`) · เติมวันที่หายที่ `admin.service.ts:103-108` |

- **ไม่ spread แถวจาก DB ลง response** หยิบทีละช่องตาม DTO กันข้อมูลเกิน (เช่น email) หลุด (`admin.service.ts:4-6`)
- หน้าจอ: `frontend/src/pages/AdminAnalyticsPage.tsx` (StatCard, BarList, DailyBars)

### `GET /admin/feedback`
- กรอง `helpful=true|false`, `from`/`to` (YYYY-MM-DD, ช่วง ≤ 366 วัน), แบ่งหน้า 20 (สูงสุด 100) (`admin.dto.ts:5-10, 122-138`)
- JOIN `sessions` เพื่อได้ `graph_id` และประเภทเจ้าของ แต่ไม่ส่ง email/ชื่อผู้ใช้ (`admin.store.ts:52-107`)

### ข้อจำกัดของตัวเลข (ต้องพูดเองถ้าถูกถาม)
1. **DB ใช้ร่วมกับโปรเจกต์เก่า** session ของระบบเก่าจึงถูกนับรวมด้วย (`admin.service.ts:11-12`, `docs/ops/DEPLOY.md:36`)
2. `outcomes` อิงผังปัจจุบัน ถ้าผังถูก seed ใหม่จนหาโหนดเดิมไม่เจอ จะกลายเป็น `unknown`
3. `satisfactionRate` มาจากคนที่เลือกกด feedback เท่านั้น (selection bias) ไม่ใช่ความแม่นยำของระบบ
4. ข้อมูลตอนนี้ส่วนใหญ่มาจากการทดสอบของผู้พัฒนา ไม่ใช่ผู้ใช้จริง
5. `WHERE UNIX_TIMESTAMP(created_at) >= ?` ครอบคอลัมน์ด้วยฟังก์ชัน ทำให้ใช้ index บน `created_at` ไม่ได้ (ไม่มี index นี้อยู่แล้ว) ยอมรับได้ที่ข้อมูลระดับนี้
