# STUDY_NOTES — บันทึกการเรียนรู้จากการสร้าง fixbot-rebuild ทีละ slice

> สะสมต่อเนื่องทุก slice (เขียนต่อท้าย ห้ามเขียนทับ) · แผนเต็มอยู่ที่ [REBUILD_PLAN.md](REBUILD_PLAN.md)
> สอบ 13 พ.ย. 2569 · โปรเจกต์ใหม่อยู่ที่ `C:\Users\SPS\Desktop\499\fixbot-rebuild` (ปริตต์สร้างไฟล์เอง)

---

## Slice 1 — โครงโปรเจกต์ + MySQL + `/health` + frontend เรียก API (9 พ.ย. 2569)

### ทำไมเลือกแบบนี้
- **Express แทน NestJS:** ต่อ route ด้วยมือใน `app.ts` อ่านไล่จากบนลงล่างเห็นทุกอย่าง ไม่มี decorator/DI ซ่อนกลไก · ข้อเสีย: ต้องจัดโครงสร้างเอง (ตั้งกฎชั้น route → service → store)
- **ไม่ใช้ ORM, SQL ล้วนผ่าน mysql2:** เห็น query จริงทุกตัว ใช้ FK/transaction ตรง ๆ · ข้อเสีย: map row เป็น object เอง ไม่มี type จาก schema อัตโนมัติ
- **connection pool (limit 5):** request พร้อมกันไม่ต้องต่อคิวรอ connection เดียว และไม่ต้องเปิด connection ใหม่ (handshake) ทุกครั้ง · เลข 5 ไม่ได้มาจาก load test
- **utf8mb4:** `utf8` ของ MySQL เก็บได้ 3 byte/ตัว emoji 👍 ใช้ 4 byte · ต้องตั้งทั้งที่ DB และที่ connection (`charset` ใน pool)
- **ping DB ตอนบูต + throw (fail fast):** ตั้งค่าผิดรู้ทันที ไม่เปิดเซิร์ฟเวอร์ที่ไม่มี DB
- **`/health` ทำ `SELECT 1` จริง:** Node รันแต่ DB ล่ม = ใช้ไม่ได้ จึงตอบ `degraded` ไม่ใช่ `ok` หลอก ๆ · เรียก pool ตรง ไม่ผ่าน service เพราะไม่มีกฎธุรกิจ
- **`tsx watch`:** รัน TypeScript ตรง terminal เดียว แต่ไม่ตรวจ type → ใช้ `npx tsc --noEmit` เช็กเอง
- **Tailwind v3.4.19 (ระบุเวอร์ชัน):** ถ้าไม่ระบุได้ v4 ซึ่งตั้งค่าต่างกัน และ class จะไม่ทำงานแบบเงียบ ๆ

### Data flow
```
เปิดหน้า → App → <ServerStatus/> useEffect → getHealth() → request('/health')
 → fetch GET http://localhost:3100/health   (origin :5180 ≠ :3100 → เบราว์เซอร์ตรวจ CORS)
 → cors() → express.json() → healthRoutes(pool) → pool.query('SELECT 1') → MySQL fixbot_rebuild
 ← 200 {"status":"ok","database":"ok",…}  → 🟢
DB ล่ม      ← 200 {"status":"degraded","database":"error"} → 🟠
backend ดับ  fetch throw → ApiError(0,'NETWORK_ERROR') → 🔴
```

### Q&A ที่เป็นไปได้
1. **ทำไมไม่ใช้ NestJS?** — เริ่มด้วย NestJS แล้วย้ายมา Express เพราะต้องอธิบายโค้ดเองได้ทุกบรรทัด Express เห็นลำดับ middleware ชัด ข้อเสียคือต้องจัดโครงเอง
2. **ทำไมไม่ใช้ ORM?** — ตารางน้อย ความสัมพันธ์ชัด อยากเห็น SQL จริง ข้อเสียคือเขียน mapping เอง
3. **pool คืออะไร ทำไม 5?** — ชุด connection ที่เปิดค้างไว้ใช้ซ้ำ request ที่เกินรอคิว (queueLimit 0) ไม่ error · 5 ตั้งตามต้นแบบ ไม่ได้ทำ load test
4. **CORS คืออะไร ใครบล็อก?** — เบราว์เซอร์บล็อกไม่ให้ JS ของหน้าเว็บอ่าน response ข้าม origin ถ้า server ไม่อนุญาต · curl/PowerShell ไม่ตรวจ CORS → ไม่ใช่กลไกความปลอดภัยของ API ความปลอดภัยจริงมาจาก auth
5. **`fetch` ล้มกับ 404 ต่างกันอย่างไร?** — `fetch` throw เฉพาะติดต่อไม่ได้เลย (→ `ApiError(0,'NETWORK_ERROR')`) ส่วน 4xx/5xx ถือว่าได้คำตอบ ต้องเช็ก `response.ok` เอง
6. **`asyncRoute` มีไว้ทำไม?** — Express 4 ไม่จับ promise ที่ reject ใน route async → request ค้าง · `asyncRoute` เติม `.catch(next)` ส่ง error เข้า `errorHandler`
7. **ทำไมลำดับ `app.use` สำคัญ?** — request ผ่าน middleware ตามลำดับ `notFoundHandler`/`errorHandler` ต้องอยู่ท้ายสุด route ที่ register หลัง `notFoundHandler` จะไม่ถูกเรียกเลย

### จุดอ่อนที่ต้องพูดตรง ๆ
- `/health` ตอบ **HTTP 200 แม้ `degraded`** (ตามต้นแบบ) → Render ที่ดูแค่ status code จะไม่รู้ว่า DB ล่ม ถ้าต้องการให้รีสตาร์ตเองควรตอบ 503
- `errorHandler` และ `/health` ส่ง `error.message` (รวมข้อความของ MySQL) ออกไปให้ผู้เรียกเห็น → อาจเผยรายละเอียดภายใน
- `request<T>` เป็นแค่การ "บอก" TypeScript ว่า response มีรูปอะไร **ไม่ได้ตรวจตอนรันจริง** ถ้า backend เปลี่ยนรูปแล้วลืมแก้ type จะไม่มี error แจ้ง
- ไม่มีเทสต์ใน Slice นี้ (เทสต์ engine มาใน Slice 2)

### บทเรียนที่เจอจริง
- `backend/.env` ที่ copy มามี `CORS_ORIGIN=http://localhost:5173` (ค่าของต้นแบบ) → หน้าเว็บ 🔴 ทั้งที่ backend ปกติ · วินิจฉัยโดย `curl -H "Origin: …" /health` ดู header `Access-Control-Allow-Origin` · แก้ `.env` แล้วต้อง **restart backend** (`dotenv` อ่านครั้งเดียว `tsx watch` ไม่ restart เมื่อแก้ `.env`)
- `npm install` ถูกขัดจังหวะ (SIGINT/EPERM จากโปรแกรมสแกนไฟล์ของ Windows) → รันซ้ำจนติดตั้งครบ · อย่ารัน `npm audit fix --force`
- React `<StrictMode>` ทำให้เห็น request `health` 2 ครั้งใน dev (ตั้งใจ ไม่ใช่บั๊ก)

---

## Slice 2+3 — ระหว่างทำ (9 พ.ย. 2569)
- สคริปต์ `run-migrations.js` / `seed-flows.js` อธิบายไว้ใน [REBUILD_SCRIPTS.md](REBUILD_SCRIPTS.md) (migrate = โครงสร้าง, seed = ข้อมูล)
- **บทเรียนซ้ำ:** `.env` ที่ copy จากต้นแบบมี `DB_SSL_CA` → `self-signed certificate in certificate chain` ตอนรัน migrate/seed (แต่ `/health` ผ่านเพราะ `pool.ts` ไม่อ่านค่านี้) · แก้โดยลบค่านั้น · สร้าง `.env` จาก `.env.example` เท่านั้น

### ค้างตรวจ (mark 10 พ.ย. 2569)
- [ ] `npx tsc --noEmit` ของ `types.ts` + `state-machine.ts` (พิมพ์ครบแล้วแต่ยังไม่ได้รัน)
- [ ] `npm test` ของ `state-machine.test.ts` (10 เคส)
- [ ] `seed` 3 คู่มือ → ตรวจ `SELECT COUNT(*) FROM flows` = 88

### สถานะไฟล์ Slice 2+3 (mark 10 พ.ย. 2569)
| ไฟล์ | พิมพ์แล้ว | tsc | อธิบายแล้ว |
|---|---|---|---|
| state-machine/types.ts | ✅ | ⬜ ยังไม่ตรวจ | ✅ |
| state-machine/state-machine.ts | ✅ | ⬜ | ✅ |
| state-machine/state-machine.test.ts | ✅ | ⬜ ยังไม่รัน `npm test` | ✅ |
| common/helpers.ts, common/error-handler.ts (ฉบับเต็ม) | ✅ | ⬜ | ✅ |
| execution/flow.repository.ts | ✅ (5 ส่วน) | ⬜ | ✅ (+ สรุปสั้นด้านล่าง) |

**flow.repository.ts สรุปสั้น:** อ่านผังจาก DB (2 query: ระดับผัง + ระดับ state ที่พับ transitions ด้วย `MAX(CASE) GROUP BY`) ประกอบเป็นอ็อบเจ็กต์ `TroubleshootingFlow` เก็บใน `Map` ใน RAM ตอนบูต · ข้อมูลเสีย → throw → บูตไม่ขึ้น · request หลังจากนั้นอ่านจาก RAM ไม่แตะ DB

---

## Slice 2+3 — State machine engine + Safety gate + หน้าเดินขั้นตอน (เสร็จ 10 พ.ย. 2569)

> ✅ ค้างตรวจทั้งหมดผ่านแล้ว (tsc, npm test, ทดสอบบนหน้าเว็บ) — สถานะไฟล์ในตารางด้านบนถือว่า tick ครบ

### ทำไมเลือกแบบนี้
- **LLM ไม่ตัดสินเส้นทาง:** งานเกี่ยวกับความปลอดภัย (ไฟฟ้า/น้ำ/ถอดเครื่อง) ต้องตอบได้ว่าทำไมระบบบอกขั้นนี้ · state machine ให้ผลซ้ำได้ ตรวจย้อนได้ (history) และแต่งขั้นตอนที่ไม่มีในคู่มือไม่ได้ · ข้อเสีย: ยืดหยุ่นน้อย ผู้ใช้ต้องตอบตามที่ถาม · ไม่มีย้อนกลับขั้นก่อนหน้า
- **เทียบ DFA:** M = (Q, Σ, δ, q0, F) · Q = states, Σ = {yes,no,next,invalid}, δ = ตาราง `state_transitions`, q0 = `initial_state`, F = resolution/escalation · มี `variables` (จาก input) จึงเป็น "deterministic state machine ที่มีตัวแปร" ไม่ใช่ DFA บริสุทธิ์
- **engine เป็น pure function:** `submitAction(session, flow, action)` คืน session ใหม่ ไม่แก้ของเดิม ไม่แตะ DB/HTTP → เทสต์ได้โดยไม่ต้องมี server · service เป็นคนบันทึก (หลัง engine อนุมัติเท่านั้น)
- **safety gate อยู่ที่ server (`resolveNextState`):** frontend ข้ามได้เสมอ · instruction ที่ `safety_critical` รับเฉพาะ `confirm_safety` (`continue` → `SafetyConfirmationRequiredError` → 400) และถูกบันทึกใน history · แยกเป็น action ชนิดต่างหากแทน flag ใน `continue`
- **server เก็บตำแหน่ง (`currentStateId`)** client ส่งแค่ `sessionId` + action · `RenderedState` ไม่มี `on_yes/next` → ข้ามขั้นไม่ได้
- **ผังโหลดเข้า RAM ตอนบูต:** อ่านบ่อยแก้น้อย · 2 query (ไม่ใช่ N+1) · ข้อมูลเสีย = บูตไม่ขึ้น (fail fast)
- **δ แยกตาราง + `MAX(CASE…) GROUP BY`** พับกลับเป็น on_yes/on_no/next/on_invalid · `LEFT JOIN` เพราะ state สิ้นสุดไม่มี transition
- **ป้องกันหลายชั้น (defense in depth):** `validateManual` ตอน seed → FK ใน DB → `FlowRepository` (`required`, ตรวจ initial_state) → engine (`StateNotFoundError`) · แต่ละชั้นจับต่างกัน

### Data flow
```
HomePage → GET /execution/flows → listFlows (Map ใน RAM) → รายการ
กด "เริ่ม" → POST /execution/sessions {flowId} → parseStartSessionBody → startSession
   → engine.startSession → store.create ← 201 {sessionId, state n1}
กดปุ่ม → POST /execution/sessions/:id/actions {type,…} → parseExecutionAction
   → store.find (ตำแหน่ง) → engine.submitAction → resolveNextState (ตัดสินที่นี่ที่เดียว)
   → store.update ← state ถัดไป
safety: {type:"continue"} ที่ n1f → SafetyConfirmationRequiredError → errorHandler(ENGINE_ERRORS) → 400
```

### Q&A ที่เป็นไปได้
1. **ทำไมไม่ให้ LLM คุมบทสนทนา?** ความปลอดภัย + ตรวจย้อนได้ · ข้อเสียคือยืดหยุ่นน้อย
2. **ถ้ามีคนยิง API ข้าม safety gate?** engine ปฏิเสธ `continue` เสมอ ต้อง `confirm_safety` ซึ่งถูกบันทึก · **พิสูจน์ได้แค่ว่าผู้ใช้กดยืนยัน ไม่ใช่ว่าอ่านจริง**
3. **ทำไมแยก `confirm_safety` จาก `continue`?** engine ตรวจด้วย type ล้วน ๆ, history เห็นชัด, ไม่ต้องเชื่อ flag จาก client
4. **ทำไมเก็บผังใน RAM?** อ่านทุก request แก้น้อย · ข้อเสีย: แก้ DB แล้วต้องรีสตาร์ต, หลาย instance ไม่ sync
5. **ทำไม engine/DTO/service แยกกัน?** DTO ตรวจ "รูปร่าง" · engine ตรวจ "ความหมาย" (action ใช้กับ state นี้ได้ไหม) · service ประสานลำดับ (engine อนุมัติก่อนค่อยบันทึก)
6. **SessionAlreadyCompleted เป็น 409 แต่ InvalidAction เป็น 400 ทำไม?** 400 = คำขอผิดในตัวเอง · 409 = คำขอถูกรูปแต่ขัดกับสถานะปัจจุบัน
7. **กรอกผิด pattern เกิดอะไร?** วนที่ `on_invalid` (หรือ state เดิม) ตัวแปรไม่เปลี่ยน history เพิ่มหนึ่งรายการ
8. **เทสต์มีอะไร?** engine 10 เคส (flow สังเคราะห์) ไม่ต่อ DB · ไม่ได้ทดสอบ repository/service/route อัตโนมัติ (ทดสอบมือผ่านหน้าเว็บ + PowerShell)

### จุดอ่อนที่ต้องพูดตรง ๆ
- `safety_critical` แปลงด้วย `row.safety_critical === 1` ถ้าไดรเวอร์คืนชนิดอื่น ด่านจะปิดแบบเงียบ (fail-open) · engine ไม่ตรวจ safety flag บน state ที่ไม่ใช่ instruction (พึ่ง validateManual ที่ต้นทางข้อมูล)
- regex ใน `input` มาจากข้อมูล: pattern ผิดรูป → `SyntaxError` → 500 · seed ไม่ตรวจความถูกต้อง regex · กันความยาวที่ 255 ตัวใน DTO
- session ใน RAM (Slice นี้): restart แล้วหาย, ไม่หมดอายุ, ไม่ตรวจเจ้าของ → เหตุผลของ Slice 4
- ไม่มีการกันกดซ้ำที่ server (ไม่มีเลขเวอร์ชันของ state) กันที่ UI ด้วย `isPending` เท่านั้น
- `/execution/sessions/:id/actions` ตอบ 201 ตามต้นแบบ (200 ตรงกว่า)

### บทเรียนที่เจอจริง (ระหว่างพิมพ์เอง)
- **วางโค้ดซ้ำ:** `submitAction` ถูกวาง 2 ชุด (esbuild: "Multiple exports with the same name") และ **ช่วงที่ 5 หลุดไป** (tsc: `Cannot find name 'renderState'`) → รัน `npx tsc --noEmit` ทุกครั้งที่จบไฟล์ใหญ่ · `tsx` ไม่ตรวจ type แต่จับ "ประกาศซ้ำ" ได้
- ชื่อโฟลเดอร์ `page` ≠ `pages` → import ไม่เจอ
- `connect ETIMEDOUT` ตอนบูต ≠ MySQL หยุด (ถ้าหยุดจะเป็น ECONNREFUSED) → ตรวจ `DB_HOST`/เครือข่าย/บริการ MySQL80
- React reuse component ตามตำแหน่ง → ต้องใส่ `key={state.stateId}` ที่ `SafetyGateStep`/`InputForm` ไม่งั้น checkbox ยืนยันที่ติ๊กค้างจะติดไปขั้น safety ถัดไป
- `RowDataPacket` / `ResultSetHeader` ของ mysql2: SELECT ได้ `RowDataPacket[]`, INSERT/UPDATE/DELETE ได้ `ResultSetHeader` (`affectedRows`)

---

## Slice 4 — ระหว่างทำ (11 พ.ย. 2569)
**สถานะไฟล์** (✅ พิมพ์/วางแล้ว · ⬜ ยังไม่ตรวจ tsc/ทดสอบ)
| ไฟล์ | พิมพ์แล้ว | ตรวจ | หมายเหตุ |
|---|---|---|---|
| migrations/002_sessions.sql | ✅ | ✅ ไฟล์ถูกต้อง (ผม verify 47 บรรทัด) | ⬜ ยืนยัน `npm run migrate` |
| execution.dto.ts (ฉบับใหม่ + client id) | ✅ | ⬜ | |
| auth/session-owner.ts (ส่วน 1+2: resolve…Owner, `ownerWhere`, `ownerColumns`) | ✅ | ⬜ | **mark: ผู้ใช้ขอ mark ส่วน `ownerWhere`/`ownerColumns`** — จุดสำคัญ: ส่วน SQL ที่ต่อสตริงเป็นค่าคงที่ ค่าผู้ใช้ผ่าน `?` เท่านั้น · Slice 5 จะแก้ไฟล์นี้ (เพิ่ม kind 'user') |
| execution/session.store.ts (MySQL) | ⬜ | | |

**พบเอกสารต้นแบบไม่ตรงโค้ด:** คอมเมนต์ใน `004_sessions.sql` เขียนว่า session เดิน 24 ชม. แต่โค้ดใช้ 7 วัน (`SESSION_TTL_HOURS = 7 * 24`)

### Slice 4 frontend (11 พ.ย. 2569) — mark กลุ่ม B และ C
| กลุ่ม | ไฟล์ | พิมพ์แล้ว | ตรวจ | หมายเหตุ |
|---|---|---|---|---|
| A | lib/clientId.ts, api/http.ts (+`X-Client-Id`), api/types.ts (+trail), api/execution.ts (+getSession/abandon) | ✅ | ⬜ tsc/ทดสอบ | ทุก request มี preflight OPTIONS เพราะ header ที่ตั้งเอง |
| **B** | main.tsx (`QueryClientProvider`, retry false) , api/queries.ts | ✅ **mark** | ⬜ | แกน: query key `['session', id]` + `setQueryData` + `useSubmitAction` ต่อ trail เอง (POST /actions ไม่มี trail) · แก้ชื่อ `getHealth` (เคยเดาผิดเป็น `checkHealth`) · `BrowserRouter` อยู่ใน App.tsx ไม่ใส่ใน main.tsx |
| **C** | ServerStatus.tsx, HomePage.tsx, SessionPage.tsx | ✅ **mark** | ⬜ | SessionPage อ่านตาม id ใน URL → F5 กลับมาทำต่อได้ · มี Trail + ปุ่มเลิกทำ + แยก 404 |

**ข้อแลกเปลี่ยนที่ต้องตอบได้:** trail ฝั่งเว็บต่อเองหลัง POST อาจเพี้ยนจาก DB ถ้ามีเหตุผิดปกติ แต่ F5 จะ GET ใหม่แล้วตรงเสมอ

---

## Slice 5 — Auth (ระหว่างทำ · 11 พ.ย. 2569)
| ไฟล์ | วิธี | พิมพ์แล้ว | ตรวจ | หมายเหตุ |
|---|---|---|---|---|
| migrations/003_users.sql | copy+ALTER | ✅ | ✅ `npm run migrate` ผ่าน | เพิ่มไฟล์ใหม่ ไม่แก้ 002 (schema_migrations จดชื่อไฟล์ที่รันแล้ว) |
| scripts/seed-admin.js | Copy-Item | ✅ | ⬜ | รันด้วย `node scripts/seed-admin.js` (ไม่แตะ package.json) · ADMIN_DISPLAY_NAME บังคับ |
| auth/role.ts | พิมพ์ | ✅ | ✅ | |
| auth/token.ts ★ | พิมพ์ 2 ช่วง | ✅ | ✅ tsc | `expiresIn as jwt.SignOptions['expiresIn']` เพราะ @types/jsonwebtoken 9.0.10 ต้องการ StringValue · regex ตรวจตอนบูตเป็นสะพาน |
| **auth/users.store.ts** | copy | ✅ **mark** | ⬜ | ER_DUP_ENTRY → DuplicateEmailError · อีเมลซ้ำกันด้วย UNIQUE ของ DB ไม่ใช่ SELECT ก่อน INSERT (กัน race) |
| auth/auth.dto.ts | copy | ✅ | ⬜ | login ไม่ตรวจขั้นต่ำรหัสผ่าน (กัน enumeration) · รหัสผ่าน ≤72 ไบต์ (bcrypt) |
| auth/auth.service.ts ★ | พิมพ์ 3 ช่วง | ✅ | ⬜ | bcrypt 10 รอบ · `dummyHash` กัน timing attack · error เดียวทุกกรณี · `toUserDto` เลือกฟิลด์ทีละตัว (allowlist) · เติม `isoFromEpoch` ใน helpers (UNIX_TIMESTAMP → epoch → ISO UTC) |
| auth/auth.middleware.ts ★ | พิมพ์ 3 ช่วง | ✅ | ⬜ | ไม่ส่ง header = guest · ส่งแล้วพัง = 401 เสมอ · `requireAdmin` อ่าน role จาก DB ทุกครั้ง · `RoleLookup` interface |
| auth/auth.routes.ts | copy | ✅ | ⬜ | register 201 / login 200 / me ต้อง requireAuth |
| auth/session-owner.ts ★ | พิมพ์ 2 ช่วง | ✅ | ⬜ | union user/guest · user มาก่อน (ไม่ใช้ client id) · guest = `client_id=? AND user_id IS NULL` |
| execution/session.store.ts (create) + execution.routes.ts | แก้เมธอด / วางทั้งไฟล์ | ✅ | ⬜ | INSERT user_id · route ใส่ `optionalAuth` + `currentUser` |
| admin/admin.routes.ts | copy | ✅ | ⬜ | `adminArea` วางยามที่หัว router · `/admin/ping` |
| app.ts ★ | พิมพ์ 2 ช่วง | ✅ | ⬜ | `TokenService.fromEnv()` ก่อนต่อ DB (fail-fast) · ไม่ใช้ `credentials: true` (ใช้ Bearer ไม่ใช่ cookie) |
| **frontend**: types (+Role/AuthUser/AuthResponse), lib/authStorage.ts, api/http.ts (+Bearer, `anonymous`, `setUnauthorizedHandler`), api/auth.ts | copy | ✅ | ⬜ tsc | handler รับ `usedToken` กันคำขอเก่าลบ token ใหม่ |
| **lib/authContext.ts, components/auth/AuthProvider.tsx** | copy+อธิบาย | ✅ **mark** | ⬜ | status guest/verifying/user · `queryClient.clear()` ทุกครั้งที่เปลี่ยนตัวตน · ตัด `loginUrl`/`useIdentity` จากต้นแบบ (เด้งไป `/login?reason=expired`) · ต้องอยู่ใน BrowserRouter + QueryClientProvider |
| components/auth/TextField.tsx, pages/LoginPage.tsx, pages/RegisterPage.tsx, App.tsx (+AuthProvider, AuthNav, route login/register) | copy | ✅ | ⬜ | ฉบับย่อ ไม่พึ่ง ErrorNotice/Button/authForm ของต้นแบบ · ตรวจฟอร์มฝั่งเว็บ = UX ส่วนความปลอดภัยตัดสินที่ backend |

**ค้างตรวจ Slice 4+5 (ผู้ใช้ยังไม่รายงานผล):** tsc backend/frontend · `/admin/ping` 401/403/200 · role จาก DB (ลด role แล้ว token เดิม 403) · สมัคร/ล็อกอิน/EMAIL_TAKEN · `sessions.user_id` มีค่า · guest มองไม่เห็น session ของ user · token เพี้ยน → /login?reason=expired

---

## Slice 6 — ค้นอาการด้วย embedding (12 พ.ย. 2569 · ผู้ใช้สั่งให้สร้างด้วยวิธี copy ทีละไฟล์ ไม่ใช่แค่อธิบาย)
| ไฟล์ | พิมพ์/copy | อธิบายแล้ว | ตรวจ | หมายเหตุ |
|---|---|---|---|---|
| ติดตั้ง `@huggingface/transformers@4.3.0` + copy `backend/model/` (~56 MB) | คำสั่ง | ✅ | ⬜ | โฟลเดอร์ `Xenova/paraphrase-multilingual-MiniLM-L12-v2/onnx/model_quantized.onnx` ต้องตรงชื่อ |
| common/logger.ts | copy | ✅ | ⬜ | ห่อ console ไว้หลัง interface `AppLogger` |
| **embedding/embedding.service.ts** | copy | ✅ **mark** | ⬜ ลอง `embed` ได้ 384 มิติ | q8 · `allowRemoteModels=false` (ไม่โหลดตอนรัน ข้อความไม่ออกนอกเครื่อง) · mean pooling + normalize → cosine = dot product · `import()` ตอนเรียกเพื่อไม่โหลดไลบรารีหนักถ้าไม่ใช้ · **ยังไม่ได้วัดเวลาโหลด/RAM จริง** (ดู `/symptom-search/status`) |
| **symptom-search/symptom-matcher.ts** | copy | ✅ **mark** | ⬜ tsc + ลองเวกเตอร์ 2 มิติ | ฟังก์ชันบริสุทธิ์ 3 ตัว · `cosineSimilarity` คำนวณความยาวซ้ำ (ถูกต้องแม้ไม่ normalize) + ตรวจมิติ + กันหารศูนย์ · `rankFlows` = หนึ่งผังหนึ่งคะแนน (สูงสุดของข้อความ) เรียงเสถียรด้วย flowId · `selectMatches` กรอง ≥ threshold → ไม่ถึงเกณฑ์ = `[]` ไม่เดา · เกณฑ์ 0.55 เป็นค่าประมาณ ต้องดูตัวเลขจาก eval/ ก่อนตอบ |
| `round3` ต่อท้าย common/helpers.ts, symptom-search/symptom-search.dto.ts, บรรทัด `SYMPTOM_SEARCH_ENABLED=false` ใน .env.example | copy | ✅ | ⬜ | dto: `parseSearchBody` (query ไม่ว่าง ≤200, manualId ไม่บังคับ) + ชนิดตอบกลับ |
| **symptom-search/symptom-search.service.ts** (ฉบับ rebuild: ตัด `addFlows`/`removeFlows` เพราะอ้าง `isActive` ซึ่ง FlowRepository ของ rebuild ไม่มี — เป็นของ Slice 10) | copy 4 ช่วง | ✅ **mark** | ⬜ tsc | ดูหัวข้อสรุปด้านล่าง |

**symptom-search.service.ts — ทำไมเลือกแบบนี้:** `start()` ไม่ await (โหลดโมเดลเบื้องหลัง `/health` ตอบได้) · ปิดเป็นค่าเริ่มต้น (`=== 'true'` เป๊ะ) · ดัชนีใน RAM ไม่ใช้ vector DB · ล้ม = state `failed` + `lastError` ไม่ throw ออกจาก `void` promise (กัน unhandled rejection ล้มทั้งโปรเซส) · ข้อความซ้ำ embed ครั้งเดียว · สร้าง index/info ใหม่ในตัวแปรชั่วคราวแล้วสลับทีเดียว · ตัดสินเกณฑ์ด้วยค่าเต็ม ปัดเศษตอนส่งออก · ไม่ถึงเกณฑ์ = `matches: []` ไม่เดา
**Data flow:** บูต `start()` → (เบื้องหลัง) load โมเดล → ไล่ผัง → embed → `ready` · ค้น `POST /symptom-search` → ตรวจ state (loading=503 NOT_READY, disabled/failed=503 UNAVAILABLE) → embed(query) → กรอง manualId → rankFlows → selectMatches(≥0.55, ≤3) · `GET /status` → state/loadMs/`memoryRssMb`
**Q&A:** ทำไมไม่รอโหลด (ให้ผังหลักใช้ได้ทันที) · ทำไมไม่ใช้ vector DB (ข้อความน้อย เทียบใน RAM) · ไม่ถึงเกณฑ์ทำไมตอบไม่พบ (เดาผิดในงานไฟฟ้าอันตราย) · RAM เท่าไหร่ (ต้องวัด: เทียบ disabled กับ ready จาก `memoryRssMb`) · 0.55 มาจากไหน (ค่าประมาณ ดู eval/)
**จุดอ่อน:** ทำเวกเตอร์ทีละข้อความไม่ขนาน ไม่มี retry · ดัชนีสร้างตอนบูตเท่านั้น (rebuild ไม่มี addFlows/removeFlows) · `as FlowInfo` ไม่มีการตรวจตอนรันรองรับ · `scoreFlow` ยังไม่มีผู้เรียก (ไม่มีคอลัมน์ `sessions.confidence`) · ยังไม่ได้วัดเวลาโหลด/RAM จริง

### Slice 6 frontend — ทำตามต้นแบบจริง (12 พ.ย. 2569 · ผู้ใช้สั่งยกเลิกฉบับย่อ) — ธีม Tailwind ตรงกับ ORIG จึง Copy-Item ได้ตรง ๆ
| กลุ่ม | ไฟล์ | วิธี | อธิบายแล้ว | ตรวจ | หมายเหตุ |
|---|---|---|---|---|---|
| 1 | components/ui/{Icon,Button,Notice}.tsx | Copy-Item | ✅ | ⬜ | `Record<IconName,…>` บังคับครบ · Button `type='button'` เป็นค่าเริ่มต้น (กันส่งฟอร์มโดยไม่ตั้งใจ) · ไม่พึ่งสีอย่างเดียว |
| 2 | components/{LoadingText,SlowServerNotice}.tsx, lib/useSlowWait.ts | Copy-Item | ✅ | ⬜ | แจ้งเตือนเมื่อรอเกิน 4 วินาที (Render free หลับ) · `clearTimeout` ใน cleanup กันกล่องผีโผล่ · 4 วินาทีเป็นค่าประมาณ ไม่ได้วัด |
| 3 | lib/textInput.ts, labels.ts, models.ts | Copy-Item | ✅ | ⬜ tsc | ต้องเพิ่ม types: ManualSummary, ModelSelection, HistoryFeedback · `MAX_QUERY_LENGTH=200` ซ้ำกับ backend ไม่มีกลไกบังคับให้ตรง · models.ts เทียบแค่ส่วนต้นตามความยาวที่สั้นกว่า (เหมาะกับกรอง ไม่ใช่ยืนยันรุ่น) |
| 3 | **lib/modelSelection.ts**, **lib/symptoms.ts** | Copy-Item | ✅ **mark** | ⬜ | modelSelection: เก็บรุ่นที่เลือกไว้ใน URL (`?manual=…&unknown=1`) → F5/ย้อนกลับ/ส่งลิงก์ได้ · ค่าใน URL ผู้ใช้แก้เองได้ หน้าต้องตรวจ · `modelSelectionFromState` ห้ามเดาเป็น 'selected' · symptoms: `Intl.Collator('th')` สร้างครั้งเดียว เรียงไทยตามพจนานุกรม (ไม่ใช้ `<`) · `groupSymptoms` ใช้ Map ตาม manualId |

| 4 (ทำใหม่แบบทีละช่วง ไม่ใช้ Copy-Item) | lib/historyView.ts, lib/errors.ts (5 ช่วง), components/ErrorNotice.tsx (+type HistoryFlowInfo) | พิมพ์ | ✅ | ⬜ | errors.ts = ตารางแปลรหัส→{หัวข้อ,คำอธิบาย,วิธีกู้} + `describeError` · `Object.hasOwn` กัน constructor/toString · ข้อความเซิร์ฟเวอร์ใช้แทนเฉพาะรหัสที่เจาะจงกว่า · ตารางไม่มี INVALID_JSON/NOT_FOUND/INTERNAL_ERROR ของ backend rebuild (ตกเป็น UNKNOWN_ERROR) · ErrorNotice แสดงปุ่มลองใหม่เมื่อหน้าส่ง onRetry เท่านั้น |
| 5 backend | migration 004_session_search.sql (confidence DECIMAL(4,3), model_selection ENUM NULL), engine `startSession(flow, confidence)`, execution.dto (ModelSelection, parseStartSessionBody ใหม่, ใช้ MAX_QUERY/MANUAL จาก symptom-search.dto), flow.repository (`ManualSummary`, `manualExtras`, `listManuals` นับจากผังใน RAM), session.store (create รับ modelSelection, find อ่าน confidence แปลง Number, `findModelSelection`), execution.service (`listManuals`, `startSession` ตรวจ FLOW_MANUAL_MISMATCH ก่อนคำนวณ confidence, `computeConfidence` กลืน error→null), execution.routes (GET /manuals, POST /sessions ใหม่), app.ts (สร้าง symptomSearch ก่อน execution, ตัด flows.load ซ้ำ, ลงทะเบียน /symptom-search) | พิมพ์ | ✅ | ⬜ | **พบ: ORIG ในเครื่องมี session.store.ts ที่แก้ยังไม่ commit (TTL 24 ชม., ลบ findModelSelection) ทำให้ ORIG คอมไพล์ไม่ผ่าน — ใช้ HEAD เป็นต้นแบบ** · migration ของ Slice 8 เปลี่ยนเป็นเลข 005 |
| 5 frontend | api/types (SymptomMatch, SymptomSearchResponse, SessionResponse +confidence/modelSelection), api/execution.ts (+listManuals/searchSymptoms/startSession options), api/queries.ts (useManuals, useSymptomSearch, useStartSession ตัวแปรเป็นออบเจกต์, staleTime Infinity ของ flows/manuals) | พิมพ์ | ✅ | ⬜ | staleTime Infinity: ผังใหม่ปรากฏเมื่อรีเฟรชเท่านั้น · backend startSession พารามิเตอร์ตามตำแหน่ง (เสี่ยงสลับค่า) / frontend ใช้ออบเจกต์ |
| 6 | components/SymptomRow (Pick<FlowSummary,3 ฟิลด์> ใช้ได้ทั้ง FlowSummary และ SymptomMatch), SymptomSearchForm (controlled, handler ตรวจซ้ำนอกจากปุ่ม disabled), SymptomSearchResults (ไม่พบ=กล่องฟ้า ไม่ใช่แดง, เตือนคะแนนไม่ใช่โอกาสถูกต้อง), lib/useStartSymptom | พิมพ์ | ✅ | ⬜ | ข้อความมีชื่อ "Samsung" ตายตัว |
| 7 | pages/DevicesPage (3 ส่วน: DevicesPage / CategoryStep / ModelStep), pages/SymptomsPage (3 ส่วน: hooks / JSX / SearchErrorNotice) | พิมพ์ | ✅ | ⬜ | DevicesPage: category ใน URL + ตรวจ includes (as ตามด้วยตรวจจริง) · ModelStep: shown = derived state · `setIsUnknown(prev => !prev)` · SymptomsPage: hooks ต้องอยู่เหนือ early return (Rules of Hooks) · ส่ง `search.data.query` ไม่ใช่ query ปัจจุบัน ตอนเริ่ม session · แผนผัง flow ของ SymptomsPage: `/symptoms?manual=<id>[&unknown=1]` → ค้น → เลือก → /session/<id> |

**หมายเหตุสำคัญสำหรับกลุ่ม 5 (backend):** ต้นแบบเก็บ `modelSelection` ใน `sessions` (GET session ส่งกลับ) → rebuild ต้องเพิ่ม migration + แก้ store/service/dto + endpoint `GET /execution/manuals`
