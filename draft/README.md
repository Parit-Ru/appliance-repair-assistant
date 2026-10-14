# draft/ — งานร่างที่ตรวจแล้ว รอคุณตัดสินใจนำเข้า

โฟลเดอร์นี้เกิดจากคำสั่ง "คิดสิ่งที่ต้องทำทั้งหมด วางแผน แล้วทำใส่ folder draft ทั้งโค้ดและเอกสาร"
**ไม่มีไฟล์ใดใน `backend/` หรือ `frontend/` ถูกแก้โดยงานชุดนี้** (ยกเว้นที่คุณสั่งแยกต่างหากก่อนหน้า) — `draft/` ไม่ถูก build/test/lint โดยโปรเจกต์ เพราะอยู่นอก `backend/` และ `frontend/`

เริ่มอ่านที่ **[PLAN.md](PLAN.md)** แล้วดู **[docs/TOR-COMPLIANCE.md](docs/TOR-COMPLIANCE.md)**

## สารบัญ

| ไฟล์/โฟลเดอร์ | คืออะไร | สถานะการตรวจ |
|---|---|---|
| [PLAN.md](PLAN.md) | แผนงานที่เหลือทั้งหมด ลำดับ ความเสี่ยง และสิ่งที่จงใจไม่ทำ | — |
| [docs/TOR-COMPLIANCE.md](docs/TOR-COMPLIANCE.md) | ตารางเทียบ TOR ↔ ระบบ ↔ หลักฐาน ↔ ช่องว่าง | ตรวจจากโค้ด/ข้อมูล/การรันจริง |
| [docs/EVALUATION-PLAN.md](docs/EVALUATION-PLAN.md) | แผนประเมินการค้นหา + **ผลรันเบื้องต้นกับโมเดลจริง** + ตัวเลือกปรับปรุง | ผลรันจริง (ชุดที่ AI ร่าง) |
| [docs/DATA-AUTHORING-GUIDE.md](docs/DATA-AUTHORING-GUIDE.md) | วิธีแปลงคู่มือ 4 ประเภทเป็นเครื่องสถานะ + รายการตรวจ | อ้างกฎที่ตัวตรวจบังคับจริง |
| [docs/ADVISOR-QUESTIONS.md](docs/ADVISOR-QUESTIONS.md) | คำถามถึงอาจารย์ 6 ข้อ พร้อมตัวเลือกและข้อเสนอ | — |
| [docs/REPORT-OUTLINE.md](docs/REPORT-OUTLINE.md) | โครงรายงาน + ข้อเท็จจริงที่ใช้ได้ + สิ่งที่ห้ามอ้าง | — |
| [docs/LLM-REPHRASE-DESIGN.md](docs/LLM-REPHRASE-DESIGN.md) | ออกแบบโมดูล LLM เรียบเรียงถ้อยคำ (ทางเลือก ปิดเป็นค่าเริ่มต้น) | โค้ด+เทสผ่าน; ยังไม่เคยเรียก Groq จริง |
| [docs/DEMO-SCRIPT.md](docs/DEMO-SCRIPT.md) | สคริปต์สาธิต 8–10 นาที + Q&A 10 ข้อ | คะแนนค้นหาจากการรันจริง; ยังไม่ได้ดูหน้าจอจริง |
| [docs/results/TEST-REPORT.md](docs/results/TEST-REPORT.md) | ผลทดสอบทั้งหมด + สิ่งที่แก้ตอนพอร์ต + สิ่งที่ยังไม่พิสูจน์ | รันจริง 13 ต.ค. |
| `docs/results/eval-*.txt/.json` | ผลดิบของการประเมินและวิเคราะห์ส่วนต่างอันดับ | รันจริง |
| `code/backend/tests/` (+ `tests-llm/` สำหรับส่วน LLM) | เทส Jest 183 ข้อ (พอร์ตจาก FixStep) ใน `tests/` และ 36 ข้อใหม่ (rephrase 28 + การเชื่อมเข้า TraversalService 8) ใน `tests-llm/` แยกไว้เพื่อให้นำเข้าได้โดยไม่ต้องมีโค้ด LLM | **219/219 ผ่าน** (183 ข้อแรกผ่านกับโค้ดปัจจุบันของคุณ ไม่ต้องปะ; 36 ข้อใหม่ผ่านกับโค้ดที่ปะ 0001–0003) |
| `code/frontend/tests/` (+ `tests-llm/`) | เทส Vitest 56 ข้อ (พอร์ต, แก้ 1 ข้อ) ใน `tests/` + `displayNode` 5 ข้อใหม่ใน `tests-llm/` | **61/61 ผ่าน** + `tsc -b` + `eslint` + `build` ผ่าน |
| `code/backend/scripts/validate-graphs.js` | **เครื่องมือตรวจสอบความถูกต้องของผัง** (TOR §5 ข้อ 3) | ใช้กับข้อมูลจริง 0 error; self-test 17/17 |
| `code/backend/scripts/eval-symptom-search.js` (+ `validate-eval-queries.js`) | วัดคุณภาพการค้นหาด้วยโมเดลจริง | รันจริงแล้ว |
| `code/backend/scripts/check-deployed-search.js` | ตรวจเว็บที่ deploy (สถานะโมเดล/แรม/CORS) อ่านอย่างเดียว | รันกับเว็บจริงแล้ว: ทำงานถูกต้อง และรายงาน `state=failed` เพราะยังไม่ได้ push `model-slim/` (13 ต.ค.) |
| `code/backend/scripts/demo-safety-gate.ps1`, `show-session-history.js` | พิสูจน์ด่านความปลอดภัยผ่าน API / ดูประวัติ session | พอร์ต แก้ URL เท่านั้น |
| `code/backend/src/rephrase/` + `code/frontend/src/{lib,components}/` + `patches/0003`, `0004` | **LLM เรียบเรียงถ้อยคำ เชื่อมเข้าระบบแล้ว** พร้อม fallback เป็นข้อความต้นฉบับทุกกรณี + วงจรตัด (ปิดเป็นค่าเริ่มต้น) | 28+8+5 เทสผ่าน · smoke HTTP 15/15 กับ LLM จำลอง · **ยังไม่เคยเรียก Groq จริง** |
| `tools/query-collector.html` + `code/backend/scripts/collected-to-report.js` | ฟอร์มเก็บคำค้นจากเพื่อน (ไฟล์เดียว เปิดในเบราว์เซอร์/ส่งทางแชท ไม่ต้องมีเซิร์ฟเวอร์) + ตัวรวมคำตอบเป็นชุดรายงานฉบับร่าง | ทดสอบทั้งสายด้วย jsdom (ฟอร์ม → ไฟล์ → รวม → ตัวตรวจ) |
| `code/patches/0001-…microwave.patch` | เพิ่ม `Microwave` ให้ตรง TOR (types + ป้ายภาษาไทย) | `git apply --check` ผ่าน; `tsc`/เทสผ่านหลังใส่ |
| `code/patches/0002-…health….patch` | `/health` ไม่ส่งข้อความ error ของ MySQL ออกสาธารณะ | เช่นเดียวกัน |
| `data/eval/` | ชุดคำค้น (ตั้งเกณฑ์ 56 ข้อ ร่างโดย AI, ชุดรายงานว่าง), คำขอเพื่อน, แผ่นตรวจ | พอร์ตจาก FixStep |
| `data/templates/` | แม่แบบ manual + equipment (ขึ้น error ถ้ายังมี TODO) | ตัวตรวจจับแม่แบบดิบได้; กรอกแล้วผ่านโครงสร้าง |

## วิธีนำเข้า (PowerShell, ยืนที่รากโปรเจกต์ `appliance-repair-assistant`)

ทำทีละข้อได้ ไม่ต้องครบทุกข้อ

```powershell
# 1) เครื่องมือ → backend/scripts   (สคริปต์หารากโปรเจกต์เอง ใช้ได้ทั้งก่อนและหลังย้าย)
Copy-Item draft\code\backend\scripts\* backend\scripts\

# 2) ชุดประเมิน → data/eval
New-Item -ItemType Directory -Force data\eval | Out-Null
Copy-Item draft\data\eval\* data\eval\

# 3) เทส backend → วางข้างโมดูลของมัน
Copy-Item draft\code\backend\tests\traversal-engine\* backend\src\traversal-engine\
Copy-Item draft\code\backend\tests\traversal\*        backend\src\traversal\
Copy-Item draft\code\backend\tests\symptom-search\*   backend\src\symptom-search\

# 4) เทส frontend
Copy-Item draft\code\frontend\tests\api\* frontend\src\api\
Copy-Item draft\code\frontend\tests\lib\* frontend\src\lib\

# 5) patch (ทีละไฟล์ ตรวจแล้วว่า apply ได้)
git apply --ignore-whitespace draft\code\patches\0001-device-category-microwave.patch
git apply --ignore-whitespace draft\code\patches\0002-health-hide-database-error.patch

# 6) ทางเลือก: LLM เรียบเรียงถ้อยคำ + fallback (ปิดเป็นค่าเริ่มต้น เปิดด้วย REPHRASE_ENABLED=true — ดู docs/LLM-REPHRASE-DESIGN.md §4)
#    ต้องทำตามลำดับ: คัดลอกไฟล์ใหม่ก่อน แล้วค่อย git apply
Copy-Item draft\code\backend\src\rephrase backend\src\rephrase -Recurse
Copy-Item draft\code\backend\tests-llm\rephrase\rephrase.spec.ts backend\src\rephrase\
Copy-Item draft\code\backend\tests-llm\traversal\traversal.service.rephrase.spec.ts backend\src\traversal\
Copy-Item draft\code\frontend\src\lib\displayNode.ts frontend\src\lib\
Copy-Item draft\code\frontend\src\components\RephraseNote.tsx frontend\src\components\
Copy-Item draft\code\frontend\tests-llm\lib\displayNode.test.ts frontend\src\lib\
git apply --ignore-whitespace draft\code\patches\0003-backend-llm-rephrase-integration.patch
git apply --ignore-whitespace draft\code\patches\0004-frontend-llm-rephrase-display.patch
```

```powershell
# 7) เก็บคำค้นจากเพื่อน (แทนการขอ 15–20 คน): ส่งไฟล์ draft\tools\query-collector.html ให้ทีละคน (เปิดด้วยเบราว์เซอร์ได้เลย)
#    ได้ไฟล์ข้อความกลับมา → รวมเป็นชุดรายงานฉบับร่าง (ยังไม่มี label — คุณติดเอง)
node backend\scripts\collected-to-report.js คำตอบ-A.txt คำตอบ-B.txt --author "เพื่อน N คน ผู้พัฒนาติด label"
```

หลังนำเข้าให้ตรวจ (ผลที่คาดไว้ตาม `docs/results/TEST-REPORT.md`):

```powershell
cd backend;  npm test            # 183 ข้อ (219 ถ้าใส่ข้อ 6)
cd ..\frontend; npm test         # 56 ข้อ (61 ถ้าใส่ข้อ 6)
cd ..; node backend\scripts\validate-graphs.js --equipment    # 0 error, 2 warning
node backend\scripts\validate-graphs.js --self-test           # 17/17
```

ถ้าอยากเพิ่มคำสั่งใน `backend/package.json` (ผมไม่ได้แก้ให้ เพราะเป็นไฟล์ที่คุณตั้งใจให้ตรงต้นแบบ):

```json
"validate:graphs": "node scripts/validate-graphs.js --equipment",
"eval:search": "node scripts/eval-symptom-search.js"
```

## ข้อควรระวัง

- **ผลประเมินการค้นหาใน `docs/` มาจากชุดคำค้นที่ AI ร่าง** อย่าอ้างเป็นความแม่นยำของระบบ (ดูหัวเอกสาร `EVALUATION-PLAN.md`)
- `eval-symptom-search.js` ต้อง `npm run build` ใน `backend/` ก่อน และใช้โมเดลจาก `backend/model-slim/`; `dist/` ถูก git ignore
- `check-deployed-search.js` และ `demo-safety-gate.ps1` ยิงเว็บจริง: อันแรกอ่านอย่างเดียว อันหลัง **สร้าง session จริง 1 รายการ** ในฐานข้อมูลที่ใช้ร่วมกับ FixStep
- ผมไม่ได้ commit/push อะไร
