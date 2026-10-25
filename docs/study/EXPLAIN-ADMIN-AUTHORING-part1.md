# อธิบายฟีเจอร์ "อัปโหลด PDF → ร่างแผนผังขั้นตอน → ตรวจ → เผยแพร่" (ส่วนที่ 1: ภาพรวม)

> ⚠️ **เขียนตอน backend ยังเป็น NestJS** (ก่อน 21 ต.ค. 2569) — แนวคิดและลำดับการทำงานยังใช้ได้ แต่ชื่อ `*.controller.ts`, `*.module.ts`, guard (`JwtAuthGuard`/`RolesGuard`), filter, decorator และเลขบรรทัด **ไม่ตรงโค้ดแล้ว** · ตอนนี้: controller → `*.routes.ts` · guard → middleware `requireAuth`/`optionalAuth`/`requireAdmin` (`auth/auth.middleware.ts`) · filter → `errorHandler` (`common/error-handler.ts`) · module/DI → `app.ts` · ตารางเทียบเต็มและเลขบรรทัดปัจจุบันอยู่ใน `docs/STUDY_GUIDE.md` §5.7

> เขียนให้: นักศึกษาปี 4 ที่ต้องอธิบายฟีเจอร์นี้ให้กรรมการและตอบเมื่อถูกให้เปิดโค้ด
> ทุกข้อความอ้างจากโค้ดจริง ใช้รูปแบบ `ไฟล์:ฟังก์ชัน` หรือ `ไฟล์:บรรทัด` (path ย่อจาก `backend/src/` และ `frontend/src/`)
> ที่ไม่ได้ตรวจเอง ผมเขียนว่า "ไม่แน่ใจ" พร้อมบอกว่าให้ไปดูที่ไหน

---

## 1.1 ศัพท์ที่ต้องรู้ก่อน (โค้ด ↔ คำไทยที่ควรใช้พูด)

ในโค้ดใช้คำว่า graph/node แต่ **ตอนพูดกับกรรมการและเขียนบนหน้าจอ ให้ใช้คำไทยในตารางนี้**

| ในโค้ด | พูดว่า | ความหมายสั้นๆ |
|---|---|---|
| `graph` | **แผนผังขั้นตอน** | ชุดคำถาม/คำสั่งของอาการ 1 อาการ เช่น "ไฟแอร์กะพริบ" |
| `node` | **ขั้นตอน** (หรือ "จุดในแผนผัง") | 1 คำถาม / 1 คำสั่ง / 1 ข้อสรุป |
| `edge` (ลูกศร) | **เส้นทางไปขั้นถัดไป** | ฟิลด์ `on_yes` / `on_no` / `next` ที่ชี้ไปขั้นถัดไป |
| `manual` | **คู่มือ** (1 เล่ม = 1 รุ่น) | แถวในตาราง `manuals` · 1 คู่มือมีหลายแผนผังขั้นตอน |
| `draft` | **ร่าง** | ผลที่ AI ร่างไว้ ยังไม่ให้ผู้ใช้เห็น เก็บในตาราง `graph_drafts` |
| `publish` | **เผยแพร่** | เอาร่างที่ผ่านการตรวจเข้าตารางจริง ผู้ใช้จึงเริ่มตรวจตามแผนผังนี้ได้ |
| `validator` | **ตัวตรวจแผนผัง** (ตรวจด้วยโค้ด ไม่ใช่ AI) | `authoring/graph-validator.ts` |
| `terminal node` | **ขั้นตอนสุดท้าย / ข้อสรุป** | node ชนิด `resolution` (แก้ได้/ปกติ) หรือ `escalation` (ส่งต่อช่าง) |
| `safety_critical` | **ขั้นตอนที่ต้องยืนยันคำเตือน** | ติดธงนี้ → ผู้ใช้ต้องกดยืนยันคำเตือนก่อนไปต่อ |

---

## 1.2 ฟีเจอร์นี้แก้ปัญหาอะไร

**ปัญหา:** ระบบตรวจอาการใช้ "แผนผังขั้นตอน" ที่คนต้องแปลงจากคู่มือ PDF เป็น JSON ด้วยมือ ช้าและผิดง่าย (ผังเดิม 22 คู่มือทำแบบนี้)

**ทางออก:** ให้ admin อัปโหลด PDF คู่มือเล่มใหม่ → ให้ AI (Groq) **ร่าง** แผนผังขั้นตอนจากข้อความของหน้าที่เลือก → โค้ดตรวจกฎความถูกต้อง → admin อ่านเทียบกับหน้าต้นฉบับแล้วกดอนุมัติ → ผู้ใช้จึงเห็น

**ใครใช้:** เฉพาะ admin ทุก endpoint อยู่ใต้ `/admin/drafts` และ controller ติด `JwtAuthGuard` + `RolesGuard` + `@Roles(Role.Admin)` ที่ระดับ class (`authoring/drafts.controller.ts:49-52`) · ผู้ใช้ทั่วไปและ guest ไม่มีทางเรียก

---

## 1.3 หลักการข้อเดียวที่ต้องจำ

```
   AI  ───────▶  โค้ดตรวจ  ───────▶  คนอนุมัติ  ───────▶  ผู้ใช้ใช้งาน
 "ร่าง"          "ตัดสินว่าผ่านไหม"     "กดเผยแพร่"          (engine เดิมเดินให้)
 เสนอได้อย่างเดียว   AI ขอข้ามไม่ได้        ข้ามด่านโค้ดไม่ได้
```

1. **AI ไม่มีอำนาจตอนที่ผู้ใช้ใช้งานจริง** — ตอนผู้ใช้ตรวจอาการ "ขั้นถัดไปคืออะไร" ตัดสินโดย `traversal-engine` ซึ่งเป็นโค้ดล้วน ไม่เรียก AI (`traversal/traversal.service.ts:1-13`) ฟีเจอร์นี้ไม่ได้เปลี่ยนข้อนี้เลย
2. **AI ร่างได้อย่างเดียว** — ผลที่ AI ตอบเป็นแค่ข้อความ ต้องผ่านตัวแปลงแบบเข้ม (`authoring/draft-schema.ts:parseLlmOutput`) แล้วผ่านตัวตรวจแผนผัง (`authoring/graph-validator.ts:validateManual`) ก่อนจะไปถึงตาคน
3. **โค้ดตัดสินว่าผ่านไหม** — ถ้าตัวตรวจพบ "error" แม้แต่ข้อเดียว เผยแพร่ไม่ได้ **ไม่มีปุ่มข้าม** (`authoring/drafts.service.ts:publish` โยน `DraftInvalidError`)
4. **คนเป็นคนกดเผยแพร่** — และตอนกด เซิร์ฟเวอร์ตรวจซ้ำอีกรอบเอง ไม่เชื่อรายงานที่เก็บไว้หรือที่หน้าจอส่งมา
5. **ข้อมูลที่ไม่ใช่เนื้อหา เซิร์ฟเวอร์ใส่เอง** — รหัสคู่มือ ยี่ห้อ รุ่น ประเภทเครื่อง ชื่อแหล่งที่มา ช่วงหน้า และ `graph_id` มาจากสิ่งที่ admin กรอกกับกติกาของโค้ด ไม่ใช่จาก AI (`authoring/draft-manual.ts:assembleManual`)

---

## 1.4 ทำไมเก็บร่างในตารางแยก (`graph_drafts`)

โปรเจกต์เก่า (`troubleshoot-assistantv2`) ใช้ **ฐานข้อมูลเดียวกัน** และอ่านตาราง `graphs` ตรงๆ (คอมเมนต์ใน `backend/migrations/012_create_graph_drafts.sql:3-6`)

ถ้าเก็บร่างไว้ในตาราง `graphs` พร้อมคอลัมน์ `status` — โปรเจกต์เก่าไม่รู้จักคอลัมน์นี้ จะมองเห็นร่างที่ยังไม่ตรวจเป็นผังจริง

จึงแยก:

```
 ตารางที่ผู้ใช้/โปรเจกต์เก่าอ่าน          ตารางที่เฉพาะ admin เห็น
 ┌──────────┬────────┬───────┐            ┌─────────────────────────┐
 │ manuals  │ graphs │ nodes │            │ graph_drafts            │
 └──────────┴────────┴───────┘            │ (status, pages, graphs, │
        ▲                                 │  validation เป็น JSON)  │
        │  INSERT เฉพาะตอน "เผยแพร่"       └─────────────────────────┘
        └────────────────────────────────────────┘
```

หลักฐานว่าฝั่งผู้ใช้ไม่มีทางเห็นร่าง: `traversal/graph.repository.ts:123-142` (ฟังก์ชัน `loadAll`) อ่านจาก `graphs`, `manuals`, `nodes` เท่านั้น ไม่มี query ไปที่ `graph_drafts` · ตารางนี้ถูกแตะโดย `authoring/drafts.store.ts` ไฟล์เดียว

**ข้อจำกัดที่ต้องพูดตรงๆ:** พอเผยแพร่แล้ว แถวใน `manuals/graphs/nodes` อยู่ในฐานข้อมูลที่ใช้ร่วมกัน โปรเจกต์เก่าอาจเห็นผังใหม่ด้วย (ผมไม่ได้อ่านโค้ดโปรเจกต์เก่า จึง **ไม่แน่ใจ** ว่าจะแสดงหรือไม่) · ใช้รหัสคู่มือขึ้นต้น `demo_` สำหรับทดลอง เพื่อลบทีหลังได้ง่าย

---

## 1.5 ภาพรวมตั้งแต่ต้นจนจบ

```
 ┌───────────────┐
 │ เบราว์เซอร์    │  admin เลือก PDF + กรอก รหัสคู่มือ/ยี่ห้อ/รุ่น/ประเภท/หน้าที่ใช้ (ไม่เกิน 10 หน้า)
 │ (React)       │  frontend/src/components/admin/drafts/UploadDraftForm.tsx
 └──────┬────────┘
        │ ① POST /admin/drafts  (multipart + Bearer token)         api/drafts.ts:uploadDraft
        ▼
 ┌───────────────────────────────────────────────────────────────────────────┐
 │ Backend (NestJS)                                                          │
 │  ② ด่าน: JwtAuthGuard → RolesGuard(admin) → multer รับไฟล์เข้าหน่วยความจำ │
 │     authoring/drafts.controller.ts                                        │
 │  ③ ตรวจ: เป็น PDF จริงไหม (ไบต์ %PDF-) · ว่างอยู่ไหม · คู่มือซ้ำไหม       │
 │     authoring/drafts.service.ts:createFromUpload                          │
 │  ④ แยกข้อความ PDF ตามหน้าที่เลือก (ไม่เก็บไฟล์ PDF)                        │
 │     authoring/pdf-text.ts:UnpdfTextExtractor.extract                      │
 │  ⑤ INSERT graph_drafts (status = drafting)  แล้วตอบ 202 ทันที             │
 │        authoring/drafts.store.ts:insert                                   │
 │  ───────────── งานเบื้องหลัง (ทีละ 1 งาน) ─────────────                    │
 │  ⑥ ส่งข้อความทีละ 2 หน้าให้ Groq ร่างเป็น JSON                            │
 │     authoring/draft-llm.client.ts → drafts.service.ts:runDrafting         │
 │  ⑦ parse เข้ม: รูปร่างไม่ตรงเป๊ะ = ล้ม ไม่แก้ให้ไม่เดาให้                   │
 │     authoring/draft-schema.ts:parseLlmOutput                              │
 │  ⑧ เซิร์ฟเวอร์ตั้ง graph_id/source/page_range เอง แล้วประกอบเป็นคู่มือ     │
 │     draft-schema.ts:assignGraphIds · draft-manual.ts:assembleManual       │
 │  ⑨ ตัวตรวจแผนผัง (โค้ดล้วน) → รายงาน error/warning                         │
 │     authoring/graph-validator.ts:validateManual                           │
 │  ⑩ UPDATE graph_drafts (status = ready, graphs, validation)               │
 └──────┬────────────────────────────────────────────────────────────────────┘
        │ ⑪ หน้าจอถามสถานะทุก 3 วินาที (เฉพาะตอน drafting)  GET /admin/drafts[/:id]
        ▼
 ┌───────────────┐
 │ หน้าตรวจร่าง   │  อ่านผลตรวจ + เทียบทุกขั้นตอนกับข้อความหน้าต้นฉบับ
 │ AdminDraft    │  แก้ JSON ได้ (PUT → ตรวจใหม่) · ติ๊กยืนยัน · กดเผยแพร่
 │ ReviewPage    │
 └──────┬────────┘
        │ ⑫ POST /admin/drafts/:id/publish {acknowledgedWarnings}
        ▼
 ┌───────────────────────────────────────────────────────────────────────────┐
 │  ⑬ BEGIN → SELECT … FOR UPDATE (ล็อกแถวร่าง) → ตรวจซ้ำด้วย validator       │
 │     error ≥ 1 → 409 DRAFT_INVALID · มี warning ไม่ได้ ack → 409             │
 │     id ชนของเดิม → 409 (ไม่เขียนทับ)                                       │
 │     INSERT manuals → graphs → nodes · UPDATE draft = published · COMMIT    │
 │        authoring/drafts.store.ts:publish                                  │
 │  ⑭ GraphRepository.reload()   โหลดผังจากฐานข้อมูลเข้า RAM (สลับ Map ใหม่)   │
 │  ⑮ SymptomSearchService.addGraphs()  เพิ่มเข้าดัชนีค้นหา (ถ้าเปิดค้นหาอยู่)  │
 └──────┬────────────────────────────────────────────────────────────────────┘
        ▼
 ┌───────────────┐
 │ ผู้ใช้ทั่วไป    │  เห็นคู่มือใหม่ในหน้าเลือกเครื่อง → เริ่มตรวจ
 │               │  → traversal-engine เดินตามแผนผังเหมือนผังเดิมทุกประการ
 └───────────────┘
```

จุดสำคัญของแผนภาพ:
- ขั้น ⑥–⑨ คือที่ **AI เข้ามาเกี่ยว** และมีด่านโค้ด 2 ชั้น (⑦ ⑨) กั้นก่อนถึงคน
- ขั้น ⑬ คือด่านจริงที่ **ตรวจซ้ำ** ถึงแม้ ⑨ เคยตรวจแล้ว เพราะระหว่างนั้นร่างอาจถูกแก้ (⑪–⑫ มีการแก้ JSON ได้)
- หลัง ⑭ ผู้ใช้เดินแผนผังนี้ด้วย engine ตัวเดิม ไม่มีโค้ดพิเศษสำหรับผังที่ AI ร่าง

---

## 1.6 แผนที่ไฟล์ (หนึ่งบรรทัดต่อไฟล์)

### Backend — `backend/src/authoring/` (โมดูลใหม่ทั้งโฟลเดอร์)

| ชั้น | ไฟล์ | ทำอะไร |
|---|---|---|
| ประกอบโมดูล | `authoring.module.ts` | ผูก controller/service/store กับตัวแยก PDF และ LLM client (ตัว LLM เป็น `null` ถ้าไม่ได้ตั้ง `GROQ_API_KEY` + `AUTHORING_LLM_MODEL`) |
| ทางเข้า HTTP | `drafts.controller.ts` | 7 endpoint ใต้ `/admin/drafts` + ด่านสิทธิ์ admin + เพดานขนาดไฟล์ |
| | `drafts.dto.ts` | ตรวจฟิลด์ที่ admin กรอกตอนอัปโหลด/แก้/เผยแพร่ และกำหนดรูปร่าง response |
| | `drafts.errors.ts` | ฟังก์ชันสร้าง `ApiError` ของโมดูลนี้ (`draftBusy`, `draftInvalid` ฯลฯ) · การแปลงเป็น `{statusCode, code, message}` ทำที่ `common/all-exceptions.filter.ts` (filter กลางตัวเดียวของแอป) |
| ตรรกะหลัก | `drafts.service.ts` | วงจรชีวิตของร่าง: อัปโหลด → ร่าง → แก้ → ปฏิเสธ → เผยแพร่ + งานเบื้องหลัง |
| ฐานข้อมูล | `drafts.store.ts` | SQL ทั้งหมดของ `graph_drafts` และ transaction ตอนเผยแพร่ |
| PDF | `pdf-text.ts` | แยกข้อความตามหน้าด้วย `unpdf` (ในหน่วยความจำ) + เพดานต่างๆ |
| AI | `draft-llm.client.ts` | prompt + เรียก Groq (JSON mode, timeout) |
| แปลงผลจาก AI | `draft-schema.ts` | parse ผล AI แบบเข้ม + ตั้ง `graph_id` |
| ประกอบข้อมูล | `draft-manual.ts` | ประกอบ "คู่มือ" จากร่าง + แปลงเป็นแถวสำหรับ INSERT |
| ตัวตรวจ | `graph-validator.ts` | กฎความถูกต้องของแผนผัง (error/warning) — หัวใจด้านความปลอดภัย |

### Backend — ไฟล์เดิมที่ถูกแก้เพื่อรองรับฟีเจอร์นี้

| ไฟล์ | ส่วนที่เพิ่ม |
|---|---|
| `traversal/graph.repository.ts` | `reload()` (บรรทัด ~182) · `loadAll` สร้าง Map ใหม่ก่อนสลับ (`:151-172`) |
| `symptom-search/symptom-search.service.ts` | `addGraphs()` (บรรทัด ~138) |
| `app.module.ts` | เพิ่ม `AuthoringModule` |
| `migrations/012_create_graph_drafts.sql` | ตาราง `graph_drafts` |
| `scripts/backup-graph-tables.js` | สำรอง `manuals/graphs/nodes` เป็นไฟล์ .sql (อ่านอย่างเดียว) ก่อน publish ครั้งแรก |

### Frontend

| ชั้น | ไฟล์ | ทำอะไร |
|---|---|---|
| เส้นทาง | `App.tsx` | route `/admin/drafts` และ `/admin/drafts/:id` ครอบด้วย `AdminRoute` |
| ครอบสิทธิ์ (UX) | `components/auth/AdminRoute.tsx` | ไม่ใช่ admin → ไม่แสดงหน้า (แค่ความสะดวก ด่านจริงอยู่ backend) |
| เรียก API | `api/drafts.ts` | ฟังก์ชันเรียก endpoint ทั้ง 7 ตัว |
| | `api/queries.ts` (ส่วน `useAdminDrafts` … `usePublishDraft`) | hook ของ TanStack Query, query key มี identity, ถามสถานะทุก 3 วินาที |
| | `api/http.ts` | ส่ง multipart (FormData) ได้ + แนบ token |
| หน้า | `pages/AdminDraftsPage.tsx` | ฟอร์มอัปโหลด + รายการร่าง |
| | `pages/AdminDraftReviewPage.tsx` | หน้าตรวจร่าง ประกอบจากคอมโพเนนต์ย่อย |
| คอมโพเนนต์ | `components/admin/drafts/UploadDraftForm.tsx` | ฟอร์มอัปโหลด |
| | `…/ValidationReportPanel.tsx` | แสดง error/warning/คำเสี่ยง |
| | `…/DraftGraphCard.tsx` | แต่ละแผนผังขั้นตอน: เส้นทางแบบข้อความ + ทุกขั้นตอนเทียบข้อความหน้าต้นฉบับ |
| | `…/DraftJsonEditor.tsx` | แก้ JSON แล้วส่ง PUT ให้ตรวจใหม่ |
| | `…/DraftActions.tsx` | ติ๊ก "ตรวจแล้ว"/"รับทราบคำเตือน" + ปุ่มเผยแพร่/ปฏิเสธ/ลองใหม่ |
| | `…/DraftStatusBadge.tsx` | ป้ายสถานะ |
| ตัวช่วย | `lib/draftView.ts` | ป้ายภาษาไทย, เส้นทางแบบข้อความ, `publishGate`, ตรวจฟอร์มอัปโหลด |
| | `lib/errors.ts` | แปลง error code ของฟีเจอร์นี้เป็นข้อความไทย |

### ลำดับที่แนะนำให้อ่าน

| ลำดับ | ไฟล์ | อ่านเพื่ออะไร | เวลา |
|---|---|---|---|
| 1 | `docs/authoring/authoring-step5.md` (หัวข้อภาพรวม) | ภาพรวมที่เขียนไว้ตอนทำ | 10 นาที |
| 2 | `migrations/012_create_graph_drafts.sql` | ร่างหน้าตาเป็นอย่างไรในฐานข้อมูล (มีคอมเมนต์อธิบายทุกคอลัมน์) | 10 นาที |
| 3 | `authoring/drafts.controller.ts` | มี endpoint อะไรบ้าง ใครเรียกได้ | 10 นาที |
| 4 | `authoring/drafts.service.ts` | **หัวใจ**: ดูหลักการ 4 ข้อในคอมเมนต์หัวไฟล์ (`:1-12`) แล้วไล่ `createFromUpload` → `runDrafting` → `publish` | 40 นาที |
| 5 | `authoring/draft-llm.client.ts` | prompt ที่ส่งให้ AI (`:55-84`) | 15 นาที |
| 6 | `authoring/draft-schema.ts` + `draft-manual.ts` | ผล AI กลายเป็นผังที่ระบบเข้าใจได้อย่างไร | 25 นาที |
| 7 | `authoring/graph-validator.ts` | กฎตรวจ (อ่านเฉพาะรายการรหัส error/warning ก่อน แล้วค่อยลงรายละเอียดทีละกฎ) | 45 นาที |
| 8 | `authoring/drafts.store.ts` (`publish` `:246-282`) | transaction ตอนเผยแพร่ | 20 นาที |
| 9 | `traversal/graph.repository.ts` (`loadAll`, `reload`) และ `symptom-search.service.ts` (`addGraphs`) | ผังใหม่เข้าระบบที่ใช้งานอยู่อย่างไร | 20 นาที |
| 10 | `pdf-text.ts`, `common/all-exceptions.filter.ts` | รายละเอียดเสริม | 20 นาที |
| 11 | ฝั่ง frontend: `api/drafts.ts` → `api/queries.ts` (ส่วนร่าง) → `AdminDraftsPage` → `AdminDraftReviewPage` → `components/admin/drafts/*` → `lib/draftView.ts` | หน้าจอ | 60 นาที |

พื้นฐานที่ควรผ่านมาก่อน (ถ้ายังไม่เคยอ่าน): `traversal-engine/types.ts` (ชนิด node และ outcome) และ `auth/jwt-auth.guard.ts` + `auth/roles.guard.ts` (ด่านสิทธิ์)

---

## 1.7 สิ่งที่ "ตรวจแล้วจริง" กับ "ยังไม่เคยพิสูจน์" (ภาพรวม)

ส่วนนี้สำคัญมาก ถ้ากรรมการถามว่า "ทดสอบแล้วหรือยัง" ต้องตอบตรงตามนี้

| ส่วน | สถานะ |
|---|---|
| โค้ดคอมไพล์ผ่าน (`tsc`, `nest build`, `eslint`, `vite build`) | ✅ รันแล้ว ผ่าน (รอบเก็บกวาดล่าสุด) |
| ตัวตรวจแผนผัง, ตัว parse ผลจาก AI, กฎเผยแพร่ | 🟡 **เคยมี unit test** ที่ใช้ของปลอม (ฐานข้อมูลปลอมในหน่วยความจำ, AI ปลอม) ตอนเขียน แต่ **ไฟล์เทสต์ถูกลบแล้ว** (ตามที่คุณสั่ง) และไม่เคย commit จึงกู้ไม่ได้ · ตอนนี้ไม่มีเทสต์อัตโนมัติของฟีเจอร์นี้เหลือเลย |
| แยกข้อความ PDF (`unpdf`) | 🟡 เคยรันกับ PDF ที่สร้างเองสำหรับทดสอบ ใน Node แยกโปรเซส (เพราะ jest ใช้ `unpdf` ไม่ได้) · **ยังไม่เคยลองกับ PDF คู่มือจริง** (เช่น ตัวหนังสือภาษาไทย ตาราง คอลัมน์ซ้อน) |
| เรียก Groq จริง | ❌ **ไม่เคย** ไม่รู้ว่าโมเดลที่เลือกตอบ JSON ตรงรูปแบบแค่ไหน ไม่รู้คุณภาพของร่าง ไม่รู้ว่าโดน rate limit บ่อยแค่ไหน |
| SQL ของ `graph_drafts` บน MySQL จริง (คอลัมน์ JSON, `FOR UPDATE`, transaction, INSERT หลายแถว) | ❌ **ยังไม่เคยรันบนฐานข้อมูลจริง** (ชื่อคอลัมน์ของ INSERT เคยตรวจเทียบ schema จริงด้วย `SHOW COLUMNS` แบบอ่านอย่างเดียว) · **ไม่แน่ใจ**ว่า migration 012 รันบน Aiven แล้วหรือยัง (ดู `SELECT filename FROM schema_migrations`) |
| การเผยแพร่จริงแล้วผู้ใช้เดินผังนั้นได้ | ❌ ยังไม่เคยลองครบวงจร |
| หน้าจอทั้งหมดของฟีเจอร์นี้ในเบราว์เซอร์จริง | ❌ ไม่เคยเปิดดูด้วยตา (มีแค่ผ่านตัวตรวจโค้ด) |

> ก่อนอธิบายหรือสาธิต ควรทดสอบครบวงจรหนึ่งครั้งตาม `docs/authoring/authoring-step5.md` หัวข้อ 6 (สำรองฐานข้อมูลก่อน, ใช้รหัสคู่มือ `demo_…`, เตรียม SQL ล้างหลังทดสอบ)

---

## ส่วนที่ 1 จบ — รอคุณพิมพ์ "ok" หรือถามต่อ

ส่วนถัดไป (ส่วนที่ 2) คือไล่ `POST /admin/drafts` ตั้งแต่ controller ลงไป: ด่านสิทธิ์ เพดานไฟล์ แยก PDF งานเบื้องหลัง และ prompt ที่ส่งให้ AI
