# MIGRATION-MAP — migration เดิม 001–012 → ไฟล์ใหม่ และเอกสารที่ต้องแก้ตาม

> เขียน 20 ต.ค. 2569 หลังรวม/แยก migration ใหม่ · ไฟล์นี้ **ไม่ได้แก้เอกสารอื่น** — แค่บอกว่าที่ไหนล้าสมัยและควรแก้เป็นอะไร (แก้เมื่อสั่ง)
> migration เดิมกู้ดูได้จาก git commit `142ea2d` (`git show 142ea2d:backend/migrations/<ไฟล์>`)

## 1. ไฟล์ migration ใหม่ (`backend/migrations/`)

| ไฟล์ใหม่ | ตาราง | รวมมาจากไฟล์เดิม |
|---|---|---|
| `001_users.sql` | `users` | 010 |
| `002_graphs.sql` | `manuals`, `graphs`, `nodes` | 001 + 003 (ENUM ประเภทเครื่อง) + 006 (`display_name`, `model_aliases`) |
| `003_equipment.sql` | `equipment`, `equipment_usage` | 003 (ส่วนสร้างตาราง) |
| `004_sessions.sql` | `sessions`, `session_history` | 002 + 004 (`confidence`) + 005 (`outcome_text`, `outcome_at`) + 007 (`model_selection`) + 008 (`client_id`, `idx_sessions_client`) + 011 (`user_id`, `fk_sessions_user`, `idx_sessions_user`) |
| `005_session_feedback.sql` | `session_feedback` | 009 |
| `006_graph_drafts.sql` | `graph_drafts` | 012 |

ลำดับรัน = ลำดับชื่อไฟล์ ซึ่งเรียงตาม FK แล้ว: `users` และ `graphs` ต้องมาก่อน `sessions`; `sessions` ต้องมาก่อน `session_feedback`; `users` ต้องมาก่อน `graph_drafts`
การเปลี่ยนแปลงเดียวที่ไม่ใช่การรวม: ย้ายคอลัมน์ที่เคยเพิ่มด้วย ALTER เข้าไปไว้ใน `CREATE TABLE` (ชื่อ ชนิด ค่าเริ่มต้น index FK ตรงกับของเดิม)

## 2. ไฟล์ในโค้ด/เอกสารที่อ้างเลข migration เดิม

**ในโค้ด (คอมเมนต์เท่านั้น ไม่กระทบการทำงาน):** `auth/role.enum.ts`, `auth/session-owner.ts`, `auth/users.store.ts` (migration 010), `authoring/drafts.store.ts` (migration 012), `history/history.dto.ts`, `history/history.store.ts`, `traversal/session.store.ts` (migration 008/011), `traversal/graph.repository.ts`, `traversal/traversal.dto.ts`, `scripts/seed-graphs.js` (migration 006)
→ แปลงเลขตามตารางข้างบน (010→001_users, 012→006_graph_drafts, 008/011→004_sessions, 006→002_graphs, 009→005_session_feedback)

**เอกสาร (จำนวนจุดที่อ้างเลข migration):** `STUDY_GUIDE.md` 16 · `study/READING_ROADMAP_v2.md` 30 · `features/PLAN-MODEL-SELECTION.md` 14 · `README.md` 6 · `auth/auth-step2.md` 6 · `study/EXPLAIN-ADMIN-AUTHORING-part1/2.md` 7 · `features/history-page.md` 4 · `authoring/*` 7 · อื่นๆ รวม ~8
เอกสารบันทึกประวัติการทำงาน (`auth/`, `authoring/`, `features/PLAN-*`, `archive/`) ควรปล่อยไว้ตามเดิม เพราะเล่าสิ่งที่เกิดตอนนั้น — ที่ควรแก้จริงคือ `STUDY_GUIDE.md`, `README.md`, `ops/DEPLOY.md` และ `study/*`

## 3. จุดใน `STUDY_GUIDE.md` ที่ต้องแก้ (เลขบรรทัดของไฟล์ ณ ตอนนี้)

| บรรทัด | ปัจจุบันเขียนว่า | ควรแก้เป็น |
|---|---|---|
| 171 | `backend/migrations/001–012_*.sql` + อธิบายแต่ละเลข | `001–006_*.sql` ตามตารางข้อ 1 |
| 436, 1395, 1451 | `migrations/002_create_session_tables.sql:36` (`uq_history_step`) | `migrations/004_sessions.sql:74` |
| 440 | UNIQUE อาจไม่มีถ้าตารางถูกสร้างไว้ก่อนด้วย schema อื่น (migration 002 ใช้ `IF NOT EXISTS`) | หลังล้าง DB แล้ว migrate ใหม่ ข้อกังวลนี้ลดลง (ตารางสร้างจาก `004_sessions.sql`) แต่ยังตรวจได้ด้วย `SHOW CREATE TABLE session_history` |
| 847 | `migrations/010_create_users.sql:31` (UNIQUE email) | `migrations/001_users.sql:22` |
| 852, 1351 | `migrations/010_create_users.sql:12-13` (role / seed-admin) | `migrations/001_users.sql:10` |
| 871 | `migrations/011_add_session_user_id.sql:6-10` และ "คอมเมนต์ migration 011 บรรทัด 12" | `migrations/004_sessions.sql:11-15` (คอมเมนต์กฎเจ้าของ) · ข้อความ "ไม่มี claim" ยังจริงที่โค้ด แต่คอมเมนต์ต้นทางไม่มีแล้ว ให้ชี้ `auth/session-owner.ts` แทน |
| 872 | `migration 011 บรรทัด 9-10` (`AND user_id IS NULL`) | `migrations/004_sessions.sql:15` |
| 894 | cascade `migrations/002…:34`, `009…:10-12` | `004_sessions.sql:70-72`, `005_session_feedback.sql:19-21` |
| 914 | `migrations/009_create_session_feedback.sql:8-13` | `migrations/005_session_feedback.sql:17-21` |
| 1238 | `migrations/006,007,008,009,012` ต่างจาก HEAD เฉพาะคอมเมนต์ | เปลี่ยนเป็นข้อความว่า migration เดิมถูกรวม/แยกใหม่เป็น 001–006 (เป็นการเปลี่ยน DDL ในรูปแบบไฟล์ ไม่ใช่ schema) |
| 1452 | `migrations/009…:8-13`, `010…:31`, `011…` | `005_session_feedback.sql:17-21`, `001_users.sql:22`, `004_sessions.sql` |
| 1454 | "migration 012 รันแล้ว" | "`006_graph_drafts.sql` รันแล้ว" |

เลขบรรทัดในคอลัมน์ซ้ายจะขยับถ้าแก้ไฟล์ — ค้นด้วยข้อความ `migration` แทน
ผลข้างเคียง: ภาคผนวกข้อ 1–2 ("ตรวจ `SHOW CREATE TABLE`") ยังใช้ได้ แต่เหตุผลเรื่อง "ตารางอาจสร้างไว้ก่อนด้วย schema อื่น" ลดลงถ้าใช้ DB ที่ล้างแล้ว

## 4. อย่าลืม

- ก่อนรัน migrate ต้อง **ลบตาราง `schema_migrations` เดิม** (สคริปต์ `reset-database.js` ทำให้) ไม่งั้นตัวรันจะคิดว่าไฟล์ชื่อ `001_…` เดิมรันไปแล้ว (ชื่อใหม่ต่างจากเดิม จึงไม่ถูกข้าม แต่ตารางเดิมที่ค้างอยู่จะชนกับ `IF NOT EXISTS` แล้วไม่ถูกแก้ตาม schema ใหม่)
- ถ้าจะเพิ่มคอลัมน์ภายหลัง: สร้างไฟล์ `007_*.sql` ใหม่ ห้ามแก้ 001–006 หลังรันไปแล้ว
