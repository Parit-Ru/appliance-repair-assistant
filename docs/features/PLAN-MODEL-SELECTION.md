# แผน: เลือกรุ่นก่อนค้นอาการ (ทางเลือก ก)

> ⚠️ **เอกสารนี้บันทึกตอน backend ยังเป็น NestJS** (ก่อน 21 ต.ค. 2569) — ชื่อ `*.controller.ts`, `*.module.ts`, guard, exception filter, decorator และเลขบรรทัดในนี้อาจไม่มีแล้ว เก็บไว้เป็นประวัติการตัดสินใจ · โค้ดปัจจุบันเป็น Express ดูตารางเทียบใน `docs/STUDY_GUIDE.md` §5.7

> 15 ต.ค. 2569 · **สถานะ: ระยะ 0 เสร็จ · ระยะ 2 เสร็จทั้งหมด (โค้ด + รัน migration 006/007 แล้ว ตรวจกับ DB จริง 15 ต.ค.) · พร้อม commit/push (ยังไม่ commit)** · ทำด้วยกันทีละขั้น (ผมเสนอ ผู้ใช้ตัดสินใจ/พิมพ์/ตรวจ)
> ที่มา: หลังมีคู่มือ 22 ไฟล์ / 644 ผัง ระบบค้นหาคืนอาการเดียวกันจากคนละรุ่น และผลลัพธ์ไม่บอกรุ่น (ดู HANDOFF 15 ต.ค.)

---

## 1. ทำไมต้องทำ (หลักฐานที่วัดแล้ว 15 ต.ค.)

| ปัญหา | หลักฐาน |
|---|---|
| ผลค้นซ้ำกัน 3 ช่อง เป็นอาการเดียวกันจากคนละรุ่น | "ทีวีไม่มีภาพ" → "หาช่องไม่เจอ" ×3 · 144 จาก 365 อาการมีมากกว่า 1 รุ่น |
| **ไม่รู้ว่าผู้ใช้ใช้รุ่นไหน** → ขั้นตอนอาจเป็นของรุ่นอื่น | ผลค้น (`SymptomMatchDto`) ไม่มีฟิลด์รุ่น/คู่มือ · ผังต่างรุ่นมีขั้นตอนต่างกัน |
| เกณฑ์ 0.55 ตั้งจากแอร์ 13 ผัง ใช้ต่อไม่ได้ | "น้ำรั่ว" ได้ "รหัส 9C4 ไฟฟ้ารั่ว" อันดับ 1 (0.787) |
| คำตอบ `GET /traversal/graphs` ใหญ่ขึ้น | 644 ผัง ≈ **222 KB** ก่อน gzip (เดิม 13 ผัง) |
| สร้างดัชนีค้นหานาน | 3,850 ข้อความ → 38.5 วินาทีในเครื่องหลังแก้ (ประมาณ ~2 นาทีบน Render ยังไม่ได้วัด) |

TOR ข้อ 2: "เลือกประเภทเครื่องแล้วเลือกจากรายการ" — ทางเลือก ก คือขยายให้เป็น **ประเภท → รุ่น → อาการ**

## 2. หน้าตาที่ตั้งใจ

```
หน้าแรก ──▶ เลือกประเภทเครื่อง ──▶ เลือกรุ่น ──▶ เลือกอาการ (พิมพ์ค้น / ดูทั้งหมด ของรุ่นนั้น) ──▶ ตรวจทีละขั้น
            (5 ประเภท)             (ของประเภทนั้น    ผังเฉพาะรุ่นที่เลือก
                                    + พิมพ์เลขรุ่นกรอง)
```

- เก็บรุ่นที่เลือกใน URL (`/#/symptoms?manual=<manual_id>`) เพื่อกด back/แชร์ได้ และจำค่าล่าสุดใน `localStorage` (ไม่บังคับ ใช้เป็นความสะดวก ไม่เป็นความจำเป็น)
- ในหน้าตรวจอาการแสดงรุ่นที่ใช้ ("ตามคู่มือ Samsung WA21A8376G*") ให้ผู้ใช้เห็นว่ากำลังใช้ผังของรุ่นอะไร

## 3. สิ่งที่พบในข้อมูล (ต้องรู้ก่อนออกแบบ)

`model_pattern` ของคู่มือ 22 ไฟล์ **ใช้เลือกรุ่นไม่ได้ทุกไฟล์**:

| กลุ่ม | ตัวอย่าง `model_pattern` | ผู้ใช้เลือกได้ไหม |
|---|---|---|
| รุ่นจริงมี `*` แทนตัวอักษร | `AR70H**D1***`, `MC32K7055**`, `WA21A8376G*/WA19A8376G*`, `WW9*T4*****` | ✅ จับคู่ด้วยสัญลักษณ์แทนได้ |
| หลายรุ่นในคู่มือเดียว | `RF195AC/RF197AC/…`, `RS70F65Q1BST/…`, `WA**R526***/WA**T526***/…` | ✅ แยกด้วย `/` |
| **รหัสเอกสาร/เฟิร์มแวร์ ไม่ใช่เลขรุ่นที่สติกเกอร์** | ทีวี 5 คู่มือ: `KM2DVBADN-2.1.5`, `JZDVBADK-1.1.2`, `MUSDVBADR-4.0.5`, `NLDVBAS4M-1005`, `BN81-28760D` · ตู้เย็น `DA68-02676A` | ❌ ผู้ใช้ดูจากสติกเกอร์ไม่ได้ → **ต้องมีชื่อรุ่นที่คนรู้จัก (เพิ่มข้อมูล)** |

## 4. คำตอบที่ตัดสินใจแล้ว (D1–D5 · 15 ต.ค. 2569)

| # | คำถาม | คำตอบของผู้ใช้ | ผลต่องาน |
|---|---|---|---|
| D1 | ผู้ใช้ **ไม่รู้รุ่น** | แสดงวิธีหาเลขรุ่น + ปุ่ม "ดูทุกรุ่น" ที่เตือนว่าขั้นตอนอาจไม่ตรง · **ห้ามเลือกให้เงียบๆ** · **เก็บค่า "ไม่ทราบรุ่น" ไว้ใน session** | ต้องมีคอลัมน์ใหม่ใน `sessions` (ดู §5 ระยะ 2) และใช้แยกเคสตอนวัดผล |
| D2 | ชื่อรุ่นของทีวี/ตู้เย็นบางไฟล์ | ผู้ใช้เติม `display_name` เองจากหน้ารายชื่อรุ่นในคู่มือ · **ไฟล์ที่ยังไม่เติม ให้แสดง `model_pattern` ไปก่อน ไม่เดาชื่อ** · ห้ามให้ LLM เดาชื่อรุ่น | `display_name` เป็น NULL ได้ · หน้าจอใช้ `displayName ?? modelPattern` · เติมทีละไฟล์ได้ ไม่ต้องรอครบก่อนเขียนโค้ด |
| D3 | ค้นพิมพ์อิสระ | คง แต่ค้นเฉพาะผังของรุ่นที่เลือก | ผลไม่หลุดข้ามรุ่น (ดูหมายเหตุด้านล่าง) |
| D4 | เปิดกี่ไฟล์บนเว็บจริง | ยังไม่ seed เพิ่มจนหน้าเลือกรุ่นเสร็จ | บนเว็บจริงยังมีแอร์ 13 ผัง + เครื่องซักผ้า WT10J7 6 ผัง |
| D5 | เลือกหลายประเภทพร้อมกัน | ไม่ | เส้นทางเดียว: เครื่อง → รุ่น → อาการ |

**หมายเหตุ D3 (แก้เหตุผลให้ตรงกับที่วัดได้):** ประโยชน์จริงของการกรองตามรุ่นคือ **ผลไม่หลุดไปรุ่นอื่น** ไม่ใช่เรื่องหน่วยความจำ ดัชนียังโหลดข้อมูลทุกรุ่นตอนบูตเหมือนเดิม เวกเตอร์ไม่ซ้ำ 1,972 ตัว ≈ 3 MB แรมส่วนใหญ่บน Render คือตัวโมเดล (~183 MB) การกรองลดแค่จำนวนครั้งที่เทียบ cosine ซึ่งอยู่ระดับมิลลิวินาทีอยู่แล้ว ถ้าจะเขียนลงรายงาน ให้ใช้เหตุผลข้อแรก

**หมายเหตุ D1 (ออกแบบที่เสนอ):** เก็บใน **คอลัมน์ใหม่** `sessions.model_selection` (`'selected'` / `'unknown'` / NULL = ไม่ผ่านหน้าเลือกรุ่น เช่น session เก่า) ไม่เก็บใน `variables` เพราะ `variables` ใช้แทนค่า `{{ตัวแปร}}` ในข้อความขั้นตอน (และเป็นข้อมูลที่ส่งให้ LLM) ปนกันแล้วเสี่ยงชนชื่อ · ผู้ใช้ที่เลือก "ดูทุกรุ่น" ยังต้องเลือกรุ่นที่ใกล้เคียงเอง (ทุก session ผูกกับผังเดียวเสมอ) ค่า `'unknown'` จึงแปลว่า "ผู้ใช้บอกว่าไม่ทราบรุ่น แล้วเลือกรุ่นใกล้เคียงเอง"

---

## 5. งานที่ต้องทำ (เรียงตามลำดับที่ควรทำ)

ขนาด: **S** = เล็ก (ไม่กี่บรรทัด/ชั่วโมงเดียว) · **M** = กลาง · **L** = ใหญ่

### ระยะ 0 — ตัดสินใจ (ไม่แตะโค้ด)
- [x] ตอบ D1–D5 (15 ต.ค. ดู §4)
- [ ] ยืนยันกับอาจารย์ว่าต้องรองรับกี่ประเภท/รุ่นในรายงาน (`ADVISOR-QUESTIONS.md` Q1) ผลกำหนดว่าต้องลงแรงข้อมูล (ระยะ 1) มากแค่ไหน

### ระยะ 1 — ข้อมูลรุ่น (ผู้ใช้เป็นหลัก ผมช่วยเครื่องมือ) · **L**
- [ ] เพิ่มฟิลด์ `display_name` (และ `model_aliases` ถ้ามี) ในคู่มือทั้ง 22 ไฟล์ — **S ต่อไฟล์** แต่ต้องอ่านคู่มือ
- [x] (✔ รันกับ DB แล้ว 15 ต.ค.) migration `006_add_manual_display_name.sql` (คอลัมน์ `display_name` NULL ได้, `model_aliases` JSON NULL ได้ — ตามที่ตัดสินใจ D2 ว่าว่างได้ ไม่เดาชื่อ) — **S**
- [x] ปรับ `seed-graphs.js` ให้เขียนฟิลด์ใหม่ และ `--verify` เตือนเมื่อ `display_name` ว่าง — **S** (✔ 15 ต.ค. ทดสอบด้วย mysql ปลอม 12/12 · ต้องรัน migration 006 ก่อนใช้จริง)
- [ ] ตรวจรายการอุปกรณ์ใหม่ตามหน้าคู่มือ แล้วเปลี่ยน `reviewed_by_author` เอง (ผู้ใช้) → `npm run seed:equipment`

### ระยะ 2 — backend · **M**
- [x] ใส่ `manual_id` ใน `TroubleshootingGraph` และ `GraphSummary` (ตอนนี้ `GraphRow` มี และ SELECT แล้ว แต่ `buildGraph` ยังไม่ส่งต่อ) — **S**
- [x] (✔ 15 ต.ค. ขั้นแรก: ยังไม่มี `displayName` เพราะต้องมี migration 006 ก่อน) `GET /traversal/manuals` ส่งรายการคู่มือ (manualId, deviceCategory, brand, displayName, modelPattern, graphCount) — ผู้ใช้เลือกรุ่นไม่ต้องโหลดทุกผัง — **S–M**
- [x] `GET /traversal/graphs?manualId=…` กรองตามคู่มือ — **S**
- [x] `POST /symptom-search` รับ `manualId` (ไม่บังคับก่อน เพื่อไม่ทำให้ฝั่งเก่าพัง) และกรองดัชนีก่อนจัดอันดับ — **M**
- [x] ไม่ส่งผังข้ามรุ่น: `startSession` ตรวจว่า `graphId` อยู่ใน `manualId` ที่ระบุ (ถ้าส่งมา) — **S**
- [x] (✔ รันกับ DB แล้ว 15 ต.ค.) (D1) migration `007_add_session_model_selection.sql`: `sessions.model_selection ENUM('selected','unknown') NULL` + `POST /traversal/sessions` รับ `modelSelection` (ไม่บังคับ) และบันทึกลง `session.store.ts` — **S–M** (✔ โค้ดเสร็จและรัน migration แล้ว 15 ต.ค.)
- [x] ทดสอบทั้งสายด้วย pool ปลอมเหมือนที่เคยทำ (✔ ขั้น 1: 12/12 · 2.3: 17/17 · 2.2+2.4: 22/22) (ผัง 2 รุ่นที่มีอาการเดียวกัน → ผลค้นต้องไม่ข้ามรุ่น)

### ระยะ 3 — frontend · **M–L**
- [x] (✅ ใส่แล้ว 15 ต.ค. = ขั้น 1 ของทาง ข ดู §10 · ร่างอยู่ที่ `docs/features/DRAFT-PHASE3-FRONTEND.md`) ชนิดข้อมูล + hook `useManuals`, `useGraphs(manualId)`, `useSymptomSearch` รับ `manualId` — **S**
- [ ] หน้า "เลือกเครื่อง": การ์ด 5 ประเภท → รายการรุ่น (กรองด้วยเลขรุ่นที่พิมพ์ ใช้ `*` เป็นตัวแทน 1 ตัวอักษร จับคู่แบบคำนำหน้า) — **M**
- [ ] (D1) ทางเลือก "ไม่ทราบรุ่น": แสดงวิธีหาเลขรุ่น + ปุ่ม "ดูทุกรุ่นของประเภทนี้" พร้อมคำเตือนว่าขั้นตอนอาจไม่ตรง แล้วเริ่ม session ด้วย `modelSelection: 'unknown'` — **M**
- [ ] เส้นทางใหม่ + `SymptomsPage`/`AllSymptomsPage` อ่านรุ่นจาก URL ถ้าไม่มีให้กลับไปเลือก — **M**
- [ ] หน้าแรก "รองรับตอนนี้" ลิงก์เข้ารุ่น — **S**
- [ ] หน้าตรวจอาการแสดงรุ่นที่ใช้ + ปุ่ม "เปลี่ยนรุ่น" — **S**
- [ ] เรนเดอร์ทดสอบ (vitest scratch) + ตรวจมือบนมือถือ — **M**

### ระยะ 4 — ตรวจ/เปิดใช้
- [ ] วัดคุณภาพการค้น **ต่อรุ่น** ใหม่ (ชุดเดิมสำหรับแอร์ใช้ไม่ได้) และตัดสินใจเกณฑ์ (`EVALUATION-PLAN.md` §4)
- [ ] (D1) ตอนวัดผล แยกรายงานเคส `model_selection = 'unknown'` ออกจากเคสที่เลือกรุ่นเอง
- [ ] seed คู่มือที่เหลือ **ทีละประเภท** แล้วรีสตาร์ท Render ตรวจ `/symptom-search/status` (แรม, เวลา `loadMs`)
- [ ] อัปเดต `draft/docs/TOR-COMPLIANCE.md` ข้อ 1, 2 และ `FILES-*.md`
- [ ] `npm run deploy` frontend แล้วผู้ใช้ commit/push

## 6. ความเสี่ยง

| ความเสี่ยง | ลดอย่างไร |
|---|---|
| ผู้ใช้เลือกรุ่นผิด ได้ขั้นตอนของรุ่นอื่น | แสดงรุ่นที่ใช้ทุกหน้า + ปุ่มเปลี่ยน + โหนดความปลอดภัยยังบังคับยืนยันเสมอ |
| ข้อมูล `display_name` ของทีวีหาไม่ได้ | ใช้ชื่อซีรีส์/รหัสเอกสาร + คำอธิบาย แล้วปรึกษาอาจารย์ (D2) |
| เนื้อหา 644 ผังยังไม่ผ่านการตรวจโดยผู้พัฒนา (TOR ต้องตรวจ) และมีโหนดความปลอดภัย 406 ข้อ | เปิดเป็นประเภทๆ หลังตรวจตัวอย่าง ไม่ seed ทั้งหมดรวดเดียว |
| Render ตื่นจากหลับแล้วค้นพิมพ์อิสระยังไม่พร้อมหลายนาที | บอกผู้ใช้ชัด (มีกล่องแจ้งอยู่แล้ว) และให้ "ดูอาการทั้งหมดของรุ่น" ใช้ได้เสมอ |

## 7. ลำดับที่เสนอสำหรับ "ขั้นแรก"

ถ้าจะเริ่มพรุ่งนี้: **ระยะ 0 (D1–D5) → ระยะ 2 ข้อ `manual_id` + `GET /traversal/manuals`** เพราะเล็ก ทดสอบได้ในเครื่องโดยไม่แตะข้อมูลจริง และเป็นฐานให้หน้าเว็บทุกขั้นถัดไป

## 8. ที่ผมไม่ได้ทำ/ไม่รู้

- ยังไม่ได้ดูว่าคู่มือแต่ละไฟล์มีหน้า "รายชื่อรุ่นที่ใช้ได้" ให้เก็บ `display_name` ไหม (ต้องเปิดไฟล์คู่มือต้นฉบับ ซึ่งไม่อยู่ใน repo)
- ยังไม่ได้ทดลองหน้าจอจริงบนมือถือ
- ตัวเลขเวลาบน Render เป็นการประมาณจากอัตราส่วนช้ากว่าในเครื่อง ~3.7 เท่า (วัดจาก `loadMs` ตอนมี 36 ข้อความ)

---

## 9. บันทึกสิ่งที่เพิ่มแล้ว (ตามไฟล์)

> เฉพาะที่ **ยืนยันแล้วว่าอยู่ในไฟล์จริง** (ตรวจด้วย `git diff`/`tsc`/ทดสอบ) · เพิ่มอย่างเดียว ไม่เปลี่ยนพฤติกรรมเดิม

### ขั้น 1 — `manual_id` + `GET /traversal/manuals` (15 ต.ค. 2569 · ผมใส่ให้ตามที่ผู้ใช้สั่ง · ✅ ตรวจแล้ว)

| ไฟล์ | เพิ่มอะไร | ใช้ทำอะไร |
|---|---|---|
| `backend/src/traversal-engine/types.ts` | `manual_id: string` ใน `TroubleshootingGraph` | ผังรู้ว่าเป็นของคู่มือ/รุ่นไหน (ข้อมูลมีใน DB อยู่แล้ว ถูกตัดทิ้งตอนแปลงเป็นผัง) |
| `backend/src/traversal/graph.repository.ts` | `manualId` ใน `GraphSummary` · interface `ManualSummary` · เมธอด `listManuals()` · `buildGraph` ส่ง `manual_id: row.manual_id` | `GET /traversal/graphs` บอกรุ่นของแต่ละผัง · จัดกลุ่มผังเป็นรายการรุ่น (`graphCount`) จากหน่วยความจำ ไม่แตะ SQL |
| `backend/src/traversal/traversal.service.ts` | `listManuals()` · คอมเมนต์ 6→7 เมธอด | ส่งต่อให้ controller |
| `backend/src/traversal/traversal.controller.ts` | `GET /traversal/manuals` · คอมเมนต์ 6→7 endpoint | ให้หน้าเว็บเลือกรุ่นก่อนเลือกอาการ |

**ตรวจ:** `tsc --noEmit --noUnusedLocals --noUnusedParameters` ผ่าน · `nest build` ผ่าน · ทดสอบ HTTP จริง (Nest + `TraversalModule` จริง + DB ปลอม 2 รุ่นที่มีอาการเดียวกัน) **12/12**

### ก่อนหน้านั้น (ไม่ใช่งานเลือกรุ่น แต่อยู่ในไฟล์เดียวกับขั้น 2.3) — ทำเวกเตอร์เฉพาะข้อความไม่ซ้ำ (15 ต.ค. · ✅ ตรวจแล้ว 7/7)

| ไฟล์ | เพิ่มอะไร |
|---|---|
| `backend/src/symptom-search/symptom-search.service.ts` | `prepareIndex`: `Map` ข้อความ→เวกเตอร์ (+8 บรรทัด) ทำเวกเตอร์ 1,972 ครั้งแทน 3,850 ผลเท่าเดิมทุกค่า |

### ขั้น 2.3 — `POST /symptom-search` รับ `manualId` (15 ต.ค. 2569 · ผมใส่ให้ตามที่ผู้ใช้สั่ง · ✅ ตรวจแล้ว)

> ผู้ใช้เริ่มพิมพ์เองแต่โค้ดไม่ถูกเซฟลงดิสก์ (ตรวจแล้วไม่มี `manualId` ในไฟล์) จึงสั่งให้ผมใส่ให้ · ก่อนแก้ ผมตรวจซ้ำว่าไฟล์ยังไม่มี `manualId` และสำรองไฟล์เดิมไว้

| ไฟล์ | เพิ่มอะไร | ใช้ทำอะไร |
|---|---|---|
| `backend/src/symptom-search/symptom-search.dto.ts` | `MAX_MANUAL_ID_LENGTH = 80` · `SearchBody.manualId?` · `parseSearchBody` อ่าน `manualId` (ไม่ส่ง = ไม่กรอง · ไม่ใช่ข้อความ/ว่าง/ยาวเกิน 80 → `InvalidSearchQueryError` → 400 `INVALID_QUERY` · ตัดช่องว่างหน้าหลัง) | รับรุ่นที่ผู้ใช้เลือก และตรวจรูปแบบ (80 ตรงกับ `manual_id VARCHAR(80)`) |
| `backend/src/symptom-search/symptom-search.service.ts` | `GraphInfo.manualId` · `info.set` ใส่ `manualId: graph.manual_id` · `search(query, manualId?)` กรองดัชนีด้วย `graphInfo.get(...)?.manualId === manualId` **ก่อน** `rankGraphs` | ผลค้นมีแต่ผังของรุ่นที่เลือก (กรองก่อนเลือก top-3 เพื่อไม่ให้เหลือ 0 ผัง) |
| `backend/src/symptom-search/symptom-search.controller.ts` | อ่าน `{ query, manualId }` แล้วส่ง `search(query, manualId)` · คอมเมนต์ body | ต่อสายจาก HTTP ถึง service |

**พฤติกรรม**

| กรณี | ผล |
|---|---|
| ไม่ส่ง `manualId` | เหมือนเดิมทุกอย่าง (เว็บเก่าไม่พัง) |
| ส่ง `manualId` ที่มี | ผลมีแต่ผังของรุ่นนั้น `bestScore` คิดจากผังของรุ่นนั้นเท่านั้น |
| ส่ง `manualId` ที่ไม่มี | 200, `matches: []`, `bestScore: null` |
| `manualId` ผิดรูปแบบ (ตัวเลข, ว่าง, ยาว 81, `null`, อาร์เรย์) | 400 `INVALID_QUERY` |

**ตรวจ:** `tsc --noEmit --noUnusedLocals --noUnusedParameters` ผ่าน · `nest build` ผ่าน · ทดสอบ HTTP จริง (`SymptomSearchModule` + `GraphRepository` จริง + โมเดลจริง + DB ปลอม 3 คู่มือ อาการ "เครื่องซักผ้ามีเสียงดัง" ซ้ำ 2 รุ่น) **17/17**: ไม่ส่ง → ได้ทั้ง 2 รุ่น · `m_wt10j7` → ได้เฉพาะ `wt10j7_noise` · `m_tv` ค้นเรื่องซักผ้า → ไม่หลุดไปเอาผังซักผ้า (`bestScore` 0.083 เทียบ 0.924 ของทุกรุ่น) · ไม่พบรุ่น → ว่าง + `null` · ผิดรูปแบบ 6 แบบ → 400 · ยาว 80 ตัวพอดีผ่าน

**ที่ยังไม่ทำในขั้นนี้:** ฝั่ง frontend (ยังไม่ส่ง `manualId`) · ไม่ได้เพิ่ม `manualId` ในผลลัพธ์แต่ละรายการ (`SymptomMatchDto`) เพราะเมื่อกรองตามรุ่นแล้วผู้เรียกรู้รุ่นอยู่แล้ว (ถ้าต้องใช้ค่อยเพิ่มทีหลัง)

### ขั้น 2.2 + 2.4 — กรองผังตามรุ่น และตรวจผังอยู่ในรุ่นที่ระบุ (15 ต.ค. 2569 · ผมใส่ให้ตามที่ผู้ใช้สั่ง · ✅ ตรวจแล้ว)

| ไฟล์ | เพิ่มอะไร | ใช้ทำอะไร |
|---|---|---|
| `backend/src/traversal/traversal.dto.ts` | `parseOptionalManualId(raw)` (ไม่ส่ง = `undefined` · ไม่ใช่ข้อความ/ว่าง/ยาวเกิน 80 → `InvalidRequestBodyError`) · `StartSessionBody.manualId?` · `parseStartSessionBody` อ่าน `manualId` · import `MAX_MANUAL_ID_LENGTH` จาก dto ของ symptom-search | ตรวจ `manualId` ทั้งจาก query string และ body ด้วยฟังก์ชันเดียว |
| `backend/src/traversal/traversal.service.ts` | คลาส `GraphManualMismatchError` · `listGraphs(manualId?)` กรองด้วย `g.manualId === manualId` · `startSession(graphId, query?, manualId?)` เช็ก `graph.manual_id !== manualId` **ก่อน** `computeConfidence`/สร้าง session | 2.2 และ 2.4 |
| `backend/src/traversal/traversal.controller.ts` | `@Query('manualId')` ใน `GET /traversal/graphs` · `POST /traversal/sessions` ส่ง `manualId` ต่อ · import `Query`, `parseOptionalManualId` | ต่อสายจาก HTTP |
| `backend/src/traversal/traversal.exception.filter.ts` | `GraphManualMismatchError` → 400 `GRAPH_MANUAL_MISMATCH` | แยกจาก 404 `GRAPH_NOT_FOUND` (ผังมีจริงแต่ไม่ใช่ของรุ่นนั้น) |

**พฤติกรรม**

| กรณี | ผล |
|---|---|
| `GET /graphs` ไม่ส่ง `manualId` | เหมือนเดิม (ได้ทุกผัง) |
| `GET /graphs?manualId=รุ่นที่มี` | เฉพาะผังของรุ่นนั้น |
| `GET /graphs?manualId=รุ่นที่ไม่มี` | 200 รายการว่าง |
| `manualId` ว่าง / ช่องว่างล้วน / ซ้ำสองค่า / ยาว 81 | 400 `INVALID_ACTION` |
| `POST /sessions` ไม่ส่ง `manualId` | เหมือนเดิม 201 |
| `POST /sessions` ผังตรงรุ่น | 201 |
| `POST /sessions` ผังไม่ใช่ของรุ่นที่ระบุ | 400 `GRAPH_MANUAL_MISMATCH` **และไม่สร้าง session** |
| `POST /sessions` ไม่มีผังนั้นเลย (มี `manualId`) | 404 `GRAPH_NOT_FOUND` เหมือนเดิม |
| `manualId` เป็นตัวเลข/`null`/ว่าง/ยาว 81 | 400 `INVALID_ACTION` |

**ตรวจ:** `tsc --noEmit --noUnusedLocals --noUnusedParameters` ผ่าน · `nest build` ผ่าน · ทดสอบ HTTP จริง (Nest + `TraversalModule` จริง + DB ปลอม 2 รุ่นที่มีอาการเดียวกัน) **22/22** · ทดสอบซ้ำของเดิมหลังแก้: ขั้น 1 **12/12**, ขั้น 2.3 (โมเดลจริง) **17/17**

**ข้อสังเกต:** ใช้รหัส `INVALID_ACTION` เดิมสำหรับ `manualId` ผิดรูปแบบ (ผ่าน `InvalidRequestBodyError` ซึ่งชื่อมีคำว่า Body แต่ใช้กับ query string ด้วย) เพื่อไม่เพิ่มรหัสใหม่ฝั่งหน้าจอ · รหัสใหม่มีรหัสเดียวคือ `GRAPH_MANUAL_MISMATCH` ฝั่ง frontend (`lib/errors.ts`) ยังไม่รู้จัก จะแสดงข้อความทั่วไปจนกว่าจะทำระยะ 3

**ที่ยังไม่ทำในระยะ 2:** migration 006 (`display_name`) และ 007 (`sessions.model_selection` + `modelSelection` ตอนเริ่ม session) — ทั้งสองแตะ DB ที่ใช้ร่วมกับ Render

### migration 006 / 007 (15 ต.ค. 2569 · 📥 เพิ่มใน `backend/migrations/` · ✅ **รันกับฐานข้อมูลแล้ว** ดู "ผลการรัน" ท้ายหัวข้อนี้ในส่วนล่างสุด)

ผู้ใช้สั่ง "เพิ่ม 2 migration มา" → ผมย้ายจาก `draft/migrations/` ไป `backend/migrations/` (ลบร่างเดิมแล้ว) **ไม่ได้รัน** · ตั้งแต่ตอนนี้ `npm run migrate` จะหยิบสองไฟล์นี้ไปรัน

| ไฟล์ | ทำอะไร | ผลต่อแถวเดิม |
|---|---|---|
| `006_add_manual_display_name.sql` | `manuals` + `display_name VARCHAR(120) NULL`, `model_aliases JSON NULL` (statement เดียว) | ทุกแถวได้ NULL |
| `007_add_session_model_selection.sql` | `sessions` + `model_selection ENUM('selected','unknown') NULL` | ทุกแถวได้ NULL |

**ตรวจแล้ว (อ่านโค้ด):**
- โค้ดของโปรเจกต์นี้: ทุก SQL ที่แตะ `manuals`/`sessions` ระบุชื่อคอลัมน์เอง ไม่มี `SELECT *` · `INSERT INTO sessions` ระบุคอลัมน์ · seed upsert ของ `manuals` ไม่แตะคอลัมน์ใหม่
- **โค้ดของ FixStep** (`troubleshoot-assistantv2/backend` ในเครื่อง): `INSERT/UPDATE/SELECT` ของ `sessions` ระบุคอลัมน์ทุกจุด · `manuals` ถูกอ่านผ่าน `JOIN` ที่ระบุคอลัมน์ · ไม่พบ `SELECT *` → การเพิ่มคอลัมน์ NULL ได้ไม่น่ากระทบ **(ตรวจกับโค้ดในเครื่อง ไม่ได้ยืนยันว่าเป็นเวอร์ชันเดียวกับที่ deploy อยู่)**
- `docs/ops/DEPLOY.md` เตือนว่า **ฐานข้อมูลใช้ร่วมกับ FixStep และตาราง `sessions` ใช้ร่วมกันสองระบบ** ⇒ รัน migration = เปลี่ยนตารางของทั้งสองระบบ ไม่ใช่แค่เว็บนี้

**ข้อควรระวังของตัวรัน:** ไม่มี transaction (DDL ของ MySQL commit เอง) ถ้าไฟล์มีหลาย statement แล้วล้มกลางทาง รันซ้ำจะติด "Duplicate column" จึงทำให้แต่ละไฟล์เป็น statement เดียว · ไม่มีไฟล์ย้อนกลับ (SQL ย้อนกลับเขียนไว้ในคอมเมนต์หัวไฟล์ ต้องรันเอง)

**⚠️ คำสั่งดูสถานะที่ปลอดภัย (แก้คำแนะนำเดิมของผมที่ผิด):** ใช้ `node scripts/run-migrations.js --status` (รันใน `backend`) **ห้ามใช้ `npm run migrate -- --status` บน PowerShell 5.1** เพราะ PowerShell ตัด `--` ทิ้งแล้ว npm รัน migration **จริง** (เคยเกิดกับ migration 005 ตามที่ `FILES-BACKEND.md` บันทึกไว้ ผมลืม) ซึ่งตอนนี้จะเป็นการใช้ 006/007 กับ DB เว็บจริงทันที

**ลำดับที่ปลอดภัย:** `node scripts/run-migrations.js --status` (ต้องเห็น 001–005 ✅ และ 006–007 ⬜) → `npm run migrate` → `node scripts/run-migrations.js --status` อีกครั้ง (ต้องครบ ✅) → **จึง deploy โค้ดที่เขียนคอลัมน์ใหม่** (deploy โค้ดก่อน = `INSERT` ล้ม ผู้ใช้เริ่มตรวจไม่ได้) · Render ไม่รัน migration เอง (`buildCommand` = `npm ci && npm run build`, `startCommand` = `npm run start:prod`, ไม่มี hook pre/post) การ push จึงไม่ใช้ migration

### โค้ดที่ใช้คอลัมน์ของ migration 006/007 + แก้ `run-migrations.js` (15 ต.ค. 2569 · ผมใส่ให้ตามที่ผู้ใช้สั่ง "do it" · ✅ ตรวจแล้ว · ✅ migration รันแล้ว ตรวจกับ DB จริงแล้ว)

| ไฟล์ | เพิ่มอะไร | ใช้ทำอะไร |
|---|---|---|
| `backend/scripts/run-migrations.js` | `statusOnly` ตรวจ `process.env.npm_config_status === 'true'` ด้วย | `npm run migrate -- --status` บน PowerShell 5.1 (ตัด `--`) ไม่รัน migration จริงอีก (ยืนยันบนเครื่องนี้ว่า npm ตั้ง `npm_config_status="true"` ให้) |
| `backend/src/traversal/graph.repository.ts` | `GraphRow` + `display_name`, `model_aliases` · SELECT เพิ่ม `m.display_name, m.model_aliases` · `ManualSummary` + `displayName?`, `modelAliases?` · `manualExtras` (เก็บแยกจากผังของ engine) · กรอง aliases ที่ไม่ใช่ข้อความ | `GET /traversal/manuals` ส่งชื่อรุ่นที่ผู้ใช้รู้จัก (ไม่มี = ไม่ส่งฟิลด์) |
| `backend/src/traversal/traversal.dto.ts` | ชนิด `ModelSelection` · `parseModelSelection` · `StartSessionBody.modelSelection?` | ตรวจ `'selected'`/`'unknown'` |
| `backend/src/traversal/traversal.service.ts` | `startSession(…, modelSelection?)` ส่งต่อให้ store | บันทึกว่าผู้ใช้ระบุรุ่นเองหรือไม่ทราบรุ่น |
| `backend/src/traversal/session.store.ts` | `create(session, modelSelection?)` เขียนคอลัมน์ `model_selection` (ไม่ส่ง = NULL) | เก็บค่าแยกเคสตอนวัดผล (D1) |
| `backend/src/traversal/traversal.controller.ts` | อ่าน `modelSelection` จาก body แล้วส่งต่อ | ต่อสาย |
| `backend/scripts/seed-graphs.js` | ตรวจและเขียน `display_name`/`model_aliases` ลง `manuals` (ไม่มี = NULL) · `--verify` เตือนเมื่อไม่มี `display_name` | ผู้พัฒนาเติมชื่อรุ่นในไฟล์คู่มือ แล้ว seed |

**ตรวจ:** `tsc --noEmit --noUnusedLocals --noUnusedParameters` ผ่าน · `nest build` ผ่าน · HTTP จริง + DB ปลอม **21/21** (`/manuals` ส่ง/ไม่ส่งชื่อ · aliases สตริง JSON แปลงได้และกรองค่าที่ไม่ใช่ข้อความ · INSERT `sessions` มี `model_selection` ตรงตำแหน่ง จำนวน `?` = จำนวนพารามิเตอร์ · `'unknown'`/`'selected'`/ไม่ส่ง = NULL · ผิดรูปแบบ 5 แบบ → 400 ไม่สร้าง session) · สคริปต์ด้วย mysql/dotenv ปลอม (ไม่ต่อ DB ไม่อ่าน `.env`) **12/12** · ทดสอบซ้ำของเดิม: ขั้น 1 12/12, 2.2+2.4 22/22, 2.3 17/17 (โมเดลจริง), ทำเวกเตอร์ไม่ซ้ำ 7/7

**⚠️ ลำดับที่บังคับ:** โค้ดนี้ `SELECT m.display_name, m.model_aliases` ตอนบูต ถ้า DB ยังไม่มี migration 006 `GraphRepository.onModuleInit` ล้มและ backend **ไม่ขึ้น** (ทั้งในเครื่อง ซึ่งต่อ DB เดียวกับ Render และบน Render) และ `INSERT INTO sessions` ล้มถ้ายังไม่มี 007 ⇒ **รัน migration 006/007 ก่อน แล้วค่อยรัน backend ในเครื่องหรือ push** · `seed-graphs.js` ก็ต้องใช้ 006 เช่นกัน (ล้มแบบ rollback ทั้ง transaction ถ้ายังไม่ได้ migrate) · ข้อมูลคู่มือเดิม (ไม่มี `display_name`) seed ใหม่จะเขียน NULL ทับค่าที่เคยตั้งใน DB โดยตรง (ไฟล์ JSON คือแหล่งความจริง)

### ผลการรัน migration 006 / 007 (15 ต.ค. 2569 · ผู้ใช้รันเอง · ผมตรวจผลแบบอ่านอย่างเดียว)

**เหตุการณ์:** ก่อนรัน migration ผู้ใช้เปิด `start:dev` ด้วยโค้ดใหม่ ได้ `Unknown column 'm.display_name'` ที่ `GraphRepository.onModuleInit` ตรงตามที่เตือนไว้ (backend ในเครื่องไม่ขึ้น ไม่มีข้อมูลเสียหาย · เว็บจริงไม่กระทบเพราะยังไม่ push: local = remote `41c64f6`, `/health` ok)

**หลังรัน (ตรวจ 15 ต.ค.):**

| ตรวจ | ผล |
|---|---|
| `node scripts/run-migrations.js --status` | รันแล้ว **7/7** (001–007 ✅ รอรัน 0) |
| `manuals.display_name` | `varchar(120)` NULL ได้ ค่าเริ่มต้น NULL |
| `manuals.model_aliases` | `json` NULL ได้ ค่าเริ่มต้น NULL |
| `sessions.model_selection` | `enum('selected','unknown')` NULL ได้ ค่าเริ่มต้น NULL |
| จำนวนแถวเดิม | manuals 2 · graphs 19 · nodes 139 · sessions 14 (ไม่เปลี่ยน) · `display_name` ที่ไม่ NULL = 0 · `model_selection` ที่ไม่ NULL = 0 |
| บูต backend ใหม่ (`dist`) กับ DB จริง (พอร์ต 3999 ปิดค้นหา/LLM ไม่เขียนอะไร) | ✅ ขึ้น · `/health` ok · โหลด 19 กราฟ 139 โหนด · `/traversal/manuals` ได้ 2 คู่มือ (ยังไม่มี `displayName` เพราะยังไม่เติม) · `/traversal/graphs` ทุกผังมี `manualId` · `?manualId=` กรองได้ (13 ผังของแอร์) · `?manualId=` ว่าง → 400 |

**ที่ยังไม่ได้ทดสอบกับ DB จริง:** `POST /traversal/sessions` ที่ส่ง `modelSelection` (เขียนแถวลง `sessions` ที่ใช้ร่วมกับ FixStep) ทดสอบแล้วกับ DB ปลอมเท่านั้น (21/21) · อุปกรณ์ใน DB มีแค่แอร์ 7 รายการ (`equipment.json` ของประเภทอื่นยังไม่ถูก seed เพราะ `reviewed_by_author: false`) เครื่องซักผ้า WT10J7 จึงไม่แสดงแผงอุปกรณ์

## 10. ร่างระยะ 3 (frontend) — 15 ต.ค. 2569 · 📝 ร่าง · นำไปใช้ทีละขั้น (ทาง ข) **ขั้น 1–6/6 ใส่แล้ว (ยังไม่ commit/push/deploy · ยังไม่ได้ดูด้วยตา)**

รายละเอียด "เพิ่มอะไร ตรงไหน" อยู่ที่ [DRAFT-PHASE3-FRONTEND.md](DRAFT-PHASE3-FRONTEND.md) · ไฟล์: `draft/frontend-phase3/` (`phase3.patch`, `new-files/`, `tests/`)

| รายการ | ค่า |
|---|---|
| ขนาด | แก้ไฟล์เดิม 12 + ไฟล์ใหม่ 3 = 15 ไฟล์ (+423 −74 หลังแก้ถ้อยคำ 15 ต.ค.) |
| ตรวจแล้ว (บนสำเนา ไม่แตะโปรเจกต์จริง) | `tsc -b` ✅ · `eslint src` ✅ · `vite build` ✅ · vitest 17/17 ✅ · `git apply --check` ✅ |
| ยังไม่ได้ตรวจ | เบราว์เซอร์/มือถือ/โปรแกรมอ่านหน้าจอจริง · การเรียก backend จริง |
| ลำดับที่ต้องทำ | push backend (commit `3e089e7`) ให้ Render มี `/traversal/manuals` **ก่อน** แล้วค่อยใช้ร่างและ `npm run deploy` |
| จุดที่ต้องตัดสินใจ | (1) ถ้อยคำคำเตือน "ไม่ทราบรุ่น" (2) ส่ง `modelSelection` ผ่าน navigate state หรือให้ backend คืนใน `SessionResponse` (3) ให้ backend ใส่ `manualId` ใน `SessionResponse` เพื่อเลิกโหลดทุกผังในหน้าตรวจอาการ |
| บักที่เจอระหว่างทำร่าง (แก้แล้วในร่าง) | `useSlowWait` ถูกเรียกหลัง early return (eslint จับ) · โหมดไม่ทราบรุ่นยังกรองด้วยช่องพิมพ์ที่ถูกซ่อน · `?category=` ที่ไม่รู้จักขึ้น "undefined" |

### การนำไปใช้กับโปรเจกต์จริง (ทาง ข ทีละขั้น)

| ขั้น | ไฟล์ | สถานะ |
|---|---|---|
| 1 | แก้ `api/types.ts`, `api/traversal.ts`, `api/queries.ts` | ✅ ใส่แล้ว 15 ต.ค. |
| 2 | ไฟล์ใหม่ `lib/models.ts`, `lib/modelSelection.ts` | ✅ ผู้ใช้พิมพ์เอง 15 ต.ค. (ผมตรวจ) |
| 3 | แก้ `lib/useStartSymptom.ts` | ✅ ใส่แล้ว 15 ต.ค. |
| 4 | ไฟล์ใหม่ `pages/DevicesPage.tsx` + แก้ `App.tsx` | ✅ ใส่แล้ว 15 ต.ค. (ถ้อยคำ ทาง ก) |
| 5 | แก้ `HomePage`, `SymptomsPage`, `AllSymptomsPage` | ✅ ใส่แล้ว 15 ต.ค. |
| 6 | แก้ `SessionPage`, `SessionHeader`, `AppShell`, `errors` | ✅ ใส่แล้ว 15 ต.ค. |

#### ขั้น 1 — ฝั่งเรียก backend รู้จักรุ่น (15 ต.ค. 2569 · ผมใส่ให้ตามที่ผู้ใช้สั่ง "เพิ่มให้หน่อยแล้ว mark ไว้" · ✅ ตรวจแล้ว)

วิธีใส่: `git apply --include='frontend/src/api/*' draft/frontend-phase3/phase3.patch` (เอาเฉพาะ 3 ไฟล์นี้จาก patch; `--check` ผ่านก่อนใส่; สำรองไฟล์เดิมไว้ใน scratchpad) · +68 −15 บรรทัด

| ไฟล์ | เพิ่ม/แก้อะไร |
|---|---|
| `api/types.ts` | `GraphSummary.manualId` · ชนิดใหม่ `ManualSummary` (`displayName?`, `modelAliases?`, `graphCount`) · `ModelSelection = 'selected' \| 'unknown'` |
| `api/traversal.ts` | `listGraphs(manualId?)` ส่ง `?manualId=` · `listManuals()` เรียก `GET /traversal/manuals` · `startSession(graphId, {query?, manualId?, modelSelection?})` · `searchSymptoms(query, manualId?)` |
| `api/queries.ts` | `queryKeys.graphsOf`/`manuals` · `useGraphs(manualId?)` (แคชแยกตามรุ่น) · `useManuals()` · `useSymptomSearch` รับ `{query, manualId}` · `useStartSession` ส่ง `manualId`/`modelSelection` ต่อ |

ตรวจแล้ว: `git status` เปลี่ยนแค่ 3 ไฟล์นี้ใน `frontend/` · `eslint src/api` ✅ · `tsc -b` ได้ **error เดียว** ตรงตามที่คาดไว้ (ทดสอบบนสำเนามาก่อนใส่จริง):

```
src/pages/SymptomsPage.tsx(41,19): error TS2345: Argument of type 'string' is not assignable to parameter of type '{ query: string; manualId?: string | undefined; }'.
```

**สถานะกลางทางที่ต้องรู้ (จนกว่าจะทำขั้น 5):**
- `npm run build` / `npm run deploy` **จะล้ม** เพราะ `build` เริ่มด้วย `tsc -b` (ล้มแบบปลอดภัย ไม่หลุดขึ้นเว็บ) — ห้าม deploy ในสถานะนี้
- `npm run dev` (vite ไม่ตรวจชนิด) ช่องค้นอาการที่ `/symptoms` จะไม่ทำงาน: หน้านั้นยังส่งสตริงเปล่าๆ แต่ hook ใหม่รอ `{query, manualId}` → คำค้นว่างไป backend (ตามโค้ดควรได้ 400 `INVALID_QUERY` — **อ่านจากโค้ด ยังไม่ได้ลองรัน**) · หน้าอื่นยังใช้ได้ตามเดิม
- ย้อนกลับ: `git checkout -- frontend/src/api` (ถ้ายังไม่ commit)

#### ขั้น 2 — ฟังก์ชันจับคู่รุ่น + เก็บรุ่นใน URL (15 ต.ค. 2569 · ผู้ใช้พิมพ์เอง ผมตรวจ · ✅ ตรวจแล้ว)

| ไฟล์ใหม่ | มีอะไร |
|---|---|
| `lib/models.ts` | `matchesPattern` (`*` = 1 ตัว, ตัดช่องว่าง/ขีด, ไม่สนตัวพิมพ์, สั้นกว่า = คำนำหน้า), `patternsOf` (แยก `/` + `modelAliases`), `manualMatches`, `manualTitle` (= `displayName ?? modelPattern` ไม่เดาชื่อ) |
| `lib/modelSelection.ts` | `useChosenModel()` อ่าน `?manual=`/`?unknown=1` · `symptomsPath(manualId, modelSelection, page)` สร้างลิงก์ |

ตรวจ: โค้ดเทียบกับร่างเหมือนทุกบรรทัด (ต่างแค่คอมเมนต์ที่ไม่ได้พิมพ์) · `tsc -b` ยังเหลือ error เดิมตัวเดียว · vitest ของร่าง (`models.test.ts` 14 ข้อ) **14/14** รันกับไฟล์ที่ผู้ใช้พิมพ์ — ทำบนสำเนา ไม่ได้ใส่ไฟล์เทสเข้าโปรเจกต์ · ยังไม่มีใครเรียกใช้ 2 ไฟล์นี้จนกว่าจะถึงขั้น 4–5

#### ขั้น 3 — `start()` รับ `manualId`/`modelSelection` (15 ต.ค. 2569 · ผมใส่ให้ตามที่ผู้ใช้สั่ง "แก้ให้หน่อย แล้ว mark ไว้" · ✅ ตรวจแล้ว)

วิธีใส่: `git apply --include='frontend/src/lib/useStartSymptom.ts' draft/frontend-phase3/phase3.patch` (`--check` ผ่านก่อน, ไฟล์ยังไม่เคยถูกแก้, สำรองไว้ใน scratchpad) · +10 −3 บรรทัด

| จุดใน `lib/useStartSymptom.ts` | เปลี่ยนอะไร |
|---|---|
| import | + `import type { ModelSelection } from '../api/types'` |
| `start` | จาก `start(graphId, query?: string)` เป็น `start(graphId, options = {})` โดย `options = { query?, manualId?, modelSelection? }` แล้ว `mutate({ graphId, ...options })` |
| `navigate` | `navigate('/session/:id', { state: { modelSelection } })` เพื่อให้หน้าตรวจรู้ว่าเลือกแบบ "ไม่ทราบรุ่น" |

ตรวจ: `eslint src/lib src/api` ✅ · `tsc -b` ได้ **2 error** ตรงตามที่ทำนายไว้บนสำเนาก่อนใส่:

```
src/pages/SymptomsPage.tsx(41,19):  TS2345 'string' is not assignable to '{ query: string; manualId?: ... }'   ← เดิมจากขั้น 1
src/pages/SymptomsPage.tsx(67,159): TS2559 Type 'string' has no properties in common with type '{ query?: ...; manualId?: ...; modelSelection?: ... }'   ← ใหม่: start(graphId, search.data.query)
```

ทั้งสองอยู่ใน `SymptomsPage.tsx` ไฟล์เดียว และหายพร้อมกันที่ขั้น 5 · `AllSymptomsPage` ส่ง `onSelect={start}` (เรียกด้วย graphId ตัวเดียว) จึงไม่ฟ้อง

**สถานะกลางทาง (เพิ่มจากขั้น 1):** ปุ่มเลือกอาการจากผลค้นหาใน `npm run dev` ใช้ไม่ได้จนกว่าจะทำขั้น 5 เพราะหน้านั้นยังส่งสตริงเป็นพารามิเตอร์ที่สอง ซึ่งตอนนี้ถูกอ่านเป็น `options` (**อ่านจากโค้ด ยังไม่ได้ลองรัน**) · `npm run build`/`deploy` ยังล้มที่ `tsc -b` เหมือนเดิม · ย้อนกลับ: `git checkout -- frontend/src/lib/useStartSymptom.ts`

#### ขั้น 4 — อ่านร่างแล้ว ยังไม่ได้ใส่ (15 ต.ค. 2569 · ผู้ใช้ตอบ "ok อ่านแล้ว mark ไว้เลย")

ผมอธิบายร่าง `pages/DevicesPage.tsx` (166 บรรทัด) ทีละส่วน + แก้ `App.tsx` 2 บรรทัด (import + `<Route path="/devices">`) ผู้ใช้อ่านแล้ว แต่**ยังไม่ได้สั่งให้ใส่ และยังไม่ได้เลือกถ้อยคำ** จึงยังไม่ได้แก้ร่างและไม่ได้แตะโปรเจกต์จริง · การตอบว่า "ok อ่านแล้ว" **ไม่ถือเป็นการอนุมัติข้อความด้านความปลอดภัย**

**ข้อค้นพบตอนทบทวนข้อความ (ยังเปิดอยู่):** วลี "ขั้นตอนที่เกี่ยวกับไฟฟ้าต้อง…ยืนยันคำเตือนก่อนทุกครั้ง" แคบกว่าที่ระบบทำจริง — ด่านฝั่ง backend ใช้ธง `safety_critical` + `safety_warning` (ข้อความอิสระ) บังคับ `confirm_safety` ที่เซิร์ฟเวอร์กับ**ทุกโหนดที่ข้อมูลระบุว่าอันตราย** ไม่ได้จำกัดว่าเป็นไฟฟ้า (ตรวจจาก `backend/src/traversal-engine/types.ts` บรรทัด 15–16, 115, 129, 161–163) ผู้ใช้อาจเข้าใจว่าอันตรายอื่นไม่มีด่านยืนยัน

| ที่อยู่ของวลี/ข้อความ | เป็นของใคร | หมายเหตุ |
|---|---|---|
| `frontend/src/pages/HomePage.tsx:23` "ขั้นตอนที่เกี่ยวกับไฟฟ้าต้องยืนยันคำเตือนก่อนทุกครั้ง" | **ข้อความเดิมในโปรเจกต์** (อยู่ก่อนร่างนี้) | ไม่ได้ถูกแก้โดย patch |
| `DevicesPage.tsx:134` (ในร่าง) "ขั้นตอนที่เกี่ยวกับไฟฟ้าต้องอ่านและยืนยันคำเตือนก่อนทุกครั้ง" | ผมเขียนตามถ้อยคำของหน้าแรก | กล่อง "ไม่ทราบรุ่น" |
| `DevicesPage.tsx:134` และ `SessionPage.tsx` (ในร่าง) "ให้หยุดและติดต่อศูนย์บริการ" | ผมเขียนเอง ไม่ได้มาจากคู่มือ | คำแนะนำด้านความปลอดภัย ต้องมีคนตรวจ |

**ข้อเสนอ (รอผู้ใช้ตัดสิน):** แก้เป็น "ขั้นตอนที่มีข้อควรระวังด้านความปลอดภัย ต้องอ่านและกดยืนยันก่อนทุกครั้ง" และพิจารณาแก้ข้อความที่หน้าแรกให้ตรงกันด้วย · ทางเลือกอื่น: คงถ้อยคำเดิมไว้ (สอดคล้องกับหน้าแรก)

**ที่ต้องทำต่อ:** (1) ผู้ใช้เลือกถ้อยคำ (2) พิมพ์เองหรือสั่ง "ใส่ให้" ขั้น 4 (3) `npm run dev` เปิด `/#/devices` ควรเห็นการ์ดแอร์กับเครื่องซักผ้า (ตามข้อมูลที่ seed แล้ว)

**ตัดสินใจแล้ว (15 ต.ค. 2569): ผู้ใช้เลือกทางเลือก ก** = ใช้ถ้อยคำตามข้อเสนอ "ขั้นตอนที่มีข้อควรระวังด้านความปลอดภัย ต้องอ่านและกดยืนยันก่อนทุกครั้ง"

ที่แก้ (เฉพาะร่าง — **โปรเจกต์จริงยังไม่ถูกแตะ**):

| ที่ | ก่อน → หลัง |
|---|---|
| `draft/frontend-phase3/new-files/pages/DevicesPage.tsx:134` (กล่อง "ไม่ทราบรุ่น") | "…แต่ขั้นตอนที่เกี่ยวกับไฟฟ้าต้องอ่านและยืนยันคำเตือนก่อนทุกครั้ง…" → "…แต่ขั้นตอนที่มีข้อควรระวังด้านความปลอดภัย ต้องอ่านและกดยืนยันก่อนทุกครั้ง…" |
| `phase3.patch` — ไฟล์ใหม่ `DevicesPage.tsx` | บรรทัดเดียวกับข้างบน |
| `phase3.patch` — hunk ของ `HomePage.tsx` | บรรทัด context เดิม (`HomePage.tsx:23`) เปลี่ยนเป็น −/+ : "…ขั้นตอนที่เกี่ยวกับไฟฟ้าต้องยืนยันคำเตือนก่อนทุกครั้ง…" → "…ขั้นตอนที่มีข้อควรระวังด้านความปลอดภัย ต้องอ่านและกดยืนยันก่อนทุกครั้ง…" · จำนวนบรรทัดใน hunk เท่าเดิม |

- **`frontend/src/pages/HomePage.tsx:23` ของจริงยังเป็นข้อความเดิม** จนกว่าจะทำขั้น 5 (ขั้นที่แก้ `HomePage`) — ผู้ใช้เลือก ก. ตามข้อเสนอที่ระบุไว้ว่า "แก้หน้าแรกให้ตรงกันด้วย" ผมจึงใส่ไว้ใน patch ของขั้น 5 (ย้อนได้โดยเปลี่ยนบรรทัดนั้นกลับ)
- patch รวมเป็น 15 ไฟล์ **+423 −74** (เดิม +422 −73)
- ตรวจแล้ว: บนสำเนา `tsc -b` ✅ · `eslint src` ✅ · vitest 17/17 ✅ · `git apply --check` ของส่วนที่ยังไม่ได้ใส่ (9 ไฟล์ โดยยกเว้น 4 ไฟล์ที่ใส่แล้ว) ✅

**ยังเปิดอยู่ (ไม่ได้แตะ):**
1. `frontend/index.html:11` meta description ("…พร้อมด่านยืนยันคำเตือนก่อนขั้นตอนที่เกี่ยวกับไฟฟ้า") ใช้วลีแคบเดียวกัน แสดงในผลค้นหา/พรีวิวลิงก์ ไม่ได้อยู่ใน patch — รอผู้ใช้สั่ง
2. "ให้หยุดและติดต่อศูนย์บริการ" (กล่อง "ไม่ทราบรุ่น" + `SessionPage`) ผมเขียนเอง ไม่ได้มาจากคู่มือ — ผู้ใช้เลือก ก. เฉพาะวลี "ไฟฟ้า/ยืนยันคำเตือน" ยังไม่ได้ตัดสินข้อความนี้

#### ขั้น 4–6 — ใส่ครบแล้ว (15 ต.ค. 2569 · ผู้ใช้สั่งให้ทำให้จบในโปรเจกต์จริง · ✅ ผ่านเครื่องตรวจ · ⬜ ยังไม่ได้ดูด้วยตา)

ใส่ด้วย `git apply --include=…` ทีละขั้น (`--check` ผ่านก่อนทุกขั้น) · ไฟล์เดิมสำรองไว้ใน scratchpad · ย้ายเทสต์ 2 ไฟล์เข้า `frontend/src/`

| ขั้น | ผลตรวจ |
|---|---|
| 4 `DevicesPage.tsx` + `App.tsx` | tsc: 2 error เดิมจากขั้น 1–3 (ไม่มีใหม่) · eslint ✅ · build ล้มที่ tsc |
| 5 `HomePage`, `SymptomsPage`, `AllSymptomsPage` | tsc ✅ · eslint ✅ · build ✅ |
| 6 `SessionPage`, `SessionHeader`, `AppShell`, `errors` | tsc ✅ · eslint ✅ · build ✅ |
| + เทสต์ (`lib/models.test.ts`, `pages/DevicesPage.test.tsx`) | tsc ✅ · eslint ✅ · **vitest 17/17** ✅ · build ✅ |

สรุปการเปลี่ยนแปลงทั้งหมดสำหรับอธิบายกรรมการ: [CHANGES-PHASE3-FRONTEND.md](CHANGES-PHASE3-FRONTEND.md) · **ยังไม่ได้ push/deploy** · ข้อที่รอผู้ใช้ตัดสินใจ: `index.html:11`, "ให้หยุดและติดต่อศูนย์บริการ", ถ้อยคำหน้าแรกบรรทัด 24, `modelSelection` ผ่าน navigate state, `manualId` ใน `SessionResponse`

#### รอบเพิ่ม — หน้าอาการทั้งหมดทุกรุ่น + ตัดสินใจข้อความ 3 เรื่อง ก/ค/ก (15 ต.ค. 2569 · เอา "ให้หยุดและติดต่อศูนย์บริการ" ออก, แก้ meta ใน index.html, คงถ้อยคำหน้าแรก · vitest 45/45 · ผู้ใช้สั่ง "ใส่ให้" · ✅ ผ่านเครื่องตรวจ · ⬜ ยังไม่ได้ดูด้วยตา · ยังไม่ commit)

คืนเมนู "อาการทั้งหมด" และให้ `/symptoms/all` แสดงอาการของทุกรุ่นแยกกลุ่มตามรุ่นเมื่อไม่มี `?manual=` · เริ่มตรวจส่ง `manualId` ไม่ส่ง `modelSelection` (NULL ตาม D1) · "เริ่มอาการนี้ใหม่" ไม่เปลี่ยนเป็น `selected` · หน้าตรวจแสดงชื่อรุ่นไม่ขึ้นกับ `modelSelection` (ตรวจแล้ว) · ไม่มีคำเตือนความปลอดภัยใหม่ · tsc ✅ eslint ✅ build ✅ vitest 44/44 · รายละเอียด: [CHANGES-PHASE3-FRONTEND.md](CHANGES-PHASE3-FRONTEND.md) §9
