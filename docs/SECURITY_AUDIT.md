# รายงานตรวจความปลอดภัยตาม OWASP Top 10 (2021)

- โปรเจกต์: `appliance-repair-assistant` (backend + frontend)
- วันที่ตรวจ: 24 ต.ค. 2026
- วิธีตรวจ: อ่านโค้ดอย่างเดียว (read-only) + `npm audit` + ค้นรูปแบบ secret ใน git history ทุก revision
- ไม่ได้เชื่อมต่อฐานข้อมูลจริง ไม่ได้ยิงคำขอไปที่ Render และไม่ได้อ่านค่าใน `.env`

---

## 0. ขอบเขตและข้อสังเกตก่อนอ่าน

stack ที่แจ้งมากับโค้ดจริงต่างกันอยู่บางข้อ รายงานนี้ยึดตามโค้ดจริง:

| ที่แจ้งมา | ที่พบในโค้ด | ผลต่อการตรวจ |
|---|---|---|
| NestJS | **working tree เป็น Express แล้ว** (`backend/package.json:6`, `backend/src/app.ts`) การย้ายยังไม่ commit ส่วน git HEAD ยังเป็น NestJS | ตรวจโค้ด Express ใน working tree เป็นหลัก ส่วน HEAD (NestJS) ดูเฉพาะ `main.ts`: **ไม่มี helmet / ValidationPipe / throttler เช่นกัน** ข้อค้นพบส่วนใหญ่จึงใช้กับทั้งสองเวอร์ชัน |
| Guard / ValidationPipe | ใช้ middleware `requireAuth` / `requireAdmin` / `optionalAuth` (`backend/src/auth/auth.middleware.ts`) และ parser ที่เขียนเอง (`*.dto.ts`) | A01/A05 ประเมินจาก middleware และ parser แทน |
| Docker/Render | **ไม่มี Dockerfile** มีแค่ `render.yaml` (runtime: node) | ตรวจได้เฉพาะ `render.yaml` |
| RAG: embedding เก็บใน MySQL | embedding **คำนวณตอนบูตและเก็บในหน่วยความจำ** (`symptom-search.service.ts:79-90`) ใช้โมเดล ONNX ในเครื่อง ไม่พบตาราง embedding ใน migration | ตรวจการค้นหาแบบ in-memory แทน |
| คำตอบ AI | LLM (Groq) ใช้แค่ 2 งาน: (1) เรียบเรียงข้อความโหนด (`rephrase/`) (2) ร่างผังจาก PDF ฝั่ง admin (`authoring/`) **ไม่มีแชตที่ LLM ตอบคำถามผู้ใช้อย่างอิสระ** | ประเมิน prompt injection ตามสองเส้นทางนี้ |

---

## 1. สรุปภาพรวม

ภาพรวม**อยู่ในเกณฑ์ดีสำหรับระดับโปรเจกต์นี้** จุดแข็งที่ตรวจแล้วยืนยันได้:

- SQL ทุกคำสั่งใน Repository/Store ใช้ placeholder `?` ส่วนที่ต่อสตริงเป็นค่าคงที่ทั้งหมด ไม่พบ SQL injection
- ประวัติการซ่อม + feedback กรองด้วยเจ้าของในคำสั่ง SQL เดียวกันทุกจุด ไม่พบ IDOR
- route ฝั่ง admin และ ingest PDF ผ่าน `requireAuth → requireAdmin` ครบทุกตัว ตรวจสิทธิ์**ก่อน** multer รับไฟล์
- รหัสผ่านใช้ bcrypt + dummy hash กัน timing attack ส่วน JWT ล็อก algorithm `HS256` ทั้งตอน sign และ verify และบังคับให้ secret ยาวอย่างน้อย 32 ตัวอักษร
- frontend ไม่มี `dangerouslySetInnerHTML` / `innerHTML` / `eval` เลย ข้อความจาก AI และ comment ถูก render เป็น text ผ่าน JSX
- ไม่พบ secret ใน git history หรือในโค้ด `.env` ของ backend อยู่ใน `.gitignore` และไม่เคยถูก commit
- ผังจาก PDF ต้องผ่าน validator + คนตรวจ + transaction ก่อนเผยแพร่

**จุดที่ควรแก้ก่อน:**

1. **ไม่มี rate limit เลยทั้งแอป** ทำให้ brute-force รหัสผ่าน (รวมบัญชี admin) ได้ไม่จำกัด และยิง endpoint ที่กิน CPU/เรียก LLM ได้ไม่จำกัด
2. **dependency ฝั่ง production มีช่องโหว่ 4 ตัว** (critical 1, high 2, moderate 1) แก้ได้ด้วยการอัปเดต patch
3. error 500 ส่ง `message` ดิบ (รวม error ของ mysql2) กลับไปให้ client
4. JWT เก็บใน `localStorage` อายุ 7 วัน ไม่มีทางเพิกถอน และ role ฝังในบัตร

---

## 2. รายละเอียดทีละข้อ

> path ทั้งหมดนับจาก root ของโปรเจกต์ (`appliance-repair-assistant/`)

### A01:2021 – Broken Access Control

#### A01-1 IDOR ของ Repair History และ Feedback — **ไม่พบช่องโหว่**

- หลักฐาน:
  - `backend/src/auth/session-owner.ts:25-30` สร้างเงื่อนไขเจ้าของ: user → `(user_id = ?)`, guest → `(client_id = ? AND user_id IS NULL)`
  - `backend/src/history/history.store.ts:54, 69, 99` ทุก query ของรายการ/รายละเอียด/ลบ ใส่ `session_id = ? AND ${ownerWhere}` ในคำสั่งเดียว
  - `backend/src/history/history.service.ts:91-92` บันทึก feedback ได้ต่อเมื่อ `requireOwned()` ผ่านก่อน ส่วน `:69-72` อ่าน feedback/steps ได้หลังผ่าน `requireOwned()` เท่านั้น
  - `backend/src/history/history.service.ts:35-36` ไม่ใช่เจ้าของจะได้ 404 เหมือนกับ "ไม่มี" จึงไม่บอกว่า id นั้นมีอยู่จริง
  - guest มองไม่เห็น/ลบ session ของ user ไม่ได้ เพราะมีเงื่อนไข `user_id IS NULL`
- ข้อสังเกต: `admin.service.ts:33-46` หน้า admin feedback ส่งออกเฉพาะฟิลด์ที่ประกาศ ไม่มี email/user id หลุดออกไป

#### A01-2 session ที่กำลังเดินขั้นตอนของ guest ไม่ตรวจเจ้าของ — **Low**

- ไฟล์: `backend/src/traversal/traversal.service.ts:136-141`, `backend/src/traversal/traversal.routes.ts:27-42`
- หลักฐาน:
  ```ts
  private async authorize(sessionId: string, requesterUserId?: string): Promise<void> {
    const ownerUserId = await this.sessionStore.findUserId(sessionId);
    if (ownerUserId !== null && ownerUserId !== requesterUserId) { throw sessionNotFound(sessionId); }
  }
  ```
  ถ้า `user_id` เป็น NULL (session ของ guest หรือไม่มีเจ้าของ) **ใครก็ตามที่รู้ sessionId** จะ `GET /traversal/sessions/:id`, ส่ง action และบันทึก outcome ได้ โดยไม่ตรวจ `X-Client-Id` ต่างจาก `DELETE` (`traversal.routes.ts:44-48`) ที่ตรวจ
- ที่ให้ระดับต่ำ: sessionId เป็น UUID v4 สุ่ม (`traversal-engine.ts:14`) เดาไม่ได้ และไม่มี endpoint ไหนเปิดเผย sessionId ของคนอื่น
- แนวทางแก้: ใน `authorize()` ให้ดึงทั้ง `user_id` และ `client_id` มาเทียบกับ `resolveOptionalOwner()` แบบเดียวกับ `ownerWhere()` ถ้า session มี `client_id` ต้องส่ง `X-Client-Id` ที่ตรงกันมาด้วย

#### A01-3 `X-Client-Id` ทำหน้าที่เป็น bearer secret ของ guest — **Low (เป็นการออกแบบที่รู้อยู่แล้ว)**

- ไฟล์: `backend/src/traversal/traversal.dto.ts:23`, `frontend/src/lib/clientId.ts:7`
- หลักฐาน: คอมเมนต์ในโค้ดระบุเองว่า "ไม่ใช่การยืนยันตัวตน — ใครรู้ id ก็เห็นประวัติของ guest id นั้นได้" และ id ถูกเก็บใน `localStorage`
- แนวทางแก้: ยอมรับได้ในฐานะ trade-off ถ้าอยากให้แข็งขึ้น ให้ backend ออก client id ที่มีลายเซ็น (HMAC) แทนการให้เบราว์เซอร์สุ่มเอง หรือย้ายประวัติ guest ไปใช้บัญชีเมื่อผู้ใช้ล็อกอิน

#### A01-4 Guard ครบทุก route / endpoint admin และ ingest — **ไม่พบช่องโหว่**

- `backend/src/app.ts:70-76` ตารางการ mount:

  | path | middleware | ประเมิน |
  |---|---|---|
  | `/health`, `/symptom-search`, `/traversal/graphs`, `/traversal/manuals` | ไม่มี | ข้อมูลสาธารณะตามการออกแบบ |
  | `/auth/register`, `/auth/login` | ไม่มี | ถูกต้อง |
  | `/auth/me` | `requireAuth` | ถูกต้อง |
  | `/traversal/sessions*`, `/history*` | `optionalAuth` + ตรวจเจ้าของใน service | ดู A01-1, A01-2 |
  | `/admin/feedback`, `/admin/analytics/summary` | `requireAuth, requireAdmin` (`admin/admin.routes.ts:26-27, 36-37`) | ถูกต้อง |
  | `/admin/drafts` ทั้ง 6 route | `...adminOnly` (`authoring/drafts.routes.ts:75-109`) | ถูกต้อง และ `uploadPdf()` อยู่**หลัง** adminOnly (`:77`) คนที่ไม่ใช่ admin จึงอัปไฟล์ไม่ได้ |
- สร้าง admin ได้ทางเดียวผ่าน `backend/scripts/seed-admin.js` ส่วน `/auth/register` ตั้ง `Role.User` ตายตัว (`auth.service.ts:43`) ผู้ใช้จึงยกสิทธิ์ตัวเองผ่าน body ไม่ได้
- `frontend/src/components/auth/AdminRoute.tsx:16` ระบุเองว่าเป็นแค่ UX ส่วนการป้องกันจริงอยู่ที่ backend ซึ่งตรวจแล้วว่าครบ

---

### A02:2021 – Cryptographic Failures

#### A02-1 การ hash รหัสผ่าน — **ไม่พบช่องโหว่ (มีข้อเสนอแนะ)**

- `backend/src/auth/auth.service.ts:10` `BCRYPT_ROUNDS = 10` · `:34` hash ตอนสมัคร · `:58` เทียบด้วย `compare()` และใช้ `dummyHash` (`:26`) เมื่อไม่พบผู้ใช้ เวลาตอบจึงใกล้กันทั้งกรณีมีและไม่มีอีเมล
- `backend/src/auth/auth.dto.ts:6-7, 72` จำกัดรหัสผ่านไม่เกิน 72 ไบต์ (กันปัญหา bcrypt ตัดส่วนท้ายทิ้งแบบเงียบ)
- `backend/migrations/001_users.sql` เก็บแค่ `password_hash`
- ข้อเสนอแนะ (Low): ปรับ cost เป็น 12 ถ้า CPU ของ Render free tier รับไหว

#### A02-2 JWT secret / อายุ / algorithm — **Low**

- `backend/src/auth/token.ts:16` บังคับ `JWT_SECRET` ยาว ≥ 32 ตัวอักษร ถ้าไม่ผ่านจะบูตไม่ขึ้น
- `:33` sign ด้วย `HS256` · `:38` verify ด้วย `algorithms: ['HS256']` กันการโจมตีแบบ `alg: none` และการสลับ algorithm
- `:5` อายุเริ่มต้น `7d` **ค่อนข้างยาว** สำหรับ access token ที่ไม่มีระบบเพิกถอน (ดู A07-3)
- `render.yaml` ไม่ได้ประกาศ `JWT_SECRET` / `GROQ_API_KEY` (แม้แบบ `sync: false`) จึงต้องตั้งเองใน dashboard ซึ่งไม่ใช่ช่องโหว่ แต่ลืมได้ง่าย (ถ้าลืม แอปจะบูตไม่ขึ้นเพราะ token.ts:16)
- แนวทางแก้: ลดอายุเหลือ 15 นาที–1 ชั่วโมง แล้วเพิ่ม refresh token หรืออย่างน้อยลดเหลือ 1 วัน และเพิ่ม `JWT_SECRET`, `GROQ_API_KEY` เป็น `sync: false` ใน `render.yaml`

#### A02-3 การเชื่อมต่อฐานข้อมูล — **ไม่พบช่องโหว่**

- `backend/src/database/pool.ts:43` ใช้ TLS พร้อม CA เมื่อตั้ง `DB_SSL_CA` · `:52-53` log เฉพาะวันหมดอายุของใบรับรอง ไม่ log เนื้อหาใบรับรองหรือรหัสผ่าน
- หมายเหตุ: ถ้าไม่ตั้ง `DB_SSL_CA` ระบบจะต่อแบบไม่เข้ารหัสโดยเตือนแค่ใน log (`:53`) ตรวจไม่ได้ว่าบน Render ตั้งค่านี้แล้วหรือยัง เพราะไม่ได้อ่านค่า env

---

### A03:2021 – Injection

#### A03-1 SQL ใน Repository Layer — **ไม่พบช่องโหว่**

ไล่ทุกจุดที่ใช้ template literal ในคำสั่ง SQL (`grep '\${'` ร่วมกับคำสงวน SQL ใน `backend/src` และ `backend/scripts`):

| ไฟล์:บรรทัด | สิ่งที่ต่อเข้าไป | ปลอดภัยไหม |
|---|---|---|
| `admin/admin.store.ts:71, 77, 89` | `whereSql` ประกอบจากสตริงคงที่ `'f.helpful = ?'` ฯลฯ ค่าจริงอยู่ใน `params` | ใช่ |
| `admin/admin.store.ts:86` | `OWNER_TYPE_SQL` ค่าคงที่ | ใช่ |
| `history/history.store.ts:54, 69, 99`, `traversal/session.store.ts:165` | `ownerWhere().sql` เป็นค่าคงที่ 2 แบบ (`session-owner.ts:27, 29`) | ใช่ |
| `auth/users.store.ts:56, 61`, `authoring/drafts.store.ts:127, 215` | `SELECT_USER` / `SELECT_DRAFT` ค่าคงที่ | ใช่ |
| `authoring/drafts.store.ts:224-226` | ชื่อคอลัมน์จาก `MANUAL_COLUMNS` / `GRAPH_COLUMNS` / `NODE_COLUMNS` (`as const` ใน `draft-manual.ts:50-58`) ค่าจริงส่งผ่าน `VALUES ?` | ใช่ |
| `scripts/backup-graph-tables.js:66, 73` | ชื่อตารางจากรายการคงที่ ค่าในแถวผ่าน `sqlValue(conn, …)` | ใช่ (เป็นสคริปต์ ops ไม่ใช่ runtime) |

- `LIMIT ? OFFSET ?` ก็ใช้ placeholder (`admin.store.ts:91-92`, `history.store.ts:56-57`)
- runtime ไม่ได้เปิด `multipleStatements` (`database/pool.ts:32-44`) มีเปิดเฉพาะ `scripts/run-migrations.js:27` ซึ่งอ่านไฟล์ `.sql` ในเครื่อง ยอมรับได้
- ใช้ `pool.query()` (escape ฝั่ง client) แทน `execute()` (prepared statement ฝั่ง server) ก็ยังปลอดภัยเพราะทุกค่าผ่าน `?`

#### A03-2 Prompt injection จากข้อความผู้ใช้ — **Low**

- เส้นทาง rephrase: `traversal.service.ts:172-182` ส่ง `node.text` ไปที่ `groq-llm.client.ts:30-33` ข้อความหลักมาจากผังที่ admin เผยแพร่ ไม่ใช่ข้อความอิสระของผู้ใช้
- **มีช่องเล็กๆ:** `traversal-engine.ts:139, 168-171` แทนค่า `{{ตัวแปร}}` ด้วยข้อความที่ผู้ใช้กรอกในโหนด input (สูงสุด 255 ตัว, `traversal.dto.ts:5`) **ก่อน** ส่งไป rephrase ข้อความของผู้ใช้จึงเข้า prompt ได้ ถ้าผังมีโหนดที่อ้าง `{{error_code}}` (prompt ของการร่างผังแนะนำให้ใช้รูปแบบนี้, `draft-llm.client.ts:49`)
  - ผลกระทบจำกัด: ผลลัพธ์แสดงเฉพาะผู้ใช้คนนั้น เป็น text ล้วน และต้องผ่าน `rephrase-guard.ts:26-60` (ตรวจลิงก์ HTML ตัวเลข ชื่อเฉพาะ จำนวนคำปฏิเสธ และสัดส่วนความยาว) ส่วนโหนด safety/resolution/escalation ไม่ถูก rephrase เลย (`rephrase.service.ts:40`)
  - ตรวจข้อมูลใน `data/` แล้ว**ไม่พบ** `{{…}}` และไม่พบโหนด input ส่วนฐานข้อมูล production ตรวจไม่ได้เพราะไม่ได้เชื่อมต่อ
- คำค้นของผู้ใช้ (`/symptom-search`) ใช้แค่กับโมเดล embedding ไม่ได้เข้า LLM จึงไม่เกี่ยวกับ prompt injection
- แนวทางแก้: rephrase จาก**ข้อความต้นฉบับก่อนแทนค่าตัวแปร** แล้วค่อยแทนค่าหลังจากได้ผล หรือข้ามการ rephrase เมื่อโหนดมี `{{…}}`

#### A03-3 Prompt injection จากเนื้อหา PDF/chunk (indirect) — **Low**

- `authoring/draft-llm.client.ts:64-71` ใส่ข้อความ PDF ลงใน user message ตรงๆ PDF ที่ถูกแก้ไขอาจสั่งให้ LLM ร่างผังที่เป็นอันตราย (เช่น ตัดคำเตือนทิ้ง)
- มาตรการที่มีอยู่และตรวจแล้ว:
  - อัปโหลดได้เฉพาะ admin (A01-4)
  - `response_format: json_object` (`:97`) + `parseLlmOutput` / `parseDraftGraphs` ปฏิเสธฟิลด์ที่ไม่อนุญาต (`draft-schema.ts:158, 190`)
  - `graph-validator.ts` ตรวจโครงสร้าง, `source_page` ต้องอยู่ในหน้าที่อัปโหลด (`:345`) และหน้าที่มีคำเสี่ยงแต่โหนดไม่ใช่ safety_critical จะถูกเตือน (`:416-421`)
  - publish ต้องให้คนกด, ถ้ามี warning ต้องส่ง `acknowledgedWarnings` (`drafts.service.ts:192-193`) และตรวจซ้ำในทรานแซกชัน (`drafts.store.ts:215-221`)
- ส่วน retrieval ของการค้นหาอาการไม่มี "chunk" ถูกส่งต่อให้ LLM เลย (`symptom-search.service.ts:160-192` คืนแค่ graphId + คะแนน)
- แนวทางแก้: ยอมรับได้ ถ้าจะเสริม ให้หุ้มเนื้อหา PDF ด้วยตัวคั่นชัดเจนพร้อมคำสั่งให้ถือเป็นข้อมูล ไม่ใช่คำสั่ง ใน `SYSTEM_PROMPT`

#### A03-4 XSS ตอน render คำตอบ AI ใน React — **ไม่พบช่องโหว่**

- ค้นทั้ง `frontend/src` แล้วไม่พบ `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `eval(`, `new Function`, `document.write` และไม่มี `href` ที่ประกอบจากข้อมูล
- `frontend/src/pages/SessionPage.tsx:122-124` ข้อความ `displayText` (จาก AI) แสดงผ่าน JSX · `components/RephraseNote.tsx:9` ข้อความต้นฉบับเป็น `{original}` · `pages/AdminFeedbackPage.tsx:159` comment ของผู้ใช้แสดงเป็น `{item.comment}` ทั้งหมดถูก React escape
- ข้อเสนอแนะ (Low): ไม่มี Content-Security-Policy (`frontend/index.html` ไม่มี meta CSP และ GitHub Pages ตั้ง header เองไม่ได้) ควรเพิ่ม `<meta http-equiv="Content-Security-Policy">` เพื่อลดความเสียหายถ้าวันหน้ามี XSS เกิดขึ้น ซึ่งสำคัญเพราะ token อยู่ใน localStorage (A07-3)

#### A03-5 ReDoS จาก `pattern` ของโหนด input — **Low**

- ไฟล์: `backend/src/traversal-engine/traversal-engine.ts:108`
  ```ts
  const isValid = !node.pattern || new RegExp(node.pattern).test(action.value);
  ```
- `pattern` มาจากผัง (LLM ร่างจาก PDF แล้ว admin ตรวจ) ส่วน validator ตรวจแค่ว่าเป็น regex ที่ถูกต้องและความยาว (`graph-validator.ts:316-323`) ไม่ได้ตรวจ catastrophic backtracking ถ้าหลุด pattern แบบ `(a+)+$` เข้าไป ผู้ใช้ทั่วไป (ไม่ต้องล็อกอิน) ส่ง input 255 ตัวก็ทำให้ event loop ค้างได้
- แนวทางแก้: เพิ่มการตรวจ regex ที่ปลอดภัยใน validator (เช่นแพ็กเกจ `safe-regex2` หรือ `re2`) หรือจำกัดให้ใช้ได้เฉพาะ pattern จากรายการที่กำหนดไว้

---

### A04:2021 – Insecure Design

#### A04-1 ไม่มี rate limit / โควตาของ endpoint ที่เรียก LLM และ embedding — **Medium**

- ไม่พบ rate limiter ใดๆ (`grep -i "rate.?limit|throttl|helmet"` ใน `backend/src` และ `package.json` ไม่เจอเลย, `app.ts:64-68` มีแค่ cors + body parser)
- endpoint สาธารณะที่กินทรัพยากร:
  - `POST /symptom-search` (`symptom-search.routes.ts:9`) และ `POST /traversal/sessions` ที่มี `query` (`traversal.service.ts:184-190`) รันโมเดล embedding บน CPU ทุกคำขอ (`embedding.service.ts:46-55`) Render free tier มี CPU น้อย จึงยิงไม่กี่สิบคำขอต่อวินาทีก็ทำให้บริการช้าหรือล่มได้
  - `GET /traversal/sessions/:id` และ `POST …/actions` เรียก `displayTextOf()` (`traversal.service.ts:168, 172-182`) ซึ่งเรียก Groq
- ปัญหาที่ทำให้หนักขึ้น:
  - `rephrase.service.ts:54` cache **เฉพาะผลที่ผ่าน guard** ข้อความที่ไม่ผ่าน guard หรือ timeout จะเรียก Groq ใหม่**ทุกคำขอ** การรีเฟรชหน้าซ้ำๆ จึงเผาโควตา Groq ได้
  - `rephrase.service.ts:27` cache เป็น `Map` ไม่จำกัดขนาด และ key เป็นข้อความหลังแทนค่าตัวแปรของผู้ใช้ (A03-2) ถ้ามีโหนด `{{…}}` ค่า input ที่ต่างกันแต่ละค่าจะเป็นทั้ง LLM call ใหม่และ entry ใหม่ในหน่วยความจำ
  - `POST /auth/register` ไม่มี captcha/rate limit จึงสร้างบัญชีจำนวนมากได้ และ `POST /traversal/sessions` สร้างแถวใน DB ได้ไม่จำกัด (ไม่พบงานลบแถวที่หมดอายุในโค้ด)
- แนวทางแก้:
  1. เพิ่ม `express-rate-limit` แยกตามกลุ่ม endpoint เช่น `/auth/login` 5–10 ครั้ง/นาที/IP, `/symptom-search` 30 ครั้ง/นาที/IP, `/traversal/sessions` 60 ครั้ง/นาที/IP (ต้องตั้ง `app.set('trust proxy', 1)` บน Render เพื่อให้ได้ IP จริง)
  2. cache ผลลัพธ์ที่ "ไม่ผ่าน" ด้วย (negative cache) และจำกัดขนาด cache (LRU)
  3. ตั้งงบ/โควตาต่อวันของ Groq ฝั่ง backend (นับจำนวน call ถ้าเกินให้ใช้ข้อความต้นฉบับ)

#### A04-2 ขนาดและชนิดไฟล์ตอน ingest PDF — **ไม่พบช่องโหว่**

- `authoring/drafts.routes.ts:22-26, 44-47` จำกัดไฟล์ 10 MB (ปรับด้วย env ได้), 1 ไฟล์, 12 ฟิลด์, ฟิลด์ละ 1 KB
- `authoring/drafts.service.ts:51-52` ตรวจ magic bytes `%PDF-` ใน 1 KB แรก ไม่เชื่อ Content-Type หรือนามสกุลไฟล์
- `authoring/pdf-text.ts:3-6, 80-86, 98` จำกัด 200 หน้า, เลือกได้ไม่เกิน 10 หน้า, หน้าละ 12,000 ตัวอักษร
- `drafts.service.ts:54-57` ร่างได้ทีละงาน (`busy` + `countDrafting`) กันคิวงาน LLM ล้น
- ไฟล์อยู่ใน memory (`memoryStorage`) และ "ไม่ถูกเก็บ" (`drafts.service.ts:49`) จึงไม่มีความเสี่ยงเรื่อง path traversal ตอนเขียนไฟล์
- ข้อสังเกต: multer ที่ใช้อยู่มีช่องโหว่ DoS (A06-1) แต่เข้าถึงได้เฉพาะ admin

---

### A05:2021 – Security Misconfiguration

#### A05-1 error 500 ส่ง message ดิบ (รวม error ของ SQL) ให้ client — **Medium**

- ไฟล์: `backend/src/common/error-handler.ts:67, 71, 99`
  ```ts
  const message = exception instanceof Error ? exception.message : 'ไม่ทราบสาเหตุ';
  ...
  return { statusCode: 500, code: 'INTERNAL_ERROR', message };
  ```
  error ที่ไม่รู้จัก (เช่น error ของ mysql2: `Unknown column …`, `ER_NO_SUCH_TABLE`, `connect ECONNREFUSED <host>:<port>`) จะถูกส่ง `message` กลับไปตรงๆ ทำให้ชื่อตาราง คอลัมน์ หรือ host ของ DB หลุด
- ข้อดี: ไม่ส่ง stack trace ให้ client (stack ไปแค่ log `:97`)
- แนวทางแก้: สำหรับ 5xx ที่ไม่ใช่ `ApiError` ให้ตอบข้อความกลางๆ เช่น `'เกิดข้อผิดพลาดภายใน'` และใส่ request id ไว้ให้ไปค้นใน log

#### A05-2 endpoint สาธารณะเปิดเผยข้อมูลภายใน — **Low**

- `backend/src/health/health.routes.ts:15, 22` ส่ง `databaseError` (ข้อความ error ของ mysql2 ซึ่งอาจมี host/port) และ `environment`
- `backend/src/symptom-search/symptom-search.service.ts:209-210` (`GET /symptom-search/status`) ส่ง `error` ภายใน และ `memoryRssMb`
- แนวทางแก้: ตอบแค่ `status: ok|degraded` แล้วย้ายรายละเอียดไปไว้หลัง `requireAdmin` หรือ log ฝั่ง server

#### A05-3 ไม่มี security headers (helmet) / `x-powered-by` — **Low**

- `backend/src/app.ts:64-68` ไม่มี helmet และไม่ได้ `app.disable('x-powered-by')` (Express จะส่ง `X-Powered-By: Express`)
- backend ตอบแค่ JSON ผลกระทบจึงจำกัด แต่ควรมี `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` ฯลฯ
- แนวทางแก้: `app.use(helmet())` + `app.disable('x-powered-by')`

#### A05-4 CORS — **ไม่พบช่องโหว่ (มีข้อเสนอแนะ)**

- `backend/src/app.ts:66` origin เดียวจาก env (production: `https://parit-ru.github.io` ใน `render.yaml`) ไม่ใช่ `*` และไม่ reflect origin
- `credentials: true` ไม่จำเป็น เพราะใช้ Bearer header ไม่ได้ใช้ cookie แนะนำให้ปิดเพื่อลด surface
- หมายเหตุ: origin `https://parit-ru.github.io` ครอบคลุมทุก repo GitHub Pages ของบัญชีนี้ (ไม่ใช่เฉพาะ `/appliance-repair-assistant/`) เพราะ CORS แยกได้แค่ระดับ origin

#### A05-5 การตรวจ input (แทน ValidationPipe whitelist/forbidNonWhitelisted) — **ไม่พบช่องโหว่**

- parser ทุกตัวสร้าง object ใหม่จากฟิลด์ที่รู้จักเท่านั้น (เช่น `auth.dto.ts:89-96`, `traversal.dto.ts:92-117`, `history.dto.ts:112-135`) ฟิลด์เกินจึงถูกทิ้ง ซึ่งเทียบเท่า `whitelist: true`
- ฝั่ง draft ปฏิเสธฟิลด์เกินแบบเดียวกับ `forbidNonWhitelisted` (`draft-schema.ts:158, 190`, `graph-validator.ts:200`)
- `express.json()` ใช้เพดาน 100 KB ตามค่าเริ่มต้น · `app.ts:68` เปิด `urlencoded({ extended: true })` ทั้งที่ไม่มี route ไหนใช้ แนะนำให้เอาออก

#### A05-6 Dockerfile และ config ของ Render — **Low / ตรวจได้บางส่วน**

- **ไม่มี Dockerfile** ในโปรเจกต์ จึงตรวจเรื่อง Docker (base image, user root, .dockerignore) ไม่ได้
- `render.yaml`:
  - ความลับทั้งหมดของ DB ใช้ `sync: false` (ไม่ฝังค่าในไฟล์) ถูกต้อง
  - `buildCommand: npm ci --include=dev` ใช้ lock file ถูกต้อง แต่ติดตั้ง devDependencies ซึ่งมีช่องโหว่ critical (handlebars ใน ts-jest) ลงเครื่อง build ด้วย ความเสี่ยงต่ำเพราะไม่ได้รันตอน runtime
  - ไม่ได้ประกาศ `JWT_SECRET`, `GROQ_API_KEY`, `GROQ_MODEL`, `AUTHORING_LLM_MODEL` (ดู A02-2)
- ตรวจไม่ได้: ค่า env จริงบน Render dashboard

---

### A06:2021 – Vulnerable and Outdated Components

รัน `npm audit` เมื่อ 24 ต.ค. 2026 (ไม่ได้รัน `npm audit fix` และไม่ได้แก้ `package.json` / lock file)

#### A06-1 backend — production dependencies: **4 ช่องโหว่ (critical 1, high 2, moderate 1) — High**

| แพ็กเกจ (เวอร์ชันที่ติดตั้ง) | ระดับจาก audit | advisory | ผลต่อโปรเจกต์นี้ |
|---|---|---|---|
| `proxy-addr@2.0.7` (ผ่าน express) | critical | GHSA-jqcg-44mw-7w3h IP spoofing ผ่าน IPv4-mapped IPv6 | ใช้ได้จริงก็ต่อเมื่อตั้ง `trust proxy` ซึ่งตอนนี้ยังไม่ได้ตั้ง แต่ต้องตั้งเมื่อเพิ่ม rate limit (A04-1) **จึงต้องอัปเดตก่อนทำ A04-1** |
| `multer@2.0.2` | high | DoS หลายตัว (GHSA-v52c-386h-88mc, GHSA-5528-5vmv-3xc2, …) และ file size limit bypass (GHSA-qvfw-j98x-7q72) | endpoint upload อยู่หลัง `requireAdmin` ผลกระทบจึงจำกัดอยู่ที่ admin |
| `body-parser@1.20.4` (ผ่าน express) | high | GHSA-27r3-jxmh-p828 DoS ผ่านไบต์ต่อท้าย body ที่บีบอัด · GHSA-v422-hmwv-36x6 (ใช้ได้เฉพาะเมื่อตั้ง limit ผิด ซึ่งโปรเจกต์ไม่ได้ตั้ง) | `express.json()` ใช้กับทุก route สาธารณะ |
| `qs@6.14.2` (ผ่าน express) | moderate | GHSA-4mjr-xmp4-gh2g, GHSA-x5fp-wj9c-mxmx, GHSA-q8mj-m7cp-5q26 | ใช้ parse query string ทุก route |

- แนวทางแก้: `npm audit fix` ในโฟลเดอร์ backend (audit บอกว่ามี fix แบบไม่ breaking) หรืออัปเดต `express` / `multer` เป็น patch ล่าสุด จากนั้นรันเทสต์

#### A06-2 backend — dev dependencies: **2 ช่องโหว่ (critical 1, high 1) — Low**

- `handlebars@4.7.9` (ผ่าน `ts-jest`) critical: JavaScript injection ตอน compile template
- `brace-expansion@1.1.18` (ผ่าน `jest → glob → minimatch`) high: DoS
- ใช้แค่ตอนรันเทสต์ ไม่ได้อยู่ในเส้นทางของ runtime

#### A06-3 frontend — **production dependencies: 0 ช่องโหว่** · dev dependencies: 6 ช่องโหว่ (high 1, moderate 5) — **Low**

- `zod@4.6.5` (ผ่าน `eslint-plugin-react-hooks`) high: memory exhaustion
- `@vitest/mocker` / `vitest` (≤ 4.1.11) moderate: code injection ผ่าน mock registration
- `postcss-selector-parser` → `postcss-nested` → `tailwindcss@3.4.19` moderate: CPU exhaustion (fix ต้องขึ้น tailwind v4 ซึ่งเป็น breaking change)
- ทั้งหมดเป็นเครื่องมือตอน build/test ไม่ได้ถูกส่งไปที่เบราว์เซอร์
- แนวทางแก้: `npm audit fix` (ไม่ใช้ `--force`) แล้วค่อยวางแผนย้าย tailwind v4 แยกต่างหาก

---

### A07:2021 – Identification and Authentication Failures

#### A07-1 ไม่มีการป้องกัน brute-force ที่ login — **High**

- ไฟล์: `backend/src/auth/auth.routes.ts:16-19`, `backend/src/auth/auth.service.ts:55-64`
- หลักฐาน: `/auth/login` ไม่มี rate limit, ไม่มีตัวนับครั้งที่ผิด, ไม่มี lockout หรือ backoff และไม่มี captcha (ไม่พบในโค้ด) ขณะที่รหัสผ่านขั้นต่ำแค่ 8 ตัวโดยไม่มีกฎอื่น (`auth.dto.ts:5, 67`) ระบบมีบัญชี admin ที่เข้าถึง feedback ทั้งหมดและเผยแพร่ผังได้ จึงเป็นเป้าหมายที่คุ้มค่าต่อการเดารหัส
- bcrypt cost 10 ช่วยชะลอได้บ้าง (ราว 50–100 ms ต่อครั้ง) แต่ไม่พอเมื่อไม่มีเพดานจำนวนครั้ง
- แนวทางแก้:
  1. `express-rate-limit` บน `/auth/login` และ `/auth/register` (เช่น 5 ครั้ง/นาที/IP + 20 ครั้ง/ชั่วโมง/อีเมล)
  2. หน่วงเวลาแบบทวีคูณหรือล็อกชั่วคราวตามอีเมล
  3. log การ login ที่ล้มเหลว (ดู A09-1)

#### A07-2 การสมัครบอกได้ว่าอีเมลนี้มีบัญชีแล้ว (user enumeration) — **Low**

- `backend/src/auth/auth.service.ts:12, 46-47` ตอบ `409 EMAIL_TAKEN` ส่วนตอน login ตอบเหมือนกันทุกกรณี (`:13, 59-60`) ซึ่งดีแล้ว
- แนวทางแก้: ยอมรับได้ในเชิง UX ถ้ามี rate limit (A07-1) แล้ว ความเสี่ยงจะลดลงมาก

#### A07-3 การเก็บ token ฝั่ง frontend / การเพิกถอน — **Medium**

- `frontend/src/lib/authStorage.ts:3, 53` เก็บ JWT ใน `localStorage` (key `fixstep.auth`) สคริปต์ใดๆ ที่รันบนหน้าเดียวกันอ่านได้ ถ้าวันหน้ามี XSS (หรือ dependency ฝั่ง frontend ถูกเจาะ) token อายุ 7 วันจะถูกขโมยได้ทันที
- ไม่มี endpoint logout หรือ revoke ฝั่ง server (`auth.routes.ts` มีแค่ register/login/me) logout จึงเป็นแค่การลบใน localStorage (`authStorage.ts:58-63`) token ที่หลุดไปแล้วยังใช้ต่อได้จนหมดอายุ
- role ฝังใน token (`auth.service.ts:75`) และ middleware เชื่อ role จาก token โดยไม่ถาม DB (`auth.middleware.ts:38-41`) ถ้าถอดสิทธิ์ admin หรือลบบัญชี token เดิมก็ยังมีสิทธิ์ admin ได้นานสูงสุด 7 วัน (`seed-admin.js:107` บันทึกข้อจำกัดนี้ไว้เอง)
- แนวทางแก้ (เลือกตามแรงที่มี):
  - ลดอายุ token (A02-2) + เพิ่ม CSP (A03-4) ถือเป็นขั้นต่ำ
  - ใน `requireAdmin` ให้โหลด role ล่าสุดจาก DB (ค่าใช้จ่ายแค่ 1 query ต่อคำขอ admin)
  - เพิ่ม `token_version` ในตาราง users แล้วฝังใน JWT เพื่อให้เพิกถอนได้
  - ระยะยาว: ย้ายไปใช้ cookie `HttpOnly; Secure; SameSite` (ต้องจัดการ CSRF และตั้งค่า cross-site ระหว่าง github.io กับ onrender.com)

---

### A08:2021 – Software and Data Integrity Failures

#### A08-1 Integrity ของ ingestion pipeline (PDF → ร่าง → เผยแพร่) — **ไม่พบช่องโหว่**

- `authoring/drafts.store.ts:4-9, 210-245` ร่างอยู่ในตาราง `graph_drafts` แยกต่างหาก ผู้ใช้เห็นไม่ได้จนกว่าจะ publish ซึ่งทำใน transaction เดียว ใช้ `SELECT … FOR UPDATE` และ INSERT ล้วน ไม่เขียนทับของเดิม (`assertNoConflicts` `:247-257` + `ER_DUP_ENTRY` `:240`)
- `drafts.service.ts:187-193` ตอน publish จะ parse + validate ข้อมูลใน DB ซ้ำ ("กันถูกแก้นอกระบบ") และไม่มีทางข้าม error ได้
- `draft-manual.ts:14-16` บันทึก `source_chunk_id = draft:<id>:<graph>` + `prompt_version` + `llm_model` ไว้ตามรอยที่มาได้ และ `reviewed_by` เก็บว่าใครเป็นคนเผยแพร่
- หมายเหตุ: ช่องทางที่ไม่ผ่าน validator คือ `scripts/seed-graphs.js:177` ซึ่ง DELETE แล้ว INSERT ผังใหม่ตรงๆ เป็นสคริปต์ ops ที่ต้องมีสิทธิ์ DB จึงไม่นับเป็นช่องโหว่ แต่ผังจากทางนี้ไม่ผ่าน validator

#### A08-2 โมเดล embedding และ supply chain — **ไม่พบช่องโหว่**

- `embedding/embedding.service.ts:34` `env.allowRemoteModels = false` โหลดโมเดลจาก `backend/model/` ที่ commit ไว้เท่านั้น ไม่ดาวน์โหลดตอนรัน
- `render.yaml` ใช้ `npm ci` ตาม lock file
- ข้อเสนอแนะ (Low): บันทึก checksum ของ `model_quantized.onnx` แล้วตรวจตอนบูต

---

### A09:2021 – Security Logging and Monitoring Failures

#### A09-1 ไม่ log เหตุการณ์ด้านความปลอดภัย — **Medium**

- `backend/src/common/error-handler.ts:95-98` log เฉพาะ 5xx ส่วน 4xx (รวม 401 `INVALID_CREDENTIALS`, 403 `FORBIDDEN`) ไม่ถูก log เลย จึงตรวจไม่พบ brute-force หรือการลองเข้าหน้า admin
- ไม่มี access log / request id (ไม่พบ morgan หรือ logger ระดับคำขอ)
- การ publish ผัง log แค่ draft id (`drafts.service.ts:206`) ไม่บอกว่าใครทำ (แต่ DB เก็บ `reviewed_by` ไว้)
- แนวทางแก้: log `auth.login.failed` (อีเมลแบบ hash/mask + IP), `auth.forbidden` และ `admin.publish/reject` (userId) ในรูปแบบมีโครงสร้าง แล้วตั้ง alert ใน log ของ Render

#### A09-2 ห้ามมี password/token ใน log — **ไม่พบช่องโหว่**

- ค้น `console.*` / `logger.*` ที่มีคำว่า password/token/authorization/secret/headers ใน `backend/src` และ `backend/scripts` พบแค่ `seed-admin.js:107` ซึ่งเป็นข้อความแจ้งเตือน ไม่ได้พิมพ์ค่า
- `seed-admin.js:12, 95` พิมพ์แค่อีเมล ไม่พิมพ์รหัสผ่าน · `database/pool.ts:61` log ชื่อ DB/host/port (ไม่มีรหัสผ่าน)
- ข้อสังเกต: `rephrase.service.ts:57` และ `draft-llm.client.ts:112-113` เอาเนื้อหาคำตอบ error จาก Groq 200 ตัวอักษรแรกไปใส่ log / `error_message` ซึ่งปกติไม่มี API key อยู่ในนั้น (ตรวจเนื้อหาจริงไม่ได้)

---

### A10:2021 – Server-Side Request Forgery (SSRF)

#### A10-1 จุดที่ server ดึง URL ภายนอก — **ไม่พบช่องโหว่**

- outbound มีแค่ 2 จุด ทั้งคู่ใช้ URL คงที่ `https://api.groq.com/openai/v1/chat/completions`:
  - `backend/src/rephrase/groq-llm.client.ts:3, 21`
  - `backend/src/authoring/draft-llm.client.ts:6, 89`
- ไม่มี endpoint ไหนรับ URL จากผู้ใช้ ส่วน `image_url` / `external_reference` ของโหนดถูกตั้งเป็น `null` ตอน publish (`draft-manual.ts:116-118`) และ backend ไม่ fetch ค่าพวกนี้
- โมเดล embedding ปิดการดาวน์โหลดจากระยะไกล (A08-2)

---

## 3. การตรวจ secret และ `.env`

| รายการ | ผล | หลักฐาน |
|---|---|---|
| `backend/.env` อยู่ใน `.gitignore` | ✅ ใช่ | `backend/.gitignore:5` (`git check-ignore` ยืนยัน) |
| `backend/.env` เคยถูก commit | ✅ ไม่เคย | `git log --all --name-only` ไม่พบ |
| `frontend/.env*` | ⚠️ ถูก track แต่ไม่ใช่ความลับ | `frontend/.env.development`, `frontend/.env.production` มีแค่ key `VITE_API_URL` (URL สาธารณะ) และไม่ได้อยู่ใน `frontend/.gitignore` ส่วน `frontend/.env` เคยถูก commit (`64326be`, ลบใน `cd3a4b7`) มีแค่ key `VITE_API_URL`, `VITE_USE_MOCK` (ตรวจเฉพาะชื่อ key) |
| รูปแบบ secret ใน git history ทุก revision | ✅ 0 hit | ค้น `gsk_…`, `sk-…`, `AKIA…`, `BEGIN PRIVATE KEY`, `JWT_SECRET=…`, `DB_PASSWORD=…`, `ADMIN_PASSWORD=…`, `GROQ_API_KEY=…` ด้วย `git grep` ทุก revision |
| secret hardcode ใน working tree | ✅ ไม่พบ | ค้นใน `backend/src`, `backend/scripts`, `frontend/src`, `scripts`, `render.yaml` |

ข้อเสนอแนะ: ไฟล์ `VITE_*` ถูกฝังใน JS ที่ส่งไปให้ผู้ใช้อยู่แล้ว การ commit จึงไม่เป็นปัญหา (คอมเมนต์ในไฟล์ระบุไว้แล้ว) ขอแค่ระวังอย่าใส่ความลับในตัวแปร `VITE_*` เด็ดขาด

---

## 4. ตารางสรุปช่องโหว่ (เรียงตามความรุนแรง)

| # | ระดับ | OWASP | เรื่อง | ไฟล์:บรรทัด | แนวทางแก้โดยย่อ |
|---|---|---|---|---|---|
| 1 | **High** | A07 | login ไม่มีการป้องกัน brute-force (รวมบัญชี admin) | `backend/src/auth/auth.routes.ts:16`, `auth.service.ts:55-64` | rate limit + backoff ตามอีเมล/IP |
| 2 | **High** | A06 | prod dependency มีช่องโหว่ 4 ตัว (proxy-addr critical, multer/body-parser high, qs moderate) | `backend/package.json` (express 4.22.1, multer 2.0.2) | `npm audit fix` ที่ backend แล้วรันเทสต์ |
| 3 | Medium | A04 | ไม่มี rate limit/โควตาของ endpoint ที่เรียก embedding/LLM และ rephrase ที่ไม่ผ่าน guard ถูกเรียก Groq ซ้ำทุกคำขอ | `backend/src/app.ts:64-68`, `rephrase/rephrase.service.ts:27, 54`, `traversal/traversal.service.ts:172-182`, `symptom-search/symptom-search.routes.ts:9` | rate limit, negative cache + LRU, โควตา Groq ต่อวัน |
| 4 | Medium | A05 | error 500 ส่ง message ดิบ (รวม error SQL) ให้ client | `backend/src/common/error-handler.ts:67, 71, 99` | 5xx ตอบข้อความกลาง + request id |
| 5 | Medium | A07 | JWT ใน localStorage อายุ 7 วัน ไม่มี revoke และ role ไม่รีเฟรชจาก DB | `frontend/src/lib/authStorage.ts:53`, `backend/src/auth/token.ts:5`, `auth.middleware.ts:38-41` | ลดอายุ, ตรวจ role จาก DB ใน `requireAdmin`, token_version, CSP |
| 6 | Medium | A09 | ไม่ log login ล้มเหลว/403 และไม่มี access log | `backend/src/common/error-handler.ts:95-98` | structured security log + alert |
| 7 | Low | A01 | session ของ guest ที่กำลังเดินขั้นตอนไม่ตรวจ client id (อาศัยว่าเดา UUID ไม่ได้) | `backend/src/traversal/traversal.service.ts:136-141` | ตรวจ `client_id` ใน `authorize()` |
| 8 | Low | A01 | `X-Client-Id` เป็น bearer secret ของ guest (ออกแบบไว้แบบนี้) | `backend/src/traversal/traversal.dto.ts:23` | ยอมรับ หรือใช้ id ที่ server เซ็น |
| 9 | Low | A03 | ReDoS จาก `pattern` ในผัง (ผู้ใช้ไม่ล็อกอินก็ทำให้ทำงานได้) | `backend/src/traversal-engine/traversal-engine.ts:108`, `authoring/graph-validator.ts:316-323` | ตรวจ safe-regex / ใช้ re2 |
| 10 | Low | A03 | ข้อความ input ของผู้ใช้เข้า prompt rephrase ผ่าน `{{var}}` | `backend/src/traversal-engine/traversal-engine.ts:139, 168-171` | rephrase ก่อนแทนค่าตัวแปร |
| 11 | Low | A03 | indirect prompt injection จากเนื้อหา PDF (มี validator + คนตรวจแล้ว) | `backend/src/authoring/draft-llm.client.ts:64-71` | หุ้มเนื้อหาด้วยตัวคั่น + คำสั่งให้ถือเป็นข้อมูล |
| 12 | Low | A03/A05 | ไม่มี Content-Security-Policy ฝั่ง frontend | `frontend/index.html` | เพิ่ม meta CSP |
| 13 | Low | A05 | `/health` และ `/symptom-search/status` เปิดเผย error ภายในและ memory | `backend/src/health/health.routes.ts:15, 22`, `symptom-search/symptom-search.service.ts:209-210` | ตอบแค่สถานะ ย้ายรายละเอียดไปหลัง admin |
| 14 | Low | A05 | ไม่มี helmet และยังส่ง `X-Powered-By` | `backend/src/app.ts:64-68` | `helmet()` + `disable('x-powered-by')` |
| 15 | Low | A05 | `render.yaml` ไม่ได้ประกาศ `JWT_SECRET`/`GROQ_API_KEY`, ติดตั้ง devDeps ตอน build, ไม่มี Dockerfile ให้ตรวจ | `render.yaml` | เพิ่ม `sync: false` สำหรับ key ที่ขาด |
| 16 | Low | A06 | dev dependency มีช่องโหว่ (backend: handlebars critical, brace-expansion high · frontend: zod high + moderate 5) | `backend/package.json`, `frontend/package.json` | `npm audit fix` (ไม่ใช้ `--force`) |
| 17 | Low | A07 | register บอกได้ว่าอีเมลมีบัญชีแล้ว | `backend/src/auth/auth.service.ts:46-47` | ยอมรับเมื่อมี rate limit |
| 18 | Low | A02 | bcrypt cost 10 / อายุ JWT ยาว | `backend/src/auth/auth.service.ts:10`, `token.ts:5` | cost 12, อายุสั้นลง |

**รายการที่ตรวจแล้วไม่พบช่องโหว่:** SQL injection (A03-1), XSS ตอน render คำตอบ AI (A03-4), IDOR ของ history/feedback (A01-1), Guard ของ admin/ingest (A01-4), ชนิด/ขนาดไฟล์ PDF (A04-2), integrity ของ ingestion (A08-1), password/token ใน log (A09-2), SSRF (A10-1), secret ใน git history/โค้ด (หัวข้อ 3)

**ตรวจไม่ได้:** ค่า env จริงบน Render (เช่นตั้ง `DB_SSL_CA` แล้วหรือยัง), ข้อมูลผังในฐานข้อมูล production (มีโหนด `{{var}}` หรือ `pattern` อันตรายหรือไม่), Dockerfile (ไม่มีในโปรเจกต์), header ที่ GitHub Pages ส่งจริง
