# รายงานผลทดสอบ (สร้างเมื่อ 13 ต.ค. 2569)

สิ่งที่รันจริงในเครื่องของผู้พัฒนา (Windows, Node 22.17.0) ทั้งหมดรันใน "แซนด์บ็อกซ์" นอกโปรเจกต์ โดยคัดลอก `backend/src` และ `frontend/src` ปัจจุบันของคุณไปรวมกับไฟล์ใน `draft/` — **ไม่ได้แตะโค้ดจริง**

## สรุป

| ชุดทดสอบ | จำนวน | ผล | ใช้โค้ดจริงของโปรเจกต์ | ทดสอบอะไร |
|---|---:|---|---|---|
| backend Jest (พอร์ตจาก FixStep) | 183 | **183 ผ่าน** | ✅ `backend/src` ปัจจุบัน | engine, ด่านความปลอดภัย, เดินทุกเส้นทางของ 13 ผัง, DTO, filter, service, การค้นหา |
| backend Jest (ใหม่: rephrase 28 + การเชื่อมเข้า `TraversalService` 8) | 36 | **36 ผ่าน** (กับโค้ดที่ปะ 0001–0003) | ✅ + ข้อมูลผังแอร์จริง | ด่านตรวจข้อความ, fallback ทุกกรณี, วงจรตัด, log, client (fetch ปลอม), ลำดับ nodeId ไม่เปลี่ยนเมื่อเปิด/ปิด/พัง/ช้า |
| frontend Vitest (พอร์ตจาก FixStep) | 56 | **56 ผ่าน** (แก้ 1 ข้อ ดูด้านล่าง) | ✅ `frontend/src` ปัจจุบัน | `describeError`, `trail`, `outcome`, `search`, `symptoms`, `reference`, `http` |
| frontend Vitest (ใหม่: `displayNode`) | 5 | **5 ผ่าน** + `tsc -b`/`eslint`/`build` ผ่านหลังปะ 0004 | ✅ | เลือกข้อความที่แสดง + ไม่แตะโหนดความปลอดภัย/สิ้นสุด |
| Smoke test HTTP: `AppModule` ที่ปะ 0003 + เซิร์ฟเวอร์ LLM จำลองในเครื่อง | 15 ข้อ | **ผ่านหมด** | ✅ (DI จริง, `fetch` จริงไปยังพอร์ตในเครื่อง) | LLM ปกติ / ตอบ 500 / ช้า / ล่ม → ผู้ใช้เห็นข้อความต้นฉบับ ลำดับ nodeId เหมือนกัน ไม่ส่งข้อความโหนดความปลอดภัยให้ LLM |
| `tsc --noEmit` backend (+ rephrase + spec) | — | ผ่าน | ✅ | |
| `tsc -b` + `eslint .` frontend (+ เทส) | — | ผ่าน | ✅ | |
| `validate-graphs.js` กับข้อมูลจริง | 13 ผัง/95 โหนด | **0 error**, 2 warning | ✅ `data/manuals` | โครงสร้างผัง/การเข้าถึง/ความปลอดภัย |
| `validate-graphs.js --self-test` | 17 กรณี | **17 ผ่าน** | — | ใส่ข้อผิดพลาดจงใจแล้วดูว่าจับได้ |
| `git apply --check` ของ patch | 2 ไฟล์ | ผ่าน + `tsc`/เทสผ่านหลังใส่ patch | ✅ | |
| Smoke test HTTP ผ่าน `AppModule` จริง + ฐานปลอม | 52 ข้อ | **ผ่านหมด** (รอบ 13 ต.ค. ก่อนหน้า) | ✅ | ดู HANDOFF "ผลตรวจรวม" |

## backend: แยกตามไฟล์ (Jest)

| ไฟล์สเปค | เทส |
|---|---:|
| `traversal-engine/traversal-engine.spec.ts` | 37 |
| `traversal-engine/path-coverage.spec.ts` (เดินทุกเส้นทางของ 13 ผัง) | 45 |
| `traversal-engine/traversal-engine.confidence.spec.ts` | 4 |
| `traversal/traversal.service.spec.ts` | 31 |
| `traversal/traversal.dto.spec.ts` | 15 |
| `traversal/traversal.exception.filter.spec.ts` | 5 |
| `symptom-search/symptom-matcher.spec.ts` | 19 |
| `symptom-search/symptom-search.service.spec.ts` | 13 |
| `symptom-search/symptom-search.dto.spec.ts` | 10 |
| `symptom-search/symptom-search.exception.filter.spec.ts` | 4 |
| `rephrase/rephrase.spec.ts` (ใหม่) | 28 |
| `traversal/traversal.service.rephrase.spec.ts` (ใหม่) | 8 |
| **รวม** | **219** |

จำนวน 183 ข้อของฝั่งพอร์ตเท่ากับที่ ROADMAP ระบุไว้สำหรับ FixStep (Jest 183 ข้อ)

## สิ่งที่แก้ตอนพอร์ต (ละเอียดเพราะอาจารย์อาจถามว่าเทสถูกแก้อะไร)

| ไฟล์ | การแก้ | เหตุผล |
|---|---|---|
| `symptom-search.service.spec.ts` | `import … from './embedding.service'` → `'../embedding/embedding.service'` | โปรเจกต์นี้ย้าย `EmbeddingService` ไป `src/embedding/` |
| `frontend/lib/errors.test.ts` (1 ข้อ) | `expect(detail).toContain('รายการ')` → `toContain('อาการทั้งหมด')` และชื่อเทส | หลังแยกหน้า "เลือกอาการ" / "อาการทั้งหมด" ข้อความ SEARCH_UNAVAILABLE ชี้ไปหน้า "อาการทั้งหมด" แทน "รายการด้านล่าง" — **เทสนี้จับการเปลี่ยนข้อความได้จริง** ก่อนแก้ล้ม 1 ข้อ |
| ไม่นำมา | `frontend/mocks/mockServer.test.ts` (300 บรรทัด) | โปรเจกต์นี้ตัดโหมดจำลองออก |

เทสที่เหลือ **ไม่ถูกแก้แม้แต่บรรทัดเดียว** และผ่านกับโค้ดของคุณซึ่งต่างจากต้นแบบหลายจุดโดยตั้งใจ (เช่น `graph.nodes.find` แทน `buildNodeIndex` ใน engine) — เป็นหลักฐานว่าความต่างเหล่านั้นไม่เปลี่ยนพฤติกรรมที่เทสครอบคลุม

## สิ่งที่ผลทดสอบนี้ "ไม่ได้" พิสูจน์

- ไม่ได้ทดสอบกับ MySQL จริง (เทสและ smoke ใช้ตัวแทนในหน่วยความจำ) — การต่อ MySQL จริงพิสูจน์แล้วเฉพาะตอน Render บูตและ `/health` ตอบ `database: ok`
- ไม่ได้ทดสอบ UI บนเบราว์เซอร์ (มีเฉพาะเรนเดอร์ใน jsdom ระหว่างพัฒนา ซึ่งไม่ได้เก็บเป็นเทสถาวร)
- ไม่ได้วัดความแม่นยำของการค้นหา — ดู `../EVALUATION-PLAN.md` (ผลเบื้องต้นบนชุดที่ AI ร่าง)
- `groq-llm.client.ts` ไม่เคยเรียก Groq จริง (ทดสอบด้วย fetch ปลอมและเซิร์ฟเวอร์จำลองที่ผมเขียนเอง — รูปแบบคำตอบของ Groq จริงอาจต่าง)

## ข้อสังเกต

- ตอนรัน Jest ทั้งชุด บางรอบขึ้นคำเตือน "A worker process has failed to exit gracefully … tests leaking" ทั้งที่ทุกข้อผ่าน — เกิดกับชุด 183 ข้อที่พอร์ตมาจากต้นแบบ (รันแบบไม่ใส่โมดูล LLM ก็ขึ้น) **ยังไม่ได้ไล่หาสาเหตุ** (น่าจะเป็น timer/handle ค้างในเทสต้นฉบับ) ไม่กระทบผลผ่าน/ไม่ผ่าน
- ส่วน LLM ถูกแยกไว้ที่ `code/*/tests-llm/` เพื่อให้นำเข้าชุดเทสหลักได้โดยไม่ต้องมีโค้ด LLM (ตรวจแล้ว: tests/ อย่างเดียวผ่าน 183 + 56)

## วิธีรันซ้ำ

หลังนำไฟล์จาก `draft/` เข้าโปรเจกต์ตาม `../../README.md`:

```
cd backend  && npm test
cd frontend && npm test
node backend/scripts/validate-graphs.js --equipment
node backend/scripts/validate-graphs.js --self-test
```
