# Step 5 (Phase A) — Admin อัปโหลด PDF → ร่างผังด้วย LLM → ตรวจ → เผยแพร่

> ⚠️ **เอกสารนี้บันทึกตอน backend ยังเป็น NestJS** (ก่อน 21 ต.ค. 2569) — ชื่อ `*.controller.ts`, `*.module.ts`, guard, exception filter, decorator และเลขบรรทัดในนี้อาจไม่มีแล้ว เก็บไว้เป็นประวัติการตัดสินใจ · โค้ดปัจจุบันเป็น Express ดูตารางเทียบใน `docs/STUDY_GUIDE.md` §5.7

สถานะ (16 ต.ค. 2569): **สำรวจเสร็จ เสนอแผนแล้ว รอคำตอบข้อ (a)–(i) + อนุมัติแพ็กเกจ** · ยังไม่ได้เขียนโค้ด
ขอบเขตที่เลือก: **A-lite** = endpoint อัปโหลดเฉพาะ admin + หน้าตรวจ (ดู / แก้ / อนุมัติ / ปฏิเสธ)
หลักการ: LLM ไม่มีอำนาจใดๆ ต่อการเดินขั้นตอน (runtime เป็น deterministic) · LLM แค่ "ร่าง" ตอนสร้างข้อมูล →
validator (โค้ดล้วน) ตรวจ → คนอนุมัติ · draft ต้องไม่ถูกเข้าถึงจาก endpoint ใดที่ผู้ใช้เห็น

ก่อนหน้า: Step 1–4 เขียนครบ (docs/auth/auth-step1.md … auth-step4.md) · Step 4 ยังรอทดสอบด้วยมือในเบราว์เซอร์ + ยังไม่ commit

---

## 1. รูปแบบข้อมูลผังที่มีจริง

**ไม่มีตาราง `node_edges` และ `graph_embeddings`**

| ตาราง | สาระสำคัญ |
|---|---|
| `manuals` | `manual_id` PK, `device_category`, `brand`, `model_pattern`, `source_manual`, `graph_count`, `display_name`, `model_aliases` |
| `graphs` | `graph_id` PK, `manual_id` FK, `entry_symptom` (อังกฤษ), `entry_symptom_th`, `entry_symptom_aliases` JSON, `source`, `page_start`/`page_end`, `source_chunk_id`, `severity`, `difficulty`, `entry_node`, `schema_version`=2 |
| `nodes` | PK (`graph_id`,`node_id`), `node_type` ∈ checkpoint/instruction/input/resolution/escalation, `text_content` |

- **เส้นเชื่อมเป็นคอลัมน์ใน `nodes`**: `on_yes`/`on_no` (checkpoint), `next_node` (instruction/input), `on_invalid` (input)
- คอลัมน์อื่นของ `nodes`: `input_type`, `input_pattern`, `store_as`, `outcome_kind` (terminal), `safety_critical`, `safety_warning`, `author_note`, `external_reference`, `display_order`
- **เลขหน้าอ้างอิงอยู่ระดับผังเท่านั้น** (`page_range`) ไม่มีเลขหน้ารายโหนด · หน้าจอแสดง `reference = {source, pageRange}` ของผัง
- เนื้อหาผังเป็น **ภาษาไทย** (แปลจากคู่มืออังกฤษ) · `entry_symptom` เป็นอังกฤษ
- Engine: instruction ที่ `safety_critical` ต้องส่ง `confirm_safety` ก่อน · แทนค่า `{{var}}` จาก input node · engine **ไม่ตรวจโครงสร้างผัง**
- `GraphRepository` (`backend/src/traversal/graph.repository.ts`):
  - โหลด `graphs JOIN manuals` + `nodes` ทั้งหมดตอน `onModuleInit` เก็บใน Map
  - ตรวจ schema_version, ผังต้องมีโหนด, `entry_node` มีอยู่, คอลัมน์ที่ชนิดโหนดบังคับ
  - **reload โดยไม่รีสตาร์ตยังทำไม่ได้** (`loadAll()` เป็น private) → ต้องเพิ่ม `reload()` แบบสร้าง Map ใหม่แล้วสลับ (กันโหลดล้มกลางทางแล้ว Map ว่าง)

## 2. วิธีสร้างผังทุกวันนี้ และการตรวจที่มีอยู่

กระบวนการ (offline):
1. PDF (`data/pdf`) → chunk JSON (`data/chuck`: `{chunk_id, page, content, metadata.symptom…}`) ตรวจด้วย `scripts/check_chunk_pdf.py` (pymupdf)
2. `scripts/convert_chunks_to_graphs.py` แปลง chunk → ผัง **deterministic ไม่ใช้ LLM** → `data/manuals/*.json`
3. ผู้พัฒนาแก้และแปลไทย
4. `node scripts/seed-graphs.js <file>` (`INSERT … ON DUPLICATE KEY UPDATE` + ลบ nodes ของ graph_id แล้วใส่ใหม่ — **เขียนทับเงียบๆ**)
5. รีสตาร์ต backend

การตรวจที่มีอยู่ (กระจาย 3 ภาษา):
- `backend/scripts/seed-graphs.js validateManual()` — entry มีอยู่, ลูกศรชี้โหนดที่มี, safety_critical เฉพาะ instruction + ต้องมี safety_warning
- `scripts/validate_graph.py` (ครบที่สุด) — jsonschema, node_id ซ้ำ, entry/edge, terminal ไม่มีขาออก, ทุกโหนดเดินถึงได้, ทุกโหนดไปถึง terminal (กันวนไม่รู้จบ), safety_warning, safety บน checkpoint/input = เตือน, pattern ของ input, `{{var}}` ต้องถูกเก็บก่อนใช้
- `scripts/simulate_paths.py` — ไล่ทุกเส้นทาง, ความยาว, ความครอบคลุมด่านความปลอดภัย (MAX_PATH_LENGTH = 40)
- `backend/src/traversal-engine/graph-vs-chunk.spec.ts` (jest) — ผัง ↔ chunk (22 คู่มือ 644 ผัง)

**ข้อเสนอ reuse:** พอร์ตกฎชุดเดียวกันเป็น TypeScript (`graph-validator.ts`) เป็นแหล่งความจริงเดียวฝั่ง backend + เทสต์ที่รันกับ **644 ผังจริงใน `data/manuals` ต้องผ่านทั้งหมด** (พิสูจน์ว่ากฎใหม่ไม่เข้มเกินข้อมูลจริง) · Python คงไว้สำหรับ offline (ซ้ำซ้อนที่เลี่ยงไม่ได้)

## 3. Draft/published และทุกจุดที่อ่านผัง

- ไม่มีคอลัมน์ status ใน graphs/manuals
- **จุดอ่านผังจาก DB มีจุดเดียว: `GraphRepository.loadAll()`** ทุกอย่างที่ผู้ใช้เห็นอ่านจาก Map ของมัน:
  traversal (start/get/actions), `/traversal/graphs`, `/traversal/manuals` (รายการรุ่น/เครื่อง), symptom search (index จาก `listAll()`), history (`findById`), admin analytics (`findById`)
  · `EquipmentRepository` อ่านตารางอุปกรณ์ตามประเภทเครื่อง ไม่เกี่ยวกับผัง
- **ปัญหาสำคัญ:** `troubleshoot-assistantv2` ใช้ DB เดียวกันและ `SELECT … FROM graphs g` เหมือนกัน → ถ้าใส่ status ในตาราง graphs **โปรเจกต์เก่าจะเห็น draft** (ห้ามแตะโปรเจกต์นั้น)
- **ข้อเสนอ:** เก็บ draft ใน **ตารางใหม่ `graph_drafts`** (migration 012) เป็น JSON รูปแบบ manual JSON เดิม → ตอน publish ค่อยเขียนลง manuals/graphs/nodes ใน transaction เดียว
  → **ไม่ต้องแก้ read path ไหนเลย** · โปรเจกต์เก่าปลอดภัย · FK `sessions → graphs` (RESTRICT) ไม่เกี่ยว
  → ป้องกันด้วยเทสต์: draft ที่ยังไม่ publish ไม่ปรากฏใน `GraphRepository` และ endpoint ผู้ใช้

## 4. LLM ที่ใช้อยู่

- มีแค่ **Groq** (`backend/src/rephrase/groq-llm.client.ts`) — `fetch` ตรงๆ (OpenAI-compatible) ไม่มี SDK
- env (ชื่อเท่านั้น): `REPHRASE_ENABLED`, `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_REASONING_EFFORT`, `REPHRASE_TIMEOUT_MS`
- timeout ด้วย `AbortController` · error ทุกอย่าง → ใช้ข้อความต้นฉบับ · มีด่านตรวจผล `rephrase-guard.ts`
- `temperature: 0`, `max_tokens: 1000` · **ไม่มี Gemini**

## 5. Embedding ของผังใหม่

- คำนวณ **ในหน่วยความจำตอนบูต** (`@huggingface/transformers` + `model/`) จาก `entry_symptom`, `entry_symptom_th`, aliases ของทุกผัง · ไม่มีตารางเวกเตอร์ · เปิดด้วย `SYMPTOM_SEARCH_ENABLED=true`
- ผังใหม่ที่ publish ต้อง: (1) `GraphRepository.reload()` (2) เพิ่ม `SymptomSearchService.addGraphs(ids)` embed เฉพาะข้อความใหม่ (ไม่ทำ 644 ผังใหม่) · search ปิดอยู่ = ข้าม (บูตครั้งถัดไปรวมเอง)

## 6. Pipeline ที่เสนอ (A-lite)

```
POST /admin/drafts (multipart: file=PDF + manual meta + ช่วงหน้า)   ← JwtAuthGuard+RolesGuard+@Roles(Admin)+@UseFilters
  1. ตรวจขนาด/ชนิด (หน่วยความจำเท่านั้น ไม่เขียนดิสก์)
  2. แยกข้อความรายหน้า (ไม่มีข้อความ = สแกนรูป → 422 PDF_NO_TEXT)
  3. บันทึก graph_drafts(status='drafting', pages=[{page,text}]) → ตอบ 202 {draftId}
  4. (งานเบื้องหลังในโปรเซส) เรียก LLM ทีละช่วงหน้า → JSON
  5. parse เข้ม (ไม่ผ่าน = status 'failed' + เหตุผล)
  6. validator (โค้ดล้วน) → เก็บรายงาน → status 'ready'
GET  /admin/drafts                 รายการ + สถานะ
GET  /admin/drafts/:id             draft + ข้อความหน้าต้นฉบับ + รายงาน validator
PUT  /admin/drafts/:id             admin แก้ JSON → validator รันใหม่ทุกครั้ง (ผลแก้ไม่ได้)
POST /admin/drafts/:id/reject      status 'rejected'
POST /admin/drafts/:id/publish     validator รันใหม่ฝั่งเซิร์ฟเวอร์ · error 0 เท่านั้น + id ไม่ชนของเดิม
                                   → transaction เขียน manuals/graphs/nodes → GraphRepository.reload() → SymptomSearch.addGraphs()
```

**Backend (โมดูลใหม่ `src/authoring/`):** `graph-validator.ts` (+ spec 644 ผัง), `pdf-text.ts`, `draft-llm.client.ts` (Groq JSON mode), `draft-schema.ts` (parse ผล LLM เข้ม), `drafts.store.ts` (SQL + publish transaction), `drafts.service.ts` (สถานะ + งานเบื้องหลัง), `drafts.dto.ts`, `drafts.exception.filter.ts`, `drafts.controller.ts`, `authoring.module.ts` · แก้ `GraphRepository` (`reload()`), `SymptomSearchService` (`addGraphs()`) · migration `012_create_graph_drafts.sql`

**Error code ใหม่:** `INVALID_DRAFT_REQUEST` 400 · `PDF_TOO_LARGE` 413 · `PDF_UNSUPPORTED_TYPE` 415 · `PDF_NO_TEXT` 422 · `PDF_UNREADABLE` 422 · `DRAFT_NOT_FOUND` 404 · `DRAFT_NOT_READY` 409 · `DRAFT_INVALID` 409 (publish ตอน validator มี error) · `DRAFT_ID_CONFLICT` 409 · `LLM_UNAVAILABLE` (เก็บใน status ของ draft ไม่ใช่ HTTP)

**Frontend:** route `/admin/drafts` (รายการ + อัปโหลด) และ `/admin/drafts/:id` (หน้าตรวจ) · แท็บที่สามใน `AdminTabs` "ร่างผังขั้นตอน" · ใช้ `AdminRoute`, `Notice`, `Button`, token สีเดิม

## 7. กฎของ validator (โค้ดล้วน LLM แก้/override ไม่ได้)

**Error (กัน publish):**
1. รูปร่าง: schema_version=2, ฟิลด์บังคับครบ, ชนิด/enum ถูก (node type, input_type, outcome_kind, device_category, severity/difficulty), ความยาวไม่เกินคอลัมน์
2. id: รูปแบบ `^[a-z0-9_]+$`, ไม่ซ้ำในผัง, graph_id ไม่ซ้ำในชุดและ **ไม่ชนผังใน DB** (ตรวจซ้ำตอน publish), manual_id ใหม่
3. `entry_node` มีอยู่ · ทุก edge ชี้โหนดที่มีอยู่
4. ฟิลด์ตามชนิด: checkpoint = on_yes/on_no · instruction = next · input = next/input_type/store_as · terminal = outcome_kind และ **ไม่มีขาออก**
5. ทุกโหนดเดินถึงได้จาก entry (ไม่มีโหนดกำพร้า)
6. ทุกโหนดไปถึง terminal ได้ (วน retry ได้ ถ้าไม่มีวงปิดที่ไม่มีทางออก — ตรงกับ Python และข้อมูลจริง)
7. `safety_critical` เฉพาะ instruction + ต้องมี `safety_warning` ไม่ว่าง
8. `{{var}}` ทุกตัวต้องถูก `store_as` โดย input node ก่อนหน้าในทุกเส้นทาง
9. `input pattern` คอมไพล์เป็น regex ได้ และยาว ≤ 200
10. ทุกโหนดมี `source_page` ที่อยู่ในหน้าที่อัปโหลดจริง · `page_range` ของผังครอบทุกโหนด
11. ความยาวเส้นทางสูงสุด ≤ 40

**Warning (ไม่กัน publish แต่ต้องติ๊กรับทราบ):**
- หน้าต้นฉบับที่อ้างมีคำเสี่ยง (unplug, electric, voltage, gas, water supply, ปลั๊ก, ไฟฟ้า, แก๊ส …) แต่เส้นทางนั้นไม่มีโหนด safety_critical (LLM ลืมด่านความปลอดภัยอันตรายกว่าใส่เกิน)
- ผังไม่มี escalation เลย

## 8. การจัดการความล้มเหลว

| กรณี | ผล |
|---|---|
| ไฟล์ใหญ่ / หน้าเกิน | 413 `PDF_TOO_LARGE` (multer `limits.fileSize`) |
| ไม่ใช่ PDF (ตรวจ magic bytes `%PDF-` ไม่เชื่อ mimetype) | 415 `PDF_UNSUPPORTED_TYPE` |
| PDF เสีย / มีรหัสผ่าน | 422 `PDF_UNREADABLE` |
| ไม่มีข้อความ (สแกนรูป) | 422 `PDF_NO_TEXT` "ไม่รองรับไฟล์สแกน ต้องเป็น PDF ที่เลือกข้อความได้" (ไม่ทำ OCR) |
| LLM ล่ม / ไม่ได้ตั้งค่า / timeout | draft `failed` + เหตุผล · ปุ่ม "ลองใหม่" (ข้อความหน้าเก็บไว้แล้ว) |
| LLM ตอบไม่ใช่ JSON / ไม่ตรง schema | `failed` + parse error (ไม่ซ่อม/เดาเอง) |
| validator ไม่ผ่าน | `ready` + รายงาน error → แก้ใน editor แล้วตรวจใหม่ · publish → 409 `DRAFT_INVALID` |
| เซิร์ฟเวอร์ดับกลางงาน | ตอนบูต draft ที่ค้าง `drafting` → `failed` ("งานถูกขัดจังหวะ") |
| publish ชน id เดิม | 409 `DRAFT_ID_CONFLICT` (**ห้ามเขียนทับ** ผังที่ใช้งานอยู่) |
| reload ล้มหลัง publish | commit แล้ว แต่ Map เดิมยังใช้ต่อ · ตอบ 500 บอกให้รีสตาร์ต |

## 9. คำถามที่รอคำตอบ (พร้อมคำแนะนำ)

| ข้อ | คำแนะนำ | ข้อแลกเปลี่ยน |
|---|---|---|
| (a) LLM / รูปแบบ | Groq ตัวเดิม (`fetch` ไม่เพิ่ม SDK) `response_format: json_object`, `temperature: 0`, ผลเป็น manual JSON v2 + `source_page` รายโหนด · parse ด้วย `draft-schema.ts` ทุกครั้ง · env ใหม่ `AUTHORING_LLM_MODEL`, `AUTHORING_LLM_TIMEOUT_MS` | Groq ฟรีจำกัด token/นาที → admin ต้อง **ระบุช่วงหน้า** (เช่น 35–40) เรียกทีละ 1–2 หน้า · คุณภาพแปลไทย/แตกขั้นตอน validator ตรวจไม่ได้ คนต้องเทียบ |
| (b) Embedding | ทำตอน publish ในโปรเซส (`addGraphs` เฉพาะผังใหม่) | publish ช้าขึ้นไม่กี่วินาที |
| (c) ขนาด | ≤ 10 MB, ≤ 200 หน้า, ส่ง LLM ≤ 10 หน้า/draft · ไฟล์อยู่ในหน่วยความจำ (multer memoryStorage) เก็บแค่ข้อความรายหน้าของช่วงที่เลือก | ส่วน troubleshooting ที่ยาวกว่า 10 หน้าต้องแบ่งหลาย draft |
| (d) หน้าตรวจ | รายงาน validator ด้านบน (ปุ่ม publish ปิดถ้ามี error) · ข้อความหน้าต้นฉบับข้างทุกโหนด · ป้าย "ต้องยืนยันความปลอดภัย" + safety_warning · รายการคำเตือนคำเสี่ยง · เส้นทางแบบข้อความ · ตัวแก้ JSON + "ตรวจใหม่" · ช่องติ๊กบังคับก่อน publish · ป้าย "ร่างโดย AI · ยังไม่เผยแพร่" | — |
| (e) validator ไม่ผ่าน | กันเด็ดขาด ไม่มี override (warning ต้องติ๊กรับทราบ) | ผังโครงสร้างแปลกที่ตั้งใจ ต้องแก้ให้ผ่าน หรือแก้กฎในโค้ดผ่านเทสต์ 644 ผัง |
| (f) บล็อก request? | งานเบื้องหลังในโปรเซส + poll ทุก 3 วิ · drafting ได้ทีละ 1 งาน · ใช้ draft row เป็นสถานะ | ดับกลางงาน = งานหาย (ข้อ 8 จัดการ) · บล็อก request เสี่ยง timeout (ไม่ยืนยันตัวเลขของ Render) |
| (g) audit | เก็บ `created_by`, `created_at`, `reviewed_by`, `reviewed_at`, `published_at`, `llm_model`, `prompt_version` (user id ไม่ใช่อีเมล) · ผังที่ publish ใช้ `source_chunk_id = draft:<id>` | ใช้ในรายงานโครงงานพิสูจน์ว่าคนอนุมัติทุกผัง |
| (h) เลขหน้ารายโหนด | เก็บเฉพาะใน draft (หลักฐานการตรวจ) · publish ใช้ `page_range` = min..max | ผู้ใช้ปลายทางเห็นเลขหน้าเป็นช่วงของผังเหมือนเดิม · ไม่ต้องแก้ engine/nodes |
| (i) ขอบเขต publish | 1 การอัปโหลด = 1 **คู่มือใหม่** เท่านั้น | เพิ่มอาการให้คู่มือเดิมผ่านหน้านี้ไม่ได้ ต้องใช้ seed |

**แพ็กเกจที่ขออนุมัติ:**
- `unpdf` (แนะนำ) — ห่อ pdf.js ของ Mozilla pure JS ไม่มี native · แยกข้อความรายหน้า · (ทางเลือก `pdfjs-dist` ตรงๆ แต่ ESM/worker ยุ่งกว่าใน NestJS CommonJS) · **ต้องลอง import จาก CommonJS จริงก่อนยืนยัน**
- `@types/multer` (dev) — multer มีอยู่แล้วผ่าน `@nestjs/platform-express`
- ไม่ต้องใช้ LLM SDK

## ทางเลือกสำรอง (B) ถ้า A-lite ใหญ่เกิน

ตัดเล็กสุดที่ยังปลอดภัย: สคริปต์ CLI `scripts/draft-from-pdf.js` (PDF → LLM → JSON ลง `data/drafts/*.json` + รายงาน validator) → คนแก้ไฟล์ → `seed-graphs.js` เดิม (ต้องเรียก validator ใหม่ก่อนเขียน และปฏิเสธการเขียนทับ) · ไม่มีตาราง draft / endpoint / หน้าเว็บ · **validator TS + เทสต์ 644 ผังยังต้องทำ** (แกนความปลอดภัย)

## ไฟล์และลำดับ (A-lite)

1. `backend/migrations/012_create_graph_drafts.sql`
2. `backend/src/authoring/graph-validator.ts` + spec (644 ผังจริงผ่าน + เคสผิดทีละกฎ)
3. `backend/src/authoring/draft-schema.ts` + spec
4. `backend/src/authoring/pdf-text.ts` + spec (PDF เล็กที่สร้างในเทสต์ + กรณีไม่มีข้อความ)
5. `backend/src/authoring/draft-llm.client.ts` + spec (fetch ปลอม: JSON ผิด, timeout, HTTP error)
6. `drafts.store.ts`, `drafts.service.ts`, `drafts.dto.ts`, `drafts.exception.filter.ts`, `drafts.controller.ts`, `authoring.module.ts` + `app.module.ts`
7. แก้ `traversal/graph.repository.ts` (`reload()`), `symptom-search/symptom-search.service.ts` (`addGraphs()`)
8. เทสต์ HTTP ผ่าน pipeline จริง (แบบ `admin-http.spec.ts`): 401/403/413/415/422, publish ถูกปฏิเสธเมื่อ validator ไม่ผ่าน/ชน id, **draft ไม่ปรากฏใน GraphRepository ก่อน publish**
9. Frontend: `api/drafts.ts`, `api/types.ts`, `api/queries.ts`, `pages/AdminDraftsPage.tsx`, `pages/AdminDraftReviewPage.tsx`, `components/admin/AdminTabs.tsx`, `lib/errors.ts`, `App.tsx` + เทสต์หน้า
10. `backend/.env.example`, `docs/authoring/authoring-step5.md`

## คำสั่งที่ต้องรัน (หลังอนุมัติ)

```powershell
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\backend
npm install unpdf            # เช็กเวอร์ชัน + import จาก CommonJS ก่อนให้คำสั่งสุดท้าย
npm install --save-dev @types/multer
npm run migrate              # 012
```

## กลับมาทำต่อ

ตอบ (a)–(i) + อนุมัติ/ไม่อนุมัติ `unpdf` และ `@types/multer` (หรือเลือก B) แล้วสั่งเริ่ม Phase B
