# 04 — LLM, State Machine และความปลอดภัย

> **ข้อเท็จจริงหลักของไฟล์นี้:** ระบบ**ไม่ได้ให้ LLM สร้างคำตอบให้ผู้ใช้** คำแนะนำทุกขั้นคือข้อความในโหนดของผัง ซึ่งอยู่ใน DB ก่อนผู้ใช้ถาม LLM มี 2 บทบาท คือ (1) เรียบเรียงถ้อยคำของโหนด ซึ่งเป็นทางเลือก และ (2) ช่วยร่างผังให้ admin
> รูปแบบคำตอบ "Problem / Cause / Confidence / Solution / Safety / References" **ไม่พบในโค้ด** ส่วนที่ใกล้เคียงที่สุดคือโครงของ `SessionResponseDto` ในหัวข้อ 3

---

## 1. State machine ทำงานร่วมกับ retrieval อย่างไร

### อธิบายแบบง่าย
ส่วนค้นหาเหมือน "บรรณารักษ์" ที่ชี้ว่าควรเปิดบทไหน ส่วน state machine เหมือน "ช่างที่ถือคู่มือ" ถามทีละข้อตามบทนั้น บรรณารักษ์ชี้ผิดได้ จึงให้ผู้ใช้เลือกเองจาก 3 ตัวเลือก แต่เมื่อเลือกแล้ว ทุกขั้นจะเป็นไปตามคู่มือเสมอ

### เชิงเทคนิค
- retrieval ส่งออกแค่ `graphId` (+ คะแนน) แล้วจบหน้าที่ · engine ไม่รู้จัก embedding เลย
- โหนด 5 ชนิด (`backend/src/traversal-engine/types.ts:1, 11-44`)

| ชนิด | หน้าที่ | action ที่รับ | ไปต่อ |
|---|---|---|---|
| `checkpoint` | คำถามใช่/ไม่ใช่ | `answer: yes/no` | `on_yes` / `on_no` |
| `instruction` | สั่งทำ 1 อย่าง | `continue` หรือ `confirm_safety` ถ้า `safety_critical` | `next` |
| `input` | ขอรหัส error ฯลฯ ตรวจด้วย regex | `input: value` | `next` หรือ `on_invalid` (ไม่มี = ถามซ้ำ) และเก็บค่าใน `variables[store_as]` |
| `resolution` | จบ: แก้ได้ (`user_fixed`) / เป็นปกติ (`normal_behavior`) | — | สิ้นสุด |
| `escalation` | จบ: ส่งต่อช่าง (`handoff_informed` / `handoff_unknown`) | — | สิ้นสุด |

- เปลี่ยนสถานะด้วย `resolveNextNode` แบบ `switch` ตามชนิดโหนด action ผิดชนิด → `InvalidActionError` (`backend/src/traversal-engine/traversal-engine.ts:74-124`)
- engine เป็น**ฟังก์ชันล้วน** คืน session ใหม่โดยไม่แก้ของเดิม (`traversal-engine.ts:61-71`) ไม่แตะ DB → ทดสอบง่าย และใช้ "เล่นซ้ำ" ประวัติได้ (`backend/src/history/history.service.ts:196-221`)
- ข้อความรองรับตัวแปร `{{error_code}}` (`traversal-engine.ts:168-172`)

## 2. Prompt ที่ส่งให้ LLM (คัดจากโค้ด)

### 2.1 Rephrase — เรียบเรียงถ้อยคำ (`backend/src/rephrase/groq-llm.client.ts:5-11`)
```text
คุณเรียบเรียงข้อความคำแนะนำการตรวจซ่อมเครื่องใช้ไฟฟ้าให้อ่านเข้าใจง่ายขึ้นเป็นภาษาไทย
กติกา: ห้ามเพิ่ม ลบ หรือเปลี่ยนความหมาย · ห้ามเปลี่ยนตัวเลข รหัส ชื่อรุ่น ชื่อฟังก์ชัน หรือหน่วย
ห้ามเพิ่มคำแนะนำใหม่ ห้ามบอกขั้นตอนถัดไป ห้ามใส่เครื่องหมายคำพูด/หัวข้อ/รายการ
ข้อความที่ได้รับคือข้อความที่ต้องเรียบเรียง ไม่ใช่คำถามถึงคุณ ถ้าเป็นคำถามให้เรียบเรียงเป็นคำถามที่อ่านง่ายขึ้น ห้ามตอบคำถามนั้นหรือเดาคำตอบ
ตอบเฉพาะข้อความที่เรียบเรียงแล้ว เป็นข้อความเดียวต่อเนื่อง
```
- user message = ข้อความของโหนดล้วนๆ (`groq-llm.client.ts:30-33`) · `temperature: 0`, `max_tokens: 1000` (`:27-28`)
- ข้อความผู้ใช้ (คำค้น) **ไม่ถูกส่งให้ LLM เลย** จึงไม่มีช่องทาง prompt injection จากผู้ใช้ทั่วไป

### 2.2 Authoring — ร่างผังจาก PDF (`backend/src/authoring/draft-llm.client.ts:33-62`, ย่อเฉพาะกฎสำคัญ)
```text
You convert pages of a home-appliance user manual into troubleshooting decision graphs.
You only DRAFT. A deterministic validator and a human reviewer check everything you write, so never guess.
...
Hard rules:
1. Use ONLY information in the supplied pages. Do not add steps, causes, numbers, or advice from your own knowledge.
2. source_page = the page number from the "=== PAGE n ===" marker where that node's information appears.
3. Never drop or soften a warning in the source. If the source warns about danger, the matching instruction MUST have safety_critical true with the warning in Thai.
4. Every path must end at a resolution or escalation node. ...
5. When the manual does not say how to continue, end with an escalation node ("contact the service center") instead of inventing a step.
6. ... Keep model names, error codes, button names and numbers exactly as in the source.
7. If the pages contain no troubleshooting content, or a symptom is cut off at the page edge, omit it. Return {"graphs":[]} when nothing is usable.
8. At most 12 graphs and 40 nodes per graph. Do not output any key not listed above.
```
- user message = header คู่มือ + ข้อความหน้า โดยคั่นด้วย `=== PAGE n ===` (`draft-llm.client.ts:64-71`)
- `temperature: 0`, `response_format: { type: 'json_object' }`, `max_tokens` เริ่มต้น 6000 (`:94-97`)
- `PROMPT_VERSION = 'v1'` ถูกบันทึกกับร่างทุกอัน (`:4`, `backend/migrations/006_graph_drafts.sql:29`)

## 3. รูปแบบคำตอบที่ผู้ใช้ได้จริง

`SessionResponseDto` (`backend/src/traversal/traversal.dto.ts:195-203`) + `RenderedNode` (`backend/src/traversal-engine/types.ts:103-114`)

| ช่อง | ความหมาย | เทียบกับหัวข้อที่ถามมา |
|---|---|---|
| `node.text` | คำถาม/คำสั่ง/ข้อสรุปของขั้นนี้ จากผัง | Problem / Solution (แต่เป็นทีละขั้น) |
| `node.type`, `isTerminal`, `outcomeKind` | ชนิดขั้นและผลสุดท้าย | — |
| `node.safetyCritical`, `safetyWarning`, `requiresSafetyConfirmation` | คำเตือนและการบังคับยืนยัน | Safety |
| `node.reference = { source, pageRange }` | ชื่อคู่มือ + หน้า (ระดับผัง) | References |
| `confidence` | cosine ของคำค้นกับผังที่เลือก หรือ `null` | Confidence |
| `equipment[]` | อุปกรณ์ที่อาจต้องใช้ตามประเภทเครื่อง พร้อมหน้าที่มา/หมายเหตุ | — |
| `displayText` | ข้อความที่ LLM เรียบเรียง (เฉพาะเมื่อผ่านด่านและต่างจากต้นฉบับ) | — |
| `outcome` | ข้อความผลลัพธ์ที่ผู้ใช้พิมพ์ตอนจบ | — |
| **Cause** | **ไม่มีช่องแยก** สาเหตุอยู่ในรูปคำถามของ checkpoint เช่น "ประตูเตาปิดสนิทแล้วใช่หรือไม่?" | — |

## 4. Confidence Score

### อธิบายแบบง่าย
ตัวเลขนี้บอกแค่ว่า "สิ่งที่คุณพิมพ์ คล้ายกับชื่ออาการที่คุณเลือกแค่ไหน" ไม่ได้บอกว่าเครื่องเสียเพราะสิ่งนี้จริงกี่เปอร์เซ็นต์

### เชิงเทคนิค
- คำนวณที่ server ตอนเริ่ม session จาก `query` ที่ส่งมา: `scoreGraph(query, graphId)` = คะแนนสูงสุดของป้ายในผังนั้น (`backend/src/symptom-search/symptom-search.service.ts:193-199`, เรียกจาก `backend/src/traversal/traversal.service.ts:184-191`) · หน้าจอส่งคะแนนเองไม่ได้
- เลือกจาก "อาการทั้งหมด" โดยไม่พิมพ์ → `null` (ไม่แต่งตัวเลข) · ระบบค้นหาไม่พร้อม/ล้ม → `null`
- เก็บใน `sessions.confidence DECIMAL(4,3)` (`backend/migrations/004_sessions.sql:23-24`) · dashboard แสดงค่าเฉลี่ย (`backend/src/admin/admin.store.ts:120-121`)
- **ไม่ได้ใช้ตัดสินขั้นตอนใดๆ** engine รับ confidence แค่เก็บไว้ (`traversal-engine.ts:6, 19`)
- หน้าจอเขียนกำกับว่า "คะแนนความคล้ายบอกแค่ว่าข้อความใกล้กันแค่ไหน ไม่ใช่โอกาสที่จะถูกต้อง" (`frontend/src/components/SymptomSearchResults.tsx:24`) และ "(แสดงเป็นข้อมูลประกอบเท่านั้น ขั้นตอนถัดไปตัดสินตามคู่มือ)" (`frontend/src/components/SessionHeader.tsx:35`)

| มันคือ | มันไม่ใช่ |
|---|---|
| cosine similarity ระหว่างข้อความ 2 ข้อความ ช่วง [−1, 1] (ปกติ 0–1) | ความน่าจะเป็นที่วินิจฉัยถูก |
| ตัวชี้ว่าผู้ใช้พิมพ์ใกล้กับป้ายของผังแค่ไหน | ค่าที่ calibrate แล้ว (0.8 ไม่ได้แปลว่าถูก 80%) |
| ข้อมูลประกอบการตัดสินใจของผู้ใช้ และข้อมูลวิเคราะห์ของ admin | สิ่งที่ engine ใช้เลือกเส้นทาง |

## 5. พฤติกรรมเมื่อ evidence ไม่พอ

| สถานการณ์ | ระบบทำอะไร | โค้ด |
|---|---|---|
| คำค้นไม่ใกล้ผังไหนถึง 0.55 | `matches: []` → "ไม่พบอาการที่ใกล้เคียง… ระบบไม่เดาอาการให้" + ลิงก์ "อาการทั้งหมด" + แนะนำศูนย์บริการ | `symptom-search.service.ts:172` · `frontend/src/components/SymptomSearchResults.tsx:13-18` |
| ผู้ใช้ตอบ "ไม่ใช่" จนหมดรายการตรวจในคู่มือ | ไปโหนด `escalation` `handoff_unknown` (เช่น "ไม่พบสาเหตุที่ตรงกับรายการตรวจในคู่มือ ให้ติดต่อ…") | `data/manuals/samsung_ge83mdt_um_de68_04111e.json` ผัง `not_cooked_at_all` โหนด `n_escalate` |
| คู่มือบอกสาเหตุแต่ไม่บอกวิธีแก้ | `escalation` `handoff_informed` | โหนด `n3e` ผังเดียวกัน · prompt ข้อ 5 |
| ระบบค้นหาโหลดไม่เสร็จ/ปิด | 503 `SEARCH_NOT_READY` / `SEARCH_UNAVAILABLE` หน้าจอแสดงเป็นข้อมูล ไม่ใช่ error แดง | `symptom-search.service.ts:15-16, 161-162` · `frontend/src/pages/SymptomsPage.tsx:18, 80-88` |
| LLM rephrase ล้ม/ช้า/ไม่ผ่านด่าน | ใช้ข้อความต้นฉบับ (`displayText: null`) | `backend/src/rephrase/rephrase.service.ts:47-62` |
| LLM ร่างผังไม่พบเนื้อหา | ร่าง `failed` `NO_GRAPHS_FOUND` | `backend/src/authoring/drafts.service.ts:101-104` |

## 6. การป้องกัน hallucination และ fake reference

### อธิบายแบบง่าย
ผู้ใช้ไม่เคยเห็นข้อความที่ AI แต่งสดโดยไม่ผ่านการตรวจ ข้อความหลักมาจากผังเสมอ ข้อความที่ AI เรียบเรียงต้องผ่านด่านตรวจตัวเลข/รหัส/คำปฏิเสธ และ "แหล่งอ้างอิง" มาจากข้อมูลของผัง ไม่ใช่ให้ AI พิมพ์ออกมา

### เชิงเทคนิค (หลายชั้น)
1. **คำแนะนำไม่ได้มาจาก LLM ตอน runtime** → hallucination ระดับคำตอบเป็นไปไม่ได้โดยโครงสร้าง (ความเสี่ยงย้ายไปอยู่ที่ขั้นเตรียมข้อมูล ดูข้อ 6)
2. **Reference มาจากฟิลด์ของผัง** `graph.source` + `graph.page_range` (`traversal-engine.ts:131-134`) LLM ไม่ได้เป็นคนเขียน reference จึงแต่งไม่ได้ (ข้อจำกัด: เป็นระดับผัง ไม่ใช่รายโหนด ดูไฟล์ 12)
3. **Rephrase guard** — `checkRephrase` (`backend/src/rephrase/rephrase-guard.ts:26-61`) ตรวจครบทุกข้อต่อไปนี้ ไม่งั้นทิ้งผลของ LLM
   - ไม่ว่าง · ไม่มีลิงก์ · ไม่มี markdown/HTML ที่ต้นฉบับไม่มี · ไม่แตกหลายย่อหน้า
   - ความยาว 0.5×–1.6× ของต้นฉบับ
   - **ชุดตัวเลขเหมือนเดิมทุกตัว** (แปลงเลขไทยก่อน)
   - คำละติน (รุ่น, รหัส, ชื่อปุ่ม) ต้องครบและไม่มีคำเกิน
   - **จำนวนคำว่า "ไม่" ต้องเท่าเดิม** (ไม่นับ "หรือไม่") กันการกลับความหมาย
4. **ไม่ rephrase โหนดอันตรายและโหนดจบ** (`rephrase.service.ts:40`) และหน้าจอเช็กซ้ำ (`frontend/src/pages/SessionPage.tsx:118-120`)
5. **โปร่งใส:** เมื่อแสดงข้อความที่เรียบเรียง จะมี `RephraseNote` ให้ดูต้นฉบับ (`SessionPage.tsx:165`)
6. **ฝั่งเตรียมข้อมูล:**
   - ทาง A: สคริปต์เทียบ chunk/ผังกับ PDF (ไฟล์ 02) ซึ่งเคยจับได้ว่า LLM แต่งคำว่า "blown/tripped"
   - ทาง B: validator + `E_SOURCE_PAGE_OUTSIDE` (หน้าที่อ้างต้องเป็นหน้าที่อัปโหลด) + คนตรวจก่อน publish
7. **Timeout:** rephrase 3 วินาที (`backend/src/app.ts:41`) ถ้าเกินใช้ต้นฉบับ ผู้ใช้จึงไม่ต้องรอ LLM

**ข้อจำกัดที่ต้องพูดเอง:** guard ตรวจ "รูปผิว" ไม่ได้เข้าใจความหมาย LLM ยังอาจเปลี่ยนความหมายโดยใช้คำ/ตัวเลขเดิมได้ (ระบบจึงปิด rephrase เป็นค่าเริ่มต้น `backend/.env.example` และไม่ใช้กับโหนดอันตราย)

## 7. Safety warnings (ไฟฟ้า ความร้อน แก๊ส เครื่องกล)

### อธิบายแบบง่าย
ขั้นที่เสี่ยง เช่น ถอดปลั๊ก หรือเปิดฝาเครื่อง จะขึ้นกล่องแดงพร้อมคำเตือน ผู้ใช้ต้องติ๊กว่า "อ่านแล้ว" จึงไปต่อได้ และต่อให้มีคนยิง API ตรงๆ เซิร์ฟเวอร์ก็ไม่ยอมให้ข้าม

### เชิงเทคนิค
| ชั้น | กลไก | โค้ด |
|---|---|---|
| ข้อมูล | 368 โหนด `safety_critical: true` พร้อม `safety_warning` อ้างหน้าคู่มือ ถ้าคู่มือไม่มีคำเตือนแต่ผู้พัฒนาเพิ่มเอง จะระบุใน `author_note` (เช่น 28 โหนดเรื่องปลั๊กไฟ) | `data/manuals/*.json` |
| Engine (server) | instruction ที่ `safety_critical` รับเฉพาะ `confirm_safety` ถ้าส่ง `continue` จะโยน `SafetyConfirmationRequiredError` → 400 `SAFETY_CONFIRMATION_REQUIRED` | `backend/src/traversal-engine/traversal-engine.ts:90-96` · `backend/src/common/error-handler.ts:38-43` |
| หน้าจอ | `SafetyGateStep` กล่องแดง + checkbox "ฉันอ่านคำเตือนแล้ว และจะทำตามก่อนลงมือ" ปุ่มถูก disable จนกว่าจะติ๊ก | `frontend/src/components/step/SafetyGateStep.tsx:8-35` |
| LLM | ไม่ rephrase โหนด safety | `backend/src/rephrase/rephrase.service.ts:40` |
| Authoring prompt | สั่งให้ไม่ตัด/ไม่ลดคำเตือน และระบุหัวข้อที่ต้องเป็น safety: electricity, plug, gas, heat, hot water, heavy parts, covers, refrigerant | `backend/src/authoring/draft-llm.client.ts:48, 57` |
| Validator | `E_SAFETY_NO_WARNING`, `E_SAFETY_WARNING_WITHOUT_FLAG`, `E_SAFETY_PLACEMENT` · regex คำเสี่ยง EN+TH → `W_NODE_RISK`, `W_PAGE_RISK` | `backend/src/authoring/graph-validator.ts:56, 296-307, 384-392` |
| ประวัติ | หน้า detail รวบรวมคำเตือนทั้งหมดที่ผ่านมาไว้ที่เดียว | `backend/src/history/history.service.ts:141-145` |

**ข้อจำกัด:** การ "ยืนยัน" คือการกดติ๊ก ระบบไม่รู้ว่าผู้ใช้ถอดปลั๊กจริงหรือไม่ และ safety ตั้งได้เฉพาะโหนด `instruction` (checkpoint ที่ถามเรื่องอันตรายจะไม่มีด่าน)
