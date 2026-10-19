# docs/ — สารบัญเอกสาร

> จัดโฟลเดอร์ตามเรื่อง 18 ต.ค. 2569 · ย้ายไฟล์แล้วแก้พาธที่อ้างถึงทุกที่ (โค้ด, migration, สคริปต์, ข้อความบนหน้าจอ, `draft/docs`)
> สำรองก่อนย้ายไว้ใน scratchpad ของเซสชันที่ทำ (`docs-backup-before-folders`)

## ⚠ อ่านก่อน: เอกสารเก่าที่อ้างเทสต์ซึ่งถูกลบแล้ว
เทสต์ทั้งหมดถูกลบตามคำสั่งผู้ใช้ (เหลือแต่ config และ dependency ของ jest/vitest) เอกสารที่เขียนก่อนหน้านั้นยังมีประโยคอย่าง "`npx jest` ผ่าน N เคส" ซึ่ง **ตอนนี้ไม่เป็นจริง** : `auth/*`, `authoring/authoring-*`, `features/history-page`, `features/LLM-INTEGRATION` ให้ถือเป็นบันทึกประวัติ ไม่ใช่สถานะปัจจุบัน

## โครงสร้าง

```
docs/
├─ study/       เตรียมสอบ / อธิบายระบบ  (เริ่มที่นี่)
├─ auth/        ระบบบัญชีผู้ใช้ Step 1–4
├─ authoring/   Step 5: admin อัปโหลด PDF → AI ร่างผัง → เผยแพร่
├─ features/    ฟีเจอร์อื่น (ประวัติ, เลือกรุ่น, ระยะ 3, LLM rephrase)
├─ ops/         deploy และสคริปต์ตรวจข้อมูล
├─ reference/   แผนที่ไฟล์ (เก่า)
└─ archive/     เอกสารประวัติ (ไม่ต้องอ่านเพื่อสอบ)
```

---

## study/ — เตรียมสอบ

| ไฟล์ | คืออะไร | สถานะ |
|---|---|---|
| [FLOW-PDF-TO-PUBLISH.md](study/FLOW-PDF-TO-PUBLISH.md) | flow อัปโหลด PDF → ร่าง → ตรวจ → publish → ผู้ใช้ค้นเจอ (frontend + backend) + ข้อค้นพบ + ที่คั่นหนังสือการอ่านโค้ด | **ใช้งานอยู่ อัปเดตทุกไฟล์ที่อ่าน** |
| [READING_ROADMAP_v2.md](study/READING_ROADMAP_v2.md) | แผนที่โค้ดทั้งระบบ, endpoint, ความเสี่ยง R1–R19, คำถามกรรมการ | **ฉบับปัจจุบัน** (แทน v1) |
| [EXPLAIN-ADMIN-AUTHORING-part1.md](study/EXPLAIN-ADMIN-AUTHORING-part1.md), [part2](study/EXPLAIN-ADMIN-AUTHORING-part2.md) | อธิบาย admin authoring ละเอียด ส่วนที่ 1–2 | ส่วนที่ 3 ขึ้นไปไม่ได้เขียน (แทนด้วย FLOW) |

> หมายเหตุ: `HANDOFF-TOR.md` (ส่งต่อให้ Claude แก้ TOR) **ไม่พบในโฟลเดอร์** ทั้งที่เคยบอกว่าเขียนแล้ว ถ้าต้องการให้เขียนใหม่ บอกได้

## auth/ — บัญชีผู้ใช้

| ไฟล์ | เนื้อหา |
|---|---|
| [auth-step1.md](auth/auth-step1.md) | Auth + roles ฝั่ง backend |
| [auth-step2.md](auth/auth-step2.md) | ผูกประวัติการซ่อมกับผู้ใช้ (migration 011) |
| [auth-step3.md](auth/auth-step3.md) | endpoint ผู้ดูแลระบบแบบอ่านอย่างเดียว |
| [auth-step4.md](auth/auth-step4.md) | หน้าจอ login / ประวัติของบัญชี / หน้า admin |

## authoring/ — Step 5

| ไฟล์ | เนื้อหา |
|---|---|
| [PLAN-STEP5-AUTHORING.md](authoring/PLAN-STEP5-AUTHORING.md) | แผน Step 5 |
| [authoring-step5.md](authoring/authoring-step5.md) | สรุป Step 5 (B1 backend + B2 หน้าจอ) — ถูกอ้างจากข้อความบนหน้าจอ admin |
| [authoring-b1-testing.md](authoring/authoring-b1-testing.md) | วิธีทดสอบด้วย PowerShell, ลบข้อมูล demo (SQL), สำรองข้อมูล — ถูกอ้างจาก `backup-graph-tables.js` |

## features/ — ฟีเจอร์อื่น

| ไฟล์ | เนื้อหา | สถานะ (ตามหัวไฟล์) |
|---|---|---|
| [history-page.md](features/history-page.md) | หน้าประวัติการซ่อม | เขียนครบ รอ migration 008/009 |
| [PLAN-MODEL-SELECTION.md](features/PLAN-MODEL-SELECTION.md) | แผน "เลือกรุ่นก่อนค้นอาการ" | โค้ดเสร็จ migration 006/007 รันแล้ว |
| [CHANGES-PHASE3-FRONTEND.md](features/CHANGES-PHASE3-FRONTEND.md) | สรุปสิ่งที่เปลี่ยนใน frontend ระยะ 3 | ใส่ลงโปรเจกต์แล้ว |
| [DRAFT-PHASE3-FRONTEND.md](features/DRAFT-PHASE3-FRONTEND.md) | ร่างก่อนทำระยะ 3 | 🗄 ถูกแทนที่ด้วย CHANGES-PHASE3 |
| [LLM-INTEGRATION.md](features/LLM-INTEGRATION.md) | LLM เรียบเรียงถ้อยคำ (rephrase) | พักไว้ ปิดเป็นค่าเริ่มต้น รอเลือก A/B/C |

## ops/ — deploy และตรวจข้อมูล

| ไฟล์ | เนื้อหา |
|---|---|
| [DEPLOY.md](ops/DEPLOY.md) | backend บน Render + frontend บน GitHub Pages + Aiven MySQL |
| [VERIFY-CHUNKS-AGAINST-PDF.md](ops/VERIFY-CHUNKS-AGAINST-PDF.md) | สคริปต์ตรวจ chunk เทียบ PDF |
| [VERIFY-GRAPHS-AGAINST-SOURCE.md](ops/VERIFY-GRAPHS-AGAINST-SOURCE.md) | ตรวจว่าผังยังตรงคู่มือหลังแปลง |
| [BRIEF-VERIFY-CHUNKS-FOR-CLAUDE.md](ops/BRIEF-VERIFY-CHUNKS-FOR-CLAUDE.md) | สรุปส่งต่อ Claude อีกเซสชันเรื่องสคริปต์ตรวจ chunk |

## reference/ — แผนที่ไฟล์

| ไฟล์ | หมายเหตุ |
|---|---|
| [FILES-BACKEND.md](reference/FILES-BACKEND.md) | เขียน 14 ต.ค. **เก่ากว่า** authoring/auth |
| [FILES-FRONTEND.md](reference/FILES-FRONTEND.md) | เขียน 14 ต.ค. **เก่ากว่า** หน้า admin/ร่างผัง |

## archive/ — ประวัติ

| ไฟล์ | ทำไมเป็นประวัติ |
|---|---|
| [HANDOFF.md](archive/HANDOFF.md) (~297 KB) | ส่งต่องาน 12 ต.ค. ช่วงพิมพ์โค้ดพอร์ตจาก FixStep |
| [ROADMAP.md](archive/ROADMAP.md) | แผนพอร์ต FixStep → โปรเจกต์นี้ (6 ต.ค.) |
| [READING_ROADMAP.md](archive/READING_ROADMAP.md) | v1 แทนที่ด้วย v2 |
| [CLEANUP_PLAN.md](archive/CLEANUP_PLAN.md), [CLEANUP_LOG.md](archive/CLEANUP_LOG.md) | แผนและบันทึกการล้างโค้ด (ชุด 1, 2, 4 เสร็จ) |

---

## ไฟล์ที่ถูกอ้างจากนอก docs (พาธใหม่ ห้ามย้ายซ้ำโดยไม่แก้ผู้อ้าง)
| ไฟล์ | ถูกอ้างจาก |
|---|---|
| `authoring/authoring-step5.md` | `AdminDraftReviewPage.tsx`, `UploadDraftForm.tsx` (ข้อความบนหน้าจอ) |
| `authoring/authoring-b1-testing.md` | `backend/scripts/backup-graph-tables.js` |
| `authoring/PLAN-STEP5-AUTHORING.md` | `backend/migrations/012_create_graph_drafts.sql` |
| `features/PLAN-MODEL-SELECTION.md` | migration 006, 007 |
| `features/history-page.md` | migration 008, 009, `session.store.ts`, `clientId.ts` |
| `auth/auth-step3.md` | `admin.service.ts` |
| `ops/DEPLOY.md`, `archive/ROADMAP.md`, `features/LLM-INTEGRATION.md`, `features/DRAFT-PHASE3-FRONTEND.md` | เอกสารใน `draft/` |

> `draft/` (นอก docs) มีเอกสารของตัวเอง (`draft/README.md`, `draft/docs/*`) ไม่อยู่ในสารบัญนี้

## ที่ยังไม่ได้ทำ
- ปรับ `reference/FILES-*.md` ให้ตรงปัจจุบัน
- ใส่หมายเหตุ "เทสต์ถูกลบแล้ว" ที่หัวเอกสารเก่าแต่ละไฟล์
- ในเอกสารประวัติยังมีการเอ่ยชื่อไฟล์แบบสั้น (เช่น `ROADMAP.md`) ซึ่งตอนนี้อยู่คนละโฟลเดอร์ ไม่ได้แก้เพราะเป็นข้อความบรรยาย ไม่ใช่ลิงก์
