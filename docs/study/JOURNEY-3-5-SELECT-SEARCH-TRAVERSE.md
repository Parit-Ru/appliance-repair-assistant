# User Walkthrough ช่วงที่ 3–5: เลือกเครื่อง → ค้นอาการ → เดินผัง

> กู้คืนจากข้อความที่ตอบในแชต (ไม่ได้แก้เนื้อหา) เมื่อ 25 ต.ค. 2569
> ⚠️ เลขบรรทัดในไฟล์นี้อาจเลื่อนแล้ว (backend/frontend ถูกลบคอมเมนต์ภายหลัง) ใช้เป็นแนวทาง ต้องเปิดไฟล์เทียบอีกครั้ง
> ช่วง 5 ยัง mark 🔖⭐ ว่าต้องกลับมาอ่านอีกรอบก่อนสอบ (ดู READING-PROGRESS.md)
> ช่วง 4 เวอร์ชันละเอียดขึ้น (ตอนที่ 2 เซิร์ฟเวอร์ค้นหา) อยู่ในแชตเท่านั้น ยังไม่ได้เก็บในไฟล์นี้

---

# ช่วงที่ 3: เลือกเครื่อง → เลือกรุ่น

เล่าต่อ: สมชายล็อกอินแล้ว กด "เลือกเครื่องที่มีปัญหา" จากหน้าแรก (`HomePage.tsx:17`) ช่วงนี้ **ไม่มีการยิง SQL ตอนใช้งานเลย** เพราะข้อมูลทั้งหมดอยู่ในหน่วยความจำของเซิร์ฟเวอร์ตั้งแต่ตอนบูต นี่คือหัวใจของช่วงนี้

## ตอนที่ 1: หน้าจอ (Frontend)
หน้า `pages/DevicesPage.tsx` (route `/devices` — `App.tsx:42`) มี 2 ขั้นในหน้าเดียว สลับกันด้วย `?category=` ใน URL

1. **เปิดหน้า:** `useManuals()` (`DevicesPage.tsx:29`, `api/queries.ts:70-72`) → `listManuals()` (`api/traversal.ts:24-26`) → **`GET /traversal/manuals`** ไม่มี body ไม่ต้องล็อกอิน `staleTime: Infinity` = โหลดครั้งเดียวไม่หมดอายุ เพราะรายการเปลี่ยนเฉพาะตอนมีคู่มือใหม่
2. **ขั้น 1 เลือกประเภทเครื่อง:** `CategoryStep` (`:71-93`) ดูว่าในรายการรุ่นมีประเภทอะไรบ้าง แสดงเป็นการ์ดพร้อม "N รุ่นในระบบ" กดการ์ด (`:81`) → `setParams({ category })` URL เปลี่ยนเป็น `/devices?category=...`
3. **ขั้น 2 เลือกรุ่น:** `ModelStep` (`:95-157`) แสดงรุ่นของประเภทนั้น
   - **ช่องพิมพ์เลขรุ่น** (`:119`) กรองรายการ **ที่โหลดมาแล้ว** ฝั่งหน้าจอ ด้วย `manualMatches` (`lib/models.ts:22-24`) ที่ทำให้ตัวอักษรเป็นตัวใหญ่และตัดช่องว่าง/ขีด แล้วเทียบกับ pattern ของรุ่น (รองรับ `*` แทนตัวอักษรใดก็ได้, pattern หลายตัวคั่นด้วย `/`, และชื่อเรียกอื่น `modelAliases`)
   - **ปุ่ม "ฉันไม่ทราบรุ่น"** (`:151-153`) สลับ `isUnknown`: ซ่อนช่องกรอง แสดงคำเตือนว่าขั้นตอนอาจไม่ตรงกับเครื่อง (`:123-127`) แล้วให้เลือกรุ่นที่ใกล้เคียงเอง **ระบบไม่เลือกให้**
   - **กดเลือกรุ่น** (`pick` `:104-106`) → `navigate(symptomsPath(manualId, isUnknown ? 'unknown' : 'selected'))` ไปที่ `/symptoms?manual=<รหัสรุ่น>[&unknown=1]` (`lib/modelSelection.ts:17-21`)
4. **รุ่นที่เลือกเก็บไว้ที่ไหน:** ใน **URL** (`?manual=...`) อ่านกลับด้วย `useChosenModel()` (`lib/modelSelection.ts:9-14`) ไม่มี store กดย้อนกลับ/รีเฟรช/แชร์ลิงก์แล้วยังอยู่รุ่นเดิม

**ไม่มีช่องกรอก device/brand/model แบบอิสระ:** ประเภทเครื่องเป็นรายการคงที่ ยี่ห้อมากับข้อมูลคู่มือ มีเฉพาะช่อง "เลขรุ่นเพื่อกรอง" ที่กรองรายการเดิม

## ตอนที่ 2: เซิร์ฟเวอร์ (Backend)
คำขอ → `cors` → `express.json` → `/traversal` → `traversal.routes.ts`

`traversal.routes.ts:32-34` `GET /manuals` (ไม่มี auth middleware) → `TraversalService.listManuals` (`traversal.service.ts:48-50`) → `GraphRepository.listManuals` (`graph.repository.ts:99-118`)

`listManuals` **ไม่มีตารางคู่มือในหน่วยความจำ** จึงสร้างจากผัง: วนทุกผัง ถ้าคู่มือนั้นเคยเจอแล้วบวก `graphCount` ไม่เคยเจอสร้างรายการใหม่ แนบ `displayName`/`modelAliases` จาก `manualExtras` ได้ผลเป็นรายการรุ่นพร้อมจำนวนอาการ

### แล้วข้อมูลในหน่วยความจำมาจากไหน → ตอนบูต
`app.ts:58` `await graphs.load()` (ต้องเสร็จก่อนรับคำขอ) → `GraphRepository.loadAll` (`graph.repository.ts:120-172`) ยิง SQL สองคำสั่ง:
```sql
-- :121-129  ผังทั้งหมด + ข้อมูลคู่มือ
SELECT g.graph_id, g.manual_id, g.entry_symptom, g.entry_symptom_th, g.entry_symptom_aliases,
       g.source, g.page_start, g.page_end, g.source_chunk_id, g.entry_node,
       m.device_category, m.brand, m.model_pattern, m.display_name, m.model_aliases
  FROM graphs g JOIN manuals m ON m.manual_id = g.manual_id ORDER BY g.graph_id
-- :133-138  โหนดทั้งหมด
SELECT graph_id, node_id, node_type, text_content, on_yes, on_no, next_node, on_invalid,
       input_type, input_pattern, store_as, outcome_kind, safety_critical, safety_warning
  FROM nodes ORDER BY graph_id, display_order
```
แล้วประกอบเป็น `Map` ในหน่วยความจำ (สร้างใหม่ก่อนค่อยสลับ ถ้าข้อมูลเสีย **บูตไม่ขึ้น** ตามที่ออกแบบ) · อุปกรณ์โหลดแบบเดียวกันที่ `app.ts:59` (`equipment.repository.ts:30-37`)

**ทำไมเก็บในหน่วยความจำ:** ผัง ~600 ผังเปลี่ยนน้อย ทุกคำขอใช้ร่วมกัน อ่านจากหน่วยความจำเร็วกว่ายิง DB ซ้ำและ engine เดินผังได้เร็ว **ราคาที่จ่าย:** ข้อมูลใหม่ที่ seed ด้วยสคริปต์ต้องรีสตาร์ต backend ถึงเห็น ส่วนผังที่ admin เผยแพร่ ระบบโหลดซ้ำให้เอง (`drafts.service.ts:199`)

## ทางเลือก: เลือกจากรายการ "อาการทั้งหมด"
`pages/AllSymptomsPage.tsx` → `useGraphs(manualId)` (`queries.ts:61-67`) → **`GET /traversal/graphs?manualId=`** (`api/traversal.ts:19-22`) → `traversal.routes.ts:27-29` (`parseOptionalManualId` ตรวจ) → `TraversalService.listGraphs` (`:42-45` กรองด้วย `manualId`) → `GraphRepository.listAll` (`graph.repository.ts:87-97`) ได้รายการอาการแบบย่อ ไม่ต้องพึ่งระบบค้นหา (ใช้ได้เสมอแม้ระบบค้นหาปิด)

## ตอนที่ 3: ฐานข้อมูล
อ่านตอนบูตเท่านั้น: `graphs`, `manuals`, `nodes` (migration `002_graphs.sql`) และ `equipment`, `equipment_usage` (`003_equipment.sql`) · **ตอนผู้ใช้เลือกเครื่อง ไม่แตะ DB**

## ตอนที่ 4: คำตอบกลับ
```json
// GET /traversal/manuals → 200
[ { "manualId": "samsung_...", "deviceCategory": "microwave", "brand": "Samsung",
    "modelPattern": "GE83MDT...", "displayName": "...", "modelAliases": ["..."], "graphCount": 21 } ]
```
หน้าจอแสดง `brand + ชื่อรุ่น` กับ `{graphCount} อาการ` (`DevicesPage.tsx:139-141`) ชื่อรุ่นใช้ `displayName` ถ้ามี ไม่มีใช้ `modelPattern` (ไม่เดาชื่อ)

## ข้อสังเกต
- `/traversal/manuals` และ `/graphs` ไม่ตรวจ token เลย จึงไม่พังเพราะ token เสีย (`traversal.routes.ts:8`)
- รายการรุ่นถูก invalidate ตอน admin เผยแพร่ (`queries.ts:318-321`) จึงตั้ง `staleTime: Infinity` ได้
- ตอนไม่ทราบรุ่น ระบบ **บันทึก** ว่า `unknown` ไว้แยกเคสตอนวัดผล ไม่เปลี่ยนขั้นตอน (ช่วงถัดไปจะเห็นตอนส่งเข้า session)

## คำถามเช็ก + เฉลย
**1. ตอนสมชายเปิด `/devices` มีการยิง SQL ไหม?**
เฉลย: ไม่มี `listManuals` อ่านจาก `Map` ในหน่วยความจำ SQL ที่เกี่ยวข้องยิงครั้งเดียวตอนบูต (`graph.repository.ts:121-139`)

**2. สมชายกด "ฉันไม่ทราบรุ่น" แล้วเลือกรุ่นหนึ่ง ระบบเก็บอะไร ใช้ทำอะไร?**
เฉลย: URL ได้ `unknown=1` (`modelSelection.ts:17-21`) พอเริ่มตรวจ หน้าจอส่ง `modelSelection:'unknown'` ไป backend → เก็บในคอลัมน์ `sessions.model_selection` (`session.store.ts:42-51`) ใช้แยกเคสตอนวัดผลเท่านั้น **ไม่เปลี่ยนขั้นตอน** และหน้าตรวจแสดงกล่องเตือนว่าขั้นตอนอาจไม่ตรงกับเครื่อง (`SessionPage.tsx:155-157`)

**3. ถ้า admin เพิ่งเผยแพร่คู่มือใหม่ ผู้ใช้ที่เปิดหน้า `/devices` ค้างไว้จะเห็นรุ่นใหม่ไหม?**
เฉลย: ฝั่ง backend ตอบรุ่นใหม่ทันที (publish แล้ว `graphRepository.reload()` `drafts.service.ts:199`) ฝั่งเบราว์เซอร์ของ admin เองล้างแคช `['manuals']` (`queries.ts:318-321`) แต่ผู้ใช้คนอื่นที่เปิดหน้าค้างไว้ แคชไม่หมดอายุ (`staleTime: Infinity`) จึงเห็นรุ่นใหม่เมื่อรีเฟรชหน้า (อ่านจากโค้ด ไม่ได้ทดสอบ)

ไปต่อ **ช่วงที่ 4: พิมพ์อาการ → ค้นหาด้วย embedding → เริ่มตรวจ** (ช่วงที่ยาวและน่าสนใจที่สุด) ได้เลยครับ

---

# ช่วงที่ 4: พิมพ์อาการ → ค้นหาด้วย embedding → เลือก → เริ่มตรวจ

เล่าต่อ: สมชายเลือกรุ่นไมโครเวฟแล้ว หน้า `/symptoms?manual=...` เปิดขึ้น เขาพิมพ์ "ไมโครเวฟไม่ร้อน" ช่วงนี้คือ **"RAG" ตามชื่อเรียกในโจทย์** แต่ของจริงไม่มีขั้นที่ AI เขียนคำตอบ ระบบทำแค่ **ค้นหาอาการที่ใกล้เคียง** แล้ว **ให้ผู้ใช้เลือกเอง** จากนั้นค่อยเดินผังที่เขียนไว้ตามคู่มือ

## ตอนที่ 1: หน้าจอค้นหา (Frontend)
หน้า `pages/SymptomsPage.tsx`
1. ถ้ายังไม่มีรุ่นใน URL → เด้งกลับ `/devices` (`:52` ไม่เดารุ่นให้)
2. กรอกข้อความที่ `components/SymptomSearchForm.tsx` (ช่องพิมพ์ `:29` จำกัด 200 ตัว, ปุ่ม "ค้นหา" `:30-32` กดไม่ได้จนกว่า `checkQuery` จะ `ok` `lib/textInput.ts:31-36`)
3. กดค้นหา → `handleSearch` (`SymptomsPage.tsx:43-46`) → `search.mutate({ query, manualId })` ผ่าน `useSymptomSearch` (`api/queries.ts:97`)
   - ใช้ `useMutation` ไม่ใช่ `useQuery` และไม่แคช เพราะผลขึ้นกับสถานะเซิร์ฟเวอร์ (เช่นตอนแรกยังโหลดโมเดลอยู่) ไม่ควรจำผลเก่า
4. `api/traversal.ts:47-52` → **`POST /symptom-search`** body `{ "query": "ไมโครเวฟไม่ร้อน", "manualId": "samsung_..." }`
5. ผลที่หน้าจอ: มีผล → `SymptomSearchResults.tsx:21-32` แสดงแถวละอาการพร้อม **คะแนนความคล้าย** (`SymptomRow.tsx:28-33`) · ไม่มีผล → ข้อความ "ไม่พบอาการที่ใกล้เคียง… ระบบไม่เดาอาการให้" (`:13-19`) · error บางชนิด (`INVALID_QUERY`, `SEARCH_NOT_READY`, `SEARCH_UNAVAILABLE`) แสดงเป็นกล่องสีฟ้าแทนสีแดง เพราะไม่ใช่ระบบพัง ผู้ใช้ยังไปหน้า "อาการทั้งหมด" ได้ (`SymptomsPage.tsx:31`, `:102-111`)

## ตอนที่ 2: เซิร์ฟเวอร์ค้นหา (Backend)
`symptom-search.routes.ts:9-13` (ไม่มี auth middleware ใครก็ค้นได้) → `parseSearchBody` (`symptom-search.dto.ts:14`) → `SymptomSearchService.search` (`symptom-search.service.ts:160-192`)

ลำดับใน `search`:
1. ระบบยังโหลดโมเดล → **503 `SEARCH_NOT_READY`** (`:161`) · ปิด/ล้ม → 503 `SEARCH_UNAVAILABLE` (`:162`)
2. **แปลงคำค้นเป็นเวกเตอร์** `embedding.embed(query)` (`:164`)
3. **กรองเฉพาะผังของรุ่นที่เลือก** ในหน่วยความจำด้วย `manualId` (`:165-168`) ไม่ใช่ SQL
4. **จัดอันดับ** `rankGraphs` (`symptom-matcher.ts:64-88`)
5. **ตัดผล** `selectMatches(ranked, 0.55, 3)` (`:172`)

### สองแนวคิดที่ต้องเข้าใจ
**Embedding (เวกเตอร์):** โมเดล AI แปลง "ข้อความ" เป็น "ชุดตัวเลข 384 ตัว" ที่ข้อความ **ความหมายใกล้กัน** ได้ตัวเลขใกล้กัน เช่น "ไมโครเวฟไม่ร้อน" กับ "อุ่นอาหารไม่ขึ้น" ได้เวกเตอร์ที่ชี้ไปทางเดียวกัน แม้คำไม่ตรงกัน นี่คือเหตุผลที่ค้นด้วยความหมายได้ ไม่ใช่แค่ตรงคำ (`embedding.service.ts:46-55`: mean pooling + normalize, โมเดล `Xenova/paraphrase-multilingual-MiniLM-L12-v2` `:5-6`)

**Cosine similarity:** วัดว่า "เวกเตอร์สองตัวชี้ไปทางเดียวกันแค่ไหน" (`symptom-matcher.ts:20-41`) ได้ค่า 1 = ทิศเดียวกันพอดี, ยิ่งต่ำยิ่งต่างความหมาย ระบบเทียบคำค้นกับ **ทุกข้อความของทุกผัง** แล้วเก็บ **คะแนนสูงสุดต่อผัง** (`:64-88`) เรียงมากไปน้อย

**ตัดผล:** เอาเฉพาะคะแนน **≥ 0.55** และไม่เกิน **3 ผัง** (`MATCH_THRESHOLD` `:11`, `MAX_RESULTS` `:12`) เทียบกับค่าเต็มก่อน ค่อยปัดเศษ 3 ตำแหน่งตอนส่งออก (`round3` `:180`) ถ้าไม่มีผังไหนถึงเกณฑ์ → `matches: []` **เหตุผลที่เลือก 0.55 และ 3: ไม่ทราบ** ไม่ได้ระบุในโค้ด

## ตอนที่ 3: ดัชนีเวกเตอร์ถูกสร้างเมื่อไร (ตอนบูต)
ผังไม่ได้เก็บเวกเตอร์ไว้ใน MySQL แต่สร้างใหม่ในหน่วยความจำทุกครั้งที่เซิร์ฟเวอร์บูต
1. `app.ts:60` `symptomSearch.start()` **ไม่รอ** (โมเดลโหลดช้า ถ้ารอ เซิร์ฟเวอร์เปิดรับคำขอไม่ได้) ต้องตั้ง env `SYMPTOM_SEARCH_ENABLED=true` (`symptom-search.service.ts:45-54`)
2. `prepareIndex` (`:56-102`): โหลดโมเดล (`embedding.service.ts:23-34` จากโฟลเดอร์ `backend/model` `allowRemoteModels=false`) → `buildSymptomTexts` (`symptom-matcher.ts:43-62`) ดึงข้อความของทุกผัง = ชื่อไทย + ชื่ออังกฤษ + คำเรียกอื่น (aliases) → แปลงเป็นเวกเตอร์ทีละข้อความ (ข้อความซ้ำใช้เวกเตอร์ร่วมกัน `:78-88`) → เก็บใน `this.index`
3. สถานะมี 4 แบบ `disabled → loading → ready / failed` ดูได้ที่ `GET /symptom-search/status` (`routes :15-17`)
4. **ผังใหม่หลัง admin เผยแพร่:** `addGraphs` (`:112-158`) แปลงเฉพาะผังใหม่เข้าดัชนีที่ทำงานอยู่ ไม่ทำใหม่หมด

## ตอนที่ 4: ผู้ใช้เลือกผล → เริ่มตรวจ
1. กดแถว (`SymptomRow.tsx:23`) → `SymptomsPage.tsx:83` → `start(graphId, { query, manualId, modelSelection })` (`lib/useStartSymptom.ts:27-33`)
2. `useStartSession` (`queries.ts:118`) → `api/traversal.ts:37-44` → **`POST /traversal/sessions`** body `{ graphId, query, manualId, modelSelection }` + `headers: ownerHeaders()` (ล็อกอิน: token / guest: `X-Client-Id` ดูเรื่อง identity ที่เพิ่งเรียน)
3. **Backend:** `traversal.routes.ts:40-48` ด่าน `optionalAuth` → `parseStartSessionBody` (`traversal.dto.ts:92-117`) → `resolveOptionalOwner` (`session-owner.ts:14-23`) → `TraversalService.startSession` (`traversal.service.ts:56-73`):
   - `requireGraph` ไม่พบ → 404 · `manualId` ไม่ตรงผัง → 400 `GRAPH_MANUAL_MISMATCH` (`:64-66`)
   - `computeConfidence` (`:186-193`) → `symptomSearch.scoreGraph(query, graphId)` (`symptom-search.service.ts:193-199`) หาคะแนนของผังที่เลือก
   - `engineStartSession` (`traversal-engine.ts:4-24`) สร้าง `sessionId` (UUID) ตั้งโหนดแรก
   - `sessionStore.create` (`session.store.ts:38-57`):
```sql
INSERT INTO sessions
  (session_id, graph_id, current_node_id, status, variables, confidence, model_selection, client_id, user_id, expires_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW() + INTERVAL ? HOUR)   -- 24 ชั่วโมง
```
4. ตอบ **201** (รูปเดียวกับ session ในช่วง 5) → หน้าจอใส่ผลลงแคชทันที (`useCacheSession` `queries.ts:103`) แล้ว `navigate('/session/:id')` (`useStartSymptom.ts:31`) หน้าตรวจเปิดมาพร้อมข้อมูลโดยไม่ยิงซ้ำ

## ที่ไม่ได้เกิดในช่วงนี้ (สำคัญ)
- **ไม่มีการเรียก LLM** ตอนค้นหาและตอนเริ่ม session (ค้นแล้วใน `symptom-search/`, `traversal/`) ไม่มี prompt สร้างคำตอบ LLM ถูกเรียกในช่วง 5 (เรียบเรียงถ้อยคำ) และฝั่ง admin เท่านั้น
- **ไม่มีการเก็บเวกเตอร์ใน DB** และ **ไม่ใช่ SQL filter** กรองด้วย `manualId` ในหน่วยความจำ

## ข้อสังเกต
- "confidence" คือ **คะแนนความคล้ายของข้อความ ไม่ใช่ความน่าจะเป็นที่ถูก** หน้าจอบอกชัดและไม่แปลงเป็น % (`textInput.ts:38-47`)
- `scoreGraph` แปลงคำค้นเป็นเวกเตอร์ **ซ้ำอีกครั้ง** ตอนเริ่ม session (ค้นหาทำไปแล้วหนึ่งรอบ) ทำงานซ้ำซ้อนเล็กน้อย
- ข้อความ "ติดต่อศูนย์บริการ **Samsung**" ตายตัวในหน้าจอ (`SymptomSearchResults.tsx:16`)
- ถ้า `SYMPTOM_SEARCH_ENABLED` ไม่ใช่ `true` ค้นหาตอบ 503 ผู้ใช้ยังเลือกจาก "อาการทั้งหมด" ได้

## คำถามเช็ก + เฉลย
**1. ทำไมตอนเริ่ม session ต้องส่ง `query` ไปด้วย?**
เฉลย: เพื่อให้ backend คำนวณ "คะแนนความคล้าย" ของผังที่เลือก เก็บใน `sessions.confidence` ไว้แสดงผลและวัดผล **ไม่มีผลต่อขั้นตอนที่เดิน** ถ้าเริ่มจากรายการ "อาการทั้งหมด" ไม่ส่ง `query` ค่าจึงเป็น `NULL` (`useStartSymptom.ts:23-26`, `traversal.service.ts:186-187`)

**2. สมชายเลือกรุ่นไมโครเวฟ แต่พิมพ์ว่า "ตู้เย็นไม่เย็น" จะเกิดอะไร?**
เฉลย: ตามตรรกะโค้ด ระบบกรองเฉพาะผังของรุ่นที่เลือก (`symptom-search.service.ts:165-168`) จึงเทียบกับอาการของไมโครเวฟเท่านั้น คะแนนน่าจะต่ำกว่า 0.55 → `matches: []` → หน้าจอแสดง "ไม่พบอาการที่ใกล้เคียง" พร้อมทางไป "อาการทั้งหมด" (ไม่ได้ทดสอบจริง)

**3. backend เพิ่งบูต สมชายกดค้นหาทันที จะเห็นอะไร?**
เฉลย: โมเดลยังโหลด (`state='loading'`) → **503 `SEARCH_NOT_READY`** (`symptom-search.service.ts:161`) หน้าจอแสดงกล่องสีฟ้า ไม่ใช่ error แดง (`SymptomsPage.tsx:31`, `:102-111`) และชวนใช้ "อาการทั้งหมด" ระบบไม่ล่ม เพราะ `start()` ไม่รอโมเดล

**4. ค่า 0.55 และ top 3 เลือกด้วยเหตุผลอะไร?**
เฉลย: **ไม่ทราบ** ในโค้ดไม่ได้ระบุเหตุผล (และเอกสารบันทึกว่าเกณฑ์ยังไม่ได้ประเมินด้วยชุดทดสอบที่มนุษย์ตรวจ) ถ้ากรรมการถาม ตอบตรงๆ ว่าไม่ทราบเหตุผลที่เลือก และบอกว่าเป็นเกณฑ์เสนอรายการให้เลือก ไม่ใช่ตัวตัดสินความถูกต้อง

ไปต่อ **ช่วงที่ 5: เดินผังทีละขั้น** (ตอบ ใช่/ไม่ใช่ ด่านความปลอดภัย และที่มาของแต่ละขั้น) ได้เลยครับ

---

# ช่วงที่ 5: เดินผังทีละขั้น

เล่าต่อ: สมชายเลือกอาการ "ไมโครเวฟไม่ร้อน" แล้ว ระบบพาไปหน้า `/session/<id>` ช่วงนี้คือหัวใจของระบบ: **ขั้นถัดไปถูกตัดสินโดยโค้ด (เครื่องสถานะ) ไม่ผ่าน AI** หน้าจอแค่แสดงขั้นที่เซิร์ฟเวอร์ส่งมาและส่งสิ่งที่ผู้ใช้ทำกลับไป

> ⚠️ ไฟล์ `traversal.routes.ts` (94→52 บรรทัด) และ `traversal.service.ts` (193→191) ถูกลบคอมเมนต์ไปแล้ว เลขบรรทัดที่ผมเคยให้ในช่วง 3–4 ของทั้งสองไฟล์จึงเลื่อน ช่วงนี้ใช้เลขปัจจุบันที่ตรวจแล้ว (ท้ายข้อความมีข้อเสนอรีเฟรชเอกสาร)

## ตอนที่ 1: หน้าจอได้ข้อมูลมาจากไหน
`SessionPage.tsx` (route `/session/:sessionId` — `App.tsx:47`)
- **ปกติไม่ต้องยิงเซิร์ฟเวอร์เลย:** ตอนเริ่ม session คำตอบถูกใส่ในแคชไว้แล้ว (`useCacheSession` `api/queries.ts:103`) `useSession` (`:53`) อ่านจากแคช
- **เปิดลิงก์ตรง/กด F5** แคชว่าง → `GET /traversal/sessions/:id` (`api/traversal.ts:54-56`) → `traversal.routes.ts:27-30` (`optionalAuth`) → `TraversalService.getSession` (`traversal.service.ts:74`): `authorize` `:136` → `requireSession` `:148` → `SessionStore.find` (อ่าน `sessions` + `session_history`) → `getCurrentNode` ของ engine

## ตอนที่ 2: หน้าจอแสดงอะไร (ตรงกับหัวข้อ "คำตอบ" ในโจทย์)
`SessionPage.tsx:149-176` ประกอบหลาย component:

| ส่วน | component:บรรทัด | ข้อมูลมาจาก |
|---|---|---|
| **Problem** (ชื่ออาการ + ยี่ห้อ/รุ่น) | `SessionHeader.tsx:19`, `:22-27` | รายการอาการที่โหลดไว้ (`SessionPage.tsx:42`) |
| **Confidence** | `SessionHeader.tsx:34-38` "คะแนนความคล้าย 0.812 (ข้อมูลประกอบ)" ซ่อนถ้า `null` | `session.confidence` |
| **Solution** (ขั้นตอนปัจจุบัน) | `step/StepView.tsx:24-44` เลือกหน้าตาตามชนิดโหนด | `session.node` |
| **Safety** | `step/SafetyGateStep.tsx:8-36` กล่องแดง + ช่องติ๊ก + ปุ่ม | `node.safetyWarning`, `requiresSafetyConfirmation` |
| **References** | `step/ReferenceLine.tsx:23-36` "ที่มาของขั้นตอนนี้: คู่มือ … หน้า 12–14" ติดทุกขั้นผ่าน `StepCard.tsx:37` | `node.reference` |
| อุปกรณ์ที่อาจต้องใช้ | `EquipmentPanel.tsx:31-70` | `session.equipment` |
| ข้อความที่ AI ปรับถ้อยคำ | `RephraseNote.tsx` ปุ่มดูต้นฉบับ (`SessionPage.tsx:173`) | `session.displayText` |
| เส้นทางที่ผ่านมา | `step/PathRail.tsx:41-66` + `lib/trail.ts:12` | state `trail` ในหน้า (`SessionPage.tsx:45`) |

**Possible Cause: ไม่พบ** (ผังไม่มีฟิลด์นี้ ตั้งใจไม่ใส่)

### `StepView` เลือกหน้าตาอย่างไร (`StepView.tsx:24-44`)
```
node.isTerminal              → OutcomeStep      (ข้อสรุป + ฟอร์มบันทึกผล)
node.requiresSafetyConfirmation → SafetyGateStep (ติ๊กยืนยันก่อนกดไปต่อ)
node.type === 'checkpoint'   → CheckpointStep   (ปุ่ม ใช่ / ไม่ใช่)       :47-60
node.type === 'input'        → InputStep        (ช่องกรอก เช่น รหัสแจ้งเตือน)
อื่นๆ (instruction)          → InstructionStep  (ปุ่ม ถัดไป)             :63-71
```
หน้าจอ **ไม่ตัดสินขั้นถัดไปเอง** (คอมเมนต์ที่ `:23`) แค่ส่ง action กลับ

## ตอนที่ 3: ผู้ใช้กดปุ่ม → ส่ง action
1. กดปุ่ม เช่น "ใช่" (`StepView.tsx:51`) → `onAction({ type:'answer', value:'yes' })`
2. `handleAction` (`SessionPage.tsx:50-61`): กันกดซ้ำด้วย `isSendingRef` (`:51-52`) → `submit.mutate(action)` และเมื่อสำเร็จเพิ่มขั้นที่ผ่านลง `trail` (`:56`)
3. `useSubmitAction` (`queries.ts:125`) → `api/traversal.ts:58-66` → **`POST /traversal/sessions/:id/actions`**
4. body มี 4 แบบ ตามชนิดการกระทำ:
   - `{ "type":"answer", "value":"yes" | "no" }` (checkpoint)
   - `{ "type":"continue" }` (instruction ธรรมดา)
   - `{ "type":"confirm_safety" }` (instruction ที่ต้องยืนยันความปลอดภัย)
   - `{ "type":"input", "value":"E4" }` (กรอกข้อความ)

## ตอนที่ 4: เซิร์ฟเวอร์ตัดสินขั้นถัดไป (Backend)
คำขอ → `cors` → `express.json` → `/traversal` → `traversal.routes.ts:32-36`
1. **auth middleware:** `optionalAuth` (ไม่มีบัตร = guest, บัตรเสีย = 401)
2. **ตรวจ input:** `parseTraversalAction` (`traversal.dto.ts:119`) `switch` ตาม `type`: `answer` ต้อง `yes`/`no`, `input` ต้องเป็นข้อความ ≤ 255 (`MAX_INPUT_LENGTH` `:5`) ชนิดอื่น → 400
3. **service** `TraversalService.submitAction` (`traversal.service.ts:86`):
   - `authorize` (`:136-141`) ถามว่า session นี้มีเจ้าของเป็น user ไหม (`SELECT user_id FROM sessions WHERE session_id = ? AND expires_at > NOW()`) ถ้ามีและไม่ใช่คนที่ขอ → 404
   - `requireSession` (`:148`) → `SessionStore.find` (`session.store.ts:59-87`): อ่านแถว session + ประวัติขั้นที่ผ่านมา
   - `requireGraph` (`:142`) หาผังจากหน่วยความจำ
   - **`engineSubmitAction(session, graph, action)` (`:95`)** ← ตัดสินขั้นถัดไป
   - `sessionStore.update(...)` (`:98-101`) บันทึกผล ← **รันหลัง engine อนุมัติเท่านั้น** ถ้า engine โยน error บรรทัดนี้ไม่ถูกรัน DB ไม่เปลี่ยน
   - `toResponse` ประกอบคำตอบ

### เครื่องสถานะ (`traversal-engine/traversal-engine.ts`)
`submitAction` (`:41-72`) → `resolveNextNode` (`:74-125`) ตามชนิดโหนดปัจจุบัน:

| โหนด | ต้องส่ง | ไปโหนดไหน | ผิดชนิด |
|---|---|---|---|
| `checkpoint` `:80-88` | `answer` | `yes` → `on_yes` / `no` → `on_no` | `InvalidActionError` |
| `instruction` ธรรมดา `:98-101` | `continue` | `next` | `InvalidActionError` |
| `instruction` **ที่ `safety_critical`** `:91-97` | `confirm_safety` | `next` | ส่ง `continue` → **`SafetyConfirmationRequiredError`** |
| `input` `:104-119` | `input` | ตรง pattern → `next` เก็บค่าไว้ใน `variables[store_as]` · ไม่ตรง → `on_invalid` (หรือโหนดเดิม) | `InvalidActionError` |
| `resolution`/`escalation` `:121-123` | – | จบแล้ว | `InvalidActionError` |

ถึงโหนดจบ → `status = 'completed'` (`:61`) แล้ว `renderNode` (`:126-148`) ประกอบข้อความ (แทน `{{ตัวแปร}}` ด้วยค่าที่ผู้ใช้กรอก `:168-172`), `reference = { source, pageRange }` (`:131-134`), `requiresSafetyConfirmation`, `isTerminal`, `outcomeKind`

**ด่านความปลอดภัยบังคับสองฝั่ง:** หน้าจอ (ติ๊กก่อนกด) **และ** engine (ไม่ยอมรับ `continue` ที่โหนด safety) ต่อให้เรียก API ตรงก็ข้ามไม่ได้

### บันทึกผล (รายละเอียดอยู่ช่วง 6)
`SessionStore.update` (`session.store.ts:89-142`) ใน transaction เดียว:
```sql
UPDATE sessions SET current_node_id = ?, status = ?, variables = ?, expires_at = NOW() + INTERVAL ? HOUR WHERE session_id = ?
INSERT INTO session_history (session_id, step_order, node_id, action_type, action_value) VALUES (?, ?, ?, ?, ?)
```

## ตอนที่ 5: ประกอบคำตอบ + AI ปรับถ้อยคำ
`toResponse` (`traversal.service.ts:154`) ได้ `{ sessionId, graphId, status, node, equipment, confidence, outcome, displayText }`
- `equipment`: จากหน่วยความจำ `findByCategory` (`:165`) ตามประเภทเครื่อง
- `displayText`: `displayTextOf` (`:172`) เรียก `RephraseService.rephrase` (`rephrase.service.ts:35-62`) → ข้ามโหนด safety/จบ (`:40`) · timeout 3 วินาที (`:46`) · ผลต้องผ่านด่านตรวจ `checkRephrase` (`rephrase-guard.ts:26-61`: ตัวเลข ชื่อรหัส คำ "ไม่" ความยาว) · ล้ม/ช้า/ไม่ผ่าน → `null` ใช้ข้อความต้นฉบับ prompt ที่ส่ง Groq อยู่ `groq-llm.client.ts:5-11` ห้ามเปลี่ยนความหมาย
- หน้าจอกันซ้ำอีกชั้น: ใช้ `displayText` เฉพาะเมื่อ `!safetyCritical && !requiresSafetyConfirmation && !isTerminal` (`SessionPage.tsx:123-125`) แล้วแสดงปุ่ม "ดูข้อความต้นฉบับ"

ตอบ **201** → `useCacheSession` ใส่ session ใหม่ในแคช (`onSuccess`) หน้าจอแสดงขั้นถัดไปทันที ถ้าเซิร์ฟเวอร์ปฏิเสธ `onSuccess` ไม่ทำงาน แคชยังเป็นสถานะเดิม หน้าจอไม่ขยับ (ตรงกับสถานะจริง)

## ถ้ามีอะไรผิดพลาด
| กรณี | ผลที่ได้ |
|---|---|
| ส่ง `continue` ที่โหนด safety | 400 `SAFETY_CONFIRMATION_REQUIRED` (ตาราง `ENGINE_ERRORS` `error-handler.ts:38-43`) |
| action ผิดชนิดกับโหนด | 400 `INVALID_ACTION` |
| session จบแล้วยังส่ง action | 409 `SESSION_COMPLETED` |
| session ไม่มี/หมดอายุ/ไม่ใช่ของเรา | 404 `SESSION_NOT_FOUND` |
| ผังหายไป | 404 `GRAPH_NOT_FOUND` |
| ส่ง action พร้อมกันสองคำขอ | ผู้แพ้อาจได้ 500 แทน 409 (UNIQUE `session_history (session_id, step_order)` ชน เป็น error ของ MySQL ที่ไม่ได้ห่อเป็น `ApiError`) ตามที่บันทึกไว้ ไม่ได้ทดสอบ |

หน้าจอแสดง error ผ่าน `ErrorNotice` พร้อมปุ่ม "ดึงขั้นตอนล่าสุด" (`SessionPage.tsx:160`) ที่ล้างสถานะแล้วโหลด session ใหม่

## ข้อสังเกต
- **session ของ guest ไม่ถูกตรวจเจ้าของ** ที่ `GET`/`actions`/`outcome`: `authorize` (`traversal.service.ts:136-141`) เช็กเฉพาะ session ที่มี `user_id` ถ้าเป็นของ guest (`user_id` เป็น NULL) ใครรู้ `sessionId` (UUID เดายาก) ก็อ่าน/เดินได้ มีแค่ `DELETE` และ `/history` ที่ตรวจ `client_id` (อ่านจากโค้ด ไม่ได้ทดสอบ)
- AI ถูกเรียก **ทุกครั้งที่ประกอบ response** (มีแคชผลที่ผ่านในหน่วยความจำ `rephrase.service.ts:27`, `:42-43`)
- ไม่มีขั้นที่ LLM ตัดสินว่าจะไปไหนต่อ ขั้นถัดไปมาจากผังล้วนๆ

## คำถามเช็ก + เฉลย
**1. สมชายกด "ใช่" สองครั้งเร็วๆ จะเกิดอะไร?**
เฉลย: หน้าจอกันไว้สองชั้น: `isSendingRef` ทิ้งคลิกที่สอง (`SessionPage.tsx:51-52`) และปุ่มถูกปิดระหว่างส่ง (`StepView.tsx:51-56` `disabled={isPending}`) ถ้าคำขอสองตัวหลุดไปถึง backend จริง ตัวหลังอาจชน UNIQUE ของ `session_history` แล้วได้ 500 (ข้อจำกัดที่รู้ ไม่ได้ทดสอบ)

**2. ใครยิง API ตรงๆ ส่ง `{type:'continue'}` ที่โหนดความปลอดภัย จะเกิดอะไร?**
เฉลย: engine โยน `SafetyConfirmationRequiredError` (`traversal-engine.ts:91-94`) → `errorHandler` แปลงเป็น 400 `SAFETY_CONFIRMATION_REQUIRED` และ **ไม่มีอะไรถูกบันทึก** เพราะ `engineSubmitAction` (`traversal.service.ts:95`) รันก่อน `sessionStore.update` (`:98`)

**3. ข้อความของโหนดแบบไหนที่ AI จะไม่ปรับถ้อยคำ?**
เฉลย: โหนดความปลอดภัย (`safetyCritical`/ต้องยืนยัน) และโหนดจบ (resolution/escalation) ทั้งฝั่ง backend (`rephrase.service.ts:40`) และหน้าจอ (`SessionPage.tsx:123`) เหตุผล: ด่านตรวจ (guard) ตรวจรูปแบบ ไม่ตรวจความหมาย เคยทดสอบแล้ว "ถอดปลั๊ก" → "เสียบปลั๊ก" ผ่านได้ ข้อความที่เสี่ยงสุดจึงไม่ให้ AI แตะ

**4. ถ้า engine ปฏิเสธ action ข้อมูลใน DB เปลี่ยนไหม?**
เฉลย: ไม่เปลี่ยน `sessionStore.update` อยู่หลัง `engineSubmitAction` ถ้า engine โยน error บรรทัด update ไม่ถูกรัน ไม่ต้องมีโค้ด "ย้อนสถานะ"

**5. ทำไมหน้าจอไม่ตัดสินขั้นถัดไปเอง ให้เซิร์ฟเวอร์ตัดสิน?**
เฉลย: กฎของระบบ ขั้นตอนและด่านความปลอดภัยต้องบังคับที่เดียวที่ยิง API ตรงก็ข้ามไม่ได้ (engine) หน้าจอแค่แสดงและส่ง action ถ้าให้หน้าจอตัดสินเอง คนแก้โค้ดหน้าจอหรือยิง API ข้ามไปจะข้ามด่านความปลอดภัยได้

---

ข้อเสนอ: `docs/USER_JOURNEY_WALKTHROUGH.md` ยังอ้างเลขบรรทัดเก่าของ `traversal.routes.ts`, `traversal.service.ts` และ `api/queries.ts` (ที่ถูกลบคอมเมนต์) ให้ผมรีเฟรชเลขทั้งเอกสารให้ตรงไฟล์ปัจจุบันไหมครับ และถ้าอยากได้ไฟล์บันทึกช่วงนี้ (`JOURNEY-5-SESSION.md` แบบเดียวกับช่วง 1–2) สั่งได้เลย พร้อมไป **ช่วงที่ 6 (บันทึกประวัติ)** เมื่อบอกครับ
