# eval/ — ชุดรันประเมิน "อาการจริง → ผังที่ระบบเสนอ"

ไม่แก้โค้ด production · ไม่ใช้ LLM-as-judge · ไม่เขียนทับ `real-cases.json`

## ไฟล์ที่ส่งแล้ว

### 1. `lib/engine.ts` (+ `tsconfig.json`)
ต่อ service จริงของ backend (`FlowRepository` + `SymptomSearchService` + `EmbeddingService`) โดยไม่เปิดเซิร์ฟเวอร์ (โหมด B)

- **ปลอดภัย:** บังคับ `DB_NAME=fixbot_eval` (เปลี่ยนได้ด้วย `EVAL_DB_NAME` เท่านั้น ไม่อ่านค่าจาก `.env`) และไม่สร้าง `SessionStore`/`ExecutionService` จึงมีแค่ SELECT
- **`searchDevice(query, device)`:** API ไม่มีฟิลเตอร์ device จึงค้นทีละคู่มือของ device นั้นแล้วรวมผลเรียง score เอา top-3 (ไม่ส่ง brand/model เพราะรุ่นในเคสไม่ตรงคู่มือที่ ingest)
- **คืนค่า:** `matches` (≥ เกณฑ์, ไม่เกิน 3), `bestScore` (สูงสุดของ device แม้ต่ำกว่าเกณฑ์), `refused` (= `matches` ว่าง), `manualsSearched` (ฟิลเตอร์ที่ใช้จริง)
- **เกณฑ์ 0.55** อ่านจาก response ของ service ไม่ hard-code
- device ที่ไม่รู้จักจะ throw (ไม่เดา)

### 2. `lib/scoring.ts`
ตัดสิน "ผังที่ระบบเสนอพาไปถึงสาเหตุที่ยืนยันแล้วไหม" (ฟังก์ชันล้วน ไม่เรียก DB/LLM)

| ตัวชี้วัด | นิยาม |
|---|---|
| ข้อความส่วนสาเหตุ | ข้อความของ state ทุกตัวในผัง (คำถาม, ขั้นตอน, resolution, escalation) · **ไม่นับ** entry_symptom/aliases และ safety_warning |
| hit | เจอคำใดก็ได้ใน seed ของ `cause_tag` หรือ `alt_cause_tags` (th/en, ไม่สนตัวพิมพ์/ช่องว่างซ้ำ) · เก็บหลักฐาน (คำ, state, ข้อความรอบคำ, มาจาก tag หลักหรือ alt) |
| `top1_hit` (= `cause_hit`) | มีผังในกลุ่ม "score เท่า top-1" ที่ hit อย่างน้อย 1 ผัง · เก็บ `top1_first_only_hit` (เฉพาะผังที่เรียงก่อน) คู่ไว้ดูความไวต่อการเสมอ |
| `top3_hit` | มีผังที่ score ≥ อันดับ 3 (รวมกลุ่มเสมอที่ขอบ) ที่ hit |
| `refused` | ไม่มีผังของอุปกรณ์ ≥ 0.55 → `cause_hit/top1_hit/top3_hit/has_safety/top1_escalation_only` เป็น `null` (ไม่นับในตัวหาร) |
| `top1_tie_count` | จำนวนผังในกลุ่ม top-1 · `tie_count_is_lower_bound` = กลุ่มอาจถูกตัด (service คืนไม่เกิน 3 ผัง/คู่มือ) |
| `top1_escalation_only` | **ทุก**ผังในกลุ่ม top-1 ไม่มี `resolution` ที่เดินถึงได้จาก `initial_state` (ตามเส้นทาง yes/no/next/invalid) |
| `has_safety` | **มีผังใดผังหนึ่ง**ในกลุ่ม top-1 ที่มี state `safety_critical` หรือมี `safety_warning` |

- `validateCases` จับ `cause_tag`/`alt_cause_tags` ที่พิมพ์ผิด (ไม่ให้กลายเป็น "ไม่ hit" เงียบๆ)
- `buildSeedReport`/`renderSeedReport`: ข้อเสนอตรวจ seed (คำซ้อนข้าม tag, คำที่ไม่มีทางเจอ, ต่อเคสที่ไม่ hit ว่าคำใน seed อยู่ในวิธีแก้ที่ยืนยันไหม และคำจากวิธีแก้ที่ผังพูดถึง) · **ไม่ถูกใช้คำนวณตัวเลข ไม่แก้ seed ไม่แก้ real-cases.json**
- ทดสอบด้วยผังสังเคราะห์ (tie, alt tag, refused, escalation-only, entry_symptom ไม่นับ, tag พิมพ์ผิด) ผ่านทั้งหมด · ยังไม่ได้รันกับข้อมูลจริง (รอไฟล์ 3)

เพิ่มหลังไฟล์ 2: `has_safety_first_only` (คู่กับ `has_safety` แบบนับกลุ่ม), `allEvidence` (ทุกคู่ tag/คำที่เจอต่อผัง), `baselineRate` (สัดส่วนผังของอุปกรณ์เดียวกันที่มีคำของ tag — กฎเดียวกับ hit)

### 3. `run-real-cases.ts`
วนทุกเคสด้วย `query_th` ผ่าน engine แล้วให้คะแนนด้วย scoring

```
cd backend
./node_modules/.bin/ts-node-cwd --transpile-only ../eval/run-real-cases.ts            # ทั้ง 99 เคส (~1.5 นาที: โหลดดัชนี ~60 วินาที)
./node_modules/.bin/ts-node-cwd --transpile-only ../eval/run-real-cases.ts --ids MW01,RF11
# ตัวเลือก: --limit N · --out-dir <dir> · --overwrite (ไม่ใส่ = ถ้ามีไฟล์วันนี้แล้ว ต่อท้ายชื่อด้วย -HHMMSS ไม่ทับ)
```

ผลลัพธ์ใน `eval/results/`:
- `real-cases-YYYYMMDD.json` — meta (DB, โมเดล, hash ของ real-cases/seed, รายการคู่มือ+hash ไฟล์, นิยามทุกตัวชี้วัด, caveats) · summary · ทุกเคสพร้อมผังเต็มของอันดับ 1, กลุ่ม top-1/top-3, หลักฐานทุก hit (tag, คำ, state, ข้อความรอบคำ), ฟิลเตอร์ที่ใช้, latency
- `real-cases-YYYYMMDD.csv` — UTF-8 มี BOM (เปิดใน Excel ได้) คอลัมน์ A–I = `id, device, query, ระบบตอบว่า, ระบบอ้างอิง, cause_hit, refused, has_safety, หมายเหตุ` · J = `ผลเทียบ` (เติม "ปฏิเสธ-แนะนำช่าง" เฉพาะเมื่อ refused) · K+ = คอลัมน์เสริม (top3_hit, tie, baseline_rate, best_score, latency, ฯลฯ)
- `seed-review-YYYYMMDD.md` — ข้อเสนอตรวจ seed (ไม่ถูกใช้คำนวณ)

สรุปที่พิมพ์ท้ายรัน: จำนวนเคส, refusal %, cause_hit % (ตัวหาร = เคสที่ไม่ refused และแสดงแบบนับ refused เป็นพลาดคู่กัน), top3 %, first_only %, has_safety % (กลุ่ม/ผังแรก), escalation_only %, citation presence % — แยกตาม device และ fix_category — และตาราง cause_hit เทียบ baseline แยกตาม device

หมายเหตุเรื่อง refused กับหน้าเว็บ: เมื่อ `matches` ว่าง หน้าเว็บแสดงข้อความแนะนำติดต่อศูนย์บริการ ([SymptomSearchResults.tsx](../frontend/src/components/SymptomSearchResults.tsx)) จึงใช้ป้าย "ปฏิเสธ-แนะนำช่าง" แต่หน้าเว็บค้นข้ามทุกอุปกรณ์ ส่วน eval ค้นเฉพาะอุปกรณ์ → refused ของ eval เป็นตัวแทนที่เข้มกว่า (ไม่ได้ผ่านหน้าเว็บจริง)

## ข้อจำกัดที่ควรรู้
- **score ปัด 3 ตำแหน่ง** ตาม service ส่งออก ผังที่ score เท่ากัน (เช่นผังคนละคู่มือที่ใช้ข้อความอาการเดียวกัน) เรียงด้วย `flowId` ตามลำดับตัวอักษร → **top-1 ที่เสมอกันเป็นการตัดสินแบบสุ่มเชิงชื่อ** (พบจริงใน MW01, WM33) ไฟล์ถัดไปควรบันทึกจำนวนผังที่เสมอ top-1
- DB `fixbot_eval` มี 25 คู่มือ (ข้าม `Range` 2 ไฟล์ที่ enum ของ DB ไม่รองรับ) seed ณ 1 พ.ย. 2569 ไฟล์ใน `data/manuals/` ยังเปลี่ยนอยู่ ถ้าแก้ไฟล์ต้อง seed ใหม่แล้วรันใหม่

## รัน
```
cd backend
./node_modules/.bin/ts-node-cwd --transpile-only ../eval/run-real-cases.ts   # ไฟล์ 3 (ยังไม่ส่ง)
cd ../eval && ../backend/node_modules/.bin/tsc -p tsconfig.json              # ตรวจ type
```

## ไฟล์ถัดไป
4. `spot-check-http.ts` (โหมด A: ยิง HTTP 5–10 เคสเทียบกับโหมด B)
