# ออกแบบ: ผู้ดูแลจัดการแผนผังขั้นตอน (ดู / แก้ / ลบ flow)

| | |
|---|---|
| **สถานะ** | เอกสารวิเคราะห์และออกแบบ · ยังไม่ได้แก้โค้ด migration หรือ test |
| **ตรวจจาก** | branch `main` commit `725080b` (1 พ.ย. 2569) · backend เป็น Express + `mysql2` |
| **ความคืบหน้า** | อนุมัติแบบแล้ว · ยังไม่เริ่มแก้โค้ด · ทำตาม Part 4 ทีละ sub-step |

## คำตอบที่ตัดสินแล้ว

**ข้อมูลเพิ่มจากเจ้าของโปรเจกต์:** ระบบมี admin หลายคน และ admin ไม่ใช่โปรแกรมเมอร์

| ข้อ | เรื่อง | คำตอบ |
|---|---|---|
| A | การลบ | A2 soft delete ด้วย `deleted_at` |
| B | แก้ผังที่ถูกใช้แล้ว | B2 แก้ในแถวเดิมพร้อมด่านกันผลกระทบ · ลบผังแล้ว session เดิมเดินต่อจนจบ |
| C | หน้าแก้ | **ฟอร์มเป็นหน้าแก้หลัก (ต้องทำ)** · JSON editor เป็นทางเลือกเสริม |
| D | หน้าดู | D1 ก่อน · **เพิ่ม Mermaid เป็น step สุดท้ายของแผน** |
| E | Unpublish | E1 ไม่แยกจาก delete มีปุ่มกู้คืน |
| F | Embeddings | F1 เรียก `addFlows([id])` ทุกครั้ง และเพิ่ม `removeFlows` |
| G | แก้ชนกัน | G3 `revision` + `FOR UPDATE` |
| H | validator กับผังเดิม | H1 โหมด `pages = null` |
| I | บันทึกการจัดการ | I2 ไม่มีหน้าจอ · **บันทึกว่า admin คนไหนแก้หรือลบเมื่อไร** |
| J | ฟิลด์ที่แก้ได้ | ตามตารางใน Part 2 |
| K | ที่มาของเนื้อหา | K2 แสดงและแก้ `author_note` ได้ พร้อมข้อความเตือน |
| L | seed ทับงานแก้ | L2 ปฏิเสธถ้าไม่ใส่ `--force` |
| M | บันทึกมีผลทันที | M1 **ไม่มีติ๊กยืนยัน** มีแค่ปุ่มตรวจโดยไม่บันทึก |
| N | ลบระดับคู่มือ | N1 ลบทีละผัง |
| O | Test | **O2 ใช้ checklist ทดสอบด้วยมือ ไม่เพิ่ม test** |
| P | การเพิ่ม admin | ทำผ่าน `scripts/seed-admin.js` เท่านั้น ไม่มีหน้าจัดการ admin · **บังคับระบุชื่อที่แสดง:** ถ้า `ADMIN_DISPLAY_NAME` ไม่มีหรือว่าง สคริปต์ต้องจบพร้อมข้อความชัดเจน และไม่สร้างอะไร · **ห้ามชื่อซ้ำกับ admin คนอื่น** · อีเมลที่มีอยู่แล้วสคริปต์ไม่เปลี่ยนชื่อให้ · เพื่อให้ `edited_by`, `deleted_by`, `flow_revisions` ชี้ไปยัง admin ที่มีชื่อของตัวเอง |

**การตีความข้อ M ที่ใช้ในแบบนี้:** ไม่มีช่องติ๊กเลย และการบันทึกปกติใช้คลิกเดียว คงไว้เฉพาะปุ่ม "บันทึกต่อ" ใน 3 กรณีที่ B2 กำหนด: ลบขั้นตอนที่มีผู้ใช้อยู่, เอาด่านความปลอดภัยออก, เปลี่ยน `outcome_kind` ถ้าต้องการตัดออกด้วย ให้ลบเงื่อนไข `FLOW_CONFIRM_REQUIRED` ใน 3.2 แต่ session จะหมดอายุและด่านความปลอดภัยจะหายโดยไม่มีการถามก่อน

## สรุปสั้น

ฟีเจอร์นี้ทำได้โดยไม่เปลี่ยนสถาปัตยกรรม และ `FlowRepository.reload()`, `addFlows()` ที่มีอยู่ใช้ต่อได้ แต่มี 4 ข้อเท็จจริงในโค้ดที่ทำให้แผนแบบตรงไปตรงมาพัง

1. **`flows` ไม่มี status เลย** มีแถวใน `flows` เท่ากับเผยแพร่แล้ว คำว่า draft/published อยู่ใน `flow_drafts` เท่านั้น
2. **ลบ flow ที่เคยถูกใช้แบบ hard delete ไม่ได้** เพราะ `sessions.flow_id` เป็น `ON DELETE RESTRICT` และไม่มีงานล้าง session เก่า
3. **validator ปัจจุบันใช้กับผังที่มีอยู่ไม่ได้** ผลวัดคือผ่าน 0 จาก 754 ผัง เพราะบังคับ `source_page` ซึ่งไม่มีทั้งในตาราง `states` และไฟล์ข้อมูล
4. **ถ้าใช้ `toDbRows()` เดิมตอนบันทึก จะล้าง `author_note` ทิ้ง** (ผังที่ seed ได้มี `author_note` อยู่ 2,340 สถานะ) ข้อมูลที่มาของเนื้อหาจะหายเงียบ ๆ

แบบที่เลือก: soft delete ด้วย `deleted_at` · แก้ในแถวเดิมพร้อมด่านกันผลกระทบ · กันการแก้ชนกันและบันทึกผู้ทำรายการสำหรับ admin หลายคน · ใช้ validator เดิมเพิ่มโหมดผังที่เผยแพร่แล้ว · ฟอร์มสำหรับ admin ที่ไม่ใช่โปรแกรมเมอร์ · Mermaid เป็น step สุดท้าย

### วิธีได้ตัวเลขในเอกสาร

- รัน validator ที่ build แล้ว (`backend/dist/authoring/flow-validator.js` ตรงกับ `src` ปัจจุบัน) กับ `data/manuals/*.json` ในหน่วยความจำ โดยแปลงรูปให้เหมือนที่ `FlowRepository` คืนจาก DB
- `data/manuals` มี 27 ไฟล์ 754 ผัง 6,543 สถานะ · ในนี้ 2 ไฟล์ (32 ผัง) เป็น `Range` ซึ่ง ENUM ของ `manuals.device_category` ไม่รับ จึงเหลือ **722 ผังที่ seed ได้** ตรงกับ `eval/results/real-cases-20261101-140011.json` (`fixbot_eval`: 25 คู่มือ · 722 ผัง)

### สิ่งที่ยังไม่ได้ตรวจ

- **ไม่ได้ต่อฐานข้อมูลจริง** จำนวนแถวจริงต้องตรวจตาม step 1.1 · พฤติกรรมของ SQL ในเอกสารนี้ยังไม่ได้รันจริง
- **ไม่ได้วัดเวลา `reload()`** และไม่ได้วัด bundle size ของ dependency ที่เป็นตัวเลือก
- ค่าแรงเป็นการประมาณคร่าว ๆ: **S** ≤ ครึ่งวัน · **M** ≈ 1 วัน · **L** ≈ 2–3 วัน

---

## Part 1 — วิเคราะห์ระบบปัจจุบัน

### 1.1 flow เก็บอย่างไร

นิยามอยู่ที่ `backend/migrations/002_flows.sql` เป็น automaton `M = (Q, Σ, δ, q0, F)` แบบแยกแถว ไม่ใช่ JSON ก้อนเดียว

| ตาราง | เก็บอะไร | คอลัมน์สำคัญ |
|---|---|---|
| `manuals` | คู่มือ 1 เล่ม | `manual_id`, `device_category`, `brand`, `model_pattern`, `source_manual`, `flow_count`, `display_name`, `model_aliases` (JSON) |
| `flows` | 1 อาการ = 1 ผัง | `flow_id`, `manual_id`, `entry_symptom`, `entry_symptom_th`, `entry_symptom_aliases` (JSON), `source`, `page_start`, `page_end`, `source_chunk_id`, `severity`, `difficulty`, `config` (JSON), **`initial_state`**, `created_at`, `updated_at` |
| `states` (Q) | สถานะ 1 แถว | PK `(flow_id, state_id)`, `state_type`, `text_content`, `input_type`, `input_pattern`, `store_as`, `outcome_kind`, `safety_critical`, `safety_warning`, `has_image`, `image_url`, `author_note`, `external_reference`, `display_order` |
| `state_transitions` (δ) | เส้นเชื่อม 1 แถว | PK `(flow_id, from_state_id, input_symbol)`, `input_symbol` ∈ `yes/no/next/invalid`, `to_state_id` |
| `flow_drafts` (`006_flow_drafts.sql`) | ร่างจาก LLM | `status`, `manual_id`, `meta`, `pages`, `flows`, `validation` (JSON ทั้งหมด) |

ข้อสังเกตที่กระทบการออกแบบ

- **status:** `flow_drafts.status` มีค่า `drafting / ready / failed / rejected / published` ส่วน `flows` ไม่มีคอลัมน์ status หรือ `deleted_at` · ผู้ใช้เห็นทุกแถวใน `flows` ทันที
- **เลขหน้าอยู่ระดับ flow:** `page_start`, `page_end` · `source_page` รายสถานะมีเฉพาะในร่าง และ `toDbRows` ไม่บันทึกลง `states` (`backend/src/authoring/draft-manual.ts:109-127`)
- **ข้อมูลเครื่องอยู่ระดับคู่มือ:** device, brand, model อยู่ที่ `manuals` ไม่ใช่ `flows`
- **`flow_count` ซ้ำซ้อน:** API นับใหม่จากหน่วยความจำ (`flow.repository.ts:99-118`) ค่าใน DB จึงไม่มีใครอ่าน
- **ไม่มี FK ที่ `flows.initial_state`** ตรวจที่ validator และตอนโหลดเท่านั้น

### 1.2 เส้นทางสร้าง → ตรวจ → เผยแพร่

```text
อัปโหลด
 frontend/src/components/admin/drafts/UploadDraftForm.tsx → useUploadDraft → POST /admin/drafts
 → drafts.routes.ts: uploadPdf + parseUploadFields → DraftsService.createFromUpload (drafts.service.ts:50)
 → extract ข้อความ PDF → DraftsStore.insert (status = drafting)
 → runDrafting เบื้องหลัง: LLM → parseLlmOutput → assignFlowIds → validateManual → markReady

ตรวจและแก้
 AdminDraftReviewPage → useAdminDraft (poll ทุก 3 วินาที) → GET /admin/drafts/:id
 DraftJsonEditor → useUpdateDraft → PUT /admin/drafts/:id
 → DraftsService.update → parseDraftFlows → validate → DraftsStore.saveEdit

เผยแพร่
 DraftActions (publishGate) → usePublishDraft → POST /admin/drafts/:id/publish
 → DraftsService.publish (drafts.service.ts:183)
 → DraftsStore.publish (drafts.store.ts:199): transaction + SELECT ... FOR UPDATE
     → parseDraftFlows + assembleManual + validateManual (ตรวจซ้ำใน transaction)
     → assertNoConflicts → INSERT manuals, flows, states, state_transitions → UPDATE flow_drafts → COMMIT
 → FlowRepository.reload() → SymptomSearchService.addFlows(flowIds)
 → frontend invalidate ['flows'], ['manuals'], ['admin', identity, 'drafts']
```

**จุดตรวจมี 5 ชั้น**

| ชั้น | ที่ไหน | ตรวจอะไร |
|---|---|---|
| ฟอร์ม | `frontend/src/lib/draftView.ts:169`, `publishGate` :138 | UX เท่านั้น |
| รูปร่าง | `draft-schema.ts`: `parseLlmOutput`, `parseDraftFlows` | ชนิด ฟิลด์เกิน ความยาว |
| กฎธุรกิจ | `flow-validator.ts`: `validateManual` | โครงสร้าง ลูกศร ความปลอดภัย เลขหน้า ตัวแปร |
| ตอนโหลด | `flow.repository.ts:192-287` | ฟิลด์บังคับ, `initial_state` มีจริง · **ข้อมูลเสียทำให้บูตไม่ขึ้น** |
| DB | PK, FK, ENUM | ปราการสุดท้าย |

ข้อจำกัดเดิม: **publish รับเฉพาะคู่มือใหม่** ถ้า `manual_id` หรือ `flow_id` ซ้ำจะถูกปฏิเสธ (`drafts.service.ts:58, 234-241`, `drafts.store.ts:240`) จึงไม่มีทางแก้ผังเดิมผ่านทางนี้

### 1.3 ทุกอย่างที่อ้างถึง flow

**Foreign key ทั้งหมดที่เกี่ยวข้อง**

| ตารางลูก → แม่ | ON DELETE | ON UPDATE | ผลต่อการลบ flow |
|---|---|---|---|
| `flows.manual_id` → `manuals` | CASCADE | CASCADE | ลบคู่มือแล้วพยายามลบผังตาม |
| `states.flow_id` → `flows` | CASCADE | CASCADE | ลบผังแล้วสถานะหาย |
| `state_transitions (flow_id, from_state_id)` → `states` | CASCADE | CASCADE | ลบสถานะแล้วเส้นออกหาย |
| `state_transitions (flow_id, to_state_id)` → `states` | CASCADE | CASCADE | ลบสถานะแล้วเส้นเข้าหาย **โดยไม่เตือน** |
| **`sessions.flow_id` → `flows`** | **RESTRICT** | CASCADE | **เคยมี session แล้ว hard delete ไม่ได้** |
| `sessions.user_id` → `users` | SET NULL | CASCADE | ไม่เกี่ยว |
| `session_history.session_id` → `sessions` | CASCADE | CASCADE | ลบ session แล้วขั้นตอนหาย |
| `session_feedback.session_id` → `sessions` | CASCADE | CASCADE | ลบ session แล้ว feedback หาย |
| `flow_drafts.created_by`, `reviewed_by` → `users` | SET NULL | CASCADE | ไม่เกี่ยว |

**อ้างถึงกันโดยไม่มี FK** ฐานข้อมูลจึงไม่ช่วยกัน

| คอลัมน์ | อ้างถึง | ความเสี่ยง |
|---|---|---|
| `sessions.current_state_id` | `states.state_id` | ลบสถานะแล้ว session ค้างชี้สถานะที่ไม่มีแล้ว |
| `session_history.state_id` | `states.state_id` | ประวัติเดินย้อนไม่ได้ |
| `flow_drafts.manual_id`, `flow_drafts.flows` | ผังที่ publish แล้ว | ร่างเป็นสำเนาเก่าหลังแก้ผัง |

**ส่วนที่อ่าน flow**

| ส่วน | ไฟล์ | อ่านอย่างไร | ถ้า flow หายจาก Map |
|---|---|---|---|
| เดินผัง | `execution/execution.service.ts:142` `requireFlow` | `findById` ทุกคำขอ | 404 `FLOW_NOT_FOUND` |
| ประวัติ | `history/history.service.ts:47-54, 85-96` | `findById`, `listManuals` | `flow: null`, `available: false` · หัวข้อกลายเป็น "ข้อมูลผังเปลี่ยนไปแล้ว" |
| ประวัติ (เดินซ้ำ) | `history.service.ts:196` `replayReaches` | เดินขั้นที่บันทึกไว้ผ่าน engine บนผังปัจจุบัน | ทางเปลี่ยนแล้วได้ `available: false` |
| feedback | `admin/admin.service.ts:33-46` | `findById` | `deviceCategory`, `brand` เป็น null |
| dashboard | `admin.service.ts:73-100` | `findById` + `getOutcomeKind` | outcome เป็น `unknown`, device เป็น `unknown` |
| ค้นหา | `symptom-search/symptom-search.service.ts` | `index`, `flowInfo` ของตัวเอง | ยังค้นเจอถ้าไม่ลบจากดัชนี |
| ร่าง | `authoring/drafts.service.ts:58, 234-241` | ใช้เช็ก id ซ้ำ | ถ้าซ่อนผังที่ลบ จะผ่านด่านนี้ แต่ไปชน `assertNoConflicts` ตอน publish |
| eval | `eval/lib/engine.ts` | `listAll`, `findById` | ใช้ DB `fixbot_eval` แยกต่างหาก |

**สรุปสำหรับ dashboard:** ตัวเลขจำนวนมาจากตาราง `sessions` จึงไม่หายตราบที่แถวอยู่ แต่ป้ายกำกับ (outcome, device, ชื่ออาการ) มาจากผัง**ปัจจุบัน**ในหน่วยความจำ แก้ผังจึงเปลี่ยนป้ายย้อนหลังได้

**โครงสร้างในหน่วยความจำ**

| โครงสร้าง | เก็บ | สร้างเมื่อ | ไม่มีข้อมูล |
|---|---|---|---|
| `FlowRepository.flows`, `manualExtras` | ผังทั้งหมด | บูต + `reload()` | `severity`, `difficulty`, `author_note`, `source_page`, `updated_at` |
| `SymptomSearchService.index` | ข้อความ + vector | บูต + `addFlows` | **ไม่บันทึกลง DB** |
| `SymptomSearchService.flowInfo` | ชื่ออาการ, device, manual | เหมือน `index` | |
| `RephraseService.cache` | ข้อความเดิม → ข้อความเรียบเรียง | ตอนใช้งาน | key เป็นข้อความ แก้ผังจึงไม่ค้าง |
| React Query `['flows']`, `['manuals']` | รายการในเบราว์เซอร์ | `staleTime: Infinity` (`queries.ts:45, 50`) | ผู้ใช้คนอื่นเห็นของเก่าจนรีเฟรช |

### 1.4 การโหลดเข้าหน่วยความจำ

- `createApp()` เรียก `flows.load()` ก่อนเปิดรับคำขอ (`app.ts:59`) ข้อมูลเสียจะทำให้บูตไม่ขึ้น
- **มี `reload()` แล้ว** (`flow.repository.ts:187`) อ่านใหม่ทั้งหมดด้วย SQL 2 คำสั่ง สร้าง Map ใหม่ให้เสร็จก่อน แล้วสลับแบบไม่มี `await` คั่น (:159-177) จึงไม่มีช่วงที่ Map ว่าง และถ้าล้มเหลวของเดิมยังอยู่
- `addFlows(flowIds)` มีความหมายเป็น **แทนที่** อยู่แล้ว: เอาข้อความเดิมของ id นั้นออก ใส่ของใหม่ และใช้ vector เดิมซ้ำถ้าข้อความเหมือนกัน (`symptom-search.service.ts:127-141`)
- **ไม่มีฟังก์ชันเอา flow ออกจากดัชนี** ต้องเพิ่ม
- deploy เป็น instance เดียวบน Render (`render.yaml`) reload ใน process เดียวจึงพอ

### 1.5 chat เลือกและเดิน flow อย่างไร

ส่วนที่เรียก "chat" คือการเดิน state machine ทีละขั้น ไม่ใช่การคุยอิสระ · LLM ทำแค่เรียบเรียงถ้อยคำ (`RephraseService`) และไม่ตัดสินเส้นทาง

**การเลือก flow มี 3 ทาง**

1. พิมพ์อาการ: `POST /symptom-search` → `search()` → เทียบ cosine กับ `entry_symptom_th`, `entry_symptom`, `entry_symptom_aliases` (`symptom-matcher.ts:43`) เกณฑ์ 0.55
2. เลือกจากรายการ: `GET /execution/flows?manualId=`
3. จากประวัติ: ปุ่ม "ตรวจอาการนี้อีกครั้ง" และปุ่มตรวจใหม่ตอนจบ

**การเดิน**

```text
POST /execution/sessions → requireFlow → engine.startSession → INSERT sessions (current_state_id = initial_state)
POST /execution/sessions/:id/actions
 → SessionStore.find → requireFlow (อ่านผังปัจจุบันทุกครั้ง) → engine.submitAction → UPDATE sessions + INSERT session_history
```

**session ไม่ได้ผูกกับรุ่นของผัง** ทุกคำขออ่านผังล่าสุดจาก Map นี่คือแกนของคำถาม B

**สิ่งที่เกิดขึ้นในโค้ดปัจจุบันถ้าผังเปลี่ยนกลางคัน**

| เหตุการณ์ | ผล | ที่มา |
|---|---|---|
| แก้ข้อความสถานะ | ขั้นถัดไปเห็นข้อความใหม่ | `renderState` |
| ลบสถานะที่ session กำลังอยู่ | 500 `FLOW_STATE_MISSING` หน้าเว็บพากลับไปเลือกอาการ | `state-machine.ts:26-33, 50-53` |
| เปลี่ยนชนิดสถานะ | หน้าเดิมส่ง action ผิดชนิด ได้ 400 `INVALID_ACTION` หน้าเว็บดึงขั้นตอนล่าสุด | `state-machine.ts:81, 95, 105` |
| ใส่ safety gate เพิ่ม | ส่ง `continue` ไม่ได้ ได้ 400 `SAFETY_CONFIRMATION_REQUIRED` (ปลอดภัย) | `state-machine.ts:91-97` |
| แทรก input ก่อนหน้าตำแหน่งปัจจุบัน | `{{ตัวแปร}}` แสดงเป็นตัวอักษรดิบ ไม่ crash | `state-machine.ts:168-172` |
| ลบหรือเปลี่ยนสถานะท้ายของ session ที่จบแล้ว | ประวัติได้ `available: false` · `GET /execution/sessions/:id` ได้ 500 หรือแสดงสถานะที่ไม่ใช่สถานะจบ | `history.service.ts:127-132` |
| เปลี่ยนทางเดินของ session ที่จบแล้ว | ประวัติได้ `available: false` ซ่อนขั้นตอนและปุ่ม feedback (feedback ยังอยู่ใน DB) | `HistoryDetailPage.tsx:101, 176` |
| **แก้แค่ข้อความ** | **ประวัติแสดงข้อความใหม่โดยไม่บอกว่าเปลี่ยน** เพราะ replay ผ่าน | `session_history` ไม่เก็บข้อความ |
| ผังหายจาก Map | 404 `FLOW_NOT_FOUND` ทั้ง session ที่เดินอยู่และที่จบแล้ว | `execution.service.ts:142` |

### 1.6 frontend ที่ใช้ซ้ำได้

**โครงที่มีอยู่:** React 19 · React Router (`BrowserRouter`) · TanStack Query 5 · Tailwind · ไม่มีไลบรารี UI ภายนอก

**เช็กสิทธิ์:** `AdminRoute` (`components/auth/AdminRoute.tsx`) เป็น UX · ด่านจริงอยู่ที่ `adminArea(requireAuth, requireAdmin, ...)` (`admin/admin.routes.ts:9-14`) router ใหม่ที่ mount ในนี้ได้สิทธิ์ admin อัตโนมัติ และ `requireAdmin` อ่าน role ปัจจุบันจาก DB ทุกครั้ง

| ของเดิม | ใช้ซ้ำแบบไหน |
|---|---|
| `api/http.ts` `request()` | ใช้เลย รองรับ `PUT`, `DELETE` แล้ว · ต้องเพิ่มการส่งต่อ `details` (ข้อ 1.7) |
| `queries.ts` รูปแบบ key `['admin', identity, ...]` | ใช้รูปแบบเดียวกัน |
| `AdminTabs`, `ErrorNotice`, `Notice`, `LoadingText`, `Button`, `Icon` | ใช้เลย · `AdminTabs` เพิ่มแท็บ |
| `history/Pagination` + รูปแบบตัวกรองใน URL ของ `AdminFeedbackPage`, `lib/adminParams.ts` | ใช้เลย |
| `lib/draftView.ts`: `pathLines`, `issuesForState`, `issuesForFlow`, `issueLocation`, `stateText`, `stateTypeLabel`, `riskWarnings` | ใช้เลย |
| `ValidationReportPanel` | ต้องปรับข้อความ เพราะมีคำว่า "เผยแพร่ไม่ได้" และ "เลขหน้า" (:38, :42) |
| `DraftFlowCard` | ใช้ตรง ๆ ไม่ได้: คอลัมน์ขวาต้องมีหน้าต้นฉบับ ถ้าไม่มีจะขึ้นกล่องแดง (:64-70) → แยก `StateRow` ออกมา |
| `DraftJsonEditor` | ใช้ตรง ๆ ไม่ได้: ผูกกับ `useUpdateDraft` (:19) → แยกเป็น editor กลาง |
| `DeleteConfirm` | ต้องรับข้อความเป็น prop เพราะเขียนตายตัวว่า "กู้คืนไม่ได้" (:14) |
| `types.ts` `DraftFlow`, `DraftState` | ใช้ซ้ำได้ เพิ่ม `author_note` |

**ข้อจำกัด:** `useBlocker` ของ React Router ใช้ได้กับ data router เท่านั้น แต่แอปใช้ `BrowserRouter` ตัวเตือนงานยังไม่บันทึกจึงทำได้แค่ `beforeunload` และปุ่มยกเลิก

### 1.7 ปัญหาในโค้ดที่กระทบฟีเจอร์นี้

| # | ปัญหา | หลักฐาน | ผลกระทบ |
|---|---|---|---|
| 1 | validator ไม่ผ่านผังเดิมเลย | วัดจริง 0/754 · `E_SOURCE_PAGE_MISSING` 6,543 จุด (`flow-validator.ts:308-316`) | ใช้ตรง ๆ แล้วแก้ผังเดิมไม่ได้สักผัง |
| 2 | `toDbRows` ล้าง `author_note` | `draft-manual.ts:123` | ข้อมูลที่มาหาย 2,340 สถานะ ถ้านำมาใช้ตรง ๆ |
| 3 | ผังใน Map ไม่ครบ | `flow.repository.ts:121-147` ไม่ SELECT `severity`, `difficulty`, `author_note` | หน้าแก้ต้องอ่านจาก DB ไม่ใช่จาก Map |
| 4 | `state_id` บังคับขึ้นต้น `n` | `flow-validator.ts:58, 252` | 13 สถานะใน 2 ผังของ rs5000fc ตกกฎนี้ |
| 5 | `W_CYCLE` ขึ้นทุกผัง | วัดจริง 722/722 · ทุกผังเกิดจาก `on_invalid` ชี้ตัวเอง 938 จุด | ขึ้นเตือนทุกครั้งที่แก้ คำเตือนจริงจะจมหาย |
| 6 | error handler ทิ้งฟิลด์เสริม | `common/error-handler.ts:34-44`, `frontend/src/api/http.ts:74-78` | ส่งรายการ error รายสถานะกลับด้วย 400 ไม่ได้ถ้าไม่แก้ทั้งคู่ |
| 7 | `updated_at` ใช้กันแก้ชนไม่ได้ | ละเอียดระดับวินาที และไม่ขยับถ้าแก้แต่ `states` | ต้องมีตัวนับของตัวเอง |
| 8 | seed เขียนทับ | `backend/scripts/seed-flows.js:163, 191` | `npm run seed` ซ้ำจะล้างงานแก้ของ admin |
| 9 | reload ซ้อนกันอาจได้ของเก่า | `flow.repository.ts:187` ไม่กันลำดับ | reload ที่เริ่มก่อนแต่จบทีหลังทับของใหม่ได้ |
| 10 | `addFlows` คัดลอก `flowInfo` ก่อน `await` แล้วเขียนทับทีหลัง | `symptom-search.service.ts:114, 142` · `search` ใช้ `as FlowInfo` (:166) | ทำงานซ้อนกันแล้วอาจทำ `flowInfo` หายจนค้นหา error |
| 11 | `submitOutcome` บันทึกก่อนอ่านสถานะ | `execution.service.ts:127-132` | สถานะถูกลบ: บันทึกสำเร็จแต่ตอบ 500 |
| 12 | 500 ส่งข้อความดิบออกไป | `error-handler.ts:39-43` | hard delete ที่ชน FK จะส่งข้อความ SQL ให้ client |
| 13 | ไม่มีงานล้าง session | มี `DELETE FROM sessions` แค่ฝั่งเจ้าของ (`session.store.ts:164`, `history.store.ts:98`) | RESTRICT ไม่มีวันหมดไปเอง |
| 14 | ไม่มี test บน `main` | `docs/README.md:7` ระบุว่าถูกลบตามคำสั่งผู้ใช้ · เหลือแต่ config | ต้องตัดสินใจใหม่ (ข้อ O) |
| 15 | ข้อความเก่าในโค้ดและเอกสาร | `drafts.service.ts:46` พูดถึง migration 012 · `AdminDraftReviewPage.tsx:65` บอกว่าลบได้ด้วย SQL · `docs/authoring/authoring-step5.md:198` ยังใช้ `graph_id` | ต้องแก้ข้อความตอนทำฟีเจอร์ · migration ถัดไปคือ **007** |
| 16 | migration runner บันทึกเมื่อจบทั้งไฟล์ | `backend/scripts/run-migrations.js:92-93` และ DDL ของ MySQL commit ทันที | ไฟล์เดียวหลายคำสั่งที่พังกลางทางจะรันซ้ำไม่ได้ |

ตรวจแล้ว**ไม่เป็นปัญหา:** `express.json()` เพดาน 100 KB (ผังใหญ่สุด 17 KB) · ความยาว `flow_id` สูงสุด 55 จาก 120 ตัวอักษร (เหลือที่ถ้าเลือกตัวเลือกเติม suffix) · `has_image`, `image_url`, `external_reference`, `config` ไม่มีในไฟล์ข้อมูลเลย

---

## Part 2 — ทางเลือกในการออกแบบ

> **ส่วนนี้คือบันทึกการวิเคราะห์ก่อนตัดสินใจ** คำตอบจริงอยู่ที่[หัวเอกสาร](#คำตอบที่ตัดสินแล้ว) · เขียนก่อนทราบว่ามี admin หลายคน คำว่า "admin คนเดียว" ในข้อ G และการประเมินจึงเป็นสมมติฐานเดิม · ข้อแนะนำของ C, D, M, O ถูกแทนด้วยคำตอบแล้ว

### A. การลบ

| ตัวเลือก | ข้อดีสำหรับโปรเจกต์นี้ | ข้อเสียสำหรับโปรเจกต์นี้ | ค่าทำ |
|---|---|---|---|
| **A1. Hard delete** | อธิบายง่าย ไม่มี migration | **ชน RESTRICT ทุกผังที่เคยใช้** ถ้าจะให้ผ่านต้องลบ sessions ซึ่ง CASCADE ลบประวัติและ feedback ตัวเลข dashboard หาย ผิดข้อกำหนด | S แต่ใช้ได้เฉพาะผังที่ไม่เคยใช้ |
| **A2. Soft delete `deleted_at`** | ประวัติ feedback dashboard ไม่กระทบ · session ที่เดินอยู่เดินต่อได้ · กู้คืนได้ · ไม่แตะ FK | ต้องกรองทุกจุดที่แสดงผังให้ผู้ใช้ · `manual_id`, `flow_id` เดิมนำกลับมาใช้ใหม่ไม่ได้ | M |
| **A3. สถานะ `status` ENUM** | รองรับ unpublish ได้ในคอลัมน์เดียว | สถานะมากกว่าที่ต้องใช้ · คำว่า draft ซ้ำกับ `flow_drafts` ทำให้สับสน | M |
| **A4. ผสม A1 + A2** | ผังที่ไม่เคยใช้หายสะอาด | มี 2 ทางให้อธิบาย · พฤติกรรมของปุ่มเดียวกันขึ้นกับข้อมูล | M+ |

**ข้อแนะนำ: A2**

**เหตุผล:** เป็นตัวเลือกเดียวที่ตอบข้อกำหนดได้โดยไม่แตะข้อมูลประวัติ และประโยคอธิบายสั้นมาก: "ลบคือซ่อนจากผู้ใช้ ข้อมูลเก่ายังอยู่เพื่อให้ประวัติเปิดได้"

**จุดออกแบบที่ต้องระวัง:** ผังที่ลบต้อง**ยังอยู่ใน `FlowRepository.flows`** ไม่อย่างนั้นประวัติจะขึ้น "ข้อมูลผังเปลี่ยนไปแล้ว" และ dashboard จะนับเป็น `unknown` · แค่ซ่อนจาก `listAll`, `listManuals`, การค้นหา และการเริ่ม session ใหม่

**ค่าทำ:** 1 migration, แก้ `FlowRepository`, `ExecutionService.startSession`, `SymptomSearchService`, ด่านเช็ก id ซ้ำใน `DraftsService`

---

### B. การแก้ผังที่ถูกใช้แล้ว และ session ที่เดินอยู่

| ตัวเลือก | ข้อดี | ข้อเสีย | ค่าทำ |
|---|---|---|---|
| **B1. แก้ในแถวเดิม ไม่มีด่าน** | ง่ายสุด ตรงกับวิธีของ `seed-flows.js` | ลบสถานะแล้วผู้ใช้เจอ 500 · ไม่มีทางย้อน | M |
| **B2. แก้ในแถวเดิม + ด่านกันผลกระทบ** | ไม่แตะ `sessions`, engine, schema ของ `states` · `replayReaches` ที่มีอยู่กันการแสดงข้อมูลผิดให้แล้ว · อธิบายง่าย | ประวัติไม่ใช่ภาพถ่าย ณ ตอนนั้น: แก้ข้อความแล้วเห็นข้อความใหม่ แก้ทางเดินแล้วขึ้น "ผังเปลี่ยน" · dashboard นับ `unknown` ถ้าลบสถานะท้าย | M+ |
| **B3. Copy-on-write:** แก้แล้วสร้าง `flow_id` ใหม่ ผังเก่า soft delete | ประวัติตรงเป๊ะ session เก่าใช้ผังเก่าต่อ ไม่แตะ `sessions` และ engine | id เปลี่ยนทุกครั้งที่บันทึก · dashboard แยกนับรายรุ่นถ้าไม่รวมกลุ่ม · ปุ่ม "ตรวจอีกครั้ง" ต้องตามไปผังล่าสุด · `eval/real-cases.json` อ้าง id เดิม · แถวเพิ่มทุกการแก้คำผิด | L |
| **B4. Versioning เต็มรูปแบบ:** `states` มี `version` และ `sessions.flow_version` | ถูกต้องที่สุดตามหลัก | เปลี่ยน PK และ FK ของ `states`, `state_transitions`, `sessions` กับข้อมูลทั้งหมด · แก้ทุก query · ขัดกับ "เรียบง่าย อธิบายได้" | L+ (หลายวัน) |
| **B5. Snapshot ต่อ session:** เก็บ JSON ผังลง `sessions` ตอนเริ่ม | ตรงเป๊ะทั้งการเดินและประวัติ | ทุกแถวโตหลาย KB · engine อ่านคนละแหล่งกับ session เก่า · แก้ความปลอดภัยแล้วไม่ถึง session ที่เดินอยู่ | L |

**ข้อแนะนำ: B2**

**ด่านที่เสนอ**

1. **`state_id` กับชนิดของสถานะเดิมเปลี่ยนไม่ได้** (`E_STATE_TYPE_CHANGED`) ถ้าจะเปลี่ยนชนิดให้เพิ่มสถานะใหม่แล้วโยงเส้น · ตัดกรณี action ผิดชนิดและกรณีสถานะจบกลายเป็นไม่จบ
2. **ลบสถานะที่มี session กำลังอยู่** ต้องยืนยัน (409 `FLOW_SESSIONS_AFFECTED`) จากนั้น session เหล่านั้นถูกทำให้หมดอายุ ผู้ใช้ได้ `SESSION_NOT_FOUND` พร้อมลิงก์เริ่มใหม่ ซึ่งหน้าเว็บรองรับอยู่แล้ว ไม่ใช่ 500 · dashboard นับเป็น `expiredUnfinished` ตามจริง
3. **คำเตือนต้องรับทราบเมื่อ:** เอา safety gate ออก (`W_SAFETY_REMOVED`) หรือเปลี่ยน `outcome_kind` (`W_OUTCOME_KIND_CHANGED`)
4. **ประวัติบอกตรง ๆ:** ถ้าผังถูกแก้หลังวันที่ตรวจ แสดงว่า "ผังถูกแก้หลังการตรวจนี้ ข้อความอาจต่างจากตอนนั้น"

**สิ่งที่ B2 ไม่ทำ และต้องพูดกับกรรมการตรง ๆ**

- ประวัติไม่ได้แสดงข้อความ ณ วันที่ตรวจ
- ถ้าเปลี่ยนทางเดินหรือลบสถานะที่เคยใช้ รายการนั้นจะขึ้น "ผังเปลี่ยน" ซ่อนขั้นตอนและปุ่ม feedback (ตัว feedback ยังอยู่ และยังนับใน dashboard)
- ลบสถานะท้ายที่เคยใช้แล้ว dashboard จะนับ outcome เป็น `unknown` จำนวนรวมไม่เปลี่ยน

**ถ้าข้อจำกัดนี้รับไม่ได้** B3 คือทางถัดไปที่คุ้มสุด

**ตารางคำตอบ: session ที่เดินอยู่จะเป็นอย่างไร (ตาม B2 + A2)**

| เหตุการณ์ | ผลที่ผู้ใช้เห็น |
|---|---|
| แก้ข้อความ | ขั้นถัดไปเห็นข้อความใหม่ · การแก้คำเตือนความปลอดภัยจึงมีผลทันที |
| เปลี่ยนลูกศร | เดินตามทางใหม่จากสถานะปัจจุบัน |
| เพิ่มสถานะ | ไม่กระทบจนกว่าจะเดินถึง |
| ลบสถานะที่ไม่ได้อยู่ | ไม่กระทบ ลูกศรใหม่ถูก validator รับรองแล้ว |
| ลบสถานะที่กำลังอยู่ | admin ยืนยันก่อน → session หมดอายุ → หน้าเว็บบอกให้เริ่มใหม่ |
| ลบทั้งผัง | **เดินต่อจนจบได้** ไม่มีใครเริ่มใหม่ได้ · ถ้าเนื้อหาอันตราย ให้แก้เนื้อหาก่อนลบ |

**คำถามย่อย:** ตอนลบทั้งผังต้องการตัวเลือกตัด session ที่เดินอยู่ทันทีไหม ผมแนะนำ**ไม่ใส่ในรอบแรก** เพื่อลดเงื่อนไข

**ค่าทำ:** M+ รวมอยู่ในเฟส 4 ของ Part 4

---

### C. หน้าแก้ไข

| ตัวเลือก | ข้อดี | ข้อเสีย | ค่าทำ |
|---|---|---|---|
| **C1. ฟอร์ม** (ช่องกรอกรายสถานะ, เพิ่ม/ลบสถานะ, เลือกเป้าหมายลูกศรจาก dropdown) | admin ที่ไม่ใช่โปรแกรมเมอร์ใช้ได้ · ลดการพิมพ์ id ผิด · ซ่อนฟิลด์ที่ไม่เกี่ยวตามชนิด | โค้ดเยอะสุด ต้องอธิบาย state ของฟอร์ม | L |
| **C2. JSON + validator** | ใช้ `DraftJsonEditor` ซ้ำ · error รายสถานะมีอยู่แล้ว | ไม่เหมาะกับคนไม่เขียนโค้ด · ข้อความไทยยาวแก้ใน JSON ลำบาก | S |
| **C3. ทั้งสองแบบ ทำเป็นเฟส** | ทำ JSON ก่อนทดสอบ backend ครบทาง แล้วค่อยเพิ่มฟอร์ม · หมดเวลาก็ยังมีของใช้ · JSON เป็นทางสำรองเมื่อฟอร์มยังไม่รองรับกรณีพิเศษ | ต้องดูแลการสลับสองมุมมองให้ใช้ข้อมูลเดียวกัน | L |

**ข้อแนะนำ: C3** ทำ JSON ก่อน แล้วค่อยทำฟอร์ม (คำตอบจริงกลับลำดับ: ฟอร์มเป็นหลักและต้องทำ JSON เป็นส่วนเสริม)

**เหตุผล:** คำขอของอาจารย์คือให้ admin แก้ผังได้ ซึ่ง JSON อย่างเดียวตอบได้ในเชิงเทคนิคแต่ไม่ตอบผู้ใช้ที่ไม่ใช่โปรแกรมเมอร์ · การทำเป็นเฟสทำให้มีจุดหยุดที่ใช้งานได้จริงถ้าเวลาไม่พอ และฟอร์มไม่ต้องมี logic ตรวจกราฟเอง เพราะยึดผลตรวจจาก backend เป็นหลัก

---

### D. หน้าดูผัง

| ตัวเลือก | Dependency ใหม่ (`npm view`, 1 พ.ย. 2569, **unpacked size ไม่ใช่ bundle size**) | ข้อดี | ข้อเสีย | ค่าทำ |
|---|---|---|---|---|
| **D1. รายการสถานะ + เส้นทาง** | ไม่มี | ใช้ `pathLines`, `StateRow` ซ้ำ · อ่านข้อความไทยยาวได้ | เห็นภาพรวมยากกว่าแผนภาพ | S |
| **D2. D1 + Mermaid** | `mermaid` 12.2.0 · 122 MB | เขียนข้อความนิยามแผนภาพไม่กี่บรรทัด · อธิบายง่าย | หนักมาก ต้องโหลดแบบ lazy เฉพาะหน้า admin · ต้อง escape ข้อความจาก DB | M |
| **D3. D1 + React Flow** | `@xyflow/react` 12.12.0 · 1.2 MB + ตัวจัดวาง `dagre` 0.8.5 · 0.84 MB หรือ `elkjs` 0.12.1 · 8.2 MB | ลาก ซูมได้ · เอาไปต่อเป็นตัวแก้แบบลากได้ | ต้องเขียนการแปลงและจัดวางเอง · เกินความจำเป็น | L |

**ข้อแนะนำ: D1 ในรอบนี้** ถ้าอยากมีแผนภาพไว้โชว์ค่อยเพิ่ม D2 เป็น step เสริมสุดท้าย

**เหตุผล:** ผังมีค่ากลาง 8 สถานะ มากสุด 25 สถานะ รายการเส้นทางอ่านได้ · ข้อตกลงของโปรเจกต์คือเลี่ยงการแตะ `package.json` · ถ้าเลือก D2 ต้องขออนุมัติเพิ่ม dependency และวัด bundle จริงก่อน

---

### E. Unpublish

| ตัวเลือก | ข้อดี | ข้อเสีย | ค่าทำ |
|---|---|---|---|
| **E1. ไม่มี แยกจาก delete; มีปุ่มกู้คืน** | กลไกเดียว สถานะเดียว · "ลบ" ที่กู้คืนได้ ทำหน้าที่เดียวกับ unpublish | คำว่า "ลบ" อาจฟังแรงกว่าการซ่อนชั่วคราว | S (`restore`) |
| **E2. มี status แยก** | สื่อความตรงกว่า ซ่อนชั่วคราว ≠ ลบ | เพิ่มสถานะและตารางทดสอบ · พฤติกรรมแทบเหมือนกัน | M |
| **E3. published → draft ย้ายกลับ `flow_drafts`** | ใช้หน้าตรวจเดิม | `flow_drafts` ทำงานระดับคู่มือ มี `pages` และบังคับ `manual_id` ใหม่ · ต้องรื้อหลายจุด | L |
| **E4. ไม่มีทั้ง unpublish และกู้คืน** | โค้ดน้อยสุด | กดลบผิดต้องแก้ด้วย SQL | ไม่มี |

**ข้อแนะนำ: E1** ป้ายปุ่มอาจใช้ "ลบ (ซ่อนจากผู้ใช้)" ให้ตรงกับพฤติกรรม

---

### F. Embeddings เมื่อแก้ผัง

ข้อเท็จจริง: ดัชนีสร้างจาก 3 ฟิลด์เท่านั้น (`symptom-matcher.ts:43-59`) และอยู่ในหน่วยความจำ ไม่ได้เก็บใน DB

| การแก้ | ต้องทำ embedding ใหม่ไหม |
|---|---|
| `entry_symptom`, `entry_symptom_th`, `entry_symptom_aliases` | **ต้อง** เฉพาะข้อความที่เปลี่ยน |
| ข้อความสถานะ ลูกศร `initial_state` ความปลอดภัย `severity` `difficulty` `page_range` `author_note` | ไม่ต้อง |
| ลบ | ไม่ embed แต่ต้องเอาออกจาก `index` และ `flowInfo` |
| กู้คืน | เหมือนเพิ่มใหม่ ข้อความที่มีอยู่ใช้ vector ซ้ำ |

| ตัวเลือก | ข้อดี | ข้อเสีย | ค่าทำ |
|---|---|---|---|
| **F1. เรียก `addFlows([id])` ทุกครั้งที่บันทึก** | ไม่ต้องเขียนเงื่อนไข · ของเดิมใช้ vector ซ้ำ ข้อความไม่เปลี่ยนก็ไม่ embed ใหม่ · อัปเดต `flowInfo` ให้ด้วย | ไม่มี | S |
| **F2. เทียบฟิลด์แล้วค่อยเรียก** | ประหยัดรอบเล็กน้อย | เพิ่มเงื่อนไขที่ลืมฟิลด์ได้ · ไม่ได้ประหยัด embed จริง | S |
| **F3. โหลดดัชนีใหม่ทั้งหมด** | ง่ายในเชิงแนวคิด | ช้า ระหว่างนั้นค้นหาไม่ได้ | S แต่กระทบผู้ใช้ |

**ข้อแนะนำ: F1** พร้อมเพิ่ม `removeFlows(ids)` และกรองผังที่ไม่ active ออกจากผลค้นหา กันช่วงที่ดัชนียังโหลดไม่เสร็จ

**เมื่อ `addFlows` ไม่สำเร็จ** (ปิดอยู่ กำลังโหลด หรือ embed ล้ม): การบันทึกยังสำเร็จ ตอบ `searchIndex: { indexed: false, reason }` เหมือนตอน publish และหน้าเว็บแจ้งว่าการค้นด้วยข้อความจะอัปเดตหลังรีสตาร์ต

---

### G. การแก้ชนกัน

| ตัวเลือก | ข้อดี | ข้อเสีย | ค่าทำ |
|---|---|---|---|
| **G1. ไม่กัน (คนบันทึกหลังชนะ)** | ไม่มีโค้ดเพิ่ม | เปิดสองแท็บแล้วงานหายเงียบ ๆ และแก้ในแถวเดิมไม่มีทางย้อน | ไม่มี |
| **G2. เทียบ `updated_at`** | ไม่เพิ่มคอลัมน์ | ละเอียดระดับวินาที · ไม่ขยับถ้าแก้แต่ `states` ต้องสั่งตั้งค่าเอง | S |
| **G3. คอลัมน์ `revision` + `SELECT ... FOR UPDATE`** | แม่นยำ อธิบายง่าย ใช้กลไกเดียวกับ `DraftsStore.publish` | เพิ่ม 1 คอลัมน์ | S |
| **G4. ล็อกการแก้** | กันตั้งแต่เปิดหน้า | ต้องจัดการล็อกค้างและหมดอายุ เกินจำเป็น | M |

**ข้อแนะนำ: G3**

**เหตุผล:** แม้มี admin คนเดียว กรณีจริงคือเปิดสองแท็บ หรือค้างหน้าไว้แล้วกลับมาแก้ · ค่าทำต่ำมาก: ถ้า `expectedRevision` ไม่ตรงตอบ 409 `FLOW_EDIT_CONFLICT`

---

### ข้อตัดสินใจเพิ่มเติมที่พบระหว่างวิเคราะห์

#### H. วิธีใช้ validator กับผังที่เผยแพร่แล้ว (จำเป็นต้องเลือก)

| ตัวเลือก | ข้อดี | ข้อเสีย | ค่าทำ |
|---|---|---|---|
| **H1. เพิ่มโหมด:** `validateManual(manual, pages)` รับ `pages = null` หมายถึงไม่มีหน้าต้นฉบับ | กฎทั้งหมดอยู่ที่เดียว ใช้ของเดิมซ้ำ · ทางเผยแพร่เดิมไม่เปลี่ยน | เพิ่มเงื่อนไขใน validator | S |
| **H2. เพิ่มคอลัมน์ `states.source_page` แล้ว backfill** | ตรวจเลขหน้าได้จริง | **ไม่มีข้อมูลให้ backfill** ไฟล์ข้อมูลทุกสถานะไม่มีฟิลด์นี้ | L และทำไม่ได้จริงกับของเดิม |
| **H3. เขียน validator ชุดใหม่** | อิสระ | กฎซ้ำซ้อนและค่อย ๆ ไม่ตรงกัน | M |

**ข้อแนะนำ: H1** ในโหมดนี้: ข้ามกฎ `source_page` และ `W_PAGE_RISK` · `state_id` ใช้ `^[a-z0-9_]+$` · ยอมรับ `author_note`

นอกจากนี้ให้ `W_CYCLE` ไม่นับ `on_invalid` ที่ชี้กลับตัวเอง เพราะคือการถามซ้ำตามปกติ และตอนนี้ขึ้นทุกผัง ข้อนี้ทำให้คำเตือนของทางเผยแพร่เดิมลดลงด้วย แต่ไม่ได้ทำให้ผังที่ไม่ควรผ่านกลับผ่าน

**ผลที่คาดจากการวัด** (จำลองกฎเลขหน้าด้วยค่ากลาง ยังไม่ใช่โค้ดจริง): ผ่าน 720/722 ผัง · อีก 2 ผังของ rs5000fc ตกเฉพาะรูปแบบ `state_id` จะผ่านเมื่อใช้กฎของโหมดนี้ · คำเตือนที่ยังเหลือคือ `W_STATE_RISK` 16 จุด ซึ่งเป็นคำเตือนที่มีความหมาย

#### I. บันทึกรุ่นก่อนแก้ `flow_revisions`

| ตัวเลือก | ข้อดี | ข้อเสีย | ค่าทำ |
|---|---|---|---|
| **I1. ไม่เก็บ** | ไม่มีตารางเพิ่ม | แก้ในแถวเดิมแล้วย้อนไม่ได้ ตอบไม่ได้ว่าใครแก้อะไร | ไม่มี |
| **I2. เก็บ JSON ก่อนแก้ทุกครั้ง ไม่มีหน้าจอ อ่านด้วย SQL** | เป็นทางย้อนและหลักฐาน · 1 ตาราง 1 INSERT · เนื้อหามีผลต่อความปลอดภัยจึงควรตรวจย้อนได้ | ไม่ได้ช่วยให้ประวัติเก่าแสดงข้อความเก่า | S |
| **I3. เก็บ + มีหน้าประวัติและปุ่มย้อน** | ใช้งานสะดวก | งานเพิ่มพอสมควร ยังไม่จำเป็น | M–L |

**ข้อแนะนำ: I2**

#### J. ขอบเขตฟิลด์ที่แก้ได้

| ระดับ | แก้ได้ | แก้ไม่ได้ |
|---|---|---|
| คู่มือ | ไม่มีในรอบนี้ | `device_category`, `brand`, `model_pattern`, `source_manual`, `display_name` กระทบทุกผังในเล่ม |
| flow | `entry_symptom`, `entry_symptom_th`, `entry_symptom_aliases`, `severity`, `difficulty`, `page_range`, `initial_state` | `flow_id` (`sessions` อ้างอยู่), `manual_id`, `source_chunk_id`, `source` |
| สถานะ | ข้อความ ลูกศร ความปลอดภัย ฟิลด์ input `outcome_kind` `author_note` และเพิ่ม/ลบ/เรียงสถานะ | `state_id` และ `type` ของสถานะเดิม (ตามด่าน B2) |

**ข้อแนะนำ: ตามตาราง** ถ้าต้องการแก้ระดับคู่มือค่อยเพิ่มภายหลัง

#### K. ที่มาของเนื้อหาเมื่อ admin แก้ (`author_note`)

ผังเหล่านี้อ้าง "ตามคู่มือหน้า X" ต่อผู้ใช้ · ถ้า admin แก้ข้อความแล้วไม่บันทึกที่มา การอ้างอิงจะไม่ตรงจริง และโปรเจกต์นี้ยึดหลักแยกสิ่งที่มาจากคู่มือกับสิ่งที่ผู้พัฒนาเพิ่ม (`docs/exam-prep/18-proposal-author-note-citation.md`)

| ตัวเลือก | ข้อดี | ข้อเสีย | ค่าทำ |
|---|---|---|---|
| **K1. เก็บไว้ ไม่แสดง** | ง่าย | admin ไม่เห็นว่าข้อความไหนผู้พัฒนาเพิ่ม | S |
| **K2. แสดงและแก้ได้ พร้อมข้อความเตือนในฟอร์มเมื่อแก้ข้อความหรือเพิ่มสถานะ** | รักษาหลัก provenance โดยไม่บังคับเกินไป | อาศัยวินัยของ admin | S |
| **K3. บังคับกรอกเมื่อแก้ข้อความ** | เข้มที่สุด | แก้คำผิดเล็กน้อยก็ต้องเขียนหมายเหตุ | S |

**ข้อแนะนำ: K2** และไม่ว่าจะเลือกอะไร `author_note` เดิม**ต้องไม่หาย**

#### L. `data/manuals` กับ DB อันไหนเป็นตัวจริง

| ตัวเลือก | ข้อดี | ข้อเสีย | ค่าทำ |
|---|---|---|---|
| **L1. เขียนในเอกสารว่าอย่า seed ซ้ำ** | ไม่มีโค้ด | พลาดแล้วงานแก้หายเงียบ ๆ | ไม่มี |
| **L2. seed ปฏิเสธผังที่ `revision > 0` หรือ `deleted_at` ไม่ว่าง ถ้าไม่ใส่ `--force`** | กันพลาดได้จริง · DB คือตัวจริงหลังเริ่มแก้ | แก้สคริปต์เล็กน้อย | S |
| **L3. เขียนกลับลงไฟล์ JSON ตอนบันทึก** | ไฟล์ตรงกับ DB | บน Render ไฟล์ไม่ถาวร · ซับซ้อน | M |

**ข้อแนะนำ: L2** · `eval/` ใช้ DB `fixbot_eval` ที่ seed จากไฟล์ จึงไม่กระทบถ้าไม่ใช้ DB เดียวกัน ผลประเมินเดิมสะท้อนข้อมูลใน seed ไม่ใช่ผังที่ admin แก้

#### M. บันทึกแล้วมีผลทันทีหรือไม่

| ตัวเลือก | ข้อดี | ข้อเสีย | ค่าทำ |
|---|---|---|---|
| **M1. มีผลทันที + ปุ่ม "ตรวจโดยไม่บันทึก" + ติ๊กยืนยันก่อนบันทึก** | ใช้รูปแบบเดียวกับหน้าร่าง · แก้เนื้อหาอันตรายได้เร็ว | ไม่มีช่วงทดลองก่อนจริง | S |
| **M2. เก็บร่างของการแก้แยกจนกดเผยแพร่** | เหมือนการทำงานบนร่าง | ต้องมีที่เก็บร่างรายผัง และ `flow_drafts` ไม่รองรับ | L |

**ข้อแนะนำ: M1**

#### N. ลบระดับคู่มือ

| ตัวเลือก | ข้อดี | ข้อเสีย | ค่าทำ |
|---|---|---|---|
| **N1. ลบได้ทีละผัง** ผังสุดท้ายถูกลบแล้วคู่มือหายจากหน้าเลือกรุ่นเอง | ตรงกับที่อาจารย์ขอ · `listManuals` คำนวณจากผังที่ active อยู่แล้ว | ลบทั้งเล่มต้องกดหลายครั้ง | ไม่เพิ่ม |
| **N2. มีปุ่มลบทั้งคู่มือ** | สะดวก | เพิ่มความเสี่ยงกดผิด เพิ่ม endpoint | S–M |

**ข้อแนะนำ: N1**

#### O. จะเพิ่ม test กลับเข้ามาไหม

`docs/README.md:7` ระบุว่า test ถูกลบตามคำสั่งผู้ใช้ เหลือ config และ dependency ของ jest/vitest

| ตัวเลือก | ข้อดี | ข้อเสีย | ค่าทำ |
|---|---|---|---|
| **O1. เพิ่มเฉพาะส่วนที่เสี่ยง:** validator, service, ฟังก์ชันล้วนของฟอร์ม | กันทางเผยแพร่เดิมพังได้ ใช้เครื่องมือที่ติดตั้งแล้ว | เพิ่มไฟล์ที่ต้องอ่าน | M |
| **O2. ทดสอบมือเท่านั้น** | ไม่เพิ่มไฟล์ · สอดคล้องกับการตัดสินใจเดิม | ตรวจซ้ำทั้งหมดด้วยมือทุกครั้ง · พลาด validator ได้ง่าย | S |

**ข้อแนะนำ: O1** (คำตอบจริงคือ O2 จึงใช้ checklist ด้วยมือใน 3.7)

---

## Part 3 — แบบที่เสนอ

> ตรงกับคำตอบในหัวข้อ [คำตอบที่ตัดสินแล้ว](#คำตอบที่ตัดสินแล้ว) · ยังไม่ได้ implement

**สมมติฐานหลักของแบบนี้:** มี admin หลายคนที่อาจทำงานพร้อมกัน และ admin ไม่ใช่โปรแกรมเมอร์

**ผลต่อการออกแบบ**

| เรื่อง | สิ่งที่แบบนี้ทำ |
|---|---|
| หลาย admin | กันแก้ชนกัน · บอกว่าใครแก้หรือลบ · reload เข้าคิว · เก็บบันทึกทุกการแก้ ลบ และกู้คืน |
| ไม่ใช่โปรแกรมเมอร์ | ไม่ต้องพิมพ์ id หรือ regex · เลือกเป้าหมายจาก dropdown · ข้อความ error เป็นภาษาคน · JSON เป็นโหมดเสริมที่ไม่ต้องแตะ |
| การสร้าง admin | ทำได้ทางเดียวคือ `scripts/seed-admin.js` (รันซ้ำด้วยค่า `ADMIN_EMAIL` อื่น และต้องระบุ `ADMIN_DISPLAY_NAME` ตามข้อ P) · ไม่มีหน้าจัดการ admin |

### 3.1 ฐานข้อมูล

แยกเป็น 2 ไฟล์ ไฟล์ละ 1 คำสั่ง เพราะ DDL commit ทันทีและ runner บันทึกชื่อไฟล์เมื่อจบทั้งไฟล์

**`backend/migrations/007_flow_management.sql`**

```sql
-- 007_flow_management: ดู/แก้/ลบผังโดยผู้ดูแล
-- ต้องรันหลัง 001_users และ 002_flows
ALTER TABLE flows
  ADD COLUMN revision    INT UNSIGNED NOT NULL DEFAULT 0
    COMMENT 'เพิ่มทีละ 1 ทุกครั้งที่แก้ ใช้กันการแก้ชนกัน · 0 = ไม่เคยแก้',
  ADD COLUMN edited_at   TIMESTAMP NULL DEFAULT NULL
    COMMENT 'เวลาที่ admin แก้เนื้อหาล่าสุด ไม่เปลี่ยนเมื่อลบหรือกู้คืน',
  ADD COLUMN edited_by   CHAR(36) NULL COMMENT 'users.id ของ admin ที่แก้ล่าสุด',
  ADD COLUMN deleted_at  TIMESTAMP NULL DEFAULT NULL
    COMMENT 'NULL = ใช้งานอยู่ · มีค่า = ซ่อนจากผู้ใช้ แต่ session ประวัติ และสถิติยังอ้างถึงได้',
  ADD COLUMN deleted_by  CHAR(36) NULL COMMENT 'users.id ของ admin ที่ลบ',
  ADD CONSTRAINT fk_flows_edited_by FOREIGN KEY (edited_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_flows_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE;
```

**`backend/migrations/008_flow_revisions.sql`**

```sql
-- 008_flow_revisions: บันทึกว่า admin คนไหนแก้/ลบ/กู้คืนผังเมื่อไร พร้อมเนื้อหาก่อนแก้
-- ไม่มีส่วนใดของการเดินผังอ่านตารางนี้ ใช้ตรวจย้อนหลังและกู้ด้วยมือเท่านั้น
CREATE TABLE IF NOT EXISTS flow_revisions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  flow_id     VARCHAR(120) NOT NULL,
  action      ENUM('edit','delete','restore') NOT NULL,
  revision    INT UNSIGNED NOT NULL COMMENT 'ค่า flows.revision ก่อนทำรายการนี้',
  snapshot    JSON NULL COMMENT 'เนื้อหาก่อนแก้ รูปเดียวกับ GET /admin/flows/:id · มีเฉพาะ action = edit',
  acted_by    CHAR(36) NULL COMMENT 'users.id ของ admin ที่ทำรายการ',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_revisions_flow (flow_id, created_at),

  CONSTRAINT fk_revisions_flow FOREIGN KEY (flow_id) REFERENCES flows (flow_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_revisions_acted_by FOREIGN KEY (acted_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**บันทึกว่าใครทำอะไร อยู่ 2 ระดับ**

| เก็บที่ | ตอบคำถาม | ใช้ที่ไหน |
|---|---|---|
| `flows.edited_at`, `edited_by`, `deleted_at`, `deleted_by` | ตอนนี้ใครแก้ล่าสุด ใครลบ | แสดงในหน้ารายการและรายละเอียด |
| `flow_revisions` | ทุกครั้งที่แก้ ลบ หรือกู้คืน รวมถึงการลบที่ถูกกู้คืนไปแล้ว | อ่านด้วย SQL (ไม่มีหน้าจอตามข้อ I2) |

กู้คืนแล้ว `deleted_at`, `deleted_by` กลับเป็น NULL แต่แถว `delete` ใน `flow_revisions` ยังอยู่ จึงไม่เสียหลักฐาน

```sql
-- ดูประวัติการจัดการของผังหนึ่ง
SELECT r.created_at, r.action, r.revision, u.display_name, u.email
  FROM flow_revisions r
  LEFT JOIN users u ON u.id = r.acted_by
 WHERE r.flow_id = ?
 ORDER BY r.id DESC;
```

| การตัดสินใจ | เหตุผล |
|---|---|
| ไม่เพิ่ม index ให้ `deleted_at` | ผังมีหลักร้อยแถว การกรองสำหรับผู้ใช้ทำในหน่วยความจำ · SQL อ่าน `deleted_at` เฉพาะหน้า admin |
| ไม่มี UNIQUE ที่ `(flow_id, revision)` | การลบและกู้คืนไม่เปลี่ยนเนื้อหา จึงไม่เพิ่ม `revision` แถวเหล่านี้ใช้เลขซ้ำกันได้ · ลำดับการแก้ถูกกันด้วย `FOR UPDATE` แล้ว |
| `acted_by` เป็น `ON DELETE SET NULL` | ตรงกับข้อตกลงเดิมของ `flow_drafts` · โค้ดแอปไม่มีการลบบัญชี แต่ถ้าลบด้วย SQL จะเหลือแค่เวลา ไม่รู้ชื่อผู้ทำ |
| ไม่เก็บอีเมลซ้ำในตารางนี้ | ตรงกับข้อตกลงเดิม · หน้าเว็บแสดงเฉพาะ `display_name` |
| ไม่แตะ `states`, `state_transitions`, `sessions` | INSERT เดิมของ seed และ publish ใช้ได้เพราะคอลัมน์ใหม่มีค่าเริ่มต้น |
| ไม่เปลี่ยน FK `RESTRICT` | ยังเป็นด่านกันการลบข้อมูลโดยไม่ตั้งใจ |

**ข้อควรระวัง:** โค้ดปัจจุบันตั้งชื่อเริ่มต้นเป็น `Admin` (`seed-admin.js:54`) และ `.env.example:38` ก็ใส่ค่า `Admin` ไว้ step 1.2 จึงตัดค่าเริ่มต้นทั้งสองจุดตามข้อ P · admin ที่มีอยู่แล้วอาจชื่อซ้ำกัน step 1.1 จึงตรวจเรื่องนี้

### 3.2 API

**รูปแบบเดิม:** error คือ `{ statusCode, code, message }` และ envelope เป็น camelCase แต่เนื้อผังเป็น snake_case เหมือน `/admin/drafts`

**ส่วนที่เพิ่ม:** `details` เป็นฟิลด์ไม่บังคับใน error body

ทุก endpoint อยู่ใต้ `adminArea` จึงต้องมี token ของ admin · **401** `UNAUTHENTICATED` · **403** `FORBIDDEN`

#### รายการทั้งหมด

| Method | Path | ใช้ทำอะไร | สำเร็จ |
|---|---|---|---|
| GET | `/admin/flows` | รายการ พร้อมตัวกรองและแบ่งหน้า | 200 |
| GET | `/admin/flows/:id` | รายละเอียดสำหรับดูและแก้ | 200 |
| POST | `/admin/flows/:id/validate` | ตรวจโดยไม่บันทึก + บอกผลกระทบ | 200 |
| PUT | `/admin/flows/:id` | บันทึกการแก้ | 200 |
| DELETE | `/admin/flows/:id` | soft delete | 204 |
| POST | `/admin/flows/:id/restore` | กู้คืน | 200 |

#### `GET /admin/flows`

Query: `q`, `manualId`, `deviceCategory`, `status=active|deleted|all` (ค่าเริ่มต้น `active`), `page`, `pageSize`

```json
{
  "items": [{
    "flowId": "samsung_ge83mdt_um_not_start",
    "manualId": "samsung_ge83mdt_um_de68_04111e",
    "deviceCategory": "Microwave",
    "brand": "Samsung",
    "modelPattern": "GE83MDT",
    "displayName": null,
    "entrySymptom": "...",
    "entrySymptomTh": "...",
    "stateCount": 8,
    "status": "active",
    "revision": 2,
    "editedAt": "2026-11-01T10:00:00.000Z",
    "editedByName": "Admin B",
    "deletedAt": null,
    "deletedByName": null,
    "sessionCount": 12,
    "activeSessionCount": 1
  }],
  "total": 722, "page": 1, "pageSize": 20, "totalPages": 37
}
```

Error: **400** `INVALID_ADMIN_QUERY`

#### `GET /admin/flows/:id`

```json
{
  "flowId": "...", "manualId": "...", "deviceCategory": "...", "brand": "...", "modelPattern": "...",
  "displayName": null, "sourceManual": "...", "source": "...", "sourceChunkId": "...",
  "status": "active", "revision": 3, "createdAt": "...", "updatedAt": "...",
  "editedAt": "...", "editedByName": "Admin B", "deletedAt": null, "deletedByName": null,
  "flow": {
    "flow_id": "...", "entry_symptom": "...", "entry_symptom_th": "...", "entry_symptom_aliases": ["..."],
    "severity": "medium", "difficulty": "easy", "page_range": [37, 37], "initial_state": "n1",
    "states": [
      { "state_id": "n1", "type": "checkpoint", "question": "...", "on_yes": "n2", "on_no": "n3", "safety_critical": false, "author_note": "..." }
    ]
  },
  "usage": { "sessions": 12, "completed": 10, "feedback": 4, "activeByState": { "n2": 1 } },
  "validation": { "errors": [], "warnings": [], "stats": { "flows": 1, "states": 8 }, "validatedAt": "..." }
}
```

เปิดผังที่ลบแล้วได้ · Error: **404** `ADMIN_FLOW_NOT_FOUND` (แยกจาก `FLOW_NOT_FOUND` เพราะข้อความและทางแก้เขียนสำหรับผู้ใช้ทั่วไป)

#### `POST /admin/flows/:id/validate`

Body: `{ "flow": { ... } }` · ไม่เขียนอะไรลง DB

```json
{
  "validation": { "errors": [], "warnings": [], "stats": { "flows": 1, "states": 8 }, "validatedAt": "..." },
  "impact": {
    "removedStates": ["n5"],
    "completedSessionsOnRemovedStates": 3,
    "searchTextChanged": false,
    "confirmRequired": true,
    "confirmReasons": [
      { "code": "ACTIVE_SESSIONS_ON_REMOVED_STATE", "stateId": "n5", "count": 1 },
      { "code": "SAFETY_REMOVED", "stateId": "n2" }
    ]
  }
}
```

ผลการตรวจไม่ผ่านยังเป็น **200** เพราะคำขอทำงานสำเร็จ · Error: **400** `INVALID_FLOW_REQUEST` · **404** · **409** `FLOW_DELETED`

#### `PUT /admin/flows/:id`

```json
{
  "expectedRevision": 3,
  "confirmImpact": false,
  "flow": {
    "entry_symptom": "...", "entry_symptom_th": "...", "entry_symptom_aliases": ["..."],
    "severity": "medium", "difficulty": "easy", "page_range": [37, 37],
    "initial_state": "n1",
    "states": [ { "state_id": "n1", "type": "checkpoint", "question": "...", "on_yes": "n2", "on_no": "n3" } ]
  }
}
```

`flow_id` ใช้จาก URL เท่านั้น ถ้าส่งฟิลด์นอกรายการจะถูกปฏิเสธ

```json
{
  "detail": { "...": "รูปเดียวกับ GET /admin/flows/:id รวมคำเตือนที่ยังเหลือ" },
  "searchIndex": { "indexed": true },
  "expiredSessions": 0
}
```

**คำเตือนไม่ขวางการบันทึก** ตามข้อ M: ไม่มีช่องติ๊ก และการบันทึกปกติใช้คลิกเดียว คำเตือนทั่วไป (`W_STATE_RISK`, `W_NO_ESCALATION` ฯลฯ) แสดงในรายงาน แต่ไม่ขวาง

**ด่านเดียวที่ขวางคือการเปลี่ยนแปลงที่กระทบผู้ใช้หรือความปลอดภัยโดยตรง** (`confirmReasons`) ซึ่งต้องกด "บันทึกต่อ" อีกครั้ง

| `confirmReasons[].code` | เกิดเมื่อ | ทำไมต้องกดอีกครั้ง |
|---|---|---|
| `ACTIVE_SESSIONS_ON_REMOVED_STATE` | ลบสถานะที่มีผู้ใช้กำลังอยู่ | session เหล่านั้นจะหมดอายุ ผู้ใช้ต้องเริ่มใหม่ |
| `SAFETY_REMOVED` | สถานะเดิมมี `safety_critical` แล้วหายไป | เอาด่านความปลอดภัยออก |
| `OUTCOME_KIND_CHANGED` | เปลี่ยน `outcome_kind` ของสถานะเดิม | ป้ายผลลัพธ์ใน dashboard และประวัติเปลี่ยนย้อนหลัง |

| สถานะ | code | เมื่อไร | `details` |
|---|---|---|---|
| 400 | `INVALID_FLOW_REQUEST` | รูปร่างผิด ฟิลด์เกิน | ไม่มี (ข้อความบอกจุดผิด) |
| 400 | `FLOW_INVALID` | validator หรือด่านเทียบรุ่นเดิมพบ error | `{ validation }` |
| 404 | `ADMIN_FLOW_NOT_FOUND` | ไม่มีผังนี้ | |
| 409 | `FLOW_DELETED` | ผังถูกลบแล้ว | `{ deletedAt, deletedByName }` |
| 409 | `FLOW_EDIT_CONFLICT` | `expectedRevision` ไม่ตรง admin คนอื่นบันทึกไปก่อน | `{ currentRevision, editedAt, editedByName }` |
| 409 | `FLOW_CONFIRM_REQUIRED` | มี `confirmReasons` แต่ `confirmImpact` เป็น false | `{ impact }` |
| 500 | `FLOW_RELOAD_FAILED` | commit แล้วแต่โหลดเข้าหน่วยความจำไม่สำเร็จ | |

ตัวอย่าง 400 รายสถานะ

```json
{
  "statusCode": 400,
  "code": "FLOW_INVALID",
  "message": "ผังยังไม่ผ่านการตรวจ (2 ข้อผิดพลาด)",
  "details": {
    "validation": {
      "errors": [
        { "code": "E_EDGE_TARGET_MISSING", "message": "next ชี้ไป 'n9' ที่ไม่มีอยู่", "flowId": "samsung_x_flow", "stateId": "n3" },
        { "code": "E_STATE_TYPE_CHANGED", "message": "สถานะเดิมเปลี่ยนชนิดไม่ได้ ให้เพิ่มสถานะใหม่แล้วโยงเส้น", "flowId": "samsung_x_flow", "stateId": "n5" }
      ],
      "warnings": [],
      "stats": { "flows": 1, "states": 8 },
      "validatedAt": "2026-11-01T10:00:00.000Z"
    }
  }
}
```

#### `DELETE /admin/flows/:id`

**204** ไม่มี body · session ที่เดินอยู่เดินต่อได้ · การลบกู้คืนได้ จึงไม่ต้องส่ง `expectedRevision`

Error: **404** · **409** `FLOW_ALREADY_DELETED` พร้อม `{ deletedAt, deletedByName }` · **500** `FLOW_RELOAD_FAILED`

#### `POST /admin/flows/:id/restore`

**200** `{ "detail": { ... }, "searchIndex": { "indexed": true } }`

Error: **404** · **409** `FLOW_NOT_DELETED` · **500** `FLOW_RELOAD_FAILED`

### 3.3 โครงสร้าง backend

โค้ด Express ของโปรเจกต์ไม่มีชั้น controller: `*.routes.ts` เรียก service ตรง และใช้ชื่อ `*.store.ts` สำหรับ SQL ต่อคำขอ แบบนี้ใช้ต่อ

**ไฟล์ใหม่ `backend/src/flow-admin/`**

| ไฟล์ | หน้าที่ |
|---|---|
| `flow-admin.routes.ts` | ประกาศ 6 endpoint · อ่าน `currentUser(request)!.sub` เป็นผู้ทำรายการ · ไม่มี logic |
| `flow-admin.dto.ts` | `parseListQuery`, `parseValidateBody`, `parseUpdateBody` และชนิดของ response |
| `flow-admin.errors.ts` | รวม `ApiError` ของฟีเจอร์นี้ เหมือน `drafts.errors.ts` |
| `flow-diff.ts` | ฟังก์ชันล้วนเทียบผังเก่ากับใหม่: `removedStates`, `E_STATE_TYPE_CHANGED`, `SAFETY_REMOVED`, `OUTCOME_KIND_CHANGED`, `searchTextChanged` |
| `flow-admin.service.ts` | ขั้นตอนธุรกิจ: แปลงเป็นรูปที่ validator รับ, ตรวจ, เรียก store, reload, อัปเดตดัชนี, ทำ session หมดอายุ |
| `flow-admin.store.ts` | SQL ทั้งหมด: list, findDetail (JOIN `users` เอา `display_name`), update (transaction), softDelete, restore, นับ session, เขียน `flow_revisions` |

**ไฟล์ที่แก้**

| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `common/api-error.ts`, `common/error-handler.ts` | `ApiError` รับ `details` และ `toBody` ส่งต่อ |
| `authoring/flow-validator.ts` | `pages: ReadonlyMap \| null` (ข้อ H1) · เพิ่ม `author_note` · `W_CYCLE` ไม่นับ `on_invalid` ชี้ตัวเอง |
| `authoring/draft-manual.ts` | `toDbRows` ใช้ `state.author_note ?? null` · ร่างไม่มีฟิลด์นี้ ทางเผยแพร่จึงเขียน null เหมือนเดิม |
| `authoring/draft-schema.ts` | export ตัวตรวจรูปร่างของ `states` พร้อมระบุรายการฟิลด์ที่รับได้ |
| `authoring/drafts.service.ts` | เช็ก id ซ้ำต้องรวมผังที่ลบแล้ว · แก้ข้อความ migration 012 |
| `execution/flow.repository.ts` | อ่าน `deleted_at`, `edited_at` · Map เสริม · `listAll` และ `listManuals` กรองผังที่ลบ · เพิ่ม `isActive(id)`, `editedEpoch(id)` · reload เข้าคิว |
| `execution/execution.service.ts` | `startSession` ปฏิเสธผังที่ลบ · `submitOutcome` อ่านสถานะก่อนบันทึก |
| `symptom-search/symptom-search.service.ts` | เพิ่ม `removeFlows` · กรองผังที่ไม่ active · แก้การเขียนทับ `flowInfo` |
| `history/history.service.ts`, `history.dto.ts` | ใช้คู่มือรวมผังที่ลบ · ส่ง `flow.active` และ `flowEditedAfterSession` |
| `app.ts` | สร้าง service และ `router.use('/flows', flowAdminRoutes(...))` ใน `adminArea` |
| `scripts/seed-admin.js`, `.env.example` | บังคับ `ADMIN_DISPLAY_NAME` ตามข้อ P · ตัดค่าเริ่มต้น `Admin` |
| `scripts/seed-flows.js` | ด่านตามข้อ L2 |
| `scripts/backup-flow-tables.js` | เพิ่ม `flow_revisions` ใน `TABLES` |

**วิธีใช้ validator ซ้ำโดยไม่แตก logic**

```ts
// ทางร่าง: ไม่เปลี่ยน
validateManual(assembleManual(manualId, meta, flows, draftId), pageMap);

// ทางแก้ผัง: ส่งข้อมูลคู่มือจาก DB ครอบผังเดียว และไม่มีหน้าต้นฉบับ
validateManual({ manual_id, device_category, brand, model_pattern, source_manual, flows: [flow] }, null);
```

ตอนเขียนลง DB ใช้ `toDbRows` ซ้ำ โดยนำเฉพาะ `.states` และ `.transitions` · แถว `flows` เขียน `UPDATE` แยก ระบุเฉพาะคอลัมน์ที่แก้ได้ จึงไม่แตะ `config`, `source_chunk_id`, `source`

### 3.4 การ reload และดัชนีค้นหา

**ลำดับหลังบันทึก**

```text
COMMIT → flows.reload() → symptomSearch.addFlows([id]) → ทำ session บนสถานะที่ถูกลบให้หมดอายุ → ตอบกลับ
```

| ข้อกำหนด | วิธีทำ | เหตุผล |
|---|---|---|
| ผังที่ลบต้องยังอ่านได้ | `flows` เก็บทุกผัง · `listAll`, `listManuals` กรองออก | ประวัติ เดินต่อ dashboard |
| reload ของหลาย admin ต้องไม่ทับกัน | **เข้าคิวทีละรอบ** (โค้ดด้านล่าง) | แต่ละรอบอ่าน DB หลัง commit ของตัวเอง และจบตามลำดับ ของเก่าจึงทับของใหม่ไม่ได้ · `addFlows` ที่ตามมาเห็นผังของตัวเองแน่นอน |
| `addFlows` ของหลาย admin ต้องไม่ทำ `flowInfo` หาย | เขียนเฉพาะรายการของ flow ที่ทำลงใน `this.flowInfo` ตอนจบ ไม่แทนทั้ง Map | ปิดปัญหาข้อ 10 ใน Part 1.7 |
| reload ล้มเหลว | ของเดิมในหน่วยความจำยังอยู่ · ตอบ 500 `FLOW_RELOAD_FAILED` บอกให้รีสตาร์ต · คิวเดินต่อได้ | กลไกเดียวกับ `publishReloadFailed` |
| ทำ session หมดอายุ**หลัง** reload | ถ้าทำใน transaction ผู้ใช้ยังเดินบนผังเก่าไปถึงสถานะที่ถูกลบได้ก่อน reload | ปิดช่องว่าง · ถ้าคำสั่งนี้ล้ม ผู้ใช้ได้ `FLOW_STATE_MISSING` และลิงก์เริ่มใหม่ |
| ลบหรือกู้คืน | reload เหมือนกัน แล้วเรียก `removeFlows` หรือ `addFlows` | จุดเดียว เข้าใจง่าย |

```ts
private reloadQueue: Promise<unknown> = Promise.resolve();

async reload(): Promise<number> {
  const run = this.reloadQueue.then(() => this.loadAll());
  this.reloadQueue = run.catch(() => undefined); // รอบที่ล้มต้องไม่ทำให้คิวหยุด
  await run;
  return this.flows.size;
}
```

**คิวรี session หมดอายุ** ใช้กลไกเดิม `expires_at > NOW()`

```sql
UPDATE sessions SET expires_at = NOW()
 WHERE flow_id = ? AND status = 'in_progress' AND current_state_id IN (?)
```

**ขนาดของการโหลด:** ตอนนี้ reload ทั้งหมดทุกครั้งเพื่อความเรียบง่าย ถ้าวัดแล้วช้าเกินไปบน Aiven ค่อยเพิ่มการโหลดรายผัง

### 3.5 Frontend

ข้อความบนหน้าจอใช้คำว่า "แผนผังขั้นตอน" (ไม่ใช้ "กราฟ") ตามข้อตกลงเดิม และในฟอร์มเรียกแต่ละ state ว่า "ขั้นตอน" เพื่อให้ admin ที่ไม่ใช่โปรแกรมเมอร์เข้าใจ

#### เส้นทาง

| Route | หน้า |
|---|---|
| `/admin/flows` | `AdminFlowsPage` รายการ |
| `/admin/flows/:id` | `AdminFlowDetailPage` รายละเอียด ลบ กู้คืน |
| `/admin/flows/:id/edit` | `AdminFlowEditPage` แก้ไข |

ทุกหน้าครอบด้วย `AdminRoute` และเพิ่มแท็บ "แผนผังที่เผยแพร่" ใน `AdminTabs`

#### ฟอร์มสำหรับ admin ที่ไม่ใช่โปรแกรมเมอร์ (หน้าแก้หลัก)

| ข้อมูลทางเทคนิค | ฟอร์มจัดการอย่างไร | ที่มาของการตัดสินใจ |
|---|---|---|
| `state_id` | ระบบสร้างให้ด้วย `nextStateId` ไม่ต้องพิมพ์ · แสดงตัวเล็กกำกับ | พิมพ์ผิดไม่ได้ |
| ลูกศร (`on_yes`, `on_no`, `next`) | dropdown แสดง "ข้อ 3 · คำถาม: ปิดประตูสนิทหรือไม่…" แทน id | เห็นเนื้อหาที่จะไปต่อ |
| `type` | ปุ่มเพิ่มตามชนิดเป็นภาษาคน · สถานะเดิมเปลี่ยนชนิดไม่ได้ | ตามด่าน B2 |
| `input_type`, `pattern`, `store_as`, `on_invalid` | ปุ่ม "ถามหมายเลขรุ่น" ใส่ค่าให้ครบ · ซ่อนไว้ใน "ตั้งค่าขั้นสูง" | วัดจากข้อมูล: ทั้ง 938 สถานะ `input` ใช้ค่าชุดเดียวกัน |
| `{{model_number}}` | ปุ่ม "แทรกหมายเลขรุ่น" ในช่องข้อความ | ทุกผังใช้ตัวแปรนี้ |
| `outcome_kind` | ตัวเลือกภาษาไทยจาก `OUTCOME_TITLES` กรองตามชนิด: resolution ได้ 2 ค่า, escalation ได้ 2 ค่า | ตรงกับข้อมูลเดิม |
| `safety_critical`, `safety_warning` | checkbox ประจำฟิลด์ของขั้นตอนชนิด instruction เท่านั้น ติ๊กแล้วจึงมีช่องคำเตือน | ป้องกัน `E_SAFETY_PLACEMENT` และ `E_SAFETY_WARNING_WITHOUT_FLAG` ตั้งแต่ต้น |
| `initial_state` | dropdown "ขั้นตอนแรก" | |
| `severity`, `difficulty` | dropdown ภาษาไทย | |
| `author_note` | ช่อง "หมายเหตุที่มา (ผู้ใช้ไม่เห็น)" · เมื่อแก้ข้อความหรือเพิ่มขั้นตอน ขึ้นข้อความเตือนให้บันทึกที่มา แต่ไม่บังคับกรอก | ข้อ K2 |
| ลบขั้นตอน | บอกว่ามีกี่ข้อชี้มาที่นี่ ลูกศรเหล่านั้นกลายเป็น "ยังไม่ได้เลือก" และถูกเน้น · ลบขั้นตอนแรกต้องเลือกขั้นตอนแรกใหม่ก่อน | ไม่มีลูกศรหายเงียบ |

**input ชนิดอื่น:** ข้อมูลปัจจุบันไม่มี แต่ร่างจาก LLM อาจมี ฟอร์มแก้ข้อความและขั้นถัดไปได้ โดยคง `pattern` และ `store_as` เดิม และเพิ่มชนิดอื่นใหม่ได้ผ่านโหมด JSON

**หลักการ:** ฟอร์มกันความผิดพลาดที่พบบ่อย แต่ผลตรวจสุดท้ายยังมาจาก backend เสมอ

#### ข้อความ error ภาษาคน

ข้อความจาก validator เขียนเชิงเทคนิค เช่น "next ชี้ไป 'n9'" จึงเพิ่ม `lib/flowIssueLabels.ts` แปลงจาก `code` เป็นประโยคที่บอกวิธีแก้ · ถ้าไม่รู้จัก code ให้แสดงข้อความจาก backend · รหัสเดิมแสดงตัวเล็กไว้แจ้งผู้พัฒนา

| code | ข้อความในฟอร์ม |
|---|---|
| `E_MISSING_FIELD` | ขั้นตอนนี้ยังกรอกไม่ครบ ตรวจช่องที่ว่าง |
| `E_EDGE_TARGET_MISSING` | ปลายทางของขั้นตอนนี้ไม่มีแล้ว เลือกขั้นตอนถัดไปใหม่ |
| `E_UNREACHABLE` | ผู้ใช้เดินมาไม่ถึงขั้นตอนนี้ ให้โยงจากขั้นตอนอื่นหรือลบออก |
| `E_NO_EXIT` | จากขั้นตอนนี้ไปไม่ถึงจุดจบ ให้โยงไปขั้นตอนจบ |
| `E_NO_TERMINAL` | แผนผังนี้ไม่มีขั้นตอนจบ เพิ่ม "จบ: แก้ได้" หรือ "จบ: ส่งต่อช่าง" |
| `E_ENTRY_MISSING` | ยังไม่ได้เลือกขั้นตอนแรก |
| `E_VAR_UNDEFINED`, `E_VAR_NOT_GUARANTEED` | ข้อความนี้ใช้หมายเลขรุ่น แต่ผู้ใช้อาจยังไม่ได้กรอก ให้เพิ่มขั้นตอน "ถามหมายเลขรุ่น" ก่อนหน้านี้ |
| `E_PATH_TOO_LONG` | เส้นทางยาวเกินไป ควรแบ่งหรือลดขั้นตอน |
| `E_TOO_LONG` | ข้อความยาวเกินที่กำหนด |
| `E_PAGE_RANGE` | หน้าคู่มือไม่ถูกต้อง หน้าแรกต้องไม่มากกว่าหน้าสุดท้าย |
| `W_STATE_RISK` | ข้อความพูดถึงเรื่องที่อาจอันตราย ควรติ๊ก "ต้องยืนยันความปลอดภัย" |
| `W_NO_ESCALATION` | ไม่มีขั้นตอนส่งต่อช่าง ผู้ใช้ที่แก้ไม่ได้จะไม่มีทางไปต่อ |

#### Component

| ใหม่ | หน้าที่ |
|---|---|
| `components/admin/flows/FlowRow.tsx` | แถวในรายการ |
| `components/admin/flows/FlowStructure.tsx` | เส้นทาง + รายการสถานะ (แยกจาก `DraftFlowCard`) |
| `components/admin/flows/FlowMetaFields.tsx` | ฟิลด์ระดับ flow |
| `components/admin/flows/StateEditorCard.tsx` | ฟอร์ม 1 ขั้นตอน แสดงฟิลด์ตามชนิด |
| `components/admin/flows/StateTargetSelect.tsx` | dropdown เลือกเป้าหมายลูกศร |
| `components/admin/flows/FlowConfirmPanel.tsx` | แสดงเหตุที่ต้องกด "บันทึกต่อ" |
| `components/admin/flows/FlowConflictNotice.tsx` | แจ้งว่า admin คนอื่นบันทึกไปก่อน |
| `components/admin/JsonEditor.tsx` | แยกจาก `DraftJsonEditor` ใช้ร่วมกันทั้งสองหน้า (โหมดเสริม) |
| `components/admin/flows/FlowDiagram.tsx` | แผนภาพ Mermaid (step สุดท้าย) |

| ไฟล์ logic ใหม่ | หน้าที่ |
|---|---|
| `api/flows.ts` | เรียก 6 endpoint |
| `lib/flowEditor.ts` | ฟังก์ชันล้วน: `addState`, `removeState`, `moveState`, `nextStateId`, `cleanForType`, ค่าสำเร็จรูปของ "ถามหมายเลขรุ่น" |
| `lib/flowIssueLabels.ts` | แปลง code เป็นข้อความภาษาคน |
| `lib/adminFlowParams.ts` | แปลงตัวกรองกับ URL ตามแบบ `adminParams.ts` |
| `lib/flowDiagram.ts` | แปลงผังเป็นข้อความ Mermaid (step สุดท้าย) |

| แก้ของเดิม | สิ่งที่เปลี่ยน |
|---|---|
| `api/http.ts` | `ApiError` เก็บ `details` |
| `api/types.ts` | ชนิดใหม่ · `DraftState.author_note?` |
| `lib/errors.ts` | ข้อความของทุก code ใหม่ (ไม่อย่างนั้น `describeError` คืน `UNKNOWN_ERROR`) |
| `ValidationReportPanel.tsx` | เพิ่ม prop กำหนดข้อความและตัวแปลงข้อความ ส่วนหน้าร่างใช้ค่าเดิม |
| `DeleteConfirm.tsx` | เพิ่ม prop ข้อความ ส่วนหน้าประวัติใช้ค่าเดิม |
| `AdminDraftReviewPage.tsx:65` | เปลี่ยนจาก "ลบได้ด้วย SQL" เป็นลิงก์ไปหน้าจัดการ |
| `HistoryDetailPage.tsx` | แสดงหมายเหตุ "ผังถูกแก้หลังการตรวจนี้" · ซ่อนปุ่มตรวจซ้ำถ้าผังถูกลบ |

#### React Query

```ts
['admin', identity, 'flows', 'list', params]
['admin', identity, 'flows', 'detail', flowId]
```

| Mutation | เมื่อสำเร็จ |
|---|---|
| ตรวจ (`validate`) | ไม่ invalidate เก็บผลใน state ของหน้า |
| บันทึก | `setQueryData` detail · invalidate list, `['flows']`, `['manuals']`, `['admin', identity, 'summary']`, `['history', identity]` |
| ลบ, กู้คืน | invalidate `['admin', identity, 'flows']`, `['flows']`, `['manuals']`, `['history', identity]` |
| `usePublishDraft` เดิม | เพิ่ม invalidate `['admin', identity, 'flows']` |

**หน้าแก้กับ admin หลายคน:** ค่าในฟอร์มและ `expectedRevision` ตั้งจากการโหลดครั้งแรกเท่านั้น การ refetch ภายหลังต้องไม่ทับงานที่กำลังแก้ และ React Query ที่ไม่ refetch ตอนสลับหน้าต่าง (`App.tsx:25`) ช่วยตรงนี้อยู่แล้ว

**เบราว์เซอร์ของผู้ใช้คนอื่น:** `['flows']` เป็น `staleTime: Infinity` ผู้ใช้อาจเห็นอาการที่ถูกลบจนกว่าจะรีเฟรช เมื่อกดจะได้ `FLOW_NOT_FOUND` พร้อมลิงก์เลือกใหม่ ซึ่งมีอยู่แล้วและยอมรับได้

#### การแสดงผลตอบกลับจาก backend

| ผล | สิ่งที่หน้าเว็บทำ |
|---|---|
| 400 `FLOW_INVALID` | เก็บ `details.validation` · ขึ้นข้อความภาษาคนใต้แต่ละขั้นตอนด้วย `issuesForState` + `flowIssueLabels` พร้อมขอบแดง · `issuesForFlow` แสดงเหนือฟิลด์ของ flow · สรุปด้านบนมีลิงก์ไปที่ `#state-{stateId}` · **ค่าในฟอร์มไม่หาย** |
| 409 `FLOW_CONFIRM_REQUIRED` | `FlowConfirmPanel` แสดงเหตุเป็นประโยค และปุ่ม "บันทึกต่อ" (ส่ง `confirmImpact: true`) กับ "กลับไปแก้" |
| 409 `FLOW_EDIT_CONFLICT` | `FlowConflictNotice`: "Admin B บันทึกผังนี้ไปแล้วเมื่อ 10:02" พร้อมปุ่ม "เปิดฉบับล่าสุดในแท็บใหม่" กับ "โหลดฉบับล่าสุด (สิ่งที่คุณแก้จะหาย)" · ระบบไม่รวมงานให้อัตโนมัติ |
| 409 `FLOW_DELETED` | "Admin B ลบผังนี้เมื่อ 10:02" พร้อมลิงก์กลับไปรายการ |
| 200 มีคำเตือนเหลือ | แจ้งว่าบันทึกแล้ว และแสดงคำเตือนภาษาคน |
| 200 `searchIndex.indexed = false` | แจ้งว่าการค้นด้วยข้อความจะอัปเดตหลังรีสตาร์ต |

frontend **ไม่ตรวจกฎของผังเอง** ผลตรวจมาจาก backend เหมือนหน้าร่าง

#### การยืนยันก่อนลบ

ใช้ `DeleteConfirm` เป็นกล่องในหน้า ไม่ใช้ `window.confirm` การกดลบต้องยืนยันอีกครั้งเหมือนหน้าประวัติเดิม

> ซ่อนผัง "ไมโครเวฟไม่ทำงาน" จากผู้ใช้? ผู้ใช้ 1 คนที่กำลังตรวจอยู่จะเดินต่อจนจบได้ ประวัติและสถิติเดิมไม่หาย กู้คืนได้จากตัวกรอง "ลบแล้ว"

#### Wireframe

**`/admin/flows`**

```text
ผู้ดูแลระบบ
[สถิติ] [ความเห็น] [ร่างแผนผัง] [แผนผังที่เผยแพร่*]

ค้นหา [___________]  เครื่อง [ทั้งหมด ▾]  คู่มือ [ทั้งหมด ▾]  สถานะ [ใช้งานอยู่ ▾]

พบ 722 รายการ
────────────────────────────────────────────────────────
ไมโครเวฟไม่ทำงาน                               [ใช้งานอยู่]
Microwave · Samsung GE83MDT · 8 ขั้นตอน
ใช้ไป 12 ครั้ง · กำลังเดินอยู่ 1 · แก้ล่าสุด 1 พ.ย. 2569 โดย Admin B
────────────────────────────────────────────────────────
ประตูเปิดไม่ได้                                  [ลบแล้ว]
Microwave · Samsung GE83MDT · 6 ขั้นตอน · ลบเมื่อ 30 ต.ค. 2569 โดย Admin A
────────────────────────────────────────────────────────
                       ← ก่อนหน้า  หน้า 1/37  ถัดไป →
```

**`/admin/flows/:id`**

```text
← กลับไปรายการ
ไมโครเวฟไม่ทำงาน                         [ใช้งานอยู่] ฉบับที่ 3
The microwave does not start
samsung_ge83mdt_um_not_start · Samsung GE83MDT · คู่มือ xxx.pdf หน้า 37–37
ความรุนแรง ปานกลาง · ความยาก ง่าย
คำที่ผู้ใช้อาจพิมพ์: เปิดไม่ติด · กดเริ่มไม่ทำงาน
การใช้งาน: 12 ครั้ง · จบ 10 · ความเห็น 4 · กำลังเดินอยู่ 1
แก้ล่าสุด 1 พ.ย. 2569 10:02 โดย Admin B

[แก้ไข]  [ลบ (ซ่อนจากผู้ใช้)]

เส้นทาง (▶ จุดเริ่ม · ⚠ ยืนยันความปลอดภัย)
  ▶ n1 · คำถาม ใช่/ไม่ใช่ — ใช่ → n2 · ไม่ใช่ → n3
    n2 · ขั้นตอน ⚠ — ถัดไป → n2v
    ...
ทุกขั้นตอน
  n1  [คำถาม ใช่/ไม่ใช่]  ข้อความ...  ใช่ → n2 · ไม่ใช่ → n3
      หมายเหตุที่มา: ...
  n2  [ขั้นตอน] [⚠ ต้องยืนยัน] ข้อความ... คำเตือน: ...   กำลังอยู่ที่นี่ 1 คน

▸ ดูแผนภาพ   (step สุดท้าย: เปิดแล้วจึงโหลด Mermaid)
```

**`/admin/flows/:id/edit`**

```text
← ยกเลิก
แก้ไขแผนผัง: ไมโครเวฟไม่ทำงาน
⚠ บันทึกแล้วมีผลกับผู้ใช้ทันที                  ▸ โหมดขั้นสูง (JSON)

[ผลการตรวจ: ต้องแก้ 1 ข้อ · ควรดู 2 ข้อ · แต่ละข้อลิงก์ไปยังขั้นตอน]

ข้อมูลอาการ
  อาการ (อังกฤษ) [_______]   อาการ (ไทย) [_______]
  คำที่ผู้ใช้อาจพิมพ์ [___] [+]
  ความรุนแรง [▾]  ความยาก [▾]  หน้าคู่มือ [37]–[37]
  ขั้นตอนแรก [ข้อ 1 · คำถาม: ประตูปิดสนิทหรือไม่… ▾]

ขั้นตอน
┌ ข้อ 1 · คำถาม ใช่/ไม่ใช่  ▶ ขั้นตอนแรก      [↑][↓][ลบ] ┐
│ คำถาม [_____________________________________________]  │
│ ถ้าใช่ไปที่ [ข้อ 2 · ขั้นตอน: ปิดประตู… ▾]              │
│ ถ้าไม่ใช่ไปที่ [ข้อ 3 · … ▾]                            │
│ หมายเหตุที่มา (ผู้ใช้ไม่เห็น) [____]                     │
└───────────────────────────────────────────────────────┘
┌ ข้อ 2 · ขั้นตอนให้ทำ    กำลังอยู่ที่นี่ 1 คน [↑][↓][ลบ] ┐
│ ✗ ปลายทางของขั้นตอนนี้ไม่มีแล้ว เลือกขั้นตอนถัดไปใหม่    │
│ ข้อความ [__________]  ทำเสร็จแล้วไปที่ [ยังไม่ได้เลือก ▾] │
│ [x] ต้องยืนยันความปลอดภัย  คำเตือน [__________]         │
└───────────────────────────────────────────────────────┘
เพิ่มขั้นตอน: [คำถาม] [ขั้นตอนให้ทำ] [ถามหมายเลขรุ่น] [จบ: แก้ได้] [จบ: ส่งต่อช่าง]

[ตรวจโดยไม่บันทึก]  [บันทึก]
```

**เมื่อการบันทึกกระทบผู้ใช้** (แสดงแทนที่ปุ่มบันทึก เฉพาะกรณีนี้)

```text
การบันทึกนี้จะมีผลดังนี้
• ลบ "ข้อ 5" ซึ่งมีผู้ใช้กำลังอยู่ 1 คน คนนั้นต้องเริ่มตรวจใหม่
• เอาการยืนยันความปลอดภัยออกจาก "ข้อ 2"
• ประวัติที่จบที่ข้อ 5 จำนวน 3 รายการ จะแสดงว่าผังเปลี่ยน

[บันทึกต่อ]  [กลับไปแก้]
```

### 3.6 ลำดับการทำงาน

#### แก้และบันทึก

1. admin เปิดหน้าแก้ → `GET /admin/flows/:id` → ได้เนื้อหาพร้อม `revision = 3`
2. admin แก้ในฟอร์ม และกด "ตรวจโดยไม่บันทึก" ได้ถ้าต้องการ → `POST /validate` → แสดงผลการตรวจและผลกระทบ
3. admin กดบันทึก → `PUT` พร้อม `expectedRevision: 3`, `confirmImpact: false`
4. `requireAuth`, `requireAdmin` ผ่าน → `parseUpdateBody` ตรวจรูปร่าง
5. เริ่ม transaction → `SELECT ... FROM flows WHERE flow_id = ? FOR UPDATE`
6. ไม่พบได้ 404 · ลบแล้วได้ 409 · revision ไม่ตรงได้ 409 `FLOW_EDIT_CONFLICT`
7. อ่านสถานะเดิม → `validateManual(manual, null)` + `flow-diff` → error ได้ 400
8. มี `confirmReasons` และ `confirmImpact` เป็น false → 409 `FLOW_CONFIRM_REQUIRED` → หน้าเว็บแสดงผลกระทบ → admin กด "บันทึกต่อ" ส่งซ้ำด้วย `confirmImpact: true`
9. `INSERT flow_revisions` (`action = 'edit'`, เนื้อหาเก่า, `acted_by`) → `UPDATE flows` (`revision + 1`, `edited_at = NOW()`, `edited_by`)
10. `DELETE FROM states` (เส้นเชื่อมหายตาม CASCADE) → `INSERT states` → `INSERT state_transitions` → COMMIT
11. `flows.reload()` (เข้าคิว) → `addFlows([id])` → ทำ session บนสถานะที่ลบให้หมดอายุ
12. ตอบ 200 → frontend อัปเดต cache แสดงว่าบันทึกแล้วและคำเตือนที่เหลือ

ถ้าล้มเหลวระหว่างข้อ 5–10 จะ rollback ทั้งหมด

#### ลบ

1. หน้ารายละเอียดเปิดกล่องยืนยัน แสดงจำนวนคนที่กำลังเดินอยู่
2. `DELETE /admin/flows/:id`
3. transaction: `UPDATE flows SET deleted_at = NOW(), deleted_by = ? WHERE flow_id = ? AND deleted_at IS NULL`
4. `affectedRows = 0` → แยกกรณี 404 กับ 409 พร้อมบอกว่าใครลบไปแล้ว
5. `INSERT flow_revisions` (`action = 'delete'`) → `UPDATE manuals SET flow_count = (จำนวนผังที่ยังไม่ลบ)` → COMMIT
6. `flows.reload()` → `removeFlows([id])` → 204
7. ผล: ไม่อยู่ใน `GET /execution/flows` และค้นหาไม่เจอ · เริ่มใหม่ได้ 404 · session เดิมเดินต่อได้ · ประวัติเปิดได้ครบ · dashboard ยังมีชื่ออาการและ outcome · ไม่มีการแตะ `sessions`, `session_history`, `session_feedback`

#### ผู้ใช้กำลังเดินผังขณะ admin แก้

| เวลา | ผู้ใช้ | admin / ระบบ |
|---|---|---|
| t0 | อยู่ที่ `n2` (ผังรุ่น 3) | |
| t1 | | บันทึก: แก้ข้อความ `n3` และลบ `n5` พร้อมกด "บันทึกต่อ" |
| t2 | กด "ถัดไป": เซิร์ฟเวอร์ยังใช้ผังเดิม ไป `n3` ข้อความเก่า | COMMIT แล้ว reload ยังไม่จบ |
| t3 | | reload สลับ Map ในครั้งเดียว ไม่มีช่วงผังครึ่ง ๆ กลาง ๆ |
| t4 | ขั้นถัดไปอ่านผังรุ่น 4 | หมดอายุ session ที่อยู่ `n5` |
| t5a | ถ้าไม่ได้อยู่ `n5`: เดินต่อปกติ | |
| t5b | ถ้าอยู่ `n5`: คำขอถัดไปได้ 404 `SESSION_NOT_FOUND` พร้อมลิงก์เลือกอาการใหม่ | |
| t6 | จบแล้วเปิดประวัติ: ถ้าทางเดิมยังเดินซ้ำได้ แสดงขั้นตอนพร้อมหมายเหตุ "ผังถูกแก้หลังการตรวจนี้" · ถ้าไม่ได้ แสดงข้อความ "ผังเปลี่ยน" | |

กรณีแทรกระหว่าง t2–t4 ผู้ใช้อาจได้ `FLOW_STATE_MISSING` ซึ่งหน้าเว็บมีทางออกอยู่แล้ว

#### Admin สองคนแก้ผังเดียวกัน

| เวลา | Admin A | Admin B | ระบบ |
|---|---|---|---|
| t0 | เปิดหน้าแก้ ได้ `revision = 3` | เปิดหน้าแก้ ได้ `revision = 3` | |
| t1 | กดบันทึก | | ล็อกแถว → `revision` เป็น 4 · `edited_by` = A |
| t2 | เห็นว่าสำเร็จ | กดบันทึก (ส่ง `expectedRevision: 3`) | รอจนล็อกของ A หมด → พบ 3 ≠ 4 → 409 |
| t3 | | เห็น "Admin A บันทึกไปแล้วเมื่อ 10:02" งานในฟอร์มยังอยู่ | ไม่มีอะไรถูกทับ |
| t4 | | เปิดฉบับล่าสุดในแท็บใหม่ เทียบแล้วโหลดฉบับล่าสุดและแก้ซ้ำ | `flow_revisions` มีแถวของทั้งคู่เมื่อ B บันทึกสำเร็จ |

**ถ้าแก้คนละผังพร้อมกัน:** ไม่ชนกัน transaction ล็อกคนละแถว และ reload เข้าคิวตามลำดับ

**ถ้า A ลบระหว่างที่ B แก้:** B ได้ 409 `FLOW_DELETED` พร้อมชื่อผู้ลบ

### 3.7 แผนทดสอบ (ด้วยมือ ตามข้อ O2)

**ไม่เพิ่มไฟล์ test** ทุกข้อทำด้วยมือบน DB ทดสอบแยก · config ของ jest และ vitest คงไว้ตามเดิม

#### เตรียม

- **DB ทดสอบคือ `fixbot_admin_test` บน MySQL ในเครื่อง** ยังไม่แตะ Aiven
- **ห้ามใช้ `backend/.env` ตรง ๆ เพราะไม่ได้ชี้ localhost** · ใช้ไฟล์ `C:\Users\SPS\Desktop\499\fixbot-admin-test.env` ซึ่งอยู่นอก repo และตั้ง `$env:DOTENV_CONFIG_PATH` ให้ชี้ไฟล์นี้ในทุกหน้าต่าง PowerShell ที่รัน backend หรือสคริปต์ · การตั้ง `$env:DB_NAME` อย่างเดียวไม่พอ เพราะ `DB_HOST` จะยังมาจาก `.env`
- `node scripts/backup-flow-tables.js` ก่อนเริ่ม ถ้าใช้ DB ที่มีข้อมูล
- มีบัญชี **admin 2 คนที่ชื่อต่างกัน** และบัญชี user 1 คน
- ใช้ `manual_id` ขึ้นต้น `demo_` สำหรับผังทดสอบ
- เปิดหน้าต่างปกติ (Admin A), โปรไฟล์อื่น (Admin B), incognito (ผู้ใช้)

#### ตรวจ backend ด้วยคำสั่ง

เรียกผ่าน PowerShell หรือคำสั่งครั้งเดียวแบบไม่สร้างไฟล์ในโปรเจกต์ และแนบผลจริงมาในรายงาน

| ID | ตรวจอะไร | ผลที่ต้องได้ |
|---|---|---|
| C1 | รัน validator โหมด `pages = null` กับทุกผังที่ seed ได้ใน `data/manuals` | ผ่านครบ 722 ผัง · ไม่มี `W_CYCLE` จาก `on_invalid` ชี้ตัวเอง |
| C2 | รัน validator ทางร่างโดยไม่มี `source_page` | ยังได้ `E_SOURCE_PAGE_MISSING` **(ทางเดิมห้ามถอย)** |
| C3 | ไม่มี token · token role user เรียกทุก endpoint | 401 · 403 |
| C4 | `PUT` รูปร่างผิด | 400 `INVALID_FLOW_REQUEST` |
| C5 | `PUT` ลูกศรชี้สถานะที่ไม่มี | 400 `FLOW_INVALID` · `details.validation.errors[].stateId` ถูกต้อง |
| C6 | `PUT` เปลี่ยนชนิดสถานะเดิม | 400 มี `E_STATE_TYPE_CHANGED` |
| C7 | `PUT` เอา safety ออก ไม่ส่ง `confirmImpact` แล้วส่งซ้ำพร้อม flag | 409 `FLOW_CONFIRM_REQUIRED` แล้ว 200 |
| C8 | `PUT` `expectedRevision` เก่า | 409 พร้อม `editedByName` |
| C9 | `PUT` ที่มีคำเตือนทั่วไปอย่างเดียว | 200 ทันที คำเตือนอยู่ใน `detail.validation` |
| C10 | ใน MySQL หลัง `PUT`: `author_note` | ค่าเดิมยังอยู่ |
| C11 | ใน MySQL หลังแก้ ลบ กู้คืน | `flow_revisions` มีครบ 3 แถว พร้อม `acted_by` ถูกคน · `edited_by` ถูกคน · `deleted_by` ถูกคนก่อนกู้คืน และเป็น NULL หลังกู้คืน |
| C12 | `DELETE` ซ้ำ · `restore` ผังที่ไม่ได้ลบ · ผังที่ไม่มี | 409 · 409 · 404 |
| C13 | `POST /validate` | ไม่มีการเปลี่ยนแปลงใน DB และ `flow_revisions` |
| C14 | error เดิม เช่น `GET /execution/sessions/ไม่มีจริง` | body เหมือนเดิมทุกตัวอักษร ไม่มี `details` |
| C15 | ทำให้ migration 007, 008 รันบน DB เดิมและ DB ใหม่ | ผ่านทั้งคู่ · seed และ publish ใช้งานได้ |
| C16 | ส่ง `PUT` สองผังพร้อมกันด้วย `Start-Job` หลายรอบ | ทั้งสองผังเป็นเนื้อหาใหม่ · ค้นหาเจอทั้งคู่ · ไม่มี error จาก `search` |
| C17 | จับเวลา `reload()` | รายงานตัวเลข ถ้าช้าเกินไปค่อยตัดสินใจเพิ่มการโหลดรายผัง |
| C18 | รัน `seed-admin.js` โดยไม่มี `ADMIN_DISPLAY_NAME` และโดยค่าว่าง | จบด้วย exit code ไม่เป็น 0 พร้อมข้อความชัดเจน · ไม่เชื่อมต่อ DB · `users` ไม่เปลี่ยน |
| C19 | รัน `seed-admin.js` ด้วยอีเมลใหม่แต่ชื่อซ้ำ admin เดิม · ด้วยอีเมลเดิมแต่ชื่อใหม่ | ชื่อซ้ำ: exit code ไม่เป็น 0 และไม่สร้างแถว · อีเมลเดิม: ชื่อในตารางไม่เปลี่ยน |

#### Checklist ในเบราว์เซอร์

| # | ทำอะไร | ต้องเห็น |
|---|---|---|
| 1 | **สร้าง:** อัปโหลด → ตรวจ → เผยแพร่ตามทางเดิม | เผยแพร่สำเร็จ ทางเดิมไม่พัง |
| 2 | **ดู:** ไปแท็บ "แผนผังที่เผยแพร่" ค้นชื่อผัง | เจอ · จำนวนขั้นตอนถูกต้อง |
| 3 | เปิดรายละเอียด | เห็นเส้นทาง ขั้นตอน คำเตือนความปลอดภัยครบ |
| 4 | เปิดผัง seed ที่มี `author_note` | เห็นหมายเหตุที่มา |
| 5 | ผู้ใช้: เริ่มตรวจผังนี้แล้วหยุดกลางทาง | อยู่ที่ขั้นตอนกลาง |
| 6 | **แก้:** Admin A แก้ข้อความขั้นตอนถัดไป แล้วกดบันทึกคลิกเดียว | สำเร็จ · **ไม่มีช่องติ๊ก** · แสดง "แก้ล่าสุดโดย Admin A" |
| 7 | **เดินผัง:** ผู้ใช้กดถัดไป | **เห็นข้อความใหม่โดยไม่รีสตาร์ต** |
| 8 | แก้ `entry_symptom_th` | ค้นด้วยคำใหม่เจอ · คำเก่าที่เอาออกไม่เจอ |
| 9 | **ฟอร์ม:** เพิ่มขั้นตอนทุกชนิด โยงเส้นด้วย dropdown โดยไม่พิมพ์ id หรือ regex | บันทึกสำเร็จ · ผู้ใช้เดินผ่านได้ถึงจบ · ฟอร์มเตือนให้บันทึกหมายเหตุที่มา แต่ไม่บังคับ |
| 10 | เพิ่ม "ถามหมายเลขรุ่น" แล้วแทรกหมายเลขรุ่นในขั้นจบ | ผู้ใช้เห็นค่าที่กรอกแทนตัวแปร |
| 11 | ลบขั้นตอนที่ถูกชี้อยู่ แล้วกด "ตรวจโดยไม่บันทึก" | ลูกศรเป็น "ยังไม่ได้เลือก" · error ภาษาคนใต้ขั้นตอนนั้น · **ค่าที่แก้ไม่หาย** · ไม่มีอะไรเปลี่ยนใน DB |
| 12 | ลบขั้นตอน "ถามหมายเลขรุ่น" ที่ข้อความอื่นใช้ค่าอยู่ | ข้อความภาษาคนบอกให้เพิ่มคืน |
| 13 | เอาความปลอดภัยออก กดบันทึก | เห็นผลกระทบและปุ่ม "บันทึกต่อ" · "กลับไปแก้" แล้วค่าไม่หาย |
| 14 | ลบขั้นตอนที่ผู้ใช้กำลังอยู่ กด "บันทึกต่อ" | ผู้ใช้ได้หน้าไม่พบการตรวจ พร้อมลิงก์เริ่มใหม่ ไม่ใช่ 500 |
| 15 | **หลาย admin:** A และ B เปิดผังเดียวกัน A บันทึกก่อน แล้ว B บันทึก | B เห็น "Admin A บันทึกไปแล้ว" · งานของ B ในฟอร์มไม่หาย · ของ A ไม่ถูกทับ |
| 16 | A และ B แก้คนละผังพร้อมกัน | สำเร็จทั้งคู่ |
| 17 | A ลบผังที่ B เปิดแก้อยู่ แล้ว B บันทึก | B เห็นว่า Admin A ลบแล้ว |
| 18 | ผู้ใช้เดินผังจบ และให้ feedback | สำเร็จ |
| 19 | ดู dashboard จดตัวเลข | บันทึกค่าก่อนลบ |
| 20 | **ลบ:** admin ลบผัง | หายจากรายการ ค้นไม่เจอ · ตัวกรอง "ลบแล้ว" แสดงชื่อผู้ลบ |
| 21 | ดู dashboard อีกครั้ง | ตัวเลขเท่าเดิม ไม่เพิ่ม `unknown` |
| 22 | **ประวัติ:** ผู้ใช้เปิดประวัติของผังที่ลบ | **เปิดได้ เห็นขั้นตอนและ feedback** ไม่มีปุ่มตรวจซ้ำ |
| 23 | เริ่ม session ค้างก่อนลบ แล้วเดินต่อหลังลบ | เดินจนจบได้ |
| 24 | อัปโหลดร่างด้วย `manual_id` เดิม | ถูกปฏิเสธ |
| 25 | กู้คืน | กลับมาในรายการ ค้นหาเจอ เริ่มตรวจได้ |
| 26 | รีสตาร์ต backend | สถานะลบและเนื้อหาที่แก้ยังคงเดิม |
| 27 | เข้า `/admin/flows` ด้วยบัญชี user และ guest | หน้าไม่มีสิทธิ์ และหน้า login ตามลำดับ |
| 28 | ทดลองกับ `SYMPTOM_SEARCH_ENABLED=false` | บันทึกสำเร็จและแจ้งว่าดัชนียังไม่อัปเดต |
| 29 | `npm run seed` กับคู่มือที่มีผังถูกแก้ | ถูกปฏิเสธ ถ้าไม่ใส่ `--force` |
| 30 | **JSON:** เปิดโหมดขั้นสูง แก้ค่า แล้วสลับกลับฟอร์ม | ข้อมูลตรงกัน · JSON พังแล้วสลับไม่ได้และมีข้อความบอก |
| 31 | **Mermaid:** เปิด "ดูแผนภาพ" ในผังใหญ่สุด (25 ขั้นตอน) และผังที่มีเครื่องหมายคำพูดในข้อความ | แผนภาพแสดงถูกต้อง · ถ้าวาดไม่ได้ยังเห็นรายการปกติ |
| 32 | **Mermaid:** เปิดหน้าผู้ใช้ทั่วไปแล้วดูแท็บ Network | ไม่โหลดไฟล์ของ Mermaid |

#### ข้อจำกัดของการทดสอบด้วยมือ

- **ไม่มีตัวกันการถอยอัตโนมัติ:** ทุกครั้งที่แก้ `flow-validator.ts`, `flow.repository.ts`, `toDbRows` ต้องไล่ C1, C2 และ checklist ข้อ 1 ซ้ำ
- **การชนกันของเวลาตรวจด้วยมือได้ไม่แน่นอน:** คิว reload และการเขียน `flowInfo` ยืนยันได้จากการอ่านโค้ด และ C16 ซึ่งเป็นการลองหลายรอบ ไม่ใช่การพิสูจน์

### 3.8 ความเสี่ยง

| ความเสี่ยง | ระดับ | การรับมือ |
|---|---|---|
| ข้อมูล `author_note` หาย | สูง | แก้ `toDbRows` + C10 + ส่งผ่าน API รอบเดียวกัน |
| แก้ validator แล้วทางร่างเปลี่ยน | สูง | C2 + checklist ข้อ 1 + พฤติกรรมเปลี่ยนเฉพาะ `pages = null` ยกเว้น `W_CYCLE` ที่ตั้งใจ |
| ผังเสียเข้า DB จน reload หรือบูตล้ม | สูง | validator ต้องเข้มกว่า `buildFlow` · C1 + `FLOW_RELOAD_FAILED` · ของเดิมในหน่วยความจำยังใช้ได้ |
| เนื้อหาความปลอดภัยถูกเอาออกโดยไม่ตั้งใจ | สูง | `SAFETY_REMOVED` ต้องกด "บันทึกต่อ" + `flow_revisions` |
| **ไม่มี test อัตโนมัติ** | สูง (ยอมรับตามข้อ O2) | ทำตามข้อจำกัดใน 3.7 และทำทีละ step เล็ก ๆ |
| **บันทึกคลิกเดียวมีผลกับผู้ใช้ทันที** | กลาง (ยอมรับตามข้อ M) | ป้ายเตือนบนหน้า · ปุ่มตรวจโดยไม่บันทึก · `flow_revisions` ย้อนได้ · คำเตือนทั่วไปรวมถึง `W_STATE_RISK` ไม่ขวาง ต้องอาศัยการอ่าน |
| admin ใช้งานยากจนแก้ผิดซ้ำ | กลาง | ฟอร์มซ่อนรายละเอียดเทคนิค · ข้อความภาษาคน · ค่าสำเร็จรูป · checklist ข้อ 9–12 |
| admin หลายคนงานหาย | กลาง | `revision` + `FOR UPDATE` + งานในฟอร์มไม่หายเมื่อชนกัน · ระบบไม่รวมงานให้ |
| reload หรือ `flowInfo` ชนกันเมื่อบันทึกพร้อมกัน | กลาง | คิว reload + แก้การเขียน `flowInfo` |
| admin ชื่อเหมือนกันจนแยกผู้แก้ไม่ออก | กลาง | step 1.1 ตรวจของเดิม · step 1.2 บังคับระบุชื่อ · SQL ใน 3.1 ดูอีเมลได้ |
| **คำสั่งทดสอบวิ่งไป DB ภายนอก** | สูง | `backend/.env` ไม่ได้ชี้ localhost · ใช้ `DOTENV_CONFIG_PATH` ตาม 3.7 · คำสั่ง one-off มีด่านปฏิเสธถ้าไม่ใช่ localhost + `fixbot_admin_test` · `run-migrations.js` พิมพ์ชื่อ DB และ host ให้ตรวจ |
| **backend ไม่ขึ้นบน DB ที่ยังไม่ migrate** | สูง | ตั้งแต่ step 3.4 `FlowRepository` อ่านคอลัมน์ใหม่ · ต้อง migrate ก่อนรันโค้ดทุก DB รวม `fixbot_eval` และ Aiven ตามลำดับใน `docs/ops/DEPLOY.md:37` |
| ลืมกรองผังที่ลบบางจุด | กลาง | กรองที่ `FlowRepository` ที่เดียว + checklist ข้อ 20, 24 |
| seed ทับงานแก้ | กลาง | ด่าน L2 + checklist ข้อ 29 |
| ประวัติไม่ใช่ภาพ ณ วันตรวจ | กลาง (ยอมรับ) | `replayReaches` + หมายเหตุ + พูดตรง ๆ กับกรรมการ · ทางขยายคือ B3 |
| dashboard นับ `unknown` เมื่อลบสถานะท้าย | กลาง (ยอมรับ) | หน้าแก้แจ้งจำนวนประวัติที่กระทบก่อนบันทึก |
| Mermaid หนักหรือ API เปลี่ยน | กลาง | ทำเป็น step สุดท้าย · โหลดแบบ lazy · ล้มเหลวแล้วรายการยังใช้ได้ · ตัดออกได้โดยไม่กระทบฟีเจอร์ |
| ข้อความจาก DB ทำให้ Mermaid พังหรือแทรกโค้ด | กลาง | `lib/flowDiagram.ts` ใช้ id แทนข้อความ escape ป้ายกำกับ · `securityLevel: 'strict'` |
| ร่างใน `flow_drafts` เป็นสำเนาเก่า | ต่ำ | หน้าร่างที่ published ลิงก์ไปหน้าจัดการ และบอกว่าตัวจริงอยู่ที่นั่น |
| session ชะงักระหว่าง commit กับ reload | ต่ำ | แจ้ง `FLOW_STATE_MISSING` พร้อมทางออก |
| FK ตอน `DELETE states` ชน | ต่ำ | ไม่มี FK จาก sessions ไป states · CASCADE ไป transitions ตามที่ `seed-flows.js:191` ใช้อยู่ |
| admin ใส่ regex ที่ช้ามาก | ต่ำ | ฟอร์มไม่ให้พิมพ์ regex · โหมด JSON มีเพดานความยาว 200 · ยังไม่กันเพิ่ม |

---

## Part 4 — แผนลงมือ

### ข้อกำหนดสำหรับเซสชันที่ลงมือ

- **ผู้ใช้ commit และ push เอง**
- **ไม่อ่านค่าใน `.env`**
- **`package.json` และ lock:** แตะได้เฉพาะ `frontend` ใน step 7.1 สำหรับ `mermaid` ซึ่งได้รับอนุมัติแล้ว · ส่วนอื่นไม่แตะ
- **ไม่เพิ่มไฟล์ test** · การตรวจแต่ละ step ทำด้วยมือและรายงานผลจริง
- **Branch และ DB:** ทำทุกอย่างบน branch `admin-flow-management` และ DB ทดสอบ `fixbot_admin_test` · **ไม่แตะ `main` และ Aiven จนกว่าเจ้าของโปรเจกต์จะสั่ง**
- **ทดสอบ DB:** ใช้ `fixbot_admin_test` ในเครื่องตามวิธีใน 3.7 · ยังไม่แตะ Aiven
- **ก่อน migrate หรือ deploy บน DB จริงต้องรู้:** ชื่อ DB จริง และยังใช้ร่วมกับ FixStep หรือไม่ (`docs/ops/DEPLOY.md:36`) · ยังรอคำตอบจากเจ้าของโปรเจกต์
- **`docs/reference/`:** ถามก่อนแก้
- อธิบายภาษาไทยแบบง่าย และคงรูปแบบโค้ดเดิม · code, identifier และ comment ที่เขียนใหม่เป็นภาษาอังกฤษ
- ไม่ลบ `TODO(demo)` ใน `draft-schema.ts:153` ถ้าไม่ได้รับคำสั่ง เพราะอยู่นอกขอบเขต
- **ทำทีละ sub-step:** อธิบายสั้น ๆ → ให้ไฟล์เต็มทีละไฟล์ → บอกวิธีตรวจจากเอกสารนี้ → รอคำว่า "ok" ก่อนทำต่อ
- **จบแต่ละเฟส:** เขียนคำอธิบายภาษาไทยไว้ที่ `docs/explanations/` และเสนอ commit message กับรายการไฟล์
- **โค้ดไม่ตรงเอกสารหรือ step ไม่ชัด:** หยุดและถาม · ถ้าต้องเปลี่ยน ให้แก้เอกสารนี้ให้ตรงกับโค้ดเสมอ
- **เตือนทุกครั้ง** เมื่อต้องรัน `npm install` หรือ migration ใหม่
- **ลำดับ migration:** ตั้งแต่ step 3.4 โค้ดอ่านคอลัมน์ใหม่ ทุก DB ที่รันโค้ดนี้ต้อง migrate ก่อน รวม `fixbot_eval`
- **step 6.1 และเฟส 7 เป็นส่วนเสริม:** ถามก่อนว่าจะทำเลยหรือข้าม

### เฟส 1 — ตรวจก่อนเริ่ม

| Step | ไฟล์ | เสร็จเมื่อ |
|---|---|---|
| **1.1** สร้าง `fixbot_admin_test` (migrate 001–006 + seed) แล้วคิวรีอ่านอย่างเดียว: จำนวนผัง · `has_image`, `image_url`, `external_reference`, `config` ไม่ถูกใช้ · รายชื่อ `display_name` ของ admin | ไฟล์ env นอก repo เท่านั้น | ตัวเลขตรงกับที่คำนวณจาก `data/manuals` · ถ้าไม่ตรงให้แจ้ง |
| **1.1b** คิวรีเดียวกันบน DB จริง **ทำก่อน migrate หรือ deploy บน DB จริง** | ไม่แก้ไฟล์ | ถ้าคอลัมน์เหล่านี้มีค่า ต้องปรับ `toDbRows` ก่อน · ถ้า admin ชื่อซ้ำ ผู้ใช้เปลี่ยนชื่อด้วย SQL ก่อน เพราะแอปไม่มีทางเปลี่ยนชื่อ |
| **1.2** บังคับระบุชื่อ admin และห้ามชื่อซ้ำตามข้อ P · ตัดค่าเริ่มต้น `Admin` | `backend/scripts/seed-admin.js`, `backend/.env.example` | C18, C19 ผ่าน · สร้าง admin ใหม่พร้อมชื่อได้ตามปกติ |
| **1.3** สำรองด้วย `backup-flow-tables.js` ก่อนรัน migration บน DB ที่มีข้อมูลจริง | `backend/backups/` (ถูก ignore) | มีไฟล์สำรอง |

### เฟส 2 — ฐานข้อมูล

| Step | ไฟล์ | เสร็จเมื่อ |
|---|---|---|
| **2.1** Migration คอลัมน์ใหม่ | `backend/migrations/007_flow_management.sql` | `npm run migrate` ผ่านบน DB ทดสอบ · seed และ publish เดิมไม่พัง |
| **2.2** Migration บันทึกการจัดการ | `backend/migrations/008_flow_revisions.sql` | C15 ผ่าน |

### เฟส 3 — ฐานของ backend (ยังไม่มี endpoint ใหม่)

| Step | ไฟล์ | เสร็จเมื่อ |
|---|---|---|
| **3.1** `ApiError.details` | `common/api-error.ts`, `common/error-handler.ts` | C14 ผ่าน |
| **3.2** โหมดผังที่เผยแพร่แล้วของ validator | `authoring/flow-validator.ts` | C1, C2 ผ่าน |
| **3.3** `toDbRows` รักษา `author_note` · export ตัวตรวจรูปร่าง | `authoring/draft-manual.ts`, `authoring/draft-schema.ts` | checklist ข้อ 1 ผ่าน · ร่างเดิมบันทึก `author_note` เป็น null |
| **3.4** รู้จักผังที่ลบ และ reload เข้าคิว | `execution/flow.repository.ts` | ยังไม่มีผังที่ถูกลบ พฤติกรรมจึงเหมือนเดิม · ตั้งค่า `deleted_at` ด้วย SQL แล้วรีสตาร์ต: ผังหายจาก `GET /execution/flows` แต่ session เดิมเปิดได้ |
| **3.5** `removeFlows`, กรองผล, แก้ `flowInfo` | `symptom-search/symptom-search.service.ts` | ค้นหาทำงานเหมือนเดิม · อ่านโค้ดยืนยันการเขียน `flowInfo` |
| **3.6** ด่านในบริการเดิม | `execution/execution.service.ts`, `history/history.service.ts`, `history/history.dto.ts`, `authoring/drafts.service.ts` | ผังที่ลบเริ่มใหม่ได้ 404 · ประวัติเปิดได้ · dashboard ไม่เป็น `unknown` · อัปโหลด `manual_id` เดิมถูกปฏิเสธ |

### เฟส 4 — ฟีเจอร์ของ backend

| Step | ไฟล์ | เสร็จเมื่อ |
|---|---|---|
| **4.1** อ่าน: store + service + route ของ 2 GET และ mount | `flow-admin/flow-admin.store.ts`, `.service.ts`, `.routes.ts`, `.dto.ts`, `.errors.ts`, `app.ts` | ทดลองด้วย PowerShell ได้ข้อมูลตาม 3.2 · ผัง seed ได้ `validation.errors` ว่าง · C3 ผ่าน |
| **4.2** ตัวเทียบรุ่นเก่า-ใหม่ | `flow-admin/flow-diff.ts` | ตรวจผ่าน 4.3 |
| **4.3** `POST /validate` | service, routes, dto | C13 ผ่าน · รายงานและ `impact` ถูกต้อง |
| **4.4** `PUT` พร้อม transaction, reload, ดัชนี, หมดอายุ session | store, service, routes | C4–C10, C16 ผ่าน |
| **4.5** `DELETE` และ `restore` พร้อมบันทึกผู้ทำ | store, service, routes | C11, C12 ผ่าน · ดัชนีและ `flow_count` ถูกต้อง |
| **4.6** สคริปต์ | `scripts/seed-flows.js`, `scripts/backup-flow-tables.js` | checklist ข้อ 29 ผ่าน · `--force` ผ่าน รวมกรณี PowerShell 5.1 ตัด `--` แล้วส่งมาเป็น `npm_config_force` (ดู `run-migrations.js:60-63`) |

**จุดหยุด A:** ถึงตรงนี้ API ครบ ทดสอบด้วย PowerShell ได้

### เฟส 5 — Frontend ส่วนหลัก (ต้องทำ)

| Step | ไฟล์ | เสร็จเมื่อ |
|---|---|---|
| **5.1** ฐาน: `details`, ชนิด, API, hooks, ข้อความ error | `api/http.ts`, `api/types.ts`, `api/flows.ts`, `api/queries.ts`, `lib/errors.ts`, `lib/flowIssueLabels.ts` | `tsc` ผ่าน · error เดิมแสดงเหมือนเดิม |
| **5.2** แยก component ใช้ร่วม | `DraftFlowCard.tsx`, `FlowStructure.tsx`, `ValidationReportPanel.tsx`, `DeleteConfirm.tsx` | หน้าร่างและหน้าประวัติแสดงผลเหมือนเดิม |
| **5.3** หน้ารายการ | `pages/AdminFlowsPage.tsx`, `FlowRow.tsx`, `lib/adminFlowParams.ts`, `App.tsx`, `AdminTabs.tsx` | checklist ข้อ 2, 27 ผ่าน |
| **5.4** หน้ารายละเอียด + ลบ + กู้คืน | `pages/AdminFlowDetailPage.tsx` | checklist ข้อ 3, 4, 20, 25 ผ่าน |
| **5.5** ตัวช่วยฟอร์มแบบฟังก์ชันล้วน | `lib/flowEditor.ts` | เรียกผ่านหน้าใน 5.6 ได้ถูกต้อง |
| **5.6** ฟอร์มแก้ (หน้าแก้หลัก) | `pages/AdminFlowEditPage.tsx`, `FlowMetaFields.tsx`, `StateEditorCard.tsx`, `StateTargetSelect.tsx` | checklist ข้อ 6, 7, 9–12 ผ่าน |
| **5.7** ผลตอบกลับ: ยืนยันและชนกัน | `FlowConfirmPanel.tsx`, `FlowConflictNotice.tsx`, `AdminFlowEditPage.tsx` | checklist ข้อ 13–17 ผ่าน |
| **5.8** หน้าประวัติและหน้าร่าง | `HistoryDetailPage.tsx`, `AdminDraftReviewPage.tsx`, `api/queries.ts` | checklist ข้อ 22 ผ่าน |

**จุดหยุด B:** ถึงตรงนี้ฟีเจอร์ดู แก้ และลบครบสำหรับ admin ที่ไม่ใช่โปรแกรมเมอร์

### เฟส 6 — ตรวจรับและส่วนเสริม

| Step | ไฟล์ | เสร็จเมื่อ |
|---|---|---|
| **6.1** โหมด JSON เสริม (ถามก่อนทำ) | `components/admin/JsonEditor.tsx`, `DraftJsonEditor.tsx`, `AdminFlowEditPage.tsx` | checklist ข้อ 30 ผ่าน · หน้าร่างยังทำงานเดิม |
| **6.2** ตรวจ C1–C19 และ checklist ข้อ 1–29 ครบบน DB ทดสอบ (รวมข้อ 30 ถ้าทำ 6.1) | ไม่แก้ไฟล์ | รายงานผลแต่ละข้อ รวมเวลา `reload()` |
| **6.3** เอกสาร | `docs/README.md`, `docs/ops/DEPLOY.md` · `docs/reference/DATABASE.md` (ถามก่อน) · แก้ `drafts.service.ts:46` | ขั้นตอน migrate, การเพิ่ม admin, ข้อควรระวังเรื่อง seed ตรงกับของจริง |

### เฟส 7 — แผนภาพ Mermaid (step สุดท้าย)

ฟีเจอร์ครบแล้วตั้งแต่จุดหยุด B เฟสนี้ตัดออกได้โดยไม่กระทบส่วนอื่น · ถามก่อนเริ่มว่าจะทำเลยหรือข้าม และเตือนให้รัน `npm install` ใน `frontend`

| Step | ไฟล์ | เสร็จเมื่อ |
|---|---|---|
| **7.1** ติดตั้ง `mermaid` และบันทึกขนาด build ก่อน-หลัง | `frontend/package.json`, `frontend/package-lock.json` | `npm run build` ผ่าน · ตรวจ API ของเวอร์ชันที่ติดตั้ง · Render ไม่กระทบเพราะ build เฉพาะ `backend` |
| **7.2** แปลงผังเป็นข้อความ | `lib/flowDiagram.ts` | ใช้ `s0, s1, …` เป็น id ของจุด กันคำสงวน · escape และตัดป้ายกำกับ · รูปร่างตามชนิด · **ไม่วาด `on_invalid` ที่ชี้ตัวเอง** เพราะมี 938 จุดและรกโดยไม่ได้ข้อมูลเพิ่ม |
| **7.3** แสดงในหน้ารายละเอียด | `components/admin/flows/FlowDiagram.tsx`, `pages/AdminFlowDetailPage.tsx` | ใช้ `import('mermaid')` เมื่อเปิดส่วน "ดูแผนภาพ" เท่านั้น · `securityLevel: 'strict'` · ล้มเหลวแล้วแสดงข้อความและรายการปกติ · checklist ข้อ 31, 32 ผ่าน · โหลดหน้าผู้ใช้ทั่วไปไม่เพิ่มขึ้น |

---

## Part 5 — เตรียมตอบกรรมการ

> คำตอบอิงตามแบบนี้ ซึ่ง**ยังไม่ได้ implement** ก่อนตอบต้องทำจริงและตรวจตาม 3.7 แล้ว ถ้าตอบก่อนหน้านั้นให้พูดว่าเป็นแผน

**1. ทำไมใช้ soft delete ไม่ลบจริง?**
เพราะ `sessions.flow_id` เป็น `ON DELETE RESTRICT` ฐานข้อมูลไม่ให้ลบผังที่เคยถูกใช้ และถ้าลบ session ตามไป ประวัติการซ่อม ความเห็น และตัวเลขสถิติก็จะหายตาม เราจึงใส่ `deleted_at` เพื่อซ่อนจากผู้ใช้ ส่วนข้อมูลเดิมยังอยู่และกู้คืนได้

**2. ถ้าผู้ใช้กำลังตรวจอยู่แล้วแอดมินแก้หรือลบผังล่ะ?**
ถ้าลบผัง ผู้ใช้เดินต่อจนจบได้ แต่ไม่มีใครเริ่มใหม่ได้ และประวัติยังเปิดดูได้ ถ้าแก้ผัง session อ่านผังล่าสุดทุกขั้น จึงเห็นข้อความใหม่ในขั้นถัดไป ซึ่งมีข้อดีคือแก้คำเตือนความปลอดภัยแล้วมีผลทันที ถ้าจะลบขั้นตอนที่มีคนอยู่ ระบบบอกผลกระทบให้ admin กดยืนยันก่อน แล้ว session นั้นหมดอายุ ผู้ใช้ได้ข้อความให้เริ่มใหม่แทนหน้าระบบล้ม

**3. ทำไมไม่ทำ versioning? ประวัติเก่าจะไม่ตรงหรือเปล่า?**
ตรงนี้เป็นข้อจำกัดที่ยอมรับ: ประวัติไม่ได้เป็นภาพถ่าย ณ วันที่ตรวจ Versioning เต็มรูปแบบต้องเปลี่ยน PK และ FK ของหลายตาราง เกินความจำเป็นสำหรับขนาดโปรเจกต์นี้ แต่ระบบ**ไม่แสดงข้อมูลผิดโดยไม่บอก**: `replayReaches` เดินขั้นที่บันทึกซ้ำบนผังปัจจุบัน ถ้าไปไม่ถึงสถานะเดิมจะแจ้งว่าผังเปลี่ยน และถ้าแก้แต่ข้อความจะมีหมายเหตุบอก ส่วน `flow_revisions` เก็บเนื้อหาก่อนแก้ไว้ตรวจย้อนหลัง ทางขยายถัดไปคือแก้แล้วสร้าง `flow_id` ใหม่

**4. Admin ไม่ใช่โปรแกรมเมอร์ จะแก้ผังอย่างไรไม่ให้พัง?**
มี 2 ชั้น ชั้นแรกคือฟอร์ม: ไม่ต้องพิมพ์ id หรือ regex เลือกขั้นตอนถัดไปจาก dropdown ที่เห็นเนื้อหา และมีค่าสำเร็จรูปสำหรับขั้นตอนถามหมายเลขรุ่น ชั้นที่สองคือ validator ตัวเดียวกับตอนเผยแพร่ ตรวจฝั่งเซิร์ฟเวอร์ทุกครั้งว่าลูกศรชี้ขั้นตอนที่มีจริง เดินถึงทุกขั้นตอน ไปถึงจุดจบได้ และตัวแปรถูกเก็บก่อนใช้ ถ้าไม่ผ่านจะบันทึกไม่ได้ และบอกเป็นภาษาคนใต้ขั้นตอนที่ผิด

**5. ต้องรีสตาร์ตเซิร์ฟเวอร์ไหมเมื่อแก้ผัง? Embedding ทำอย่างไร?**
ไม่ต้อง `reload()` สร้าง Map ใหม่ให้เสร็จก่อนแล้วสลับในครั้งเดียว ผู้ใช้จึงไม่เจอผังครึ่ง ๆ กลาง ๆ และถ้า admin หลายคนบันทึกพร้อมกัน reload จะเข้าคิวทีละรอบ ส่วน embedding ทำใหม่เฉพาะข้อความอาการที่เปลี่ยน เพราะดัชนีสร้างจาก 3 ฟิลด์นี้ แก้ข้อความขั้นตอนจึงไม่กระทบการค้นหา

**6. ไม่มีติ๊กยืนยันตอนบันทึก แล้วถ้าแอดมินเอาคำเตือนความปลอดภัยออกโดยไม่ตั้งใจ?**
การบันทึกปกติใช้คลิกเดียวเพื่อไม่ให้ยุ่งยากเกินไป แต่ระบบเทียบผังเก่ากับใหม่ ถ้าด่านความปลอดภัยหายไป จะไม่บันทึกทันที แต่แสดงผลกระทบและให้กด "บันทึกต่อ" อีกครั้ง และเนื้อหาก่อนแก้ถูกเก็บใน `flow_revisions` พร้อมชื่อผู้แก้ จึงกู้คืนได้ · ข้อจำกัดคือระบบ**ตรวจความถูกต้องของเนื้อหาแทนคนไม่ได้** คำเตือนทั่วไปแสดงให้อ่านแต่ไม่ขวางการบันทึก

**7. มีแอดมินหลายคน ถ้าแก้พร้อมกันหรืออยากรู้ว่าใครแก้ล่ะ?**
แต่ละผังมี `revision` ตอนบันทึกต้องส่งเลขที่ตัวเองอ่านมา ถ้าไม่ตรงจะได้ 409 พร้อมบอกว่าใครบันทึกไปก่อน งานในฟอร์มไม่หาย ไม่มีการเขียนทับเงียบ ๆ และ `SELECT ... FOR UPDATE` ทำให้การบันทึกเกิดทีละครั้ง เป็นวิธีเดียวกับตอน publish ส่วนการตรวจย้อนหลัง `flows` เก็บคนแก้ล่าสุดและคนลบ และ `flow_revisions` เก็บทุกการแก้ ลบ กู้คืน พร้อมเวลาและผู้ทำ ระบบไม่ได้รวมงานสองคนให้อัตโนมัติ

**8. ทดสอบฟีเจอร์นี้อย่างไร ทำไมไม่มี automated test?**
เราเลือกทดสอบด้วยมือตาม checklist ที่ครอบคลุมตั้งแต่สร้าง ดู แก้ เดินผัง ลบ จนถึงเปิดประวัติ รวมถึงกรณีแอดมินสองคนทำงานพร้อมกัน เพราะผู้พัฒนาต้องอ่านและอธิบายทุกส่วนได้ และโปรเจกต์ตัดชุด test ออกไปก่อนหน้านี้แล้ว ข้อแลกเปลี่ยนคือไม่มีตัวกันการถอยอัตโนมัติ เมื่อแก้ validator หรือตัวโหลดผังต้องไล่ checklist ซ้ำ และกรณีชนกันด้านเวลาตรวจด้วยมือได้ไม่แน่นอน
