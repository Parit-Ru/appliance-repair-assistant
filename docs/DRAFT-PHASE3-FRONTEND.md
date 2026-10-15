# ร่างระยะ 3 (frontend): เพิ่มอะไร ตรงไหน — เลือกเครื่อง → รุ่น → อาการ

> 15 ต.ค. 2569 · **สถานะ: ใส่ลงโปรเจกต์จริงครบ 6 ขั้นแล้ว 15 ต.ค. (ยังไม่ commit/push/deploy) — สรุปที่ [CHANGES-PHASE3-FRONTEND.md](CHANGES-PHASE3-FRONTEND.md)** · แผนใหญ่: [PLAN-MODEL-SELECTION.md](PLAN-MODEL-SELECTION.md) ระยะ 3 · ไฟล์ร่าง: `draft/frontend-phase3/`

## 1. ตรวจร่างนี้อย่างไรแล้วบ้าง

ผมสร้างสำเนาของ `frontend/` ไว้ในที่ชั่วคราว ใส่ร่างลงไป แล้วรัน (ไม่แตะโปรเจกต์จริง):

| ตรวจ | ผล |
|---|---|
| `tsc -b` (ตั้งค่าเดียวกับโปรเจกต์) | ✅ ผ่าน |
| `eslint src` ทั้งโปรเจกต์ | ✅ ผ่าน (รอบแรกจับบั๊กจริง 1 จุด: เรียก `useSlowWait` หลัง early return แก้แล้ว) |
| `vite build` | ✅ ผ่าน |
| vitest (ตรรกะจับคู่เลขรุ่น + เรนเดอร์ `DevicesPage` 2 ขั้น) | ✅ **17/17** |
| `git apply --check draft/frontend-phase3/phase3.patch` กับโปรเจกต์จริง | ✅ ใช้ได้สะอาด (ตรวจเฉยๆ ยังไม่ได้ใช้) |

**ที่ยังไม่ได้ตรวจ:** การใช้งานบนเบราว์เซอร์จริง/มือถือ/โปรแกรมอ่านหน้าจอ และการเรียก backend จริง (ทดสอบเรนเดอร์ด้วยข้อมูลจำลองเท่านั้น)

## 2. ⚠️ ลำดับที่ต้องทำ (สำคัญ)

1. **backend ต้องขึ้น Render ก่อน** (ตอนนี้ commit `3e089e7` ยังไม่ได้ push และเว็บจริงตอบ 404 ที่ `/traversal/manuals`)
2. แล้วค่อยใช้ร่างนี้ + `npm run deploy` ฝั่ง frontend ถ้า deploy frontend ก่อน หน้า `/devices` จะโหลดรายการรุ่นไม่ได้
3. migration 006/007 รันกับ DB แล้ว (ไม่ต้องทำอะไรเพิ่ม)

## 3. หน้าตาที่ได้

```
หน้าแรก ─▶ /devices ─────────▶ /devices?category=… ─────▶ /symptoms?manual=… ─────▶ /session/:id
           การ์ดประเภทเครื่อง    รายการรุ่น (กรองด้วยเลขรุ่น    ค้นพิมพ์อิสระ + ลิงก์          ตรวจทีละขั้น
           (เฉพาะที่มีคู่มือ)     ได้) · "ฉันไม่ทราบรุ่น"        /symptoms/all?manual=…        (แสดงรุ่นที่ใช้)
                                  = เตือน + บันทึก unknown=1
```

- รุ่นเก็บใน URL (`?manual=<manual_id>`) → กดย้อนกลับ/รีเฟรช/แชร์ลิงก์แล้วยังอยู่รุ่นเดิม
- เข้า `/symptoms` หรือ `/symptoms/all` โดยไม่มี `?manual=` → ส่งกลับ `/devices` (**ไม่เดารุ่นให้**)
- ทุกการค้นหา/เริ่มตรวจ ส่ง `manualId` ไปด้วย เซิร์ฟเวอร์ตรวจว่าผังอยู่ในรุ่นนั้น

## 4. ไฟล์ที่เพิ่ม/แก้ (15 ไฟล์ · +423 −74 บรรทัด)

### ไฟล์ใหม่ 3 ไฟล์ (เปิดอ่านได้ที่ `draft/frontend-phase3/new-files/`)

| ไฟล์ | บรรทัด | ทำอะไร |
|---|---|---|
| `frontend/src/lib/models.ts` | 46 | ฟังก์ชันล้วน: `matchesPattern` (เทียบเลขรุ่นกับ `model_pattern` โดย `*` = 1 ตัวอักษร, คั่นหลายรุ่นด้วย `/`, ตัดช่องว่าง/ขีด, ไม่สนตัวพิมพ์), `patternsOf`, `manualMatches` (รวม `modelAliases`), `manualTitle` (= `displayName ?? modelPattern` **ไม่เดาชื่อ**) |
| `frontend/src/lib/modelSelection.ts` | 21 | `useChosenModel()` อ่าน `?manual=`/`?unknown=1` จาก URL · `symptomsPath(manualId, modelSelection, page)` สร้างลิงก์ |
| `frontend/src/pages/DevicesPage.tsx` | 166 | หน้าเลือกเครื่อง→รุ่น (2 ขั้นในหน้าเดียวตาม `?category=`) + ปุ่ม "ฉันไม่ทราบรุ่น" |

### ไฟล์เดิมที่แก้ 12 ไฟล์ (เลขบรรทัด = บรรทัดเดิมก่อนแก้)

| # | ไฟล์ | บรรทัดเดิมที่แก้ | แก้อะไร |
|---|---|---|---|
| 1 | `api/types.ts` | 20–25, 29–34 | `GraphSummary` + `manualId` · ชนิดใหม่ `ManualSummary`, `ModelSelection` |
| 2 | `api/traversal.ts` | 1–5, 14–34 | `listGraphs(manualId?)` · `listManuals()` · `startSession(graphId, {query?, manualId?, modelSelection?})` · `searchSymptoms(query, manualId?)` |
| 3 | `api/queries.ts` | 4–15, 27–32, 44–56, 80–104 | `queryKeys.manuals`/`graphsOf` · `useGraphs(manualId?)` · `useManuals()` · `useSymptomSearch` รับ `{query, manualId}` · `useStartSession` รับ `manualId`/`modelSelection` |
| 4 | `lib/useStartSymptom.ts` | 1–6, 19–28 | `start(graphId, {query?, manualId?, modelSelection?})` และส่ง `modelSelection` ไปกับ navigate state |
| 5 | `App.tsx` | 2–7, 23–28 | import + `<Route path="/devices" …>` |
| 6 | `pages/HomePage.tsx` | 1–16, 22–48 | ใช้ `useManuals()` (แถวละรุ่น แทนโหลดทุกผังมาจัดกลุ่ม) · ปุ่ม "เลือกเครื่องที่มีปัญหา" ไป `/devices` · แต่ละรุ่นเป็นลิงก์เข้ารุ่นนั้น |
| 7 | `pages/SymptomsPage.tsx` | 1–13, 31–77 | อ่านรุ่นจาก URL (ไม่มี → `Navigate /devices`) · แสดง "รุ่น: … เปลี่ยนรุ่น" · ค้นด้วย `manualId` · เริ่มตรวจด้วย `manualId`+`modelSelection` · ลิงก์ "ดูอาการทั้งหมด" พก `?manual=` |
| 8 | `pages/AllSymptomsPage.tsx` | 1–38, 62–83 | ใช้ `useGraphs(manualId)` แสดงอาการของรุ่นเดียว (เลิก `groupSymptoms` ทั้งระบบ) |
| 9 | `pages/SessionPage.tsx` | 1–17, 29–34, 60–73, 114–134 | ชื่อรุ่น (`displayName`) ใน header · "ตรวจอาการอื่น"/ยกเลิก กลับไปรุ่นเดิม (`/symptoms?manual=…`) · เริ่มใหม่พก `manualId` · กล่องเตือนเมื่อ `unknown` |
| 10 | `components/SessionHeader.tsx` | 5–25 | prop `modelName?` แสดงแทน `modelPattern` |
| 11 | `components/layout/AppShell.tsx` | 23–30 | เมนูเหลือ "หน้าแรก", "เลือกเครื่อง" (`/symptoms` ต้องมีรุ่นจึงไม่อยู่ในเมนู) |
| 12 | `lib/errors.ts` | 84–89 | รหัสใหม่ `GRAPH_MANUAL_MISMATCH` → "อาการนี้ไม่ใช่ของรุ่นที่เลือก" กลับไปเลือกใหม่ |

## 5. วิธีนำไปใช้

### ทาง ก: ใช้ patch (เร็ว)

```powershell
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant
git apply --check draft\frontend-phase3\phase3.patch   # ตรวจก่อน ไม่เปลี่ยนไฟล์
git apply draft\frontend-phase3\phase3.patch           # ใช้จริง
cd frontend
npx tsc -b ; npx eslint src ; npm run build
```

ย้อนกลับได้ด้วย `git apply -R draft\frontend-phase3\phase3.patch` (ถ้ายังไม่ commit) หรือ `git checkout -- frontend/src`

### ทาง ข: พิมพ์เองทีละขั้น (เหมาะกับการเรียนรู้ รันตรวจทุกขั้น)

| ขั้น | ทำ | ตรวจด้วย |
|---|---|---|
| 1 | แก้ 1–3 (`types`, `traversal`, `queries`) | `npx tsc -b` (ตรวจแล้วบนสำเนา: ฟ้อง **error เดียว** ที่ `SymptomsPage.tsx(41)` เพราะ `useSymptomSearch` เปลี่ยนให้รับ `{query, manualId}` — error นี้ปกติ และจะหายเมื่อทำขั้น 5) |
| 2 | ไฟล์ใหม่ `lib/models.ts`, `lib/modelSelection.ts` (+ เทสใน `draft/frontend-phase3/tests/`) | `npx vitest run` |
| 3 | แก้ 4 (`useStartSymptom`) | `npx tsc -b` |
| 4 | ไฟล์ใหม่ `pages/DevicesPage.tsx` + แก้ 5 (`App.tsx`) | `npm run dev` เปิด `/#/devices` |
| 5 | แก้ 6–8 (`HomePage`, `SymptomsPage`, `AllSymptomsPage`) | `npx eslint src` (กฎ hook: เรียก hook ก่อน early return เสมอ) |
| 6 | แก้ 9–12 (`SessionPage`, `SessionHeader`, `AppShell`, `errors`) | `npx tsc -b` + `npm run build` |

**ความคืบหน้าทาง ข (อัปเดต 15 ต.ค. 2569):**

| ขั้น | สถานะ | หมายเหตุ |
|---|---|---|
| 1 | ✅ ใส่แล้ว | `api/types.ts`, `api/traversal.ts`, `api/queries.ts` · `eslint` ✅ · `tsc -b` เหลือ error เดียวที่ `SymptomsPage.tsx(41)` ตามที่คาด (หายเมื่อทำขั้น 5) |
| 2 | ✅ ผู้ใช้พิมพ์เอง | `lib/models.ts`, `lib/modelSelection.ts` · เหมือนร่างทุกบรรทัด · vitest ของร่าง 14/14 (รันบนสำเนา) |
| 3 | ✅ ใส่แล้ว | `lib/useStartSymptom.ts` · `eslint` ✅ · `tsc -b` เหลือ **2 error** ทั้งคู่ใน `SymptomsPage.tsx` (บรรทัด 41 เดิม + บรรทัด 67 ใหม่ `start(graphId, search.data.query)`) หายพร้อมกันเมื่อทำขั้น 5 |
| 4 | ✅ ใส่แล้ว | `pages/DevicesPage.tsx` + `App.tsx` · tsc ยังเหลือ 2 error เดิมจากขั้น 1–3 (ไม่มีใหม่) |
| 5 | ✅ ใส่แล้ว | `HomePage`, `SymptomsPage`, `AllSymptomsPage` · tsc/eslint/build ✅ |
| 6 | ✅ ใส่แล้ว | `SessionPage`, `SessionHeader`, `AppShell`, `errors` · tsc/eslint/build ✅ |
| เทสต์ | ✅ ย้ายเข้า `src/` แล้ว | vitest 17/17 |

⚠️ ระหว่างทาง `npm run build`/`deploy` จะล้มที่ `tsc -b` และช่องค้นที่ `/symptoms` ใน `npm run dev` ยังใช้ไม่ได้จนกว่าจะทำขั้น 5 (รายละเอียดใน PLAN §10)

## 6. รายการตรวจด้วยตา (ทำบน `npm run dev` ต่อ backend ที่มี `/traversal/manuals`)

- [ ] หน้าแรก: ปุ่มไป `/devices` · "รองรับตอนนี้" แสดงรุ่นละแถวและกดเข้ารุ่นได้
- [ ] `/devices`: มีเฉพาะประเภทที่มีคู่มือ · กดประเภท → รายการรุ่น · พิมพ์ `WA21` กรองได้ · พิมพ์ `ผิด` แล้วขึ้น "ไม่พบรุ่นที่ตรง"
- [ ] กด "ฉันไม่ทราบรุ่น": ช่องพิมพ์หาย + ขึ้นกล่องเตือน + แสดงทุกรุ่น · เลือกแล้ว URL มี `unknown=1` · หน้าตรวจอาการมีกล่องเตือน
- [ ] `/#/symptoms` (ไม่มี manual) → เด้งไป `/devices`
- [ ] ค้น "แอร์ไม่เย็น" ในรุ่นแอร์ → ผลมีแต่ผังของรุ่นนั้น (ไม่ปนรุ่นอื่น)
- [ ] เดินจนจบ → "ตรวจอาการอื่น" กลับมาที่ `/symptoms?manual=…` เดิม (รวม `unknown=1` ถ้าเลือกแบบไม่ทราบ)
- [ ] ปิด backend ระหว่างอยู่หน้า `/devices` → ขึ้นกล่องข้อผิดพลาด + ปุ่มลองอีกครั้ง
- [ ] มือถือ: แถวรุ่นกดง่าย (สูง ≥ 56px) ไม่มีแถบเลื่อนแนวนอน

## 7. ข้อจำกัดที่รู้ และจุดที่ต้องตัดสินใจ

| # | เรื่อง | รายละเอียด | ข้อเสนอ |
|---|---|---|---|
| 1 | **ข้อความคำเตือน "ไม่ทราบรุ่น"** | เป็นข้อความด้านความปลอดภัย ผมเขียนเอง ยังไม่มีใครตรวจ | ให้ผู้พัฒนา/อาจารย์อ่านและแก้ถ้อยคำ (ใน `DevicesPage.tsx` และ `SessionPage.tsx`) · **พบ 15 ต.ค.:** วลี "ขั้นตอนที่เกี่ยวกับไฟฟ้า…ยืนยันคำเตือน" แคบกว่าด่านจริง (`safety_critical` ไม่จำกัดไฟฟ้า) และวลีเดียวกันมีอยู่แล้วที่ `HomePage.tsx:23` ของเดิม · ข้อเสนอ: "ขั้นตอนที่มีข้อควรระวังด้านความปลอดภัย ต้องอ่านและกดยืนยันก่อนทุกครั้ง" · **ตัดสินใจแล้ว 15 ต.ค.: ทาง ก** ใช้ข้อเสนอ — แก้ในร่างและ patch แล้ว (รวมบรรทัดของ `HomePage.tsx:23` ที่จะเปลี่ยนตอนขั้น 5) · ยังเปิด: `frontend/index.html:11` ใช้วลีเดียวกัน (ไม่อยู่ใน patch) และ "ให้หยุดและติดต่อศูนย์บริการ" (ผมเขียนเอง) — รายละเอียด PLAN §10 ขั้น 4 |
| 2 | **`modelSelection` ส่งผ่าน navigate state** ไม่ได้อ่านจากเซิร์ฟเวอร์ | รีเฟรชหน้าแล้วยังอยู่ แต่เปิดลิงก์ `/session/:id` ในแท็บใหม่จะกลายเป็น `selected` (ค่าที่บันทึกใน DB ตอนเริ่มครั้งแรกถูกต้องเสมอ ผลกระทบคือกล่องเตือนบนหน้านี้ และค่าที่บันทึกตอนกด "ตรวจอาการอื่น"/"เริ่มอาการนี้ใหม่" ในแท็บใหม่) | ถ้าต้องการแม่นยำ ให้ backend คืน `modelSelection` ใน `SessionResponse` (อ่านคอลัมน์จาก `session.store.find` + 3–4 บรรทัด) |
| 3 | `SessionPage` ยังโหลด `useGraphs()` (ทุกผัง) เพื่อหา `summary` | ถ้า seed ครบ 644 ผัง ≈ 222 KB ต่อการเปิดหน้า (แคชไว้ครั้งเดียว) | ให้ backend ใส่ `manualId` ใน `SessionResponse` แล้วเรียก `useGraphs(manualId)` แทน |
| 4 | `modelAliases` ของทีวี/ตู้เย็นบางไฟล์ยังว่าง | เลขรุ่นที่สติกเกอร์ไม่ตรงกับรหัสเอกสาร ตัวกรองจะหาไม่เจอ (ผู้ใช้ยังเลือกจากรายการเต็มได้) | เติม `display_name`/`model_aliases` ในไฟล์คู่มือ แล้ว seed (ระยะ 1) |
| 5 | จับคู่แบบคำนำหน้า พิมพ์ตัวเดียวก็กรอง | "W" ตรงทุกรุ่นที่ขึ้นต้นด้วย W | ใช้กรองรายการเท่านั้น ผู้ใช้ยังต้องกดเลือกรุ่นเอง (ระบบไม่เลือกให้) |
| 6 | เมนูไม่มี "อาการทั้งหมด" แล้ว | หน้านั้นต้องมีรุ่น | ลิงก์ยังอยู่ในหน้าเลือกอาการ |
| 7 | ลิงก์/บุ๊กมาร์กเดิม `/#/symptoms` | จะเด้งไป `/devices` | ปกติ (ตั้งใจ) |
| 8 | ไม่มีเทสอัตโนมัติใน repo | ไฟล์เทสที่แนะนำอยู่ `draft/frontend-phase3/tests/` (17 ข้อ) | ผู้ใช้เลือกข้ามเทสมาตลอด จึงไม่ได้ใส่เข้า `src/` ใน patch |

## 8. หลังใช้ร่างแล้ว

อัปเดต `PLAN-MODEL-SELECTION.md` §5 ระยะ 3, `FILES-FRONTEND.md` (เพิ่ม 3 ไฟล์ใหม่ + ปรับ 12 ไฟล์) และตารางของ `draft/docs/TOR-COMPLIANCE.md` ข้อ 2 (เลือกประเภท → รุ่น → อาการ)
