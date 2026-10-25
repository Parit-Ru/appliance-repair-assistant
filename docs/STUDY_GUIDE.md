# คู่มือเตรียมสอบ — ผู้ช่วยซ่อมเครื่องใช้ไฟฟ้า (appliance-repair-assistant)

> เขียนสำหรับคนที่เพิ่งอ่านโค้ดและต้องอธิบายโปรเจกต์ต่อกรรมการ · ทุกข้อความในเอกสารนี้อ้างจาก **พฤติกรรมตามโค้ดจริง** ไม่ใช่ตาม TOR หรือ prompt เดิม
> ถ้าส่วนไหนไม่แน่ใจ จะเขียนว่า **"ไม่แน่ใจ"** ไว้ตรงๆ — อย่าเอาไปตอบกรรมการเป็นข้อเท็จจริงโดยไม่เปิดโค้ดยืนยัน
>
> **สถานะเอกสาร:** ส่วนที่ 1 ยืนยันแล้ว · ส่วนที่ 2 ยืนยันแล้ว · ส่วนที่ 3 ยืนยันแล้ว · ส่วนที่ 4–5 ยืนยันแล้ว · **21 ต.ค. 2569 backend ย้ายเป็น Express — ปรับเลขบรรทัด/ชื่อไฟล์ทั้งเอกสารแล้ว และเพิ่ม §5.7 (รอยืนยัน)** · ส่วนที่ 6 เขียนเสร็จ รอยืนยัน · ภาคผนวก "ต้องตรวจก่อนสอบ" อยู่ท้ายเอกสาร (รอยืนยันทีละส่วน)
>
> | ส่วน | หัวข้อ | สถานะ |
> |---|---|---|
> | 1 | โครงสร้างโฟลเดอร์ + ไฟล์สำคัญ | ✅ ยืนยันแล้ว |
> | 2 | flow หลัก ค้นอาการ → เดินผังจบ | ✅ ยืนยันแล้ว |
> | 3 | อธิบายแนวคิด (embedding, cosine, 0.55, top 3, state machine, safety, rephrase) | ✅ ยืนยันแล้ว |
> | 4 | flow auth/guest, history, feedback, outcome, admin authoring, error handling | ✅ ยืนยันแล้ว |
> | 5 | สิ่งที่ลบ/รวมในงานนี้ + ตัวเลขก่อน-หลัง (รอบ 1 + รอบ 2 ใน §5.6) · ย้ายเป็น Express §5.7 | ✅ 5.1–5.6 ยืนยันแล้ว · 📝 5.7 รอยืนยัน |
> | 6 | คำถามกรรมการ 25 ข้อ + "ทำไมไม่ใช้ X" + หน้าสรุปท้ายเอกสาร | 📝 เขียนแล้ว รอยืนยัน |

---

# ส่วนที่ 1 — โครงสร้างโฟลเดอร์ + ไฟล์สำคัญ

## 1.0 ระบบนี้คืออะไร (ย่อหน้าเดียวที่ต้องพูดให้ได้)

ผู้ใช้เลือกรุ่นเครื่องใช้ไฟฟ้า พิมพ์อาการ → ระบบหาอาการที่ **ใกล้เคียงที่สุด** จากรายการอาการที่เตรียมไว้ (เทียบความหมายด้วย embedding + cosine similarity) → เข้าสู่ **ผังขั้นตอนการตรวจ** (decision graph ที่แปลงมาจากคู่มือ) แล้ว **เดินทีละขั้น** ตอบ ใช่/ไม่ใช่ หรือกรอกค่า จนถึงจุดสิ้นสุด (แก้ได้ / ส่งต่อช่าง ฯลฯ)

**ข้อสำคัญที่สุดสำหรับการสอบ:** ระบบ *ไม่ได้ให้ AI สร้างคำตอบ* ทุกขั้นตอนที่ผู้ใช้เห็นมาจากผังที่เก็บในฐานข้อมูล AI (LLM) มีบทบาทแค่ 2 จุด และทั้งสองจุดถูกควบคุมด้วยโค้ด:

| จุดที่ใช้ LLM | ทำอะไร | ควบคุมโดย |
|---|---|---|
| **rephrase** (`backend/src/rephrase/`) | เรียบเรียงข้อความขั้นตอนให้อ่านง่ายขึ้น | `rephrase-guard.ts` ตรวจว่าตัวเลข/คำศัพท์/การปฏิเสธไม่เปลี่ยน ถ้าไม่ผ่านใช้ข้อความต้นฉบับ |
| **ร่างผังจาก PDF** (`backend/src/authoring/`) | admin อัปโหลด PDF คู่มือ → LLM ร่างผังให้ตรวจ | `graph-validator.ts` + คนต้องกดเผยแพร่เอง LLM ตัดสินเองไม่ได้ |

→ ใน TOR/prompt เดิมอาจเรียกว่า RAG แต่ **ตามโค้ดจริงไม่ใช่ RAG แบบดึงเอกสารแล้วให้ LLM เขียนคำตอบ** (ดู 1.9 "จุดที่ต้องระวังตอนสอบ")

## 1.1 ภาพรวมระดับบนสุด

```
appliance-repair-assistant/
├── backend/        Express 4 + TypeScript + mysql2 (SQL ดิบ ไม่มี ORM)  → deploy บน Render
├── frontend/       React 19 + Vite + Tailwind + TanStack Query         → deploy บน GitHub Pages
├── data/           ข้อมูลต้นทาง: คู่มือ→chunk→ผัง JSON, รายการอุปกรณ์, schema, PDF ต้นฉบับ
├── scripts/        สคริปต์ Python offline (แปลง chunk→ผัง, ตรวจผัง, จำลองการเดิน)
├── docs/           เอกสารทั้งหมด (รวมไฟล์นี้)
├── render.yaml     ตั้งค่า deploy backend บน Render (free plan)
├── check/, draft/  ไม่ใช่ส่วนของระบบที่รัน — ดู 1.8
```

| ชั้น | เทคโนโลยี | หลักฐานในโค้ด |
|---|---|---|
| Backend framework | Express 4 (เดิม NestJS 10 — ย้ายเมื่อ 21 ต.ค. 2569 ดู 5.7) | `backend/package.json` (`express ^4.22.1`), `backend/src/app.ts` |
| ฐานข้อมูล | MySQL (Aiven) ผ่าน `mysql2/promise` แบบ SQL ดิบ + พารามิเตอร์ `?` | `backend/src/database/pool.ts`, ทุกไฟล์ `*.store.ts` / `*.repository.ts` |
| Embedding | `@huggingface/transformers` รันโมเดล `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (q8) ในโปรเซส backend | `backend/src/embedding/embedding.service.ts:5-6` |
| LLM | Groq (OpenAI-compatible endpoint) | `rephrase/groq-llm.client.ts`, `authoring/draft-llm.client.ts` |
| อ่าน PDF | `unpdf` | `authoring/pdf-text.ts` |
| Frontend | React 19, react-router, TanStack Query, Tailwind | `frontend/package.json`, `frontend/src/App.tsx` |

ฐานข้อมูลเป็นก้อนเดียวกับโปรเจกต์เก่า `troubleshoot-assistantv2` (ใช้ Aiven ตัวเดียวกัน) — **โปรเจกต์นี้ไม่แตะโปรเจกต์เก่า** และตาราง `sessions`/`graphs` ใช้ร่วมกัน (มีคอมเมนต์เรื่องนี้ใน `admin/admin.service.ts` — ผลคือสถิติ admin แยกเฉพาะโปรเจกต์นี้ด้วย `graph_id` ไม่ได้ทั้งหมด)

## 1.2 Backend: จุดเริ่มและการประกอบแอป (Express ธรรมดา)

> ★ 21 ต.ค. 2569 backend ย้ายจาก NestJS เป็น Express ธรรมดา (API เหมือนเดิมทุกอย่าง) — เหตุผลและตารางเทียบอยู่ในส่วนที่ 5 หัวข้อ 5.7

```
backend/src/
├── main.ts              จุดเริ่ม: dotenv → createApp() → listen PORT   (17 บรรทัด)
├── app.ts               ★ ประกอบทุกอย่างในที่เดียว: ตรวจ JWT → pool → store → service → ลำดับบูต → routes → 404 → error handler (100)
├── database/pool.ts     สร้าง connection pool ของ mysql2 + ping ตอนบูต + อ่าน DB_SSL_CA (82)
├── common/              api-error.ts · error-handler.ts (แปลง error ทุกชนิดเป็น response) · logger.ts · helpers.ts
└── health/              GET /health — ยิง SELECT 1 เช็กว่า DB ตอบ (Render ใช้เป็น healthCheckPath)
```

**อ่าน `app.ts` จากบนลงล่างแล้วเห็นทั้งระบบ** (`app.ts:58-100`):
1. `TokenService.fromEnv()` ตรวจ `JWT_SECRET`/`JWT_EXPIRES_IN` และ `createDbPool()` ต่อฐานข้อมูล — ผิดอย่างใดอย่างหนึ่ง = บูตไม่ขึ้น (`app.ts:60-61`)
2. `new` ชั้นข้อมูล (store/repository รับ `pool`) แล้ว `new` ชั้นตรรกะ (service รับ store/repository) — **ไม่มี DI/decorator** ใครใช้อะไรเห็นจาก argument ของ `new` (`app.ts:64-72`)
3. ลำดับบูต: โหลดผังเข้าหน่วยความจำ → โหลดอุปกรณ์ → เริ่มระบบค้นหา "ไม่รอ" → เปลี่ยนร่างผังที่ค้างเป็น failed (`app.ts:75-78`)
4. ประกอบ Express: CORS (`CORS_ORIGIN`) → body parser JSON/urlencoded → routes ทีละโมดูล → 404 → error handler (`app.ts:81-97`)

`database/pool.ts` ยัง normalise ค่า `DB_SSL_CA` ที่วางใน Render ให้เป็น PEM (`normalizePem`) เหมือนเดิม

## 1.3 Backend: ไฟล์ในแต่ละโมดูล (รูปแบบซ้ำกันทุกโมดูล)

รูปแบบที่โปรเจกต์ใช้ซ้ำ — จำแพทเทิร์นนี้ได้ก็อ่านได้ทุกโมดูล:

```
*.routes.ts      ฟังก์ชันที่รับ service แล้วคืน express.Router: ตรวจรูปร่าง input ด้วย parse*() → เรียก service → ตอบ (ไม่มีตรรกะธุรกิจ)
*.dto.ts         ชนิดข้อมูล + ฟังก์ชัน parse*() เขียนมือ (ไม่ใช้ class-validator) โยน ApiError 400 ถ้าผิดรูป
*.service.ts     ตรรกะธุรกิจ (คลาสธรรมดา รับของที่ต้องใช้ทาง constructor)
*.store.ts / *.repository.ts   SQL ล้วน (ที่เดียวที่รู้จักตาราง) รับ pool ทาง constructor
```

### `traversal-engine/` — เครื่องสถานะของผัง (หัวใจ ไม่รู้จัก HTTP/ฐานข้อมูลเลย)
| ไฟล์ | ทำอะไร |
|---|---|
| `types.ts` (144) | ชนิดของผัง/โหนด/session (`NodeType` = checkpoint, instruction, input, resolution, escalation · `OutcomeKind` = user_fixed, normal_behavior, handoff_informed, handoff_unknown) + คลาส error ของ engine 4 ชนิด (`TraversalError` และลูก) |
| `traversal-engine.ts` (172) | ฟังก์ชันล้วน `startSession`, `getCurrentNode`, `submitAction`, `getOutcomeKind` (หาชนิดจุดจบของโหนด — รอบ 2 รวมมาไว้ที่เดียว) — รับ session+ผัง คืน session ใหม่+โหนดถัดไป **รวมด่าน safety_critical** (`SafetyConfirmationRequiredError`) |

### `traversal/` — ต่อ engine เข้ากับข้อมูลจริง (API เดินผัง)
| ไฟล์ | ทำอะไร |
|---|---|
| `traversal.routes.ts` (94) | 7 endpoint: `GET /traversal/graphs`, `GET /traversal/manuals`, `POST /traversal/sessions`, `GET /traversal/sessions/:id`, `POST …/actions`, `POST …/outcome`, `DELETE …/sessions/:id` · endpoint ของ session ผ่าน `optionalAuth` |
| `traversal.service.ts` (193) | หาผัง/ session → เรียก engine → บันทึก → (ถ้าเปิด) rephrase · ไม่มีตรรกะเปลี่ยนสถานะเอง (ทุกการตัดสินมาจาก engine) · ด่าน safety บังคับตรงที่เรียก engine ก่อนบันทึกเสมอ |
| `traversal.dto.ts` (203) | `parseStartSessionBody`, `parseTraversalAction`, `parseOutcomeBody`, `parseOptionalClientId`/`parseRequiredClientId` |
| `graph.repository.ts` (298) | โหลดผังทั้งหมดจาก MySQL **เข้าหน่วยความจำตอนบูต** (`load()` ที่ `app.ts` เรียก) + `reload()` หลัง publish · เป็นตัวโหลดผังที่ใช้ตอนเดินผัง (`loadAll` บรรทัด 120–172; ตาราง manuals/graphs/nodes ถูก **เขียน** โดย `authoring/drafts.store.ts` ตอน publish และถูกอ่านโดยสคริปต์ seed/backup ด้วย) |
| `session.store.ts` (236) | SQL ของ `sessions` / `session_history` · session ที่เดินอยู่หมดอายุ 24 ชม. · ที่จบแล้วเก็บ 90 วัน (ค่าคงที่ `SESSION_TTL_HOURS`, `COMPLETED_SESSION_TTL_DAYS`) |
| `equipment.repository.ts` (59) | อ่านรายการอุปกรณ์ที่ต้องใช้ตามหมวดเครื่อง เก็บใน Map ในหน่วยความจำ (`load()` ตอนบูต) |

### `symptom-search/` + `embedding/` — ค้นอาการ
| ไฟล์ | ทำอะไร |
|---|---|
| `embedding.service.ts` (55) | โหลดโมเดล embedding (cache ที่ `backend/model`) แล้วแปลงข้อความ→เวกเตอร์ (mean pooling + normalize) |
| `symptom-matcher.ts` (95) | **คณิตศาสตร์ล้วน** `cosineSimilarity`, `buildSymptomTexts`, `rankGraphs`, `selectMatches` |
| `symptom-search.service.ts` (212) | ตอนบูต (`start()` ที่ `app.ts` เรียก) **เฉพาะเมื่อตั้ง `SYMPTOM_SEARCH_ENABLED=true`** (ค่าเริ่มต้นปิด — `render.yaml` ตั้งเป็น true) แปลงอาการทุกผังเป็นเวกเตอร์เก็บในหน่วยความจำ · ตอนค้น: แปลงคำค้น → จัดอันดับ → ตัดด้วยเกณฑ์ `MATCH_THRESHOLD = 0.55` และ `MAX_RESULTS = 3` |
| `symptom-search.routes.ts` (36) | `POST /symptom-search` (ตอบ 200), `GET /symptom-search/status` |
| `symptom-search.dto.ts` | `parseSearchBody`, ค่าจำกัดความยาวคำค้น/manualId |

### `rephrase/` — เรียบเรียงข้อความ (ไม่ใช่การสร้างเนื้อหา)
| ไฟล์ | ทำอะไร |
|---|---|
| `rephrase.service.ts` (67) | เรียก LLM ภายใน timeout (ค่าเริ่มต้น 3000 ms) ถ้าผิดพลาด/เกินเวลา/guard ไม่ผ่าน → คืนข้อความต้นฉบับ (`rephrased: false`) |
| `rephrase-guard.ts` (61) | ด่านตรวจ: ผลลัพธ์ว่าง/มีลิงก์/markdown/หลายย่อหน้า, ความยาวอยู่ที่ 0.5–1.6 เท่าของต้นฉบับ, ตัวเลข (รวมเลขไทย), token ภาษาอังกฤษ, จำนวนคำปฏิเสธ "ไม่" ต้องเหมือนต้นฉบับ |
| `groq-llm.client.ts` (52) | เรียก Groq API (`SYSTEM_PROMPT` ห้ามเพิ่ม/ลบ/เปลี่ยนความหมาย ห้ามเปลี่ยนตัวเลข) — สร้างจาก env `GROQ_API_KEY`/`GROQ_MODEL` ถ้าไม่ครบก็ไม่เปิด |

> `app.ts` สร้าง `RephraseService` ใน `createRephraseService()` (`app.ts:47-56`) · เปิดจริงต่อเมื่อ client สร้างได้ (key+model ครบ)

### `auth/` — บัญชี, guest, สิทธิ์
| ไฟล์ | ทำอะไร |
|---|---|
| `auth.routes.ts` (46) | `POST /auth/register` (201), `POST /auth/login` (200), `GET /auth/me` (ผ่าน `requireAuth`) |
| `auth.service.ts` (97) | สมัคร (role = user เสมอ) / login (ข้อความ error เดียวกันทุกกรณี + compare hash หลอกเมื่อไม่พบอีเมล) / ออก JWT ผ่าน `TokenService` + `bcryptjs` |
| `token.ts` (53) | `TokenService`: ตรวจ `JWT_SECRET` (≥ 32) / `JWT_EXPIRES_IN` ตอนบูต · `sign()` และ `verify()` ด้วยไลบรารี `jsonwebtoken` แบบ HS256 เท่านั้น |
| `auth.middleware.ts` (109) | middleware 3 ตัว: `optionalAuth` (ไม่มี token = guest · token เสีย = 401 ไม่แอบเป็น guest), `requireAuth` (401), `requireAdmin` (403) · ทุกตัววางผลไว้ที่ `request.user` · ไม่ใช้ passport |
| `role.enum.ts` | บทบาท `user` / `admin` + `isRole()` |
| `session-owner.ts` (39) | **จุดเดียว** ที่ตัดสินว่า "ใครเป็นเจ้าของ session" (user → `user_id`, guest → `client_id` + `user_id IS NULL`) และสร้างเงื่อนไข SQL |
| `users.store.ts` (98) | SQL ตาราง `users` |

### `history/` — หน้าประวัติการซ่อม + feedback
| ไฟล์ | ทำอะไร |
|---|---|
| `history.routes.ts` (68) | `GET /history` (แบ่งหน้า ใหม่สุดก่อน), `GET /history/:id`, `POST /history/:id/feedback` (200), `DELETE /history/:id` (204) · ทุกตัวผ่าน `optionalAuth` |
| `history.service.ts` (258) | ประกอบรายละเอียดจาก engine + ข้อมูลผัง (ไม่เรียก LLM, ไม่คิดเกณฑ์ใหม่) · ผังที่ถูก seed ใหม่จนหาไม่เจอ → ตอบ `available=false` แทน 500 |
| `history.store.ts` (160) | SQL เฉพาะ session ที่ `completed` + ยังไม่หมดอายุ + ของเจ้าของนั้นเท่านั้น · ตาราง `session_feedback` |
| `history.dto.ts` | `parseHistoryQuery` (รับแค่ `page`, `pageSize`), `parseFeedbackBody` |

### `admin/` — สถิติ (อ่านอย่างเดียว)
| ไฟล์ | ทำอะไร |
|---|---|
| `admin.routes.ts` (44) | `GET /admin/feedback`, `GET /admin/analytics/summary` (ทุก route ผ่าน `requireAuth` → `requireAdmin` ก่อน parse query) |
| `admin.store.ts` (223) | SELECT ล้วน ไม่แตะตาราง `users` ไม่ดึง email/ชื่อ/id เจ้าของออกมา (รู้แค่ชนิด user/guest/none) |
| `admin.service.ts`, `admin.dto.ts` | ประกอบตัวเลข (ตัวหาร 0 → null) / ตรวจ query |

### `authoring/` — admin อัปโหลด PDF → ร่างผัง → ตรวจ → เผยแพร่
| ไฟล์ | ทำอะไร |
|---|---|
| `drafts.routes.ts` (140) | `POST /admin/drafts` (multipart, 202), `GET /admin/drafts`, `GET/PUT /admin/drafts/:id`, `POST …/reject`, `POST …/publish` · ทุก route ผ่าน `requireAuth` → `requireAdmin` · `uploadPdf()` รับไฟล์ด้วย multer **หลัง** ด่านสิทธิ์ และแปลง error ของ multer เป็น 413/400 |
| `drafts.service.ts` (280) | ควบคุมทั้งกระบวนการ: ตรวจไฟล์ → ทีละ 1 งาน → ดึงข้อความ PDF → เรียก LLM (ครั้งละ 2 หน้า `PAGES_PER_LLM_CALL`) → parse → ตรวจด้วย validator → เก็บเป็นร่าง |
| `pdf-text.ts` (110) | ดึงข้อความจาก PDF ด้วย `unpdf` ในหน่วยความจำ (ไม่เขียนดิสก์) · จำกัด 200 หน้า/ช่วงเลือกได้ ≤ 10 หน้า/ต่อหน้า ≤ 12,000 ตัวอักษร |
| `draft-llm.client.ts` (149) | เรียก Groq ให้ร่างผัง (`PROMPT_VERSION = 'v1'` เก็บไว้ในร่าง) |
| `draft-schema.ts` (212) | ตรวจรูปแบบคำตอบ LLM แบบ "ไม่เชื่อ JSON mode" — ฟิลด์เกิน/ชนิดผิด → ปฏิเสธทั้งก้อน (`DraftParseError`) |
| `graph-validator.ts` (502) | **ผู้ตัดสินว่าผังผ่านไหม** — พอร์ตกฎจาก `scripts/validate_graph.py` · ตรวจแบบร่างอย่างเดียว (รอบ 2 ลบโหมด `existing` ที่ไม่มีใครเรียก) · error = กัน publish, warning = ต้อง acknowledge |
| `draft-manual.ts` (123) | แปลงร่างเป็นแถวของ manuals/graphs/nodes ที่พร้อม INSERT |
| `drafts.store.ts` (258) | SQL ของ `graph_drafts` + publish ใน transaction เดียว (`SELECT … FOR UPDATE`, id ชน = ปฏิเสธ ไม่เขียนทับ) |
| `drafts.errors.ts` (36) | ฟังก์ชันสร้าง `ApiError` ของโมดูลนี้ (`draftBusy`, `draftInvalid` ฯลฯ) |
| `drafts.dto.ts` | parse ฟอร์มอัปโหลด / PUT / publish / reject |

### `common/` — ของที่ทุกโมดูลใช้ร่วม
| ไฟล์ | ทำอะไร |
|---|---|
| `api-error.ts` (10) | `ApiError(status, code, message)` — error ที่ "รู้" รหัส HTTP ในตัว |
| `error-handler.ts` (115) | `errorHandler` error middleware ตัวเดียวทั้งแอป แปลงทุก error เป็น `{statusCode, code, message}` · `notFoundHandler` (404) · `asyncRoute()` ส่ง error ของ handler แบบ async มาที่นี่ · รายละเอียดในส่วนที่ 4.7 |
| `logger.ts` (18) | log สั้นๆ แบบ `[ชื่อส่วน] ข้อความ` (console) |
| `helpers.ts` (18) | ★ รอบ 2: ฟังก์ชันเล็กที่เคยเขียนซ้ำหลายไฟล์ — `isPlainObject`, `round3`, `numOrNull`, `isoFromEpoch`, `UUID_PATTERN` |

## 1.4 Backend: นอก `src/`

| ที่อยู่ | ทำอะไร |
|---|---|
| `backend/migrations/001–006_*.sql` | schema ฐานข้อมูลแบ่งตามเรื่อง: 001 users · 002 manuals/graphs/nodes · 003 equipment · 004 sessions/session_history · 005 session_feedback · 006 graph_drafts (รายละเอียด `docs/reference/DATABASE.md`) |
| `backend/scripts/run-migrations.js` | รัน migration (`npm run migrate`) |
| `backend/scripts/seed-graphs.js` | โหลด `data/manuals/*.json` เข้า DB (`npm run seed`) — ตรวจก่อน insert (มี `validateManual` ของตัวเอง) |
| `backend/scripts/seed-equipment.js`, `seed-admin.js` | seed อุปกรณ์ / สร้างบัญชี admin (admin สร้างได้ทางนี้ทางเดียว สมัครสาธารณะได้แค่ user) |
| `backend/scripts/backup-graph-tables.js` | สำรองตารางผังเป็น SQL ลง `backend/backups/` |
| `backend/scripts/reset-database.js` | ลบตารางทั้งหมดเพื่อ migrate/seed ใหม่ (dry run เป็นค่าเริ่มต้น) |
| `backend/model/` | ไฟล์โมเดล embedding ที่เตรียมไว้ในโปรเจกต์ (`MODEL_CACHE_DIR`) |
| `backend/dist/` | ผล build (`npm run build` = ลบ dist แล้ว `tsc`) — ไม่ต้องอ่าน |
| `backend/package.json` scripts | `build` (tsc) · `start` / `start:prod` (`node dist/main.js`) · ระหว่างพัฒนา: `build:watch` (tsc --watch) คู่กับ `start:dev` (node --watch dist/main.js) คนละหน้าต่าง |
| `backend/jest.config.js` | มีตั้งค่า jest และ `npm test` แต่ **ค้นแล้วไม่พบไฟล์ `*.spec.*` / `*.test.*` ในทั้ง backend และ frontend** (frontend ก็มี vitest ตั้งไว้แต่ไม่มีไฟล์เทสต์) — ไม่มีชุดเทสต์อัตโนมัติในรีโปตอนนี้ |

## 1.5 Frontend

```
frontend/src/
├── main.tsx, App.tsx        เริ่มแอป + ตาราง route (react-router)
├── pages/                   หน้าต่างๆ (1 ไฟล์ = 1 route)
├── components/              ชิ้นส่วน UI แยกเป็นกลุ่ม: step/ history/ admin/ admin/drafts/ auth/ layout/ ui/
├── api/                     เรียก backend: http.ts (fetch กลาง), queries.ts (TanStack Query hooks), types.ts (ชนิด response)
└── lib/                     ฟังก์ชันช่วยล้วนๆ: errors.ts, clientId.ts, authStorage.ts, trail.ts ฯลฯ
```

| route | หน้า | ทำอะไร |
|---|---|---|
| `/` | `HomePage` | หน้าแรก |
| `/devices` | `DevicesPage` | เลือกหมวดเครื่อง/รุ่น |
| `/symptoms`, `/symptoms/all` | `SymptomsPage`, `AllSymptomsPage` | พิมพ์ค้นอาการ / ดูอาการทั้งหมดของรุ่นที่เลือก |
| `/session/:sessionId` | `SessionPage` | **เดินผังทีละขั้น** (ใช้ `components/step/*`) |
| `/history`, `/history/:sessionId` | `HistoryPage`, `HistoryDetailPage` | ประวัติ, รายละเอียด, feedback, ลบ |
| `/login`, `/register` | `LoginPage`, `RegisterPage` | บัญชีผู้ใช้ |
| `/admin/analytics`, `/admin/feedback` | `AdminAnalyticsPage`, `AdminFeedbackPage` | สถิติ (ห่อด้วย `AdminRoute`) |
| `/admin/drafts`, `/admin/drafts/:id` | `AdminDraftsPage`, `AdminDraftReviewPage` | อัปโหลด PDF / ตรวจร่าง / เผยแพร่ |
| `*` | `NotFoundPage` | |

ไฟล์ frontend ที่ควรรู้ชื่อ:
- `api/http.ts` — ห่อ `fetch` กลาง (ใส่ `Authorization` / `X-Client-Id`, แปลง error response เป็น error ฝั่งหน้าจอ)
- `lib/errors.ts` (279 บรรทัด) — `describeError` ตัดสิน **จาก `code`** แล้วเลือกข้อความไทย (รอบ 2 เปลี่ยนเป็นตาราง `MESSAGES` ที่ map code→ข้อความ แทน switch ยาว) (backend เปลี่ยน `message` ได้โดยหน้าจอไม่พัง)
- `lib/clientId.ts` — สร้าง/เก็บ UUID ของเบราว์เซอร์ (ตัวระบุ guest)
- `lib/authStorage.ts`, `components/auth/AuthProvider.tsx` — เก็บ token / สถานะล็อกอิน
- `components/LoadingText.tsx` — ★ รอบ 2: ข้อความ "กำลังโหลด…" + ไอคอนหมุน ที่เคยเขียนซ้ำ 10 หน้า
- `components/step/*` — ส่วนแสดงแต่ละขั้น (`StepView`, `SafetyGateStep`, `InputStep`, `OutcomeStep`, `PathRail`)

## 1.6 `data/` และ `scripts/` (ฝั่งเตรียมข้อมูล — ไม่ได้รันตอนใช้งาน)

```
PDF คู่มือ ──(แยก chunk)──▶ data/chuck/*.json ──(scripts/convert_chunks_to_graphs.py)──▶ data/manuals/*.json ──(npm run seed)──▶ MySQL
```

| ที่อยู่ | ข้อเท็จจริงที่นับได้จากไฟล์ |
|---|---|
| `data/pdf/` | PDF คู่มือต้นฉบับ (ใหญ่ ~415 MB และอยู่ใน git — ตามรายงาน `SIMPLIFY_REPORT.md`) |
| `data/chuck/` | 23 ไฟล์ JSON (ชื่อโฟลเดอร์สะกด `chuck` ไม่ใช่ chunk — **ไม่แก้เพราะสคริปต์อ้างชื่อนี้อยู่**; น่าจะหมายถึง chunk ของคู่มือ) |
| `data/manuals/` | **22** ไฟล์ JSON ผังต่อคู่มือ (schema v2) รวม **644 ผัง** (นับจริงจากไฟล์ตอนเขียนส่วนที่ 3: แอร์ 13 · ไมโครเวฟ 105 · ตู้เย็น 100 · ทีวี 288 · เครื่องซักผ้า 138) — ตรงกับที่คอมเมนต์ใน `graph-validator.ts` ระบุว่าตรวจผังจริง 644 ผัง · (ส่วนที่ 1 เดิมเขียน 19 ไฟล์ ซึ่งผิด เพราะผมดูรายการที่ถูกตัดท้าย) |
| `data/equipment/equipment.json` | รายการอุปกรณ์ที่ต้องใช้ตามหมวดเครื่อง |
| `data/schemas/` | JSON Schema ของผัง v2 |
| `scripts/validate_graph.py` | ตัวตรวจผังฉบับ Python (ต้นแบบของ `graph-validator.ts`) |
| `scripts/convert_chunks_to_graphs.py` | แปลง chunk → ผัง |
| `scripts/simulate_paths.py`, `inspect_vocab.py`, `check_chunk_pdf.py` | จำลองการเดินผัง / ตรวจคำศัพท์ / ตรวจ chunk เทียบ PDF (**ไม่แน่ใจรายละเอียดภายใน — ยังไม่ได้เปิดอ่านทีละไฟล์ในรอบนี้**) |
| `scripts/slim_model.py` | ชื่อบ่งว่าเกี่ยวกับการทำโมเดลให้เล็ก (เชื่อมกับ `backend/model`) — **ไม่แน่ใจ ยังไม่ได้เปิดอ่าน** |

## 1.7 ตารางฐานข้อมูล (จาก migrations)

| ตาราง | เก็บอะไร | migration |
|---|---|---|
| `manuals`, `graphs`, `nodes` | คู่มือ → ผังขั้นตอน → โหนด | 001, 006 |
| `sessions`, `session_history` | session การเดินผัง + ประวัติการตอบทีละขั้น (+ confidence, outcome, การเลือกรุ่น, `client_id`, `user_id`) | 002, 004, 005, 007, 008, 011 |
| `equipment`, `equipment_usage` | อุปกรณ์ที่ต้องใช้ | 003 |
| `session_feedback` | ผู้ใช้ให้คะแนน/ความคิดเห็นหลังจบ | 009 |
| `users` | บัญชี (email, password_hash, display_name, role) | 010 |
| `graph_drafts` | ร่างผังจาก PDF ที่ยังไม่เผยแพร่ | 012 |

> หมายเหตุ: ร่างผังอยู่ใน `graph_drafts` แยกจาก `graphs` โดยตั้งใจ — ผู้ใช้ทั่วไปมองไม่เห็นจนกว่า admin กด publish

## 1.8 โฟลเดอร์ที่ **ไม่ใช่ส่วนของระบบที่รัน**

| โฟลเดอร์ | คืออะไร | สถานะ |
|---|---|---|
| `draft/` | แผนและงานร่างเดิม (PLAN.md, code, data, docs, frontend-phase3, tools) | ไม่ถูก import จาก backend/frontend |
| `check/` | ไฟล์ HTML 7 ไฟล์ (ชื่อ `chunk_visual_*`, `manual_samsung_*`) — **ดูจากชื่อไฟล์ น่าจะเป็นหน้าไว้ตรวจ chunk/คู่มือด้วยตา ไม่แน่ใจ** | ไม่เกี่ยวกับระบบที่รัน |
| `scripts/old/` | สคริปต์เก่า | ไม่เกี่ยวกับระบบที่รัน |
| `backend/backups/` | ไฟล์ SQL สำรอง | ข้อมูล ไม่ใช่โค้ด |

ตามที่ตกลงในงาน simplify: เจ้าของโปรเจกต์จะย้าย `draft/`, `check/`, `scripts/old/` ออกจาก repo เอง (ยังรอขั้นตอนลบออกจาก git + อัปเดต `.gitignore`) ถ้าถูกถามว่า "โฟลเดอร์พวกนี้คืออะไร" ให้ตอบว่าเป็นเอกสาร/เครื่องมือช่วยตอนพัฒนา ไม่ได้ถูกใช้ตอนรัน

## 1.9 จุดที่ต้องระวังตอนสอบ (ส่วนที่ 1)

1. **"RAG" vs ความจริง** — ถ้า TOR/สไลด์เขียนว่า RAG ให้ระวัง: ตามโค้ด การ "ดึง" คือการค้นอาการที่ใกล้ที่สุดด้วย embedding (`symptom-search/`) แล้ว **เดินผังที่เขียนไว้แล้ว** ไม่มีขั้น "ให้ LLM เขียนคำตอบจากเอกสารที่ดึงมา" LLM แค่เรียบเรียงข้อความ (มี guard) และช่วยร่างผังให้ admin ตรวจ ตอบตรงๆ ว่า *ออกแบบอย่างนี้เพื่อความปลอดภัย: คำแนะนำซ่อมไฟฟ้าห้ามให้ AI แต่งเอง*
2. **ไม่ใช่ chatbot ตอบอิสระ** — ผู้ใช้เดินตามผัง ตอบได้แค่ ใช่/ไม่ใช่/กรอกค่า/ยืนยันความปลอดภัย
3. **ฐานข้อมูลใช้ร่วมกับโปรเจกต์เก่า** — ตาราง `sessions`/`graphs` ร่วมกัน ตัวเลขสถิติ admin บางส่วนจึงแยกเฉพาะโปรเจกต์นี้ไม่ได้ (ข้อจำกัดที่บันทึกไว้ใน `docs/auth/auth-step3.md`)
4. **embedding รันในโปรเซส backend** ไม่ใช่เรียก API ภายนอก — ผลคือ Render free plan บูตช้า/ตอบ `503 SEARCH_NOT_READY` ช่วงโหลดโมเดล (มีรหัสนี้ใน `symptom-search.service.ts`)
5. **ผังและเวกเตอร์ถูกโหลดเข้าหน่วยความจำตอนบูต** (`GraphRepository`, `SymptomSearchService`) — หลัง publish ผังใหม่ `drafts.service.ts` เรียก `GraphRepository.reload()` แล้วเพิ่มผังเข้าดัชนีค้นหาให้ (ถ้า reload ล้มเหลว การ publish ที่เขียน DB สำเร็จแล้วไม่ถูกยกเลิก แต่ API ตอบ 500 `PUBLISH_RELOAD_FAILED` และต้องรีสตาร์ต backend — **ยืนยันแล้วในส่วนที่ 4 หัวข้อ 4.6.5** จากการเปิดอ่าน `drafts.service.ts:193-223` และ `drafts.store.ts:210-245`)
6. **เทสต์** — ในรีโปไม่มีไฟล์เทสต์อัตโนมัติเลย (ดูแถว `jest.config.js` ใน 1.4) อย่าอ้างว่ามีชุดเทสต์ ถ้ากรรมการถามให้ตอบตรงๆ ว่าตรวจด้วยสคริปต์เทียบผลและทดสอบมือ (เช่นตอนรวม error ใช้สคริปต์เทียบ 120 กรณี HTTP — ไฟล์สคริปต์อยู่นอกรีโป)
7. **ตัวเลขขนาดโค้ดล่าสุด** (หลังงานรวม error): `backend/src` 59 ไฟล์ / 6,751 บรรทัด · `frontend/src` 87 ไฟล์ / 6,553 บรรทัด (นับหลัง simplify รอบ 2 — ก่อนรอบ 2 เป็น 58/6,789 และ 86/6,678 · ตัวเลขก่อน-หลังของงาน simplify อยู่ส่วนที่ 5)

---

✅ ส่วนที่ 1 ยืนยันแล้ว

---

# ส่วนที่ 2 — flow หลัก: ผู้ใช้ค้นอาการ → เดินผังจนจบ

> **วิธีอ่านเลขอ้างอิง:** `path:บรรทัด` คือบรรทัดที่เปิดอ่านจริงจากซอร์สตอนเขียนส่วนนี้ (หลังงานรวม error แล้ว) ถ้าโค้ดถูกแก้ต่อ เลขอาจเลื่อน — ให้ค้นชื่อฟังก์ชันแทน
> ทุกจุดที่ **ไม่ได้เปิดอ่านจริง** ติดป้าย **⚠️ ไม่แน่ใจ** พร้อมบอกบรรทัดที่ต้องเปิด

## 2.0 ภาพรวม 1 หน้า (จำรูปนี้ให้ได้)

```
[เลือกเครื่อง/รุ่น]──▶[พิมพ์อาการ]──▶[ระบบเสนอผัง ≤ 3 อัน]──▶[ผู้ใช้เลือก 1 อัน]
   GET /traversal/manuals   POST /symptom-search        │
                                                         ▼
                              POST /traversal/sessions  (สร้าง session + โหนดแรก)
                                                         │
                     ┌───────────────────────────────────┘
                     ▼
        ┌──▶ หน้า SessionPage แสดงโหนดปัจจุบัน
        │        │ ผู้ใช้ตอบ (ใช่/ไม่ใช่ · ถัดไป · ยืนยันความปลอดภัย · กรอกค่า)
        │        ▼
        │   POST /traversal/sessions/:id/actions ──▶ engine.submitAction ──▶ บันทึก DB ──▶ ตอบโหนดถัดไป
        └────────┘ (วนจนถึงโหนด resolution/escalation = จบ)
                     ▼
        โหนดสิ้นสุด → แสดงผล + (ไม่บังคับ) ผู้ใช้กรอกผลลัพธ์ → เข้าประวัติ
```

**กฎเหล็กที่ทำให้ระบบนี้ต่างจาก chatbot:** ขั้นถัดไปถูกตัดสินโดย `traversal-engine.ts` ที่เดียว (ฟังก์ชันล้วน ไม่รู้จัก HTTP/DB) — `traversal.service.ts` แค่เรียก engine (`:97`) แล้วบันทึกผล (`:100-103`) ไม่มีตรรกะเปลี่ยนสถานะของตัวเองแม้แต่บรรทัดเดียว การค้นหาด้วย embedding เป็นแค่ **ตัวช่วยเลือกผัง** (`SymptomsPage.tsx:23`: "การค้นหาเป็นแค่ตัวช่วยเลือก ขั้นถัดไปในผังเป็นของเครื่องสถานะที่เซิร์ฟเวอร์เสมอ")

---

## 2.1 ขั้นที่ 1 — เลือกเครื่องและรุ่น (ก่อนค้นอาการ)

| # | ผู้ใช้ทำ / ระบบทำ | ไฟล์:บรรทัด |
|---|---|---|
| 1 | หน้าแรกกด "เลือกเครื่องที่มีปัญหา" | `HomePage.tsx:17` → `/devices` · ลิงก์รุ่นตรง `HomePage.tsx:19` |
| 2 | หน้า `/devices` โหลดรายการรุ่นด้วย `useManuals()` | `DevicesPage.tsx:29` · hook `queries.ts:70-72` |
| 3 | frontend ยิง `GET /traversal/manuals` | `api/traversal.ts:24-26` |
| 4 | backend: route → service → repository (อ่านจาก **หน่วยความจำ** ไม่ยิง SQL) | `traversal.routes.ts:32-34` → `traversal.service.ts:48-50` → `graph.repository.ts:99-118` (`listManuals` รวมผังเป็นรายรุ่น + `graphCount`) |
| 5 | ผู้ใช้เลือกประเภทเครื่อง (ขั้น 1) แล้วเลือกรุ่น (ขั้น 2) หรือกด "ฉันไม่ทราบรุ่น" | `DevicesPage.tsx:60-66` (สองขั้น) · เลือกแล้ว navigate ที่ `DevicesPage.tsx:105` |
| 6 | รุ่นที่เลือกเก็บ **ใน URL** (`?manual=…&unknown=1`) ไม่ใช่ใน state/DB | `lib/modelSelection.ts:9-14` (`useChosenModel`), `:17-21` (`symptomsPath`) |

**ข้อมูลที่ได้จากขั้นนี้:** `manualId` และ `modelSelection` = `'selected'` (ผู้ใช้ระบุรุ่น) หรือ `'unknown'` (ไม่ทราบ เลือกรุ่นใกล้เคียง) — ค่านี้ **บันทึกไว้เพื่อวัดผลเท่านั้น ไม่กระทบขั้นตอน** (`traversal.routes.ts:40-48`)

---

## 2.2 ขั้นที่ 2 — พิมพ์อาการ → ค้นหาผังที่ใกล้เคียง

### ฝั่งหน้าจอ
| # | ทำอะไร | ไฟล์:บรรทัด |
|---|---|---|
| 1 | ถ้าไม่มี `?manual=` ในURL → เด้งกลับ `/devices` (ไม่เดารุ่นให้) | `SymptomsPage.tsx:52` |
| 2 | ผู้ใช้พิมพ์ในช่อง (ไม่เกิน 200 ตัวอักษร) กด "ค้นหา" | `SymptomSearchForm.tsx:14-35` · `lib/textInput.ts:16` (`MAX_QUERY_LENGTH = 200`) · `:31-36` (`checkQuery`) |
| 3 | `handleSearch` ตรวจ → `search.mutate({ query, manualId })` | `SymptomsPage.tsx:43-46` |
| 4 | ใช้ `useMutation` ไม่ใช่ `useQuery` และไม่แคชผล เพราะผลขึ้นกับสถานะระบบค้นหา | `queries.ts:141-145` |
| 5 | ยิง `POST /symptom-search` body `{ query, manualId }` | `api/traversal.ts:47-52` |

### ฝั่ง backend (ไล่ตามลำดับที่ request เดินผ่าน)
| # | ทำอะไร | ไฟล์:บรรทัด |
|---|---|---|
| 1 | route ตรวจ body ด้วย `parseSearchBody` (ผิด → `ApiError` 400 `INVALID_QUERY`) | `symptom-search.routes.ts:22-28` · `symptom-search.dto.ts:15-47` |
| 2 | `SymptomSearchService.search(query, manualId)` — ถ้าสถานะ `loading` → 503 `SEARCH_NOT_READY` · ถ้าไม่ใช่ `ready` (ปิด/พัง) → 503 `SEARCH_UNAVAILABLE` | `symptom-search.service.ts:161-162` · รหัส error `:15-16` |
| 3 | แปลงคำค้นเป็นเวกเตอร์ 384 มิติ (normalize แล้ว) | `symptom-search.service.ts:164` → `embedding.service.ts:46-55` (`pooling: 'mean', normalize: true`) |
| 4 | **กรองดัชนีตามรุ่นก่อน** จัดอันดับ (เพื่อไม่ให้ตัด top-3 แล้วเหลือ 0) | `symptom-search.service.ts:165-169` |
| 5 | `rankGraphs`: คิด cosine ของคำค้นกับ **ทุกข้อความของอาการ** แล้วเก็บ **คะแนนสูงสุดต่อผัง** เรียงมาก→น้อย (เท่ากัน เรียงตาม `graphId`) | `symptom-matcher.ts:64-88` · สูตร cosine `:20-41` |
| 6 | `selectMatches(ranked, 0.55, 3)`: กรอง `score >= 0.55` แล้วเอา **ไม่เกิน 3 อัน** | `symptom-matcher.ts:90-96` · ค่าคงที่ `symptom-search.service.ts:11-12` |
| 7 | ปัดคะแนน 3 ตำแหน่งตอนส่งออก (เทียบเกณฑ์ด้วยค่าเต็มก่อน) · ส่ง `bestScore` เสมอแม้ไม่มีผังผ่านเกณฑ์ | `symptom-search.service.ts:171-192` |
| 8 | response: `{ query, threshold, bestScore, matches: [{graphId, entrySymptom, entrySymptomTh, deviceCategory, score, matchedText}] }` | `symptom-search.dto.ts:59-64` |

### ดัชนีมาจากไหน (ทำก่อนที่ใครจะค้นได้)
- ตอนแอปบูต ถ้า `SYMPTOM_SEARCH_ENABLED=true` จึงโหลดโมเดล (**คืน `void` โดยตั้งใจ** `app.ts:77` เรียกโดยไม่ `await` เซิร์ฟเวอร์จึงเปิดรับ request ได้ก่อนโมเดลโหลดเสร็จ): `symptom-search.service.ts:39-54`
- `prepareIndex` ไล่ทุกผังจากหน่วยความจำ → `buildSymptomTexts` → embed ทีละข้อความ (ไม่ขนาน; ข้อความซ้ำใช้เวกเตอร์ร่วมกัน): `:70-118`
- ข้อความต่อผังที่ถูกนำมา embed = `entry_symptom_th`, `entry_symptom` และ `entry_symptom_aliases` ทุกคำ: `symptom-matcher.ts:43-62`
- โมเดล: `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (q8) โหลดจากโฟลเดอร์ `backend/model` และ **ห้ามดาวน์โหลดจากเน็ต** (`allowRemoteModels = false`): `embedding.service.ts:5-6, 33-41`

### ฝั่งหน้าจอแสดงผล
- ไม่มีผังผ่านเกณฑ์ → กล่องฟ้า "ไม่พบอาการที่ใกล้เคียง ... **ระบบไม่เดาอาการให้**": `SymptomSearchResults.tsx:13-19`
- มีผล → แถวละผัง แสดง "คะแนนความคล้าย 0.xxx · ใกล้กับ '<ข้อความที่ตรง>'" (`matchedText`): `SymptomRow.tsx:28-33` · ข้อความเตือนว่าคะแนน **ไม่ใช่โอกาสถูกต้อง**: `SymptomSearchResults.tsx:24` · ทศนิยม 3 ตำแหน่ง ไม่แปลงเป็น %: `textInput.ts:38-47`
- error 503/400 ของการค้นหาแสดงกล่อง **สีฟ้า** (ไม่ใช่แดง) เพราะไม่ใช่ความล้มเหลวของระบบ ผู้ใช้เลือกจาก "อาการทั้งหมด" ต่อได้: `SymptomsPage.tsx:28-31, 102-110`

### ทางเลือกที่ไม่ต้องใช้การค้นหา (ทางสำรองเสมอ)
หน้า `/symptoms/all` (`AllSymptomsPage.tsx`) → `GET /traversal/graphs?manualId=` (`api/traversal.ts:19-22` → `traversal.service.ts:42-45` → `graph.repository.ts:87-97`) → กดแถวใดแถวหนึ่งเริ่ม session ได้เลย **โดยไม่ส่ง `query`** จึง **ไม่มีคะแนนความมั่นใจ** (`AllSymptomsPage.tsx:22`)

---

## 2.3 ขั้นที่ 3 — เลือกผัง → เริ่ม session

| # | ผู้ใช้ทำ / ระบบทำ | ไฟล์:บรรทัด |
|---|---|---|
| 1 | กดแถวผลค้นหา → `start(graphId, { query, manualId, modelSelection })` | `SymptomsPage.tsx:83` → `lib/useStartSymptom.ts:27-33` (เรียกใน `onClick` เท่านั้น ไม่ใช่ `useEffect` เพราะ StrictMode จะสร้าง session ซ้ำ `:9-10`) |
| 2 | `useStartSession` → `startSession` ยิง `POST /traversal/sessions` พร้อม header เจ้าของ | `queries.ts:171-176` (ใส่แคชผ่าน `useCacheSession` `:154-160`) → `api/traversal.ts:37-44` · header: ล็อกอิน = Bearer token, guest = `X-Client-Id` (`lib/clientHeaders.ts:12-14`, `api/http.ts:69`) |
| 3 | middleware `optionalAuth` (ไม่มี token = guest · token เสีย = 401) | `traversal.routes.ts:40-48` · `auth.middleware.ts:75-83` |
| 4 | ตรวจ body `parseStartSessionBody` (graphId ห้ามว่าง, query ≤ 200, modelSelection เป็น selected/unknown) | `traversal.dto.ts:92-117` |
| 5 | หาเจ้าของ: ล็อกอิน → `{kind:'user'}` · ไม่ล็อกอิน + มี X-Client-Id (ต้องเป็น UUID) → `{kind:'guest'}` · ไม่มีเลย → ไม่มีเจ้าของ (เดินได้ แต่ไม่เข้าประวัติใคร) | `session-owner.ts:14-23` |
| 6 | `TraversalService.startSession` | `traversal.service.ts:56-73` |
| 6.1 | หาผังจาก **หน่วยความจำ** ไม่เจอ → 404 `GRAPH_NOT_FOUND` | `:100`, `:234-238` |
| 6.2 | ถ้าส่ง `manualId` มา แต่ผังไม่ใช่ของรุ่นนั้น → 400 `GRAPH_MANUAL_MISMATCH` (เช็กก่อนสร้าง จึงไม่มี session ค้าง) | `:101-103` |
| 6.3 | คิด **confidence**: ไม่มี query → `null` · มี query → `symptomSearch.scoreGraph(query, graphId)` (คะแนน cosine ของผังนั้น) · ระบบค้นหาไม่พร้อม/ล้ม → `null` (ไม่แต่งเลข ไม่ทำให้เริ่มไม่ได้) | `:104`, `:293-300` · `symptom-search.service.ts:193-199` |
| 6.4 | `engineStartSession(graph, confidence)`: หาโหนด `entry_node` → สร้าง `sessionId` (UUID) สถานะ `in_progress` `variables = {}` `history = []` → render โหนดแรก | `traversal-engine.ts:4-24` |
| 6.5 | `sessionStore.create` — INSERT ลง `sessions` พร้อม owner, `model_selection`, `expires_at = NOW() + 24 ชม.` | `session.store.ts:38-57` (TTL ค่าคงที่ `:8`) |
| 6.6 | `toResponse`: ประกอบ `{sessionId, graphId, status, node, equipment, confidence, outcome, displayText}` | `traversal.service.ts:156-171` · ชนิด `traversal.dto.ts:195-204` |
| 7 | frontend ใส่ผลลง cache ทันที แล้ว `navigate('/session/:id')` (ไม่ต้อง GET ซ้ำ) | `queries.ts:154-160`, `useStartSymptom.ts:31` |

**ลำดับสำคัญ (ตอบกรรมการได้):** ถ้า engine โยน error ตอนเริ่ม `create()` จะไม่ถูกเรียก จึงไม่มี session ครึ่งๆ กลางๆ ใน DB (`traversal.service.ts:69-70`)

**⚠️ ไม่แน่ใจ (ยังไม่ได้เปิดอ่านรายละเอียด):**
- `equipment` ที่ส่งกลับมา — เรียก `equipmentRepository.findByCategory(graph.device_category)` (`traversal.service.ts:167`) ผูกกับ **ประเภทเครื่อง** (`graph.device_category`) แต่ยังไม่ได้อ่านวิธีโหลด/แสดงผล → เปิด `equipment.repository.ts:27-59` และ `components/EquipmentPanel.tsx`
- วิธีแสดง confidence: เห็นแล้วที่ `SessionHeader.tsx:34-36` ว่าแสดง "คะแนนความคล้ายกับที่พิมพ์ค้นหา … (แสดงเป็นข้อมูลประกอบเท่านั้น ขั้นตอนถัดไปตัดสินตามคู่มือ)" แต่ไม่ได้อ่านส่วนอื่นของไฟล์

---

## 2.4 ขั้นที่ 4 — หน้าเดินผัง: แสดงโหนดปัจจุบัน

| # | ทำอะไร | ไฟล์:บรรทัด |
|---|---|---|
| 1 | `SessionView` ดึง session ด้วย `useSession(sessionId)` (เปิดลิงก์/รีเฟรชก็ใช้เส้นนี้) | `SessionPage.tsx:29` → `api/traversal.ts:54-56` |
| 2 | backend `GET /traversal/sessions/:id` (`optionalAuth`) | `traversal.routes.ts:51-57` |
| 3 | `authorize()`: ถ้า session นี้เป็นของ **user** (มี `user_id`) ต้องมี token ของเจ้าของ ไม่งั้น 404 `SESSION_NOT_FOUND` (ไม่บอกว่ามีอยู่) · session ของ guest ใช้ session id เป็นกุญแจเหมือนเดิม | `traversal.service.ts:76-77`, `:138-143` · `session.store.ts:143-151` |
| 4 | โหลด session จาก DB เฉพาะที่ **ยังไม่หมดอายุ** (`expires_at > NOW()`) พร้อมประวัติ `session_history` เรียงตาม `step_order` | `session.store.ts:59-87` |
| 5 | `getCurrentNode` → render โหนดปัจจุบัน; ถ้า `completed` อ่านข้อความผลลัพธ์ที่ผู้ใช้เคยกรอกมาด้วย | `traversal.service.ts:78-84` · `traversal-engine.ts:26-35` |
| 6 | **render โหนด**: `{nodeId, type, text, safetyCritical, safetyWarning, requiresSafetyConfirmation, inputType, isTerminal, outcomeKind, reference:{source,pageRange}}` — เติมตัวแปร `{{ชื่อ}}` ด้วยค่าที่ผู้ใช้เคยกรอก | `traversal-engine.ts:126-148`, `:168-172` · ชนิด `types.ts:104-115` |
| 7 | frontend เลือกหน้าตาตามชนิดโหนด (ลำดับตรวจ: จบ → ด่านความปลอดภัย → checkpoint → input → instruction) | `StepView.tsx:24-44` |

| ชนิดโหนด | หน้าตา | action ที่ส่งกลับ | ไฟล์:บรรทัด |
|---|---|---|---|
| `checkpoint` | คำถาม + ปุ่ม ใช่ / ไม่ใช่ | `{type:'answer', value:'yes'\|'no'}` | `StepView.tsx:47-60` |
| `instruction` (ปกติ) | ข้อความ + ปุ่ม ถัดไป | `{type:'continue'}` | `StepView.tsx:63-70` |
| `instruction` ที่ `safety_critical` | กล่องคำเตือนแดง + ช่องติ๊ก + ปุ่มยืนยัน | `{type:'confirm_safety'}` | `SafetyGateStep.tsx:8-35` |
| `input` | ช่องกรอก (`error_code`/`model_number`/`number`/`text`) | `{type:'input', value}` | `InputStep.tsx:11-38` |
| `resolution` / `escalation` | หัวข้อผลลัพธ์ + ข้อความ + ฟอร์มผลลัพธ์ + ปุ่มต่อ | (ไม่มี action แล้ว) | `OutcomeStep.tsx:28-47` |

ทุกขั้นแสดง "อ้างอิงหน้าคู่มือ" จาก `node.reference` (`StepCard` ส่งต่อให้ `ReferenceLine` — `StepCard.tsx:37`) · คำอธิบายนี้ตรงกับที่หน้าแรกบอกผู้ใช้ว่า "ทุกขั้นบอกหน้าคู่มือที่มา" (`HomePage.tsx:15`)

**⚠️ ไม่แน่ใจ:** `PathRail` (แถบเส้นทางที่เดินมา, `SessionPage.tsx:162`) ยังไม่ได้เปิดอ่าน → ดู `components/step/PathRail.tsx`

---

## 2.5 ขั้นที่ 5 — เดินทีละโหนด (หัวใจของระบบ)

### ลำดับตั้งแต่กดปุ่มจนเห็นขั้นถัดไป
| # | ทำอะไร | ไฟล์:บรรทัด |
|---|---|---|
| 1 | ผู้ใช้กดปุ่ม → `handleAction(action)` กันกดซ้ำด้วย `isSendingRef` | `SessionPage.tsx:50-61` |
| 2 | `useSubmitAction` ยิง `POST /traversal/sessions/:id/actions` (body = action ตรงๆ) | `queries.ts:179-184` → `api/traversal.ts:58-66` |
| 3 | `parseTraversalAction` ตรวจรูปร่าง (type ต้องเป็น answer/continue/confirm_safety/input · input ยาวไม่เกิน 255) | `traversal.routes.ts:60-67` · `traversal.dto.ts:119-159` |
| 4 | `TraversalService.submitAction`: `authorize` → `requireSession` → `requireGraph` | `traversal.service.ts:88-95` |
| 5 | **`engineSubmitAction(session, graph, action)`** ตัดสินทุกอย่าง | `:146` → `traversal-engine.ts:41-72` |
| 6 | ถ้า engine ไม่โยน error → `sessionStore.update` (transaction: UPDATE `sessions` + INSERT `session_history`) | `traversal.service.ts:99-103` · `session.store.ts:89-142` |
| 7 | ตอบ `SessionResponseDto` ของโหนดใหม่ | `traversal.service.ts:105` |
| 8 | frontend ใส่ผลลง cache → หน้าเปลี่ยนเป็นขั้นถัดไป · เพิ่มรอยทางใน `trail` | `queries.ts:154-160` · `SessionPage.tsx:56` · `lib/trail.ts:12-31` |

### engine ตัดสิน "ขั้นถัดไป" อย่างไร (`traversal-engine.ts:74-125` `resolveNextNode`)
| โหนดปัจจุบัน | action ที่รับ | ไปโหนด | ผิด action |
|---|---|---|---|
| `checkpoint` | `answer` | `yes` → `on_yes` · `no` → `on_no` (`:80-88`) | `InvalidActionError` |
| `instruction` (ไม่ safety) | `continue` | `next` (`:98-101`) | `InvalidActionError` |
| `instruction` (safety_critical) | **เฉพาะ** `confirm_safety` | `next` (`:90-101`) | ดูหัวข้อ 2.6 |
| `input` | `input` | ผ่าน `pattern` (regex) → เก็บค่าลงตัวแปร `store_as` แล้วไป `next` · ไม่ผ่าน → ไป `on_invalid` (ถ้าไม่มี ก็อยู่โหนดเดิม) (`:104-119`) | `InvalidActionError` |
| `resolution` / `escalation` | — ส่ง action อะไรก็ผิด | — (`:121-123`) | `InvalidActionError` |

- ถึงโหนด resolution/escalation → `status = 'completed'` (`:61`) · ถ้า session จบแล้วยังส่ง action → `SessionAlreadyCompletedError` (`:46-48`)
- engine **ไม่แก้ session เดิม** สร้าง session ใหม่คืนกลับ (`...session` + ประวัติต่อท้าย `:63-69`)
- แปลง error ของ engine เป็น HTTP: `SafetyConfirmationRequiredError` 400 · `InvalidActionError` 400 `INVALID_ACTION` · `SessionAlreadyCompletedError` 409 `SESSION_COMPLETED` · `NodeNotFoundError` 500 `GRAPH_NODE_MISSING` — ที่ `common/error-handler.ts:38-43` (engine เองไม่รู้จัก HTTP)

### ข้อสังเกต (ไม่ใช่ข้อสรุป)
- trail (รอยทางที่แสดง) อยู่ใน `useState` ของหน้า (`SessionPage.tsx:45`) → **รีเฟรชหน้าแล้วรอยทางหาย** แต่ขั้นปัจจุบันยังอยู่ เพราะมาจาก DB (ประวัติจริงอยู่ใน `session_history`)
- **สองคำขอ action พร้อมกันบน session เดียว — ไม่แน่ใจ → ยืนยันแล้ว (จากการอ่านโค้ด + migration ไม่ได้รันทดสอบกับ DB จริง):**
  - **ในโค้ดไม่มี** ล็อกแถว (`SELECT … FOR UPDATE`) ไม่มีคอลัมน์เวอร์ชัน/optimistic check และไม่มีเงื่อนไข `WHERE current_node_id = ?` ใน `UPDATE` (ค้น `FOR UPDATE|version|GET_LOCK|isolation` ใน `traversal/` และ `history/` ไม่พบ) · `submitAction` เป็น 3 ขั้นแยกกัน: อ่าน (`traversal.service.ts:94`) → engine ตัดสินในหน่วยความจำ (`:97`) → เขียน (`:100-103`)
  - **มี transaction** เฉพาะตอนเขียน: `session.store.ts:102-141` (`getConnection` → `beginTransaction` → `UPDATE sessions` → `INSERT session_history` → `commit` / `rollback`) แต่ transaction นี้เริ่มหลังจากอ่านไปแล้ว จึงไม่ได้กันการอ่านซ้อน
  - **ตัวกันจริงคือข้อจำกัด UNIQUE ของฐานข้อมูล:** `migrations/002_create_session_tables.sql:36` `UNIQUE KEY uq_history_step (session_id, step_order)` และ `step_order = session.history.length - 1` คิดจากสถานะที่อ่านมา (`session.store.ts:98`)
  - **ลำดับเหตุการณ์ที่คาดจากโค้ด** (คำขอ A, B อ่านสถานะเดียวกัน ประวัติยาว N): ทั้งคู่ผ่าน engine และได้ `step_order` เท่ากัน → A `UPDATE` ได้ล็อกแถว `sessions` และ `INSERT` ผ่าน → `commit` · B ที่ `UPDATE` รออยู่จะวิ่งต่อหลัง A commit แล้ว `INSERT` ชน UNIQUE (`ER_DUP_ENTRY`) → เข้า `catch` ที่ `session.store.ts:136-138` → `rollback` (การ `UPDATE` ของ B ถูกย้อนด้วย) → โยน error ต่อ
  - **ผลที่ผู้ใช้เห็น:** A สำเร็จ · B ได้ **500 `INTERNAL_ERROR`** (error ของ mysql2 ไม่ใช่ `ApiError` จึงตกที่ `common/error-handler.ts:71` และถูก log เป็น 5xx `:96-98`) · ข้อมูลใน DB ยังสอดคล้อง (ไม่มีประวัติซ้ำ ไม่มีสถานะครึ่งๆ กลางๆ) — ไม่มีกรณีที่สองคำขอ "ชนะทั้งคู่"
  - **ความปลอดภัย (safety) ไม่เสีย:** ทั้งสองคำขอถูก engine ตรวจกับสถานะเดิมเดียวกัน จึงข้ามด่าน `confirm_safety` ไม่ได้ด้วยการยิงซ้อน (`traversal-engine.ts:90-97`)
  - **ข้อจำกัดของข้อสรุปนี้:** (1) ยังไม่ได้ทดสอบกับ MySQL จริง (2) ไม่ทราบว่า DB ที่ใช้งานจริงมี UNIQUE KEY นี้อยู่จริงหรือไม่ ซึ่งมาจาก migration 002 ที่เขียนด้วย `CREATE TABLE IF NOT EXISTS` — ตารางนี้ใช้ร่วมกับโปรเจกต์เก่า ถ้าถูกสร้างไว้ก่อนด้วย schema อื่น ค่า UNIQUE อาจไม่มี (ตรวจด้วย `SHOW CREATE TABLE session_history`) (3) ฝั่งหน้าจอกันกดซ้ำในแท็บเดียวด้วย `isSendingRef` (`SessionPage.tsx:46-52`) ดังนั้นกรณีนี้เกิดได้จริงเฉพาะสองแท็บ/สองอุปกรณ์/ยิง API ตรง
  - **ตอบกรรมการ:** "ไม่ได้ล็อกแถว แต่มีข้อจำกัด UNIQUE (session_id, step_order) กับ transaction ทำให้ได้ผู้ชนะคนเดียว อีกคำขอได้ error และไม่มีข้อมูลเสีย — ข้อบกพร่องคือผู้แพ้ได้ 500 แทนที่จะเป็น 409"
- `session.store.ts:111`: ทุกขั้นที่ยังไม่จบต่ออายุ session เป็น 24 ชม. นับจากขั้นล่าสุด

---

## 2.6 ด่านความปลอดภัย `safety_critical` (ต้องอธิบายได้ละเอียด)

โหนดที่เป็นขั้นตอนเสี่ยง (เช่น ถอดปลั๊กก่อนทำ) ถูกทำเครื่องหมาย `safety_critical: true` + มี `safety_warning` **หลายชั้น ไม่พึ่งหน้าจอ**:

| ชั้น | กลไก | ไฟล์:บรรทัด |
|---|---|---|
| 1. ข้อมูล | ตัวตรวจผังฝั่ง backend (ใช้ตอน publish ร่างผังจาก PDF — ส่วนที่ 4; สคริปต์ seed มีตัวตรวจของตัวเองซึ่งยังไม่ได้เปิดอ่านจึง ⚠️ ไม่แน่ใจว่ากฎเดียวกันหรือไม่): `safety_critical` ใช้ได้เฉพาะโหนด `instruction` และต้องมี `safety_warning` · ถ้ามี `safety_warning` แต่ไม่ตั้งธง → error | `authoring/graph-validator.ts:330-337` |
| 2. ตอนโหลด | แปลงคอลัมน์ DB เป็นธง | `graph.repository.ts:220-221` |
| 3. engine | โหนด instruction ที่ `safety_critical`: ส่ง `continue` → **`SafetyConfirmationRequiredError`** · รับเฉพาะ `confirm_safety` | `traversal-engine.ts:90-97` · ข้อความ error `types.ts:135-139` |
| 4. ลำดับใน service | เรียก engine **ก่อน** บันทึกเสมอ ถ้า engine โยน error บรรทัด `update()` ไม่ถูกรัน → session ใน DB ไม่ขยับ ไม่ต้องมีโค้ด "ย้อนสถานะ" | `traversal.service.ts:97` เทียบ `:100-103` (คอมเมนต์ `:99`) |
| 5. HTTP | แปลงเป็น 400 `SAFETY_CONFIRMATION_REQUIRED` | `error-handler.ts:39` |
| 6. หน้าจอ | `requiresSafetyConfirmation` = (instruction ∧ safety_critical) → แสดง `SafetyGateStep` ที่ปุ่มกดไม่ได้จนกว่าจะติ๊ก | `traversal-engine.ts:142` · `StepView.tsx:31-33` · `SafetyGateStep.tsx:25-32` |
| 7. ข้อความ error ฝั่งผู้ใช้ | "เซิร์ฟเวอร์ไม่ให้ข้ามขั้นตอนนี้ — อ่านคำเตือนและติ๊กยืนยันก่อน" | `lib/errors.ts:51-55` |

**ประเด็นที่ต้องตอบให้ถูก:** หน้าจอ **ไม่ใช่ตัวบังคับจริง** ตัวบังคับจริงคือ engine ถ้ามีคนยิง API ตรงด้วย `continue` ก็ถูกปฏิเสธ (ชั้น 3–5) แต่ **การติ๊กช่อง "ฉันอ่านแล้ว" เป็นแค่ UI** — ระบบไม่ได้พิสูจน์ว่าผู้ใช้อ่านจริง (ตามโค้ด `confirm_safety` ไม่มีข้อมูลประกอบ `traversal.dto.ts:136-137`)

**เหตุผลที่ rephrase ไม่แตะโหนดเสี่ยง:** ดู 2.8

---

## 2.7 ขั้นที่ 6 — ถึงโหนดสิ้นสุด (resolution / escalation)

| # | เกิดอะไร | ไฟล์:บรรทัด |
|---|---|---|
| 1 | engine ตั้ง `status = 'completed'` เมื่อโหนดถัดไปเป็น resolution/escalation | `traversal-engine.ts:61`, `:164-166` |
| 2 | `session.store.update` ตั้ง `expires_at` = **90 วัน** (ไม่ใช่ 24 ชม.) เพื่อให้ดูย้อนหลังในหน้าประวัติ | `session.store.ts:99-100` (ค่าคงที่ `:9-10`) |
| 3 | node ที่ส่งกลับมี `isTerminal: true` และ `outcomeKind` (`user_fixed` / `normal_behavior` / `handoff_informed` / `handoff_unknown`) | `traversal-engine.ts:144-145` · `types.ts:3` |
| 4 | หน้าจอแสดง `OutcomeStep`: หัวข้อ/ไอคอน/สีตาม `outcomeKind` + ข้อความโหนด (ถ้าไม่มี `outcomeKind` ใช้ `handoff_unknown`) | `OutcomeStep.tsx:14-31`, `:43` · หัวข้อไทย `lib/labels.ts:13-18` |
| 5 | ใต้ผลมีฟอร์ม "ผลลัพธ์" (`OutcomeForm`) และปุ่ม "ตรวจอาการอื่น / เริ่มใหม่" (`TerminalActions`) | `SessionPage.tsx:132-147` |
| 6 | ปุ่มยกเลิกกลางทาง (`SessionHeader`) แสดงเฉพาะตอนยังไม่จบ (`canAbandon={!node.isTerminal}`) → `DELETE /traversal/sessions/:id` | `SessionPage.tsx:151`, `:74-76` · `traversal.service.ts:109-112` |

**แยกให้ออก (ชอบถูกถาม):** `outcomeKind` ของ **ผัง** (4 ค่า ข้างบน กำหนดไว้ในข้อมูลผัง) ≠ ข้อความผลลัพธ์ที่ **ผู้ใช้พิมพ์** หลังจบ (เก็บใน `sessions.outcome_text` ผ่าน `POST …/outcome` — `traversal.service.ts:116-136`) รายละเอียดอยู่ส่วนที่ 4

---

## 2.8 rephrase เข้ามาตอนไหน

**คำตอบสั้น:** ทุกครั้งที่ backend ประกอบ response ของ session (เริ่ม / GET / action / outcome) — ผ่าน `toResponse` → `displayTextOf` → `RephraseService.rephrase`

| # | ทำอะไร | ไฟล์:บรรทัด |
|---|---|---|
| 1 | `toResponse` เรียก `displayTextOf(node)` ทุกครั้ง | `traversal.service.ts:170` |
| 2 | `displayTextOf` ส่ง `{nodeType, safetyCritical: safetyCritical ∨ requiresSafetyConfirmation}` · คืนข้อความใหม่เฉพาะเมื่อ `rephrased` และต่างจากเดิม ไม่งั้น `null` · ถ้าเกิด error ใด → `null` | `traversal.service.ts:174-184` |
| 3 | `RephraseService.rephrase` **ข้ามทันที (คืนต้นฉบับ)** เมื่อ: ปิดอยู่/ไม่มี client · ข้อความว่าง · **โหนด safety** · **โหนด resolution/escalation** | `rephrase.service.ts:38-40` |
| 4 | มีแคชในหน่วยความจำ (คีย์ = ข้อความต้นฉบับ) | `:27`, `:42-43` |
| 5 | เรียก Groq ภายใน timeout (ค่าเริ่มต้น 3000 ms; ตั้งด้วย `REPHRASE_TIMEOUT_MS`) | `rephrase.service.ts:45-48` · `app.ts:52-55` |
| 6 | ผ่าน **guard** `checkRephrase(original, candidate)` ไม่ผ่าน → ใช้ต้นฉบับ + log เตือน | `rephrase.service.ts:49-53` · `rephrase-guard.ts:26-61` |
| 7 | LLM ถูกสั่งด้วย prompt: ห้ามเพิ่ม/ลบ/เปลี่ยนความหมาย ห้ามเปลี่ยนตัวเลข รหัส ชื่อรุ่น ห้ามตอบคำถามเอง · `temperature: 0` | `groq-llm.client.ts:5-11`, `:25-29` |
| 8 | เปิดใช้จริงเมื่อ `REPHRASE_ENABLED=true` **และ** มี `GROQ_API_KEY` + `GROQ_MODEL` | `groq-llm.client.ts:47-52` |
| 9 | ฝั่งหน้าจอ **กันซ้ำอีกชั้น**: ใช้ `displayText` เฉพาะโหนดที่ไม่ใช่ safety/ไม่ใช่โหนดจบ แล้วโชว์แถบ "ข้อความนี้ปรับถ้อยคำด้วย AI — ดูข้อความต้นฉบับจากคู่มือ" ให้กดดูต้นฉบับ | `SessionPage.tsx:123-125`, `:173` · `RephraseNote.tsx:8-9` |

**กฎของ guard** (`rephrase-guard.ts:26-61`) — ผลลัพธ์ต้อง: ไม่ว่าง · ไม่มีลิงก์ · ไม่มี markdown/HTML ที่ต้นฉบับไม่มี · ไม่มีหลายย่อหน้า · ความยาว 0.5–1.6 เท่าของต้นฉบับ · **ชุดตัวเลขเท่าเดิมทุกตัว (รวมเลขไทย)** · ชื่อ/รหัสอังกฤษเท่าเดิม ไม่ขาดไม่เกิน · **จำนวนคำว่า "ไม่" เท่าเดิม** (กันกลับความหมาย; ไม่นับ "หรือไม่")

**ข้อสังเกตเรื่องประสิทธิภาพ:** `displayTextOf` ถูก `await` ภายใน `toResponse` ดังนั้น response ของ session **ต้องรอ rephrase** (สูงสุดตาม timeout ถ้า LLM ช้า; โหนดเดิมที่เคยแปลแล้วโดนแคช) · หน้าประวัติ **ไม่เรียก LLM** (`history/history.service.ts` คอมเมนต์หัวไฟล์) · ⚠️ ไม่แน่ใจเรื่องจำนวนครั้งที่เรียก Groq จริงต่อ session — ไม่ได้วัด

---

## 2.9 สรุปลำดับเดียวจบ (สำหรับพูดหน้าห้อง)

1. เลือกรุ่นจาก `/traversal/manuals` (รุ่นอยู่ใน URL)
2. พิมพ์อาการ → `POST /symptom-search` → embedding → cosine กับข้อความอาการทุกอัน (กรองตามรุ่น) → เก็บผังที่ ≥ 0.55 ไม่เกิน 3
3. ผู้ใช้เลือกผัง → `POST /traversal/sessions` → ตรวจผังตรงรุ่น → คำนวณ confidence (แสดงผลอย่างเดียว) → engine สร้าง session + โหนดแรก → เก็บ DB
4. ทุกครั้งที่ตอบ → `POST …/actions` → **engine** ตัดสินโหนดถัดไป (ปฏิเสธ action ผิดชนิด / ข้ามด่านความปลอดภัย) → ค่อยบันทึก
5. โหนดสิ้นสุด → แสดงผลตาม `outcomeKind` + เก็บ 90 วัน
6. rephrase เป็นแค่ข้อความตกแต่งบนโหนดที่ไม่ใช่ safety/ไม่ใช่โหนดจบ ผ่าน guard เท่านั้น

---

## 2.10 จุดที่ต้องระวังตอนสอบ (ส่วนที่ 2)

1. **"ระบบ AI ถามตอบ" ≠ ความจริง** — ทุกข้อความขั้นตอนมาจากฐานข้อมูล (ผังที่แปลงจากคู่มือ) LLM ทำได้แค่ปรับถ้อยคำบางโหนด และถ้า guard ไม่ผ่านก็ใช้ข้อความคู่มือเดิม
2. **เกณฑ์ 0.55 / top 3 เป็นค่าที่ตั้งไว้ในโค้ด** (`symptom-search.service.ts:11-12`) — ถ้าถูกถามว่า "ทำไม 0.55" อย่าอ้างผลวิจัย ให้ตอบตามที่โค้ดบอก (ค่าคงที่ ไม่ได้ปรับตามข้อมูลอัตโนมัติ) · ⚠️ ไม่แน่ใจว่ามีเอกสารบันทึกการเลือกค่านี้ที่ไหน (อาจอยู่ใน `docs/` เก่า — ยังไม่ได้ค้น)
3. **คะแนน cosine ไม่ใช่ความน่าจะเป็น** — หน้าจอแสดงทศนิยม 3 ตำแหน่งและบอกผู้ใช้ตรงๆ (`textInput.ts:38-47`, `SymptomSearchResults.tsx:24`)
4. **ค้นไม่ได้ ≠ ใช้ไม่ได้** — มีทาง "อาการทั้งหมด" เสมอ ถ้าระบบค้นหายังโหลดโมเดล (503) หรือปิดอยู่
5. **ไม่มีการตรวจว่า "ผู้ใช้เลือกผังที่ถูกอาการ"** — ระบบแค่เสนอ ผู้ใช้เป็นคนเลือก (จึงมี confidence เป็นข้อมูลประกอบ ไม่ใช่เกณฑ์ตัดสิน: `traversal.service.ts:186`)
6. **ถ้า TOR เขียนว่า "RAG / LLM ตอบ"** → ให้ชี้ `traversal-engine.ts` เป็นหลักฐานว่าการเดินผังเป็นโค้ดกำหนดตายตัว
7. **คอมเมนต์เก่าที่แก้แล้ว:** `traversal.dto.ts:23` เดิมเขียนว่า "ระบบไม่มีล็อกอิน" (ล้าสมัย) — แก้เป็น "ใช้กับ guest เท่านั้น … ผู้ล็อกอินใช้ token แทน ดู auth/session-owner.ts" แล้ว · ระวังคอมเมนต์เก่าอื่นที่อาจยังเหลือ ให้เชื่อโค้ดมากกว่าคอมเมนต์

---

## 📦 ถ้ากรรมการถามว่า... (ส่วนที่ 2)

**Q1. ทำไมต้องใช้ embedding แทนการค้นด้วยคำ (keyword)?**
ผู้ใช้พิมพ์ภาษาธรรมชาติ (เช่น "แอร์ไม่เย็น", "มีน้ำหยด") ซึ่งไม่ตรงคำกับชื่ออาการในคู่มือ embedding วัดความใกล้ของ **ความหมาย** โมเดลที่ใช้เป็นแบบหลายภาษา (`paraphrase-multilingual-MiniLM-L12-v2`) จึงรองรับภาษาไทย · และแต่ละผังมีข้อความให้เทียบหลายอัน (ชื่อไทย ชื่ออังกฤษ คำพ้อง) เก็บคะแนนสูงสุดต่อผัง (`symptom-matcher.ts:43-62, 64-88`) · ข้อจำกัดที่ต้องยอมรับ: เป็นการเทียบความใกล้ ไม่ใช่ความถูกต้อง จึงให้ผู้ใช้เลือกเองจาก ≤ 3 ตัวเลือก

**Q2. ถ้าผู้ใช้พิมพ์ข้อความที่ไม่ตรงกับอาการไหนเลยจะเกิดอะไร?**
ไม่มีผังที่คะแนน ≥ 0.55 → `matches` ว่าง → หน้าจอแสดง "ไม่พบอาการที่ใกล้เคียง ระบบไม่เดาอาการให้" พร้อมทางไป "อาการทั้งหมด" (`symptom-matcher.ts:95`, `SymptomSearchResults.tsx:13-19`) ระบบไม่บังคับเสนอผังที่ไม่ตรง

**Q3. ใครการันตีว่าผู้ใช้ไม่ข้ามคำเตือนความปลอดภัย?**
การบังคับจริงอยู่ที่ **backend engine** ไม่ใช่หน้าจอ: instruction ที่ `safety_critical` รับเฉพาะ `confirm_safety` ถ้าส่ง `continue` ได้ 400 `SAFETY_CONFIRMATION_REQUIRED` และ service เรียก engine ก่อนบันทึกเสมอ session ใน DB จึงไม่ขยับ (`traversal-engine.ts:90-97`, `traversal.service.ts:97-100`) · ข้อจำกัดที่ควรยอมรับตรงๆ: ระบบพิสูจน์ไม่ได้ว่าผู้ใช้ "อ่านจริง" แค่บังคับให้กดยืนยัน

**Q4. LLM เข้ามาเกี่ยวตอนเดินผังตรงไหน และกันไม่ให้ตอบมั่วอย่างไร?**
เฉพาะ rephrase ข้อความโหนดที่ไม่ใช่ safety และไม่ใช่โหนดจบ (`rephrase.service.ts:38-40`) คำสั่งถึง LLM ห้ามเพิ่ม/เปลี่ยนความหมาย (`groq-llm.client.ts:5-11`) และผลต้องผ่าน guard: ตัวเลข ชื่อรุ่น/รหัส และจำนวนคำปฏิเสธ "ไม่" เท่าเดิม ความยาวไม่ผิดปกติ ถ้าไม่ผ่าน/ช้าเกิน 3 วินาที/ล้ม → แสดงข้อความคู่มือเดิม และหน้าจอมีปุ่มดูต้นฉบับเสมอ (`RephraseNote.tsx`)

**Q5. ถ้า session หมดอายุหรือผู้ใช้รีเฟรชกลางทางจะเป็นอย่างไร?**
สถานะอยู่ใน DB ไม่ใช่ในหน้าจอ: รีเฟรชแล้ว `GET /traversal/sessions/:id` ดึงโหนดปัจจุบันกลับมา (รอยทาง "เส้นทางที่เดินมา" ฝั่งหน้าจอหาย แต่ประวัติจริงอยู่ใน `session_history`) · session ที่ไม่มีการใช้งานเกิน 24 ชม. หมดอายุ → 404 `SESSION_NOT_FOUND` → หน้าจอแสดง "ไม่พบการตรวจนี้ เลือกอาการเพื่อเริ่มตรวจใหม่" (`session.store.ts:59-63`, `lib/errors.ts:66-70`)

---

✅ ส่วนที่ 2 ยืนยันแล้ว

---

# ส่วนที่ 3 — อธิบายแนวคิดด้วยภาษาง่าย + ตัวอย่างจากระบบจริง

> **วิธีติดป้ายตัวเลขในส่วนนี้ (สำคัญ):**
> - 🔬 **[วัดจริง]** = ผมรันโค้ดจริงของระบบ (`backend/dist`: `EmbeddingService`, `symptom-matcher`, `rephrase-guard`, `traversal-engine`) กับข้อมูลใน `data/manuals/*.json` แล้วจดผลที่ได้ ตอนวันที่ 19 ต.ค. 2569 บนเครื่องผู้พัฒนา — **ไม่ได้ต่อฐานข้อมูลจริง** ข้อมูลในฐานข้อมูลที่ใช้งานอาจต่างจากไฟล์ (เช่น ผังที่ admin publish ภายหลัง) และเวลาที่วัดไม่ใช่เวลาบน Render
> - 📐 **[ตัวอย่างประกอบ]** = ตัวเลขที่ผมตั้งขึ้นเพื่ออธิบายแนวคิด ไม่ได้คำนวณจากระบบ
> - สคริปต์ที่ใช้วัดอยู่นอกรีโป (โฟลเดอร์ชั่วคราวของเซสชัน) ถ้าต้องการให้รันซ้ำได้ตอนสอบ บอกผมให้เก็บเข้า `scripts/` ได้
> - ค่าคงที่ทุกตัวชี้ `path:บรรทัด` ที่เปิดอ่านจริง · ถ้าไม่มีหลักฐานว่าเลือกค่านั้นเพราะอะไร จะเขียนว่า **"ไม่ทราบเหตุผล"** ไม่แต่งย้อนหลัง

## 3.1 Embedding คืออะไร (ภาษาคน)

**ปัญหา:** ผู้ใช้พิมพ์ว่า "ไมโครเวฟไม่ร้อน" แต่ในคู่มือเขียนว่า "The food is not cooked at all." หรือ "Heating … does not work properly." — คอมพิวเตอร์เทียบ "ตัวอักษร" ตรงๆ ไม่ได้

**ไอเดีย:** แปลง **ข้อความ → ชุดตัวเลขชุดหนึ่ง** (เรียกว่า "เวกเตอร์") โดยให้ข้อความที่ **ความหมายใกล้กัน ได้ตัวเลขใกล้กัน** ลองนึกเป็น "พิกัดบนแผนที่": ข้อความ "ไมโครเวฟไม่ร้อน" กับ "อาหารไม่สุก" อยู่ย่านใกล้กัน ส่วน "วันนี้ฝนตก" อยู่ไกลออกไป — แต่แผนที่นี้ไม่ได้มี 2 มิติ มี **384 มิติ**

**ในระบบนี้จริงๆ:**
| เรื่อง | ค่าที่ใช้ | หลักฐาน |
|---|---|---|
| โมเดล | `Xenova/paraphrase-multilingual-MiniLM-L12-v2` ชนิด `q8` (ย่อขนาดเป็น 8 บิต) | `embedding/embedding.service.ts:5-6` |
| ไฟล์โมเดล | โหลดจาก `backend/model` เท่านั้น **ห้ามดึงจากอินเทอร์เน็ต** | `embedding.service.ts:8`, `:33-34` (`cacheDir`, `allowRemoteModels = false`) |
| ขนาดเวกเตอร์ | 384 ตัวเลขต่อข้อความ | คอมเมนต์ `embedding.service.ts:45` · 🔬 **[วัดจริง]** `dim = 384` |
| ปรับความยาวเป็น 1 | `normalize: true` (ทุกเวกเตอร์ยาว 1 พอดี) | `embedding.service.ts:50-53` · 🔬 **[วัดจริง]** norm = 1.0000 |
| รวมคำเป็นเวกเตอร์เดียว | `pooling: 'mean'` (เฉลี่ยเวกเตอร์ของทุกคำในประโยค) | `embedding.service.ts:51` |

**ข้อควรรู้:** โมเดลถูก "เรียนรู้มาแล้ว" โดยผู้พัฒนาโมเดลภายนอก (ชื่อ Xenova/… บน Hugging Face) โปรเจกต์นี้ **ไม่ได้ฝึกโมเดลเอง** — ทำแค่เรียกใช้ · ผมไม่ทราบรายละเอียดข้อมูลที่ใช้ฝึกโมเดลนี้ (ไม่มีในโค้ด/เอกสารของโปรเจกต์)

### ดัชนีในระบบนี้ใหญ่แค่ไหน (🔬 [วัดจริง] จาก `data/manuals`)
- **644 ผัง** → ข้อความอาการที่ต้องเทียบ **3,850 ข้อความ** (แต่ละผังมี ชื่อไทย + ชื่ออังกฤษ + คำพ้อง `aliases`: `symptom-matcher.ts:43-62`)
- ข้อความที่ **ไม่ซ้ำกัน 1,972** — ข้อความซ้ำ (เช่น "ทีวีปิดเอง" จากหลายคู่มือ) คำนวณครั้งเดียวใช้ร่วมกัน: `symptom-search.service.ts:78-88`
- โหลดโมเดล ~4.4 วินาที · แปลง 1,972 ข้อความ ~43.8 วินาที (บนเครื่องผู้พัฒนา; บน Render ไม่ได้วัด จึงบอกไม่ได้ว่าใช้เวลาเท่าไร)
- เก็บทั้งหมดในหน่วยความจำ (`this.index`, `symptom-search.service.ts:29`) — **ไม่ใช้ฐานข้อมูลเวกเตอร์**

---

## 3.2 Cosine similarity คืออะไร (ภาษาคน)

**ไอเดีย:** เวกเตอร์คือ "ลูกศร" ที่ชี้ไปทิศหนึ่งในพื้นที่ 384 มิติ cosine similarity วัด **มุมระหว่างลูกศรสองอัน**
- ชี้ทางเดียวกัน (ความหมายใกล้กัน) → ใกล้ **1**
- ตั้งฉากกัน (ไม่เกี่ยวกัน) → ใกล้ **0**
- ชี้สวนทางกัน → ใกล้ **−1**

📐 **[ตัวอย่างประกอบ — พื้นที่ 2 มิติเพื่อให้เห็นภาพ ไม่ใช่ค่าจริงของระบบ]**
```
คำค้น Q = (1.0, 0.0)
อาการ A = (0.8, 0.6)   → cosine = (1.0×0.8 + 0.0×0.6) / (|Q|×|A|) = 0.8 / (1×1) = 0.80   ใกล้กัน
อาการ B = (0.0, 1.0)   → cosine = 0 / 1 = 0.00                                          ไม่เกี่ยวกัน
```

**สูตรในโค้ด** (`symptom-matcher.ts:20-41`): `dot / (√normA × √normB)` โดย `dot = Σ a[i]×b[i]` · ถ้ามิติไม่เท่ากัน โยน error (`:24-28`) · ถ้าเวกเตอร์ใดเป็นศูนย์ทั้งหมดคืน 0 (`:39`)
**หมายเหตุ:** ตอนนี้ทุกเวกเตอร์ถูก normalize เป็นความยาว 1 อยู่แล้ว (`normalize: true`) cosine จึงเท่ากับผลคูณจุด (dot product) ล้วนๆ แต่โค้ดคำนวณสูตรเต็มไว้เผื่อใช้กับเวกเตอร์ที่ไม่ normalize (เหตุผลที่เลือกเขียนสูตรเต็ม **ไม่ทราบ** — ไม่มีคอมเมนต์บอก)

### ตัวอย่างคะแนนจริงจากระบบ (🔬 [วัดจริง])
คำค้น "ไมโครเวฟไม่ร้อน" เทียบกับผังของรุ่น **GE83MDT** (9 ผัง, 59 ข้อความ) — ผลเรียงตามคะแนน (คะแนนต่อผัง = ข้อความที่ใกล้ที่สุดของผังนั้น):

| อันดับ | ผัง (ย่อ) | คะแนน | ข้อความของผังที่ใกล้ที่สุด | อ่านผล |
|---|---|---|---|---|
| 1 | `…_not_start` | **0.845** | "ไมโครเวฟไม่เริ่มทำงาน" | ใกล้เพราะคำว่า "ไมโครเวฟ…ไม่…" เหมือนกัน แต่ **ไม่ใช่อาการที่ถาม** |
| 2 | `…_not_cooked_at_all` | **0.822** | "ไมโครเวฟไม่ทำให้อาหารร้อน" | ✅ อาการที่ตรงกับ "ไม่ร้อน" จริง อยู่ **อันดับ 2** |
| 3 | `…_light_not_working` | 0.813 | "ไฟในไมโครเวฟไม่ติด" | ไม่เกี่ยว แต่ยังผ่านเกณฑ์ |
| 4 | `…_normal_conditions` | 0.772 | "ไมโครเวฟมีไอน้ำ" | ไม่เกี่ยว |
| 5 | `…_arcing` | 0.753 | "ไมโครเวฟมีสะเก็ดไฟ" | ไม่เกี่ยว |

**บทเรียนที่ซื่อสัตย์ (ควรพูดกับกรรมการเองก่อนถูกถาม):**
1. embedding วัด "ความคล้ายของข้อความ" ไม่ใช่ "ความถูกต้องของอาการ" — คำที่ซ้ำกัน (ไมโครเวฟ, ไม่) ดึงคะแนนขึ้นแม้ไม่ใช่อาการเดียวกัน
2. ในตัวอย่างนี้ **อาการที่ถูกอยู่อันดับ 2 ไม่ใช่ 1** — ระบบจึง **เสนอได้ถึง 3 อัน ให้ผู้ใช้เลือกเอง** ไม่ตัดสินแทน (ดู 3.4)
3. จาก 9 ผังของรุ่นนี้ **8 ผังได้ ≥ 0.55** (เพราะคำว่า "ไมโครเวฟ" อยู่ในคำค้น ทุกอาการของไมโครเวฟจึงคล้ายกันหมด) → เกณฑ์ 0.55 **ไม่ได้แยก "ตรง/ไม่ตรง" ภายในรุ่นเดียวกัน** มันแค่ตัดของที่ไม่เกี่ยวเลิศๆ ออก

### ตัวอย่างอื่นจากการวัดจริง
| คำค้น (รุ่นที่กรอง) | ผลที่ได้ | อ่านผล |
|---|---|---|
| "อาหารไม่สุก" (GE83MDT) | `not_cooked_at_all` **0.959** ("อาหารไม่สุกเลย") · `over_under_cooked` 0.950 · ตัวที่ 3 ได้แค่ 0.238 | ผ่านเกณฑ์ 2 ผัง → ส่งกลับ 2 (ไม่ถึง 3) |
| "กดปุ่มแล้วเครื่องไม่ทำงาน" (GE83MDT) | `not_start` 0.751 ("กด start แล้วไม่ทำงาน") · **`code_se` 0.716 ("ปุ่มค้าง")** | อันดับ 2 เป็นอาการที่ไม่เกี่ยวมาก (รหัส SE) แต่ผ่านเกณฑ์ — ตัวอย่างของ "เกือบพลาด" ที่ผู้ใช้ต้องเลือกเอง |
| "วันนี้ฝนตก" (GE83MDT) | ดีที่สุดได้แค่ **0.301** ("ขึ้น SE") ไม่มีผังผ่านเกณฑ์ | `matches` ว่าง → หน้าจอบอก "ไม่พบ ระบบไม่เดาให้" |
| "ไมโครเวฟไม่ร้อน" **ไม่กรองรุ่น** | 120 ผังได้ ≥ 0.55 · สามอันดับแรกได้ **1.000** เท่ากัน (เพราะมี `alias` ที่พิมพ์ตรงทุกตัวอักษร) จาก `mc32k7055` ×2 และ `mg23t5018c` | คะแนนเท่ากัน → เรียงตาม `graphId` ตัวอักษร (`symptom-matcher.ts:82-87`) จึงเห็นแค่ 3 ผังแรกตามชื่อ **นี่คือเหตุผลที่ต้องเลือกรุ่นก่อน** |
| "ตู้เย็นไม่เย็น" ไม่กรองรุ่น | 84 ผังผ่านเกณฑ์ · อันดับ 1–4 ได้ 1.000 จากตู้เย็น 4 รุ่น | เหมือนข้างบน |

---

## 3.3 "เก็บคะแนนสูงสุดต่อผัง" + "เกณฑ์ 0.55" + "top 3"

**ขั้นตอนใน `search()`** (`symptom-search.service.ts:160-192`):
1. embed คำค้น (`:186`)
2. ถ้าผู้ใช้เลือกรุ่นมาแล้ว **กรองข้อความเฉพาะผังของรุ่นนั้นก่อน** (`:187-191`) — คอมเมนต์ `:179-180` บอกเหตุผลตรงๆ ว่า "กรองหลังเลือก top-3 อาจเหลือ 0 ผัง"
3. `rankGraphs` (`symptom-matcher.ts:64-88`): คิด cosine กับทุกข้อความ → **ต่อผัง เก็บคะแนนสูงสุดของผังนั้น** (`:68-80`) → เรียงมาก→น้อย (เท่ากันเรียงตาม `graphId` `:82-87`)
4. `selectMatches(ranked, 0.55, 3)` (`:90-96`): เอาเฉพาะ `score >= 0.55` แล้วตัดเหลือไม่เกิน 3 (`:95`)
5. ปัดคะแนน 3 ตำแหน่งตอนส่งออก (`round3` อยู่ที่ `common/helpers.ts:9` — รอบ 2 ย้ายมารวมที่เดียว · ใช้ที่ `symptom-search.service.ts:180`, `:189`, `:198`) — เทียบเกณฑ์ด้วยค่าเต็มก่อนปัด (คอมเมนต์ `:171`)

| ค่า | ที่ตั้ง | ทำอะไร | ทราบเหตุผลที่เลือกไหม |
|---|---|---|---|
| **0.55** | `symptom-search.service.ts:11` (`MATCH_THRESHOLD`) | ผังที่คะแนนต่ำกว่านี้ไม่แสดง | **ไม่ทราบเหตุผลจากโค้ด** · เอกสารเก่าในโปรเจกต์บันทึกไว้ว่าเป็นค่าที่ได้มาจากโครงการก่อนหน้า ตั้งจากคำค้น 56 ข้อที่ **AI ร่างและยังไม่ได้ตรวจแก้** จากผังแอร์ 13 ผัง และ "ห้ามอ้างเป็นความแม่นยำ" (`docs/archive/HANDOFF.md:179`, `docs/features/PLAN-MODEL-SELECTION.md:14`, `docs/archive/ROADMAP.md:418`) — **ผมอ่านจากเอกสาร ไม่ได้ตรวจซ้ำเอง** และ ⚠️ ไม่แน่ใจว่าชื่อ "FixStep" ในเอกสารเหล่านั้นหมายถึงโปรเจกต์ไหน |
| **3** | `symptom-search.service.ts:12` (`MAX_RESULTS`) | แสดงไม่เกิน 3 ผัง | **ไม่ทราบเหตุผล** — ไม่พบคำอธิบายในโค้ดหรือเอกสารที่ค้น |
| ค่าคงที่ ไม่ใช่ env | ทั้งสองตัวฝังในโค้ด | แก้ต้อง deploy ใหม่ | `docs/reference/FILES-BACKEND.md:279` ระบุไว้เช่นกัน |

**บทสรุปที่พูดได้อย่างปลอดภัย:** 0.55 เป็น "ตัวกรองหยาบ" ที่ตัดข้อความที่ไม่เกี่ยวได้ **บางส่วน** (🔬 "วันนี้ฝนตก" ได้ 0.301 ถูกตัด แต่ "สวัสดี" ได้ 0.730 ผ่านเกณฑ์ — ดู Q6) ไม่ใช่เครื่องวัดว่า "ใช่อาการนี้" — การตัดสินจริงเป็นของผู้ใช้ที่เลือกจาก ≤ 3 อัน และผลวัดจริงข้างบนแสดงว่าอาการที่ถูกอาจไม่ได้อยู่อันดับ 1 · เอกสารเก่ายังระบุว่าจากชุดทดสอบเดิม "ไม่มีเกณฑ์เดียวที่แยกนอกขอบเขตออกได้ดี (ปฏิเสธถูกราว 53%)" (`docs/reference/FILES-BACKEND.md:279` — อ่านจากเอกสาร ไม่ได้ตรวจซ้ำ)

**confidence ที่แสดงใน session** คือคะแนน cosine ของผังที่ผู้ใช้เลือกเทียบกับคำค้น (`scoreGraph` `symptom-search.service.ts:193-199`) — **แสดงผลอย่างเดียว ไม่เข้าสูตรตัดสินขั้นถัดไป** (`traversal.service.ts:186`, `SessionHeader.tsx:36`)

---

## 3.4 State machine ของผัง (เครื่องสถานะ)

**ภาษาคน:** ผังขั้นตอนคือ "แผนที่ทางแยก": แต่ละ **โหนด** คือจุดหนึ่ง (ถามคำถาม / ให้ทำอะไร / ขอให้กรอกค่า / จบ) แต่ละ **ปุ่มที่ผู้ใช้กด** คือเส้นทางที่ออกจากจุดนั้นไปจุดถัดไป ระบบจำแค่ว่า "ตอนนี้อยู่จุดไหน" และ "เคยตอบอะไร" — ไม่มีส่วนไหนเดาเอง

**นิยามในโค้ด:**
- **สถานะ** `SessionState` = `{ sessionId, graphId, currentNodeId, status: 'in_progress'|'completed', variables, confidence, history }` — `traversal-engine/types.ts:76-90`
- **ชนิดโหนด 5 แบบ:** `checkpoint` (ใช่/ไม่ใช่ → `on_yes`/`on_no`), `instruction` (ไป `next`), `input` (กรอกค่า → `next`/`on_invalid`), `resolution` และ `escalation` (โหนดจบ) — `types.ts:1-51`
- **การเปลี่ยนสถานะ** `submitAction(สถานะเดิม, ผัง, action) → สถานะใหม่` เป็นฟังก์ชันล้วน ไม่แก้ของเดิม ไม่ยุ่งกับ DB/HTTP — `traversal-engine.ts:41-72`, กฎเลือกโหนดถัดไป `:80-131`
- **action 4 แบบ:** `answer(yes|no)`, `continue`, `confirm_safety`, `input(value)` — `types.ts:93-97`

### ตัวอย่างผังจริง 🔬 (`samsung_ge83mdt_um_not_cooked_at_all` — "อาหารไม่สุกเลย" หน้าคู่มือ 37; 10 โหนด)
```
n1  [checkpoint] ตั้งเวลาถูกต้องและกดปุ่ม Start แล้วใช่หรือไม่?
      ├─ ใช่ ─▶ n2
      └─ ไม่ ─▶ n1f [instruction ⚠safety] ตั้งเวลาให้ถูกต้องและกด Start … ──confirm_safety──▶ n1v
n1v [checkpoint] หลังทำตามแล้ว อาการหายหรือไม่?   ─ ใช่ ▶ n_resolved ─ ไม่ ▶ n2
n2  [checkpoint] ประตูเตาปิดสนิทแล้วใช่หรือไม่?
      ├─ ใช่ ─▶ n3
      └─ ไม่ ─▶ n2f [instruction ⚠safety] ปิดประตูให้สนิทแล้วเริ่มปรุงอีกครั้ง … ──confirm_safety──▶ n2v
n2v [checkpoint] หลังทำตามแล้ว อาการหายหรือไม่?   ─ ใช่ ▶ n_resolved ─ ไม่ ▶ n3
n3  [checkpoint] ใช้ไฟฟ้าเกินกำลังของวงจรทำให้ฟิวส์ขาด/เบรกเกอร์ตัดไฟ ใช่หรือไม่?
      ├─ ใช่ ─▶ n3e  [escalation · handoff_informed]  ติดต่อ Samsung Customer Care …
      └─ ไม่ ─▶ n_escalate [escalation · handoff_unknown] ไม่พบสาเหตุที่ตรงกับคู่มือ …
n_resolved [resolution · user_fixed] อาหารสุกตามปกติแล้ว
```
(ข้อความและโครงสร้างอ่านจากไฟล์ `data/manuals/samsung_ge83mdt_um_de68_04111e.json` · ทุกโหนดอ้างหน้าคู่มือ)

### เดินจริงด้วยเครื่องสถานะ 🔬 [วัดจริง — รัน engine จริงกับผังนี้]
| # | action ที่ส่ง | ผล |
|---|---|---|
| 0 | (เริ่ม) | อยู่ `n1` checkpoint · `in_progress` · history 0 |
| 1 | `answer yes` ที่ n1 | → `n2` |
| 2 | `continue` ที่ n2 (ผิดชนิด) | ❌ `InvalidActionError: Action 'continue' ใช้กับโหนด 'n2' (type=checkpoint) ไม่ได้` · สถานะไม่ขยับ |
| 3 | `answer no` ที่ n2 | → `n2f` (instruction, **requiresSafetyConfirmation = true**) |
| 4 | `continue` ที่ n2f | ❌ `SafetyConfirmationRequiredError: โหนด 'n2f' เป็น safety_critical ต้องส่ง action 'confirm_safety' เท่านั้น …` |
| 5 | `answer yes` ที่ n2f | ❌ `InvalidActionError` (ชนิดไม่ตรงกับ instruction) |
| 6 | `confirm_safety` ที่ n2f | → `n2v` ✅ |
| 7 | `answer yes` ที่ n2v | → `n_resolved` resolution · `outcomeKind = user_fixed` · **`completed`** · history 4 |
| 8 | ส่ง action อีกหลังจบ | ❌ `SessionAlreadyCompletedError: … จบไปแล้ว ส่ง action เพิ่มไม่ได้อีก` |

ประวัติที่ engine สะสม: `n1:answer yes → n2:answer no → n2f:confirm_safety → n2v:answer yes` (ตรงกับที่ `session.store.ts:89-133` เขียนเป็นแถวใน `session_history` ทีละขั้น: `step_order` 0,1,2,3)
→ ใน **ระบบจริง** error ข้อ 2, 4, 5, 8 ถูกแปลงเป็น HTTP 400/400/400/409 โดย `common/error-handler.ts:38-43` และ **`update()` ไม่ถูกเรียก** (`traversal.service.ts:97` ก่อน `:100`)

**ทำไมถึงเรียก "state machine":** มีชุดสถานะจำกัด (โหนด) การเปลี่ยนสถานะเกิดจาก action ที่กำหนดไว้ล่วงหน้าเท่านั้น และจบเมื่อถึงสถานะสิ้นสุด — ทำให้ **ทดสอบได้ ทำซ้ำได้ และไม่มีสถานะที่ไม่คาดคิด** (ต่างจากให้ LLM ตัดสินว่าจะไปไหน)

---

## 3.5 ด่าน `safety_critical` (ภาษาคน + ตัวอย่างจริง)

**ภาษาคน:** ขั้นตอนบางขั้นเกี่ยวกับอันตราย (ไฟฟ้า ความร้อน) ผู้เขียนผังทำเครื่องหมาย `safety_critical` พร้อมข้อความเตือน — ระบบ **ไม่ยอมให้ผ่านด้วย "ถัดไป" ธรรมดา** ต้องส่ง action พิเศษ `confirm_safety` เท่านั้น ผู้ใช้จึงต้องเห็นคำเตือนและกดยืนยันก่อน

🔬 **ตัวอย่างจริงจากผังข้างบน:** โหนด `n2f` ("ปิดประตูให้สนิทแล้วเริ่มปรุงอีกครั้ง") มี `safety_warning` ว่า "ห้ามใช้เตาถ้าประตูหรือซีลประตูชำรุด ต้องให้ผู้มีคุณสมบัติซ่อมก่อน … ห้ามสอดนิ้วหรือสิ่งแปลกปลอมเข้าไปในเตา ถ้าสิ่งแปลกปลอมเข้าไปในเตาให้ถอดปลั๊กและติดต่อศูนย์บริการ (คู่มือหน้า 9)" — ข้อความมาจากคู่มือ ไม่ใช่ที่ AI แต่ง · ผล 🔬 ตอนส่ง `continue` = ถูกปฏิเสธ (ตาราง 3.4 ข้อ 4)

**ชั้นป้องกัน** (รายละเอียดและบรรทัดอยู่ในส่วนที่ 2 หัวข้อ 2.6): ข้อมูลผัง (validator บังคับว่า `safety_critical` ต้องอยู่บน instruction และต้องมี `safety_warning` — `graph-validator.ts:334-335`) → engine (`traversal-engine.ts:90-97`) → service เรียก engine ก่อนบันทึก (`traversal.service.ts:97-100`) → HTTP 400 `SAFETY_CONFIRMATION_REQUIRED` → หน้าจอบังคับติ๊กก่อน (`SafetyGateStep.tsx:30`)

**ข้อจำกัดที่ต้องบอกตรงๆ:**
- ระบบพิสูจน์ไม่ได้ว่าผู้ใช้ "อ่านจริง" แค่บังคับให้กดยืนยัน (`traversal.dto.ts:136-137` — `confirm_safety` ไม่มีข้อมูลประกอบ)
- ด่านนี้ครอบเฉพาะโหนดที่ผู้เขียนผังทำเครื่องหมายไว้ ถ้าผังไม่ได้ติดธงที่ขั้นอันตราย ระบบไม่ได้ตรวจเอง — มีเพียงคำเตือนตอน admin ตรวจร่างผัง (`graph-validator.ts:416-424` เตือนเมื่อข้อความมีคำที่บ่งชี้อันตรายแต่ไม่ได้ตั้งธง; **รายละเอียดอยู่ส่วนที่ 4**)

---

## 3.6 Rephrase และ guard

**ภาษาคน:** ข้อความจากคู่มือบางครั้งอ่านยาก rephrase ให้ LLM **เรียบเรียงใหม่ให้อ่านง่าย** โดย **ห้ามเปลี่ยนความหมาย/ตัวเลข/รหัส** แต่ LLM อาจพลาดหรือแต่งเพิ่ม จึงมี **guard** (โค้ดธรรมดา ไม่ใช่ AI) ตรวจผลก่อนแสดง ถ้าไม่ผ่านก็แสดง **ข้อความต้นฉบับจากคู่มือแทน**

**เมื่อไรถึงไม่ถูกเรียบเรียงเลย:** ปิดอยู่/ไม่มี key · ข้อความว่าง · **โหนด safety_critical** · **โหนดจบ (resolution/escalation)** — `rephrase/rephrase.service.ts:38-40` (หน้าจอกันซ้ำอีกชั้น `SessionPage.tsx:123-125`)

| ค่า | ที่ตั้ง | ความหมาย | ทราบเหตุผลที่เลือกไหม |
|---|---|---|---|
| ความยาวผลลัพธ์ ≥ **0.5×** ต้นฉบับ | `rephrase-guard.ts:27` (`minRatio`), ใช้ `:40-41` | สั้นเกิน = ข้อมูลอาจหาย | **ไม่ทราบเหตุผล** |
| ความยาวผลลัพธ์ ≤ **1.6×** ต้นฉบับ | `rephrase-guard.ts:28` (`maxRatio`), ใช้ `:40`, `:42` | ยาวเกิน = อาจแต่งเพิ่ม | **ไม่ทราบเหตุผล** |
| timeout **3000 ms** (3 วินาที) | `rephrase.service.ts:46` (ค่าสำรอง) และ `app.ts:54` (`REPHRASE_TIMEOUT_MS` หรือ 3000) | รอ LLM ได้นานสุดเท่านี้ ไม่ทันใช้ข้อความต้นฉบับ | เอกสาร `docs/features/LLM-INTEGRATION.md:150` ระบุว่า "ค่าเริ่มต้น 3000" เท่านั้น **ไม่ทราบเหตุผลที่เลือก 3 วินาที** |
| `temperature: 0`, `max_tokens: 1000` | `groq-llm.client.ts:27-28` | ให้ผลคงที่ที่สุดเท่าที่ LLM ทำได้ | ไม่ทราบเหตุผล (ไม่มีคอมเมนต์) |

**guard ตรวจอะไรบ้าง** (`rephrase-guard.ts:26-61` — ตามลำดับ): ผลไม่ว่าง → ไม่มีลิงก์ → ไม่มี markdown/HTML ใหม่ → ไม่เป็นหลายย่อหน้า → ความยาวอยู่ใน 0.5–1.6× → **ชุดตัวเลขเหมือนเดิมทุกตัว (รวมเลขไทยแปลงเป็นอารบิก)** → **คำอังกฤษ/รหัสไม่ขาดไม่เกิน** → **จำนวนคำว่า "ไม่" เท่าเดิม** (ไม่นับ "หรือไม่")

### ลองกับ guard จริง 🔬 [วัดจริง — รัน `checkRephrase` จริง]
ต้นฉบับ (ข้อความตัวอย่างที่ผมแต่งขึ้นเพื่อทดสอบ ไม่ใช่โหนดจริง): `ตรวจสอบว่าตั้งเวลาทำอาหาร 10 นาที และกดปุ่ม Start แล้ว ถ้าไม่ร้อนให้ลองใหม่` (75 ตัวอักษร)

| ผลที่ LLM อาจส่งมา (ผมแต่งขึ้นเพื่อทดสอบ) | ผล guard |
|---|---|
| เรียบเรียงปกติ: "เช็กว่าตั้งเวลาอาหารไว้ 10 นาที แล้วกดปุ่ม Start หรือยัง หากไม่ร้อนให้ลองอีกครั้ง" | ✅ ผ่าน (ยาว 1.08×) |
| เปลี่ยน 10 → 20 | ❌ "ตัวเลขไม่ตรงต้นฉบับ (ต้นฉบับ [10] ผลลัพธ์ [20])" |
| ตัดคำว่า "ไม่" ออก ("ถ้าร้อนให้ลองใหม่") | ❌ "จำนวนคำว่า "ไม่" ต่างจากต้นฉบับ (1 → 0) อาจกลับความหมาย" |
| เติมคำอังกฤษ "Grill" | ❌ "มีชื่อเฉพาะ/รหัสที่ต้นฉบับไม่มี: Grill" |
| ย่อเหลือ "ตั้งเวลา 10 นาที Start" | ❌ "ผลลัพธ์สั้นเกินไป (0.29× ของต้นฉบับ …)" |
| ใส่ www.samsung.com | ❌ "ผลลัพธ์มีลิงก์ที่ต้นฉบับไม่มี" |

### ⚠️ ช่องโหว่ของ guard ที่ผมทดสอบเจอ 🔬
ต้นฉบับ `ให้ถอดปลั๊กออกจากเต้ารับก่อนทำความสะอาดเตา` → ผลที่กลับความหมาย `ให้เสียบปลั๊กเข้ากับเต้ารับก่อนทำความสะอาดเตา` **ผ่าน guard** (`{"ok":true}`, ยาว 1.07×) เพราะ guard ตรวจเฉพาะ ตัวเลข / คำอังกฤษ / จำนวน "ไม่" / ความยาว / รูปแบบ — **ไม่ตรวจความหมายของคำกริยาอื่น** → guard เป็น "ตาข่ายหยาบ" ไม่ใช่การรับประกันความหมาย ด้านที่ลดความเสี่ยงจริงคือ (1) ไม่เรียบเรียงโหนด safety/โหนดจบ (2) prompt ห้ามเปลี่ยนความหมาย (3) หน้าจอมีปุ่มดูข้อความต้นฉบับทุกครั้ง (`RephraseNote.tsx`) — อย่าอ้างกับกรรมการว่า guard "กันได้ทุกกรณี"

**สถานะการใช้งานจริง:** เปิดใช้เมื่อ `REPHRASE_ENABLED=true` และตั้ง `GROQ_API_KEY` + `GROQ_MODEL` (`groq-llm.client.ts:47-52`) · `render.yaml` ตั้ง `REPHRASE_ENABLED: "true"` แต่ผม **ไม่ได้อ่านค่า env จริงบน Render** (และไม่ได้อ่าน `backend/.env` ตามข้อตกลง) จึง ⚠️ ไม่ทราบว่าตอนนี้เปิดอยู่หรือไม่ และใช้โมเดลไหน

---

## 3.7 สรุปส่วนที่ 3 (1 หน้า)

| แนวคิด | พูดสั้นๆ | ตัวเลข/หลักฐานหลัก |
|---|---|---|
| embedding | แปลงข้อความเป็นพิกัด 384 มิติ ข้อความความหมายใกล้กัน = พิกัดใกล้กัน | 384 (`embedding.service.ts:45`), โมเดล `:5` |
| cosine | วัดมุมระหว่างพิกัด 2 จุด ใกล้ 1 = ใกล้กัน | `symptom-matcher.ts:20-41` |
| 0.55 | ตัวกรองหยาบ ไม่ใช่ความแม่นยำ | `symptom-search.service.ts:11` · ไม่ทราบเหตุผลจากโค้ด |
| top 3 | เสนอให้เลือก ไม่ตัดสินแทน | `symptom-search.service.ts:12` · ไม่ทราบเหตุผล |
| state machine | โหนด + action ที่กำหนดล่วงหน้า ตัดสินในโค้ดล้วน | `traversal-engine.ts:41-125` |
| safety_critical | ต้อง `confirm_safety` ไม่งั้น engine ปฏิเสธ | `traversal-engine.ts:90-97` |
| rephrase + guard | LLM ปรับถ้อยคำเท่านั้น ผ่าน guard หรือใช้ข้อความคู่มือ | `rephrase.service.ts:35-62`, `rephrase-guard.ts:26-61` |

## 3.8 จุดที่ต้องระวังตอนสอบ (ส่วนที่ 3)

1. **อย่าพูดว่า "คะแนน 0.84 = มั่นใจ 84%"** — ไม่ใช่ความน่าจะเป็น (หน้าจอก็บอกผู้ใช้เช่นนี้ `SymptomSearchResults.tsx:24`)
2. **อย่าอ้างว่าเลือก 0.55/3/0.5/1.6/3 วินาทีด้วยการทดลอง** — ไม่พบหลักฐานในโค้ด; เอกสารเก่าให้ที่มาของ 0.55 เพียงข้อเดียว (ยืมมา + ชุดทดสอบ AI ร่างเอง)
3. **ตัวเลขจากการวัดในส่วนนี้ใช้ข้อมูลไฟล์ `data/manuals` ไม่ใช่ DB สด** และอยู่ที่รุ่นเดียว/คำค้นจำนวนน้อย — เป็นตัวอย่างประกอบการอธิบาย ไม่ใช่ผลประเมินความแม่นยำของระบบ · เอกสาร (`docs/reference/FILES-BACKEND.md:279`) บอกว่ามีชุดคำค้นที่ AI ร่างเองและผลวัดเก่าอยู่ใน `draft/` — ⚠️ **ผมไม่ได้เปิดดูโฟลเดอร์นั้น** (และคุณวางแผนย้ายออกนอก repo) จึงไม่ทราบว่าผลวัดนั้นแม่นแค่ไหนหรือยังตรงกับผังปัจจุบันหรือไม่ ห้ามอ้างตัวเลขจากมัน
4. **ถ้าถูกถามว่า "ใช้ AI ตรงไหน"** → embedding (ค้นอาการ), LLM (rephrase + ร่างผังจาก PDF) · **เดินผัง ไม่ใช้ AI**

---

## 📦 ถ้ากรรมการถามว่า... (ส่วนที่ 3)

**Q1. ทำไมใช้ embedding แทนการค้นด้วย keyword?**
ผู้ใช้พิมพ์ภาษาพูด ("ไมโครเวฟไม่ร้อน") ส่วนผังเขียนจากคู่มือ (EN/TH) คำไม่ตรงกัน keyword จะพลาดเมื่อใช้คำพ้อง/ภาษาต่าง · embedding เทียบ "ความหมาย" และโมเดลที่ใช้เป็นแบบหลายภาษา · เสริมด้วย `aliases` หลายคำต่อผัง (ผลวัด: "อาหารไม่สุก" ได้ 0.959 กับ "อาหารไม่สุกเลย") · **แต่ต้องยอมรับข้อเสีย:** ผลไม่แม่นยำเด็ดขาด (ผลวัด: อาการที่ถูกอยู่อันดับ 2) จึงให้ผู้ใช้เลือกเองจาก ≤ 3 อัน และมีทางเลือก "อาการทั้งหมด" เสมอ · ⚠️ ผมไม่ได้เทียบ keyword กับ embedding ด้วยข้อมูลจริง จึงไม่มีตัวเลขว่าใครดีกว่ากี่เปอร์เซ็นต์

**Q2. ทำไมไม่ให้ LLM ตอบเองแล้วจบ?**
เพราะเรื่องซ่อมเครื่องใช้ไฟฟ้ามีความเสี่ยง (ไฟช็อต ความร้อน) LLM อาจแต่งขั้นตอนที่ไม่มีในคู่มือ ระบบนี้จึงให้ **ทุกขั้นมาจากผังที่แปลงจากคู่มือ และมีหน้าอ้างอิง** (`HomePage.tsx:15`) และให้ LLM ทำแค่ปรับถ้อยคำบางโหนดผ่าน guard · ข้อดีอีกข้อคือ **ตรวจสอบย้อนได้** (ทุกขั้นชี้ไปหน้าคู่มือ) · **ข้อแลกเปลี่ยน:** ครอบคลุมเฉพาะอาการที่มีผัง (644 ผัง จาก 22 คู่มือ) ถ้าไม่มีก็แนะนำศูนย์บริการ ไม่ตอบอิสระ

**Q3. 0.55 กับ top 3 มาจากไหน?**
ตอบตรงๆ: **ไม่ทราบเหตุผลเชิงเทคนิคที่เลือก 3** และ 0.55 เป็นค่าคงที่ที่เอกสารโปรเจกต์บันทึกว่ายืมมาจากงานก่อนหน้า ตั้งจากชุดคำค้นที่ AI ร่างและยังไม่ตรวจแก้ — จึงไม่ถือเป็นค่าความแม่นยำ หน้าที่ของมันคือกรองหยาบ ตัดข้อความนอกเรื่องได้บางส่วน (ตัวอย่าง "วันนี้ฝนตก" ได้ 0.301 แต่ "สวัสดี" ได้ 0.730 ยังผ่าน — ดู Q6) ส่วนความถูกต้องปล่อยให้ผู้ใช้เลือก · ถ้าถามว่าจะปรับอย่างไร: ต้องมีชุดคำค้นที่มนุษย์ตรวจแล้วและวัดผล (ระบบยังไม่มี)

**Q4. cosine similarity คืออะไร ทำไมไม่ใช้ระยะทางแบบอื่น?**
cosine วัดมุมระหว่างเวกเตอร์ ใกล้ 1 = ทิศทางเดียวกัน (ความหมายใกล้กัน) ไม่สนความยาว · ในระบบนี้เวกเตอร์ถูก normalize ความยาว 1 อยู่แล้ว cosine จึงเท่ากับ dot product · **ส่วน "ทำไมไม่เลือกวิธีอื่น (เช่น Euclidean)" — ไม่พบเหตุผลที่บันทึกไว้ในโปรเจกต์** (ถ้ากรรมการถามให้ตอบว่าเป็นวิธีมาตรฐานคู่กับโมเดลประเภทนี้ และสำหรับเวกเตอร์ที่ normalize แล้วลำดับผลจาก cosine กับ Euclidean ออกมาเรียงเหมือนกัน — ข้อเท็จจริงทางคณิตศาสตร์ ไม่ใช่ข้อมูลเฉพาะโปรเจกต์)

**Q5. guard ของ rephrase กัน LLM มั่วได้จริงหรือ?**
กันได้ **บางประเภท** (ผลวัด: เปลี่ยนตัวเลข ตัดคำ "ไม่" เติมรหัสอังกฤษ ใส่ลิงก์ ย่อ/ขยายมาก → ถูกปฏิเสธทั้งหมด) แต่ **ไม่กันการสลับคำกริยาที่กลับความหมาย** (ผลวัด: "ถอดปลั๊ก" → "เสียบปลั๊ก" ผ่านได้) จึงไม่ใช่เครื่องรับประกันความหมาย · มาตรการที่รับภาระความเสี่ยงจริงคือ: ไม่เรียบเรียงโหนด safety/โหนดจบ, prompt ห้ามเปลี่ยนความหมาย, มีปุ่มดูข้อความต้นฉบับ, ปิดได้ด้วย env, และ LLM ไม่ได้ตัดสินขั้นตอนถัดไป · ข้อเสนอปรับปรุง (ยังไม่ได้ทำ ไม่ใช่ข้อเท็จจริงของระบบ): เพิ่ม guard ตรวจคำกริยาเสี่ยง หรือจำกัด rephrase เฉพาะ checkpoint

**Q6 (เพิ่มตามคำขอ). เกณฑ์ 0.55 ดีแค่ไหน?**
ตอบตามหลักฐานที่วัด (🔬 สคริปต์ `backend/scripts/study-measure.js`, ข้อมูล `data/manuals`, กรองรุ่น GE83MDT ที่มี 9 ผัง): **0.55 ตัดข้อความที่ไม่เกี่ยวส่วนใหญ่ได้ แต่ไม่ได้จัดอันดับความตรง และตัดไม่ครบทุกกรณี**

| คำค้นทดสอบ | ผังที่ผ่าน 0.55 | คะแนนสูงสุด (ข้อความที่ตรงกับ) | อ่านผล |
|---|---|---|---|
| "ราคาเท่าไหร่" | 0 | 0.305 ("ขึ้น SE") | ✅ ตัดออกหมด |
| "ฟ้าผ่า" | 0 | 0.414 | ✅ ตัดออกหมด |
| "วันนี้ฝนตก" | 0 | 0.301 | ✅ ตัดออกหมด |
| "เครื่องซักผ้าน้ำไม่ไหลออก" (คนละเครื่อง) | 0 | 0.518 | ✅ ตัดออก แต่ **ห่างเกณฑ์แค่ 0.03** |
| "ทีวีไม่มีเสียง" (คนละเครื่อง) | 1 | 0.571 ("ไมโครเวฟรบกวนทีวี") | ⚠️ ผ่านเกณฑ์เฉียดฉิว ทั้งที่ไม่เกี่ยวกับไมโครเวฟ |
| "เครื่องมีเสียงดัง" | 1 | 0.689 ("ไมโครเวฟรบกวนวิทยุ") | ⚠️ ผ่าน เพราะมีคำว่า "เสียง" ใกล้กัน |
| **"สวัสดี"** | 1 | **0.730 ("ขึ้น SE")** | ❌ **ข้อความที่ไม่เกี่ยวเลยได้คะแนนสูงกว่าเกณฑ์มาก** (ข้อความสั้นอย่าง "ขึ้น SE" ใกล้กับคำสั้นๆ ทั่วไป) |
| "ไมโครเวฟไม่ร้อน" (ตรงอาการ) | 8 จาก 9 | 0.845 (ตัวที่ถูกอยู่อันดับ 2 = 0.822) | ❌ **ไม่แยก "ตรง" กับ "ไม่ตรง" ภายในรุ่นเดียวกัน** |
| "ไมโครเวฟมีควันขึ้น" | 8 จาก 9 | 0.888 ("ไมโครเวฟใหม่มีควัน") | อันดับ 1 ถูก แต่ผังอื่นอีก 7 ก็ผ่าน |

**สรุปที่พูดได้ตามหลักฐาน:**
1. หน้าที่ของ 0.55 คือ **ตัวกรองหยาบ** ไม่ใช่ตัวตัดสินว่าอาการไหนใช่ — ภายในรุ่นเดียวกัน คำค้นที่มีคำว่า "ไมโครเวฟ" ทำให้เกือบทุกผังผ่าน
2. ตัดคำค้นนอกเรื่องได้ **4 จาก 7 ตัวอย่างนอกเรื่อง** (ราคา, ฟ้าผ่า, ฝนตก, เครื่องซักผ้า) แต่ **3 ตัวอย่าง** ยังผ่าน (สวัสดี, ทีวีไม่มีเสียง, เครื่องมีเสียงดัง) → ไม่ควรอ้างว่า "ระบบรู้ว่าคำค้นไม่เกี่ยวกับเครื่อง"
3. ความตรงของอันดับ 1 ไม่ได้การันตี (ตัวอย่าง "ไมโครเวฟไม่ร้อน") → จึงออกแบบให้ผู้ใช้เลือกเองจากไม่เกิน 3 อัน และมีหน้าอาการทั้งหมดเป็นทางสำรอง
4. **ข้อจำกัดของหลักฐาน:** ทดสอบคำค้น 14 ข้อ (บางข้อซ้ำกันคนละโหมดกรอง) กรองรุ่นเดียว ผมแต่งคำค้นเอง ไม่ได้ผ่านการตรวจโดยผู้เชี่ยวชาญ ไม่มี precision/recall ที่เชื่อถือได้ → **ห้ามอ้างตัวเลขเปอร์เซ็นต์ความแม่นยำของ 0.55** (ถ้ากรรมการถามเปอร์เซ็นต์ ให้ตอบว่า "ยังไม่ได้ประเมินด้วยชุดทดสอบที่มนุษย์ตรวจ")

### 3.9 วิธีรันสคริปต์วัด (รันซ้ำได้ตอนสอบ)
ไฟล์: `backend/scripts/study-measure.js` (JavaScript ธรรมดา ไม่มี dependency ใหม่ ไม่ต่อ DB ไม่อ่าน `.env` ไม่เรียกอินเทอร์เน็ต)

```bash
cd backend
npm run build                        # ต้องมี dist/ (ถ้ายังไม่เคย build)
node scripts/study-measure.js engine --out ผล-engine.json    # เดินผังจริง รวมกรณีถูกปฏิเสธ (วินาทีเดียว)
node scripts/study-measure.js guard  --out ผล-guard.json     # ลอง guard 7 กรณี (วินาทีเดียว)
node scripts/study-measure.js search --out ผล-search.json    # คะแนน cosine ชุดตัวอย่างส่วนที่ 3 (~1 นาที: โหลดโมเดล + แปลง ~2,000 ข้อความ)
node scripts/study-measure.js search --out x.json "สวัสดี@samsung_ge83mdt_um_de68_04111e" "ตู้เย็นไม่เย็น"   # คำค้นของคุณเอง (@รหัสรุ่น = กรองรุ่น)
```
- บน Windows ใส่ `--out` แล้วเปิดไฟล์ (UTF-8) เพราะคอนโซลอาจแสดงภาษาไทยเพี้ยน
- ค่าเกณฑ์ 0.55 และ 3 ถูกระบุซ้ำในสคริปต์ (ในระบบไม่ได้ export) ถ้าแก้ในระบบต้องแก้ในสคริปต์ด้วย
- ผลที่ได้เมื่อทดสอบรันสคริปต์นี้ ตรงกับตัวเลขในส่วนที่ 3 (644 ผัง · 3,850 ข้อความ · 1,972 ไม่ซ้ำ · 384 มิติ · 0.845/0.822 · 0.959/0.950 · 0.751/0.716 · 0.301)

---

✅ ส่วนที่ 3 ยืนยันแล้ว

---

# ส่วนที่ 4 — flow ของ auth/guest, history, feedback, outcome, admin authoring และการจัดการ error

> ทุกหัวข้อใช้ `path:บรรทัด` ที่เปิดอ่านจริงตอนเขียน · จุดที่ไม่ได้เปิดอ่านติดป้าย **⚠️ ไม่แน่ใจ** · ไม่มีการเรียก DB/LLM จริง ข้อความ "ผลที่คาด" คือการอ่านโค้ด ไม่ใช่ผลทดสอบ (ยกเว้นระบุ 🔬)

## 4.0 แผนที่ส่วนที่ 4

| หัวข้อ | endpoint หลัก | ใครเรียกได้ | ตารางที่เกี่ยว |
|---|---|---|---|
| 4.1 บัญชี / guest | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` | สมัคร/เข้าสู่ระบบ: ทุกคน · me: ต้องล็อกอิน | `users`, `sessions.user_id/client_id` |
| 4.2 ประวัติ | `GET /history` · `GET /history/:id` · `DELETE /history/:id` | ล็อกอินหรือ guest (ต้องมีตัวตนอย่างใดอย่างหนึ่ง) | `sessions`, `session_history` |
| 4.3 feedback | `POST /history/:id/feedback` (ผู้ใช้) · `GET /admin/feedback` (admin) | เจ้าของ session / admin | `session_feedback` |
| 4.4 outcome | `POST /traversal/sessions/:id/outcome` | เจ้าของ session ที่จบแล้ว | `sessions.outcome_text` |
| 4.5 สถิติ admin | `GET /admin/analytics/summary` | admin | อ่านอย่างเดียว |
| 4.6 admin authoring | `POST/GET/PUT /admin/drafts…` · `…/reject` · `…/publish` | admin | `graph_drafts` → `manuals/graphs/nodes` |
| 4.7 error handling | (ทุก endpoint) | — | — |

---

## 4.1 บัญชีผู้ใช้ กับ guest และสิทธิ์

### 4.1.1 สมัคร / เข้าสู่ระบบ / ดูตัวเอง
| ขั้น | ทำอะไร | ไฟล์:บรรทัด |
|---|---|---|
| ตรวจ input สมัคร | email (ตัดช่องว่าง → ตัวพิมพ์เล็ก → ตรวจรูปแบบหลวม ≤ 255) · password 8–72 ตัวอักษรและ ≤ 72 **ไบต์** (bcrypt ใช้แค่ 72 ไบต์แรก) · displayName 1–100 | `auth.dto.ts:73-111` · ค่าคงที่ `:16-26` |
| สมัคร | hash รหัสผ่านด้วย bcrypt (rounds = 10) → INSERT → **`role` ถูกตั้งเป็น `user` ในโค้ดเสมอ ไม่รับจากผู้ใช้** | `auth.service.ts:50-70`, role `:61`, rounds `:25` |
| อีเมลซ้ำ | UNIQUE ชน (`ER_DUP_ENTRY`) → `DuplicateEmailError` → `ApiError` 409 `EMAIL_TAKEN` | `users.store.ts:78-90` → `auth.service.ts:63-66` · UNIQUE `migrations/010_create_users.sql:31` |
| เข้าสู่ระบบ | หาอีเมล → `compare` รหัสผ่านกับ hash จริง **หรือ hash หลอก** ถ้าไม่พบอีเมล (เวลาตอบใกล้เคียงกัน กันเดาอีเมลจากเวลา) → ผิดทุกกรณีตอบข้อความเดียว `INVALID_CREDENTIALS` 401 | `auth.service.ts:73-82`, hash หลอก `:43`, `:76` |
| ออก token | JWT `{sub: userId, role}` ลงชื่อ HS256 หมดอายุ 7 วัน (ตั้งด้วย `JWT_EXPIRES_IN`) · `JWT_SECRET` ต้องตั้งและยาว ≥ 32 ไม่งั้นแอปไม่บูต | `auth.service.ts:93-96` · `token.ts:26-40` (ตรวจตอนบูต), `:44-46` (ลงชื่อ) |
| ดูตัวเอง | `GET /auth/me` ด้วย `requireAuth` → อ่าน user จาก DB (ไม่พบ → 401 ให้ล็อกอินใหม่) | `auth.routes.ts:36-43` → `auth.service.ts:85-91` |

**admin สร้างได้ทางเดียว** คือสคริปต์ `backend/scripts/seed-admin.js` (อ่าน `ADMIN_EMAIL`/`ADMIN_PASSWORD` จาก `.env`, รันซ้ำได้ปลอดภัย; ถ้ามีอีเมลนั้นเป็น user อยู่แล้วจะยกเป็น admin) — คอมเมนต์หัวไฟล์ `seed-admin.js:1-15`, `migrations/010_create_users.sql:12-13` · **⚠️ ไม่แน่ใจ** รายละเอียดข้างในสคริปต์หลังหัวไฟล์ (ไม่ได้อ่านครบ และไม่ได้อ่านค่า `.env`)

### 4.1.2 middleware ตรวจสิทธิ์ 3 ตัว (ใครผ่านได้)
สร้างครั้งเดียวใน `app.ts:81` ด้วย `createAuthMiddleware(tokens)` แล้วส่งให้ไฟล์ routes ที่ต้องใช้ · ติด **ราย route** (ไม่ติดทั้ง path) path ที่ไม่มีจริงใต้ `/admin` จึงยังได้ 404 ไม่ใช่ 401

| middleware | พฤติกรรม | ไฟล์:บรรทัด | ใช้กับ |
|---|---|---|---|
| `requireAuth` | ต้องมี `Authorization: Bearer …` ที่ถูกต้อง ไม่งั้น 401 · ตรวจ HS256 เท่านั้น (`token.ts:49-52`) · เชื่อ payload เฉพาะ `sub` เป็นข้อความไม่ว่าง และ `role` เป็นบทบาทจริง · ข้อความ 401 เหมือนกันทุกสาเหตุ | `auth.middleware.ts:85-94` · อ่าน token `readUser` `:43-66` | `/auth/me`, `/admin/*` |
| `optionalAuth` | ไม่มี Authorization = ผ่านเป็น guest · **มีแต่ใช้ไม่ได้ = 401** (ไม่แอบลดเป็น guest เพื่อไม่ให้ประวัติหายเงียบๆ) | `auth.middleware.ts:75-83` | `/traversal/sessions*`, `/history*` (`history.routes.ts:29`, `traversal.routes.ts:40-48`) |
| `requireAdmin` | ไม่ใช่ admin → 403 · ไม่มี user → 401 · ต้องวางหลัง `requireAuth` | `auth.middleware.ts:96-106` | `/admin/*`, `/admin/drafts*` (`admin.routes.ts:24-31`, `drafts.routes.ts:84`) |

ผลการตรวจเก็บไว้ที่ `request.user` แล้ว handler อ่านด้วย `currentUser(request)` (ไม่มี = guest)

หมายเหตุ: **ไม่พบ rate limit / การล็อกผู้ใช้หลังใส่รหัสผิดซ้ำ** ในโค้ด backend (ค้น `throttle|rate.?limit` ใน `backend/src` ไม่พบ) → ถ้ากรรมการถามเรื่อง brute-force ให้ตอบว่า "ยังไม่มีกลไกจำกัดจำนวนครั้ง" (ข้อจำกัดที่ทราบ ไม่ได้ทดสอบเพิ่ม)

### 4.1.3 guest คืออะไร และเจ้าของ session ถูกตัดสินอย่างไร
- **guest = ผู้ที่ไม่มี token** ใช้ระบบได้ทั้งหมด (เดินผัง, ดูประวัติของตัวเอง) แต่ไม่มีบัญชี
- ตัวระบุ guest = **UUID ที่หน้าเว็บสุ่มสร้างเองเก็บใน localStorage** (`fixstep.clientId`) แล้วส่งเป็นหัวข้อ `X-Client-Id`: `frontend/src/lib/clientId.ts:13`, `:34-53` · การตัดสินว่าจะส่งหัวข้อนี้หรือไม่: **ล็อกอินอยู่ = ไม่ส่ง · guest = ส่ง** `lib/clientHeaders.ts:12-14`
- **ไม่ใช่การยืนยันตัวตน**: ใครรู้ UUID ก็เห็นประวัติของ guest id นั้นได้ (คอมเมนต์ `traversal.dto.ts:23`)
- backend หา "เจ้าของ" ที่ **จุดเดียว** `auth/session-owner.ts`:
  - `resolveRequiredOwner` (ประวัติ/ยกเลิก): ล็อกอิน → `{user}` · ไม่ล็อกอิน → ต้องมี X-Client-Id เป็น UUID ไม่งั้น 400 `INVALID_CLIENT_ID` — `:31-36`
  - `resolveOptionalOwner` (เริ่ม session): ไม่มีเลยก็ได้ (เดินได้แต่ไม่เข้าประวัติใคร) — `:42-51`
  - เงื่อนไข SQL: user → `user_id = ?` · guest → **`client_id = ? AND user_id IS NULL`** — `:54-59`; ค่าที่เขียนลงตอนสร้าง `:62-69`
- **เจ้าของมีได้แบบเดียวต่อ session:** ล็อกอินตอนเริ่ม → เก็บ `user_id` (client_id = NULL) · guest → เก็บ `client_id` (user_id = NULL) (`migrations/011_add_session_user_id.sql:6-10`) · **ไม่มีการ "ย้าย" session ของ guest มาเป็นของ user หลังล็อกอิน** (คอมเมนต์ migration 011 บรรทัด 12: ไม่ผูกย้อนหลัง/ไม่มี claim)
- **กันข้ามเจ้าของ:** `AND user_id IS NULL` ทำให้ guest ที่ใช้เบราว์เซอร์เดียวกับ user ก็มองไม่เห็นและลบ session ของ user ไม่ได้ (migration 011 บรรทัด 9-10) · และ endpoint เดินผัง (GET/actions/outcome) ของ session ที่เป็นของ user **ต้องมี token ของเจ้าของ** ไม่งั้น 404 เหมือนไม่มี session (`traversal.service.ts:138-143`) — ส่วน session ของ guest ใช้ session id เป็นกุญแจเหมือนเดิม

### 4.1.4 ฝั่งหน้าจอ (สถานะล็อกอิน)
- เก็บ `{token, user:{id, displayName, role}}` ใน localStorage คีย์ `fixstep.auth` (`lib/authStorage.ts:19`, `:70-77`) พร้อมสำเนาในหน่วยความจำ ถ้า localStorage ใช้ไม่ได้ก็ใช้ในหน่วยความจำของแท็บ (`:50-58`) · **ข้อสังเกตทั่วไป** (ไม่ใช่ผลทดสอบ): token ใน localStorage ถูกอ่านได้ด้วย JavaScript ที่รันในหน้าเว็บ ถ้าเกิดช่องโหว่ XSS token อาจรั่ว
- ตอนเปิดแอป: ถ้ามี token จำไว้ → เรียก `/auth/me` ยืนยัน (`AuthProvider.tsx:58-79`) ระหว่างนั้นสถานะ `verifying`; สถานะมี 3 แบบ `guest | verifying | user` (`:114-117`)
- ได้ 401 พร้อม token → ล้าง token/แคช แล้วพาไปหน้า login พร้อมกลับมาหน้าเดิม (`api/http.ts:91-93` → `AuthProvider.tsx:42-56`) · login/สมัครสำเร็จล้างแคช query ทั้งหมด (`:81-90`) กันข้อมูลของตัวตนก่อนหน้าค้าง
- `AdminRoute`: รอตรวจ → guest ไปหน้า login → ไม่ใช่ admin แสดง `ForbiddenPage` (`components/auth/AdminRoute.tsx:19-41`) · **เป็น UX เท่านั้น** ตัวบังคับจริงคือ `requireAdmin` ฝั่ง backend (`auth.middleware.ts:96-106`)

---

## 4.2 ประวัติการซ่อม (`/history`)

| ขั้น | ทำอะไร | ไฟล์:บรรทัด |
|---|---|---|
| เข้าถึง | `optionalAuth` ติดทุก route ของ `/history` · ทุก handler เรียก `resolveRequiredOwner` (ล็อกอิน หรือส่ง X-Client-Id เป็น UUID) | `history.routes.ts:29-31`, `:41`, `:51`, `:61` |
| รายการ | `GET /history?page=&pageSize=` รับแค่ 2 พารามิเตอร์ (page ≥ 1, pageSize 1–50 ค่าเริ่มต้น 10) | `history.dto.ts:16-17`, `:36-73` |
| ดึงข้อมูล | เฉพาะ session ที่ `status='completed'` **และยังไม่หมดอายุ** ของเจ้าของนั้น เรียงใหม่สุดก่อน **ไม่เกิน 50 แถว** (`MAX_HISTORY_ROWS`) | `history.store.ts:10`, `:48-60` |
| จัดหน้า | แบ่งหน้า **ในหน่วยความจำ** หลังดึงมาแล้ว (page เกินจำนวนหน้า = ปรับเป็นหน้าสุดท้าย) | `history.service.ts:44-65` |
| แต่ละรายการ | ชื่ออาการ/รุ่นมาจากผังในหน่วยความจำ · `outcomeKind` อ่านจากโหนดสุดท้ายของผัง **ปัจจุบัน** (ผังหาย/โหนดหาย = `null` ไม่ล้มทั้งรายการ) | `history.service.ts:110-124` |
| รายละเอียด | `GET /history/:id` → ต้องเป็นของเจ้าของนี้ ไม่งั้น 404 `HISTORY_NOT_FOUND` (ไม่ใช่ 403 เพื่อไม่บอกว่า id มีอยู่) | `history.service.ts:67-75`, `:100-104`, `:35-36` |
| ประกอบรายละเอียด | **replay** ขั้นตอนที่บันทึกไว้ผ่าน engine ในผังปัจจุบัน ต้องไปจบที่โหนดเดิม ไม่งั้นตอบ `available: false` (200) ไม่ใช่ 500 — กันกรณีผังถูกแก้แล้วโชว์ขั้นเก่าคู่ข้อสรุปใหม่ที่ไม่เกี่ยวกัน | `history.service.ts:126-187`, `replayReaches` `:232-258` |
| คำเตือนความปลอดภัย | รวมเฉพาะ `safety_warning` ของโหนดที่ผ่านจริง (ไม่แต่งคำเตือนเพิ่ม) | `history.service.ts:171-176` |
| ลบ | `DELETE /history/:id` ลบทั้ง session (เฉพาะที่จบแล้วของเจ้าของ) ตอบ 204 · ไม่พบ/ไม่ใช่ของเรา → 404 · `session_history` และ `session_feedback` ถูกลบตามด้วย `ON DELETE CASCADE` | `history.routes.ts:57-65` · `history.store.ts:120-129` · `history.service.ts:77-83` · cascade `migrations/002…:34`, `009…:10-12` |
| อายุข้อมูล | session ที่จบแล้วเก็บ **90 วัน** (ตั้งตอนขั้นสุดท้าย) | `session.store.ts:9-10`, `:99-100` |

**ฝั่งหน้าจอ:** `HistoryPage.tsx` (หน้าตามที่ URL `?page=`, ใหม่สุดก่อน) → `useHistory` (`queries.ts:85-98`, ไม่แคชนาน เพื่อให้เห็นรายการล่าสุด) → `api/history.ts:11-13` (ส่ง `ownerHeaders()` ทุกครั้ง) · ลบแล้วล้างแคชรายการทุกหน้า (`queries.ts:214-232`)

**ที่ต้องรู้ตอนสอบ:**
- **ไม่มี** ตัวกรอง/ค้นหา/เรียง/สถิติในหน้านี้ (ถูกตัดในงาน simplify กลุ่ม D3) เหลือ "ใหม่สุดก่อน + แบ่งหน้า"
- **ข้อจำกัด 50 รายการ** (`MAX_HISTORY_ROWS` `history.store.ts:10`): ผู้ใช้ที่มี session จบเกิน 50 รายการจะเห็นแค่ 50 ล่าสุด รายการที่เก่ากว่านั้นเปิดดู/ลบจากหน้ารายการไม่ได้ (อ่านจากโค้ด ไม่ได้ทดสอบ · ผู้พัฒนาตั้งใจลดจาก 500 เป็น 50 เมื่อ 21 ต.ค. 2569 — เหตุผลที่เลือก 50 ผู้พัฒนาไม่ได้ระบุ)
- ประวัติดึงจาก **session ที่ยังไม่หมดอายุ** เท่านั้น — เก็บ 90 วันนับจากวันที่จบ (ไม่ต่ออายุซ้ำ)

---

## 4.3 Feedback (ให้คะแนนผลการตรวจ)

| ขั้น | ทำอะไร | ไฟล์:บรรทัด |
|---|---|---|
| หน้าจอ | ในหน้า "รายละเอียดประวัติ" มีฟอร์ม 👍 ช่วยได้ / 👎 ไม่ช่วย + ข้อความเพิ่มเติม (ไม่บังคับ ≤ 500) + คำเตือนไม่ให้ใส่ข้อมูลส่วนตัว · ส่งซ้ำ = แก้ค่าเดิม | `components/history/FeedbackButtons.tsx:23-89` (ข้อความเตือน `:57-59`), `api/history.ts:28-35` |
| ส่ง | `POST /history/:id/feedback` body `{ helpful: boolean, comment?: string\|null }` | `history.routes.ts:47-54` |
| ตรวจ body | `helpful` ต้องเป็น boolean · `comment` ตัดช่องว่าง ว่าง = `null` ยาวเกิน 500 → 400 `INVALID_FEEDBACK` | `history.dto.ts:160-189`, ค่าคงที่ `:19` |
| บันทึก | ต้องเป็นของเจ้าของนี้และ **session จบแล้ว** (`requireOwned`) → upsert: `INSERT … ON DUPLICATE KEY UPDATE` | `history.service.ts:85-94` · `history.store.ts:131-139` |
| 1 คะแนนต่อ 1 session | `PRIMARY KEY (session_id)` + FK `ON DELETE CASCADE` (ลบ session = ลบ feedback) | `migrations/009_create_session_feedback.sql:8-13` |
| หน้าจอหลังบันทึก | ใส่ค่าที่เซิร์ฟเวอร์ตอบลงแคช → ขึ้น "บันทึกแล้ว" ทันที | `queries.ts:234-249` |

**admin อ่าน feedback ได้อย่างไร:** `GET /admin/feedback` (`requireAuth` + `requireAdmin`: `admin.routes.ts:24-31`) → `AdminStore` JOIN `session_feedback` กับ `sessions` (`admin.store.ts:98-118`) · ความเป็นส่วนตัว: store **ไม่ SELECT email / ชื่อ / user_id / client_id** รู้เจ้าของแค่ชนิด user/guest/none (คอมเมนต์หัวไฟล์ `admin.store.ts:1-14`) — อ่านเฉพาะหัวไฟล์และรายการ query ไม่ได้อ่านทุกบรรทัด

**ข้อสังเกต:** ไม่มีตัวกรองคำหยาบ/ข้อมูลส่วนตัวฝั่งเซิร์ฟเวอร์ — มีแค่คำเตือนบนหน้าจอและตัดช่องว่าง/จำกัดความยาว (`history.dto.ts:181-185`)

---

## 4.4 Outcome (ข้อความผลลัพธ์ที่ผู้ใช้พิมพ์หลังการตรวจจบ)

> **สถานะตามเอกสารโปรเจกต์:** ฟีเจอร์นี้ถูก **เก็บไว้ตามที่คุณตัดสินในงาน simplify เพราะเป็นข้อกำหนดตาม TOR** (`docs/SIMPLIFY_REPORT.md:113` มีรายการ D4 · ไฟล์ `TOR-COMPLIANCE` ที่เอกสารอ้างถึง **ไม่ได้อยู่ใน repo** และผม **ไม่ได้อ่านตัว TOR** จึงยืนยันเนื้อข้อกำหนดเองไม่ได้ — ให้ใช้ตามที่คุณตรวจ TOR ฉบับจริง)

**ต้องแยกให้ออกจาก 2 อย่างที่ชื่อคล้ายกัน**
| ชื่อ | คืออะไร | เก็บที่ไหน |
|---|---|---|
| `outcome_kind` ของโหนด | ชนิดโหนดจบ 4 ค่า (`user_fixed`, `normal_behavior`, `handoff_informed`, `handoff_unknown`) **ผู้เขียนผังกำหนด** | โหนดในผัง (`types.ts:3`) |
| **outcome ข้อความ** (หัวข้อนี้) | ข้อความอิสระที่ **ผู้ใช้พิมพ์** หลังจบ ≤ 1,000 ตัวอักษร | `sessions.outcome_text`, `outcome_at` |
| feedback comment | ข้อความประกอบ 👍/👎 ≤ 500 | `session_feedback.comment` |

**flow**
| ขั้น | ทำอะไร | ไฟล์:บรรทัด |
|---|---|---|
| หน้าจอ | ที่โหนดสิ้นสุดมีกล่อง "ผลเป็นอย่างไรบ้าง? (ไม่บังคับ)" · บอกชัดว่า **บันทึกได้ครั้งเดียว แก้ไขไม่ได้** และไม่ให้ใส่ข้อมูลส่วนตัว · ≤ 1,000 ตัวอักษร | `components/OutcomeForm.tsx:55-60`, `:63-67` · `lib/outcome.ts:1`, `:9-14` · ฟอร์มถูกใส่ใน `OutcomeStep` (`SessionPage.tsx:132-140`) |
| ส่ง | `POST /traversal/sessions/:id/outcome` body `{ text }` → ตอบ 200 (ไม่ใช่ 201) | `traversal.routes.ts:70-77` · `api/traversal.ts:68-73` |
| ตรวจ body | text ต้องเป็นข้อความ ไม่ว่าง ≤ 1,000 → ไม่ผ่าน 400 `INVALID_OUTCOME` | `traversal.dto.ts:166-185` |
| ลำดับตรวจ | (1) ไม่พบ session → 404 `SESSION_NOT_FOUND` (2) session ยังเดินอยู่ → 409 `SESSION_NOT_COMPLETED` (3) เคยบันทึกแล้ว → 409 `OUTCOME_ALREADY_SUBMITTED` | `traversal.service.ts:116-136` (404 `:122` · 409 `:125-127` · 409 `:129-132`) |
| บันทึก | `UPDATE … SET outcome_text, outcome_at WHERE session_id AND status='completed' AND outcome_text IS NULL` **คำสั่งเดียว (atomic)** — สองคำขอพร้อมกัน ชนะได้คนเดียว | `session.store.ts:171-182` · เรียกที่ `traversal.service.ts:129` แล้วดูผลว่าบันทึกได้หรือไม่ |
| ไม่ผ่าน engine | outcome เป็นข้อมูลบันทึกอย่างเดียว **ไม่เปลี่ยนสถานะ ไม่เข้า `submitAction`** | `traversal.service.ts:116-136` (ไม่มีการเรียก `engineSubmitAction`) |

**ข้อความที่ถูกเก็บแล้วถูกใช้ที่ไหน (ตรวจด้วย `grep outcome_text|outcomeText` ทั้ง backend/frontend/scripts)**
1. ส่งกลับตอน `GET /traversal/sessions/:id` ของ session ที่จบ (`traversal.service.ts:83-84`, `session.store.ts:184-192`) เพื่อให้หน้าเดินผังแสดง "บันทึกผลแล้ว" หลังรีเฟรช
2. ส่งกลับในรายละเอียดประวัติ (`history.store.ts:81-103` → `history.service.ts:139`) ให้เจ้าของเห็นของตัวเอง
3. **ไม่มีที่อื่น** — ไม่พบ query หรือโค้ดของ admin ที่อ่าน `outcome_text` (ไม่ปรากฏใน `admin.store.ts`/`admin.service.ts`) และไม่มีสคริปต์/หน้าจอสรุปหรือวิเคราะห์ข้อความนี้

**ตอบกรรมการตามหลักฐาน:** ข้อความผลลัพธ์ **ถูกเก็บไว้ในฐานข้อมูลครบตามฟีเจอร์ แต่ ณ ตอนนี้ยังไม่มีเครื่องมือสรุป/วิเคราะห์** ทั้งฝั่ง admin และสคริปต์ (ผู้ดูแลเห็น 👍/👎 และ comment ของ feedback ได้ แต่ไม่เห็น outcome ข้อความ) · ข้อมูลเดียวที่นำไปใช้ย้อนหลังคือแสดงกลับให้เจ้าของดูใน session/ประวัติของตัวเอง · ถ้าจะทำสรุปต้องเพิ่มโค้ด (ไม่ใช่ข้อเท็จจริงของระบบตอนนี้) · **ข้อสังเกต:** ไม่มีการกรองข้อมูลส่วนตัวฝั่งเซิร์ฟเวอร์ (มีแค่คำเตือนบนหน้าจอ `OutcomeForm.tsx:59`)

---

## 4.5 สถิติสำหรับ admin (สั้นๆ)
`GET /admin/analytics/summary?days=` → `AdminService.summary` ประกอบตัวเลขจาก `AdminStore` (นับ session เริ่ม/จบ, feedback รวม, อาการยอดนิยม, โหนดจบ, รายวัน) (`admin.routes.ts:34-41`, `admin.store.ts:138-223`) · กฎ: ตัวหาร 0 → `null` ไม่ใช่ 0, ส่งเฉพาะช่องที่ประกาศใน DTO (`admin.service.ts` หัวไฟล์) · **ข้อจำกัดที่เอกสารระบุ:** ตาราง `sessions/graphs` ใช้ร่วมกับโปรเจกต์เก่า จึงแยกเฉพาะโปรเจกต์นี้ด้วย `graph_id` ไม่ได้ทั้งหมด (`admin.service.ts` คอมเมนต์หัวไฟล์) · ⚠️ ไม่แน่ใจรายละเอียดสูตรแต่ละตัวเลข (ไม่ได้อ่านทุก query)

---

## 4.6 Admin authoring: PDF → ร่างผัง → ตรวจ → เผยแพร่

### 4.6.0 ภาพรวม
```
[admin อัปโหลด PDF + เลือกช่วงหน้า ≤10]
   │ POST /admin/drafts (multipart) → 202 { id, status:'drafting' }
   ▼
 drafting ──(เบื้องหลัง: แยกข้อความ → LLM ร่างทีละ 2 หน้า → parse เข้ม → ตรวจด้วย validator)──▶ ready ─┬─▶ (แก้ JSON ตรวจใหม่ได้เรื่อยๆ ยังเป็น ready)
   │                                                                                          ├─▶ published  (admin กดเผยแพร่ → ตรวจซ้ำใน transaction → INSERT)
   └──(LLM/parse/ไฟล์ล้มเหลว)──▶ failed ──────────────────────────────────────────────────────┴─▶ rejected   (admin ปฏิเสธ จาก ready หรือ failed)
```
สถานะมี 5 ค่า: `drafting, ready, failed, rejected, published` (`drafts.dto.ts:18`) · ร่างอยู่ในตาราง `graph_drafts` **แยกจาก `graphs`** ผู้ใช้ทั่วไปมองไม่เห็นจนกว่า publish (`drafts.store.ts:2-5`)

**หลักการที่ใช้ตลอด** (`graph-validator.ts` หัวไฟล์): **LLM "ร่าง" ได้แต่ไม่มีอำนาจตัดสินว่าผ่านหรือไม่** — ผู้ตัดสินคือโค้ด validator และคนที่กดเผยแพร่

### 4.6.1 อัปโหลด
| ขั้น | ทำอะไร | ไฟล์:บรรทัด |
|---|---|---|
| ฟอร์ม | เลือก PDF + กรอก manualId (เริ่มต้นเติม `demo_` ให้) หมวดเครื่อง ยี่ห้อ รุ่น ชื่อคู่มือ ชื่อที่แสดง (ไม่บังคับ) หน้าเริ่ม–สุดท้าย · ตรวจฝั่งหน้าจอก่อนส่ง แล้วไปหน้าตรวจของร่างที่ได้ | `UploadDraftForm.tsx:15-24`, `:73-93` |
| ด่านสิทธิ์ | `requireAuth` → `requireAdmin` **ก่อน** multer รับไฟล์ จึงคนนอกยัดไฟล์ใส่ RAM ไม่ได้ | `drafts.routes.ts:84`, `:86-89` |
| รับไฟล์ | multer ในหน่วยความจำ: ไฟล์เดียว ฟิลด์ข้อความ ≤ 12 ฟิลด์ ฟิลด์ละ ≤ 1,024 ไบต์ ขนาดไฟล์ ≤ 10 MB (ปรับด้วย `AUTHORING_MAX_PDF_MB`) | `drafts.routes.ts:52-56` (ค่า limits `:55`), `:89` |
| error ของ multer | `uploadPdf()` แปลงเองทันที (ไม่ส่งต่อให้ error handler กลาง) → 413 `PDF_TOO_LARGE` / 400 `INVALID_DRAFT_REQUEST` · error อื่นส่งต่อด้วย `next(err)` | `drafts.routes.ts:64-77` |
| ตรวจฟิลด์ | manualId `a-z0-9_` 3–60 · หมวดเครื่องต้องอยู่ใน 5 หมวด · ช่วงหน้า ≤ 10 หน้า | `drafts.dto.ts:54-88` |
| ตรวจไฟล์ | ว่าง → 400 · ไม่มี `%PDF-` ใน 1 KB แรก (ตรวจจากไบต์จริง ไม่เชื่อ mimetype) → 415 `PDF_UNSUPPORTED_TYPE` | `drafts.service.ts:54-55` |
| ทีละ 1 งาน | ธง `busy` ในหน่วยความจำ (ตั้งก่อน `await` ใดๆ) + นับ `drafting` ใน DB → ซ้อนกัน 409 `DRAFT_BUSY` | `drafts.service.ts:57-60` · `drafts.store.ts:159-162` |
| คู่มือต้องใหม่ | `manualId` ชนคู่มือที่มีอยู่ → 409 `DRAFT_ID_CONFLICT` | `drafts.service.ts:61-63` |
| แยกข้อความ PDF | ด้วย `unpdf` ในหน่วยความจำ **ไม่เขียนดิสก์** · PDF ≤ 200 หน้า · เลือก ≤ 10 หน้า · หน้าละ ≤ 12,000 ตัวอักษร (เกิน = ปฏิเสธ ไม่ตัดเงียบ) · ข้อความรวม ≥ 50 ตัวอักษร (ไม่งั้นถือเป็นภาพสแกน ไม่ทำ OCR) | `pdf-text.ts:3-6`, `:67-109` |
| บันทึกร่าง | INSERT สถานะ `drafting` เก็บ **เฉพาะข้อความของหน้าที่เลือก** (ไม่เก็บ PDF) + โมเดล + เวอร์ชัน prompt | `drafts.service.ts:65-77` · `drafts.store.ts:117-125` |
| ตอบกลับ | `void this.runDrafting(id)` (ไม่รอ) → 202 `{ id, status:'drafting' }` | `drafts.service.ts:79-80` · `drafts.routes.ts:92-93` |

### 4.6.2 ร่างเบื้องหลัง (`runDrafting`)
| ขั้น | ทำอะไร | ไฟล์:บรรทัด |
|---|---|---|
| ไม่มี LLM | ไม่ได้ตั้ง `GROQ_API_KEY` + `AUTHORING_LLM_MODEL` → ร่างเป็น `failed` รหัส `LLM_NOT_CONFIGURED` | `drafts.service.ts:91-94` · `draft-llm.client.ts:137-140` |
| ทีละ 2 หน้า | แบ่งหน้าเป็นกลุ่มละ 2 (`PAGES_PER_LLM_CALL`) เรียก LLM ทีละกลุ่ม อัปเดต progress | `drafts.service.ts:19`, `:96-102` |
| คำสั่งถึง LLM | prompt ภาษาอังกฤษ: ใช้เฉพาะข้อมูลในหน้าที่ให้ · ห้ามเดา/เติมเอง · ทุกโหนดต้องมี `source_page` · ขั้นอันตรายต้องติด `safety_critical` พร้อมคำเตือน · ทุกเส้นทางต้องจบที่ resolution/escalation · ไม่รู้ว่าทำอะไรต่อให้จบด้วย escalation · ≤ 12 ผัง ≤ 40 โหนด/ผัง | `draft-llm.client.ts:33-62` |
| เรียก API | Groq · `temperature: 0` · `max_tokens` เริ่มต้น 6,000 · timeout เริ่มต้น 60 วินาที · ขอ `json_object` | `draft-llm.client.ts:7-8`, `:93-102` |
| parse เข้ม | **ไม่เชื่อ JSON mode** — ไม่ใช่ JSON/มีฟิลด์เกิน/ชนิดผิด/เกินเพดาน → **ปฏิเสธทั้งก้อน** (`DraftParseError` → ร่าง `failed` รหัส `LLM_PARSE_ERROR`) | `draft-schema.ts:136-174` · `drafts.service.ts:122-126` |
| ตั้งรหัสผัง | `graph_id = <manualId>_<slug>` (ซ้ำต่อท้าย `_2`, `_3`) — **เซิร์ฟเวอร์สร้างเอง** ไม่รับจาก LLM | `draft-schema.ts:204-212` · `drafts.service.ts:109` |
| ตรวจ | ประกอบเป็นรูปแบบคู่มือแล้วรัน `validateManual(manual, pages)` + เพิ่ม error `E_ID_CONFLICT` ถ้าชนผัง/คู่มือที่ใช้งานอยู่ → เก็บเป็น `ready` พร้อมรายงาน | `drafts.service.ts:109-112`, `:240-253` · `draft-manual.ts:18-47` |
| รีสตาร์ตกลางทาง | ตอนบูต ร่างที่ค้าง `drafting` ถูกเปลี่ยนเป็น `failed` (`INTERRUPTED`) | `drafts.service.ts:43-49` · `drafts.store.ts:164-171` |

### 4.6.3 ตัวตรวจผัง (validator) — "ผู้ตัดสิน"
- `validateManual(manual, pages)` (`graph-validator.ts:117-119`) ตรวจ **แบบร่างจาก LLM อย่างเดียว** (เข้ม: ทุกโหนดต้องมี `source_page` อยู่ในช่วงหน้า `:343-345`, ห้ามฟิลด์ที่ไม่มีแหล่งตรวจ เช่น `config`/`external_reference`/รูป/`author_note` — คอมเมนต์หัวไฟล์ `:12-15`) · **★ รอบ 2:** เดิมมีโหมดที่สองชื่อ `existing` (ตรวจผังที่ใช้งานอยู่) แต่ไม่มีโค้ดส่วนไหนเรียก จึงลบออกพร้อมพารามิเตอร์ `mode` — ผังที่ใช้งานอยู่ตรวจด้วย `scripts/validate_graph.py` แบบ offline ตามที่หัวไฟล์บอก
- **error = กัน publish · warning = ต้องรับทราบก่อน** (`acknowledgedWarnings`) — หัวไฟล์ `graph-validator.ts`
- ตัวอย่างกฎ error (ใน validator มี 29 รหัส `E_*` และ 5 รหัส `W_*` ตามที่นับจาก grep): ทางออกทุกเส้นต้องถึงโหนดจบ (`E_NO_TERMINAL` `:372`, `E_NO_EXIT` `:393`), โหนดที่เข้าไม่ถึง (`E_UNREACHABLE` `:392`), เส้นชี้ไปโหนดที่ไม่มี (`E_EDGE_TARGET_MISSING` `:366`), ตัวแปร `{{x}}` ต้องถูกกำหนดก่อนใช้ (`E_VAR_UNDEFINED`/`E_VAR_NOT_GUARANTEED` `:446-448`), `safety_critical` ต้องอยู่บน instruction และมี warning (`E_SAFETY_PLACEMENT`/`E_SAFETY_NO_WARNING` `:334-335`), `source_page` ต้องอยู่ในช่วงหน้าที่เลือก (`E_SOURCE_PAGE_OUTSIDE` `:345`)
- ตัวอย่าง warning: วนลูป (`W_CYCLE`), ไม่มี escalation (`W_NO_ESCALATION`), ข้อความพูดถึงอันตรายแต่ไม่ตั้ง `safety_critical` (`W_NODE_RISK` `:416-418`), หน้าต้นฉบับมีคำเตือนแต่ผังไม่มีด่านความปลอดภัยเลย (`W_PAGE_RISK` `:420-424`) — **คำเตือนเหล่านี้คือสิ่งที่ผู้ตรวจต้องอ่านก่อนกดเผยแพร่**
- เพดาน: ≤ 60 โหนด/ผัง, เส้นทางยาว ≤ 40, ข้อความ ≤ 2,000 (`graph-validator.ts:43-46`)
- ที่มา: พอร์ตจาก `scripts/validate_graph.py` มาเป็น TypeScript และทดสอบกับผังจริง 644 ผัง (คอมเมนต์หัวไฟล์) · **ไม่ทราบ** ว่ากฎทุกข้อตรงกับตัวตรวจใน `seed-graphs.js` หรือไม่ (ไม่ได้เทียบ)

### 4.6.4 ตรวจร่าง แก้ และปฏิเสธ (หน้าจอ admin)
| ขั้น | ทำอะไร | ไฟล์:บรรทัด |
|---|---|---|
| ติดตามความคืบหน้า | หน้าตรวจร่างถามสถานะทุก 3 วินาที **เฉพาะตอนยัง `drafting`** | `AdminDraftReviewPage.tsx:81-86` · `queries.ts:46-51` |
| ป้ายเตือน | "ร่างโดย AI · ยังไม่เผยแพร่ ผู้ใช้ทั่วไปมองไม่เห็น เนื้อหาอาจผิดจากคู่มือ" | `AdminDraftReviewPage.tsx:75-79` |
| ดูร่าง | รายงานการตรวจ + การ์ดต่อผัง (โหนดคู่กับข้อความหน้าต้นฉบับ) | `AdminDraftReviewPage.tsx:96-109` |
| แก้ | แก้ผังเป็น JSON แล้วกด "ตรวจใหม่" → `PUT /admin/drafts/:id` (เฉพาะ `ready`) → parse + **ตรวจใหม่ทุกครั้ง** ผลตรวจแก้เองไม่ได้ | `DraftJsonEditor.tsx` · `drafts.service.ts:159-175` · `drafts.store.ts:193-199` |
| ปฏิเสธ | จาก `ready` หรือ `failed` พร้อมเหตุผล ≤ 300 | `drafts.service.ts:177-182` · `drafts.store.ts:201-209` · `DraftActions.tsx:85-117` |

### 4.6.5 เผยแพร่ (publish) — ลำดับจริง และปิดข้อ "ไม่แน่ใจ" เรื่อง `PUBLISH_RELOAD_FAILED`
**ด่านฝั่งหน้าจอ (UX):** ต้องติ๊ก "ตรวจข้อความทุกโหนดเทียบหน้าต้นฉบับแล้ว" เสมอ และถ้ามีคำเตือนต้องติ๊กรับทราบ · ปุ่มปิดเมื่อมี error — `DraftActions.tsx:22-29`, `:58-82`

**ฝั่ง backend** (`DraftsService.publish`, `drafts.service.ts:193-223` + `DraftsStore.publish`, `drafts.store.ts:210-245`) — ลำดับตามโค้ด:
1. เปิด transaction + **ล็อกแถวร่าง** `SELECT … FOR UPDATE` (`drafts.store.ts:213-216`)
2. ร่างต้องเป็น `ready` ไม่งั้น 409 `DRAFT_NOT_READY` (`:221`)
3. callback `prepare` ทำ **ตรวจซ้ำกับข้อมูลที่ล็อกอยู่** (ไม่เชื่อรายงานเก่า): `parseDraftGraphs` ตรวจรูปร่างอีกครั้ง → ประกอบ → `validateManual(manual, pages)` (`drafts.service.ts:196-200`)
   - error ≥ 1 → 409 `DRAFT_INVALID` **ไม่มี override** (`:204`)
   - warning ≥ 1 และไม่ส่ง `acknowledgedWarnings: true` → 409 `DRAFT_WARNINGS_UNACKNOWLEDGED` (`:205`)
4. `assertNoConflicts`: `manual_id` หรือ `graph_id` ใดมีอยู่แล้ว → 409 `DRAFT_ID_CONFLICT` (`drafts.store.ts:221`, `:247-257`)
5. **INSERT** ลง `manuals` → `graphs` → `nodes` (ไม่มี `UPDATE`/`DELETE`/`ON DUPLICATE KEY UPDATE` กับผังเดิม) แล้ว UPDATE ร่างเป็น `published` ใน transaction เดียวกัน → `commit` (`:227-239`) · ถ้า DB ตอบ `ER_DUP_ENTRY` ระหว่างทาง → `rollback` + 409 (`:241-244`)
6. **หลัง commit** ตามลำดับ: `graphRepository.reload()` (`drafts.service.ts:208-209`) → ถ้า **ล้มเหลว**: log error แล้ว `throw publishReloadFailed()` = **500 `PUBLISH_RELOAD_FAILED`** (`:210-213`; ข้อความ `drafts.errors.ts`) → **ไม่ถึงบรรทัด `addGraphs`** → ถ้า **สำเร็จ**: `symptomSearch.addGraphs(graphIds)` เพิ่มเฉพาะข้อความของผังใหม่เข้าดัชนีค้นหา (`:215`) แล้วตอบ `{id, status:'published', graphIds, searchIndex:{indexed, reason?}}` (`:217-222`)

**✅ ปิดข้อ "ไม่แน่ใจ" ตามที่ขอ — เมื่อ reload ล้มเหลวเกิดอะไรขึ้น (อ่านจากโค้ด ไม่ได้ทดสอบกับ DB จริง):**
- ร่างถูก **commit เป็น `published` และผังเข้า DB แล้ว** (ขั้น 5 เสร็จก่อนขั้น 6) — ไม่มีการ rollback
- API ตอบ **500 `PUBLISH_RELOAD_FAILED`** (ไม่ใช่ 2xx) ทั้งที่ข้อมูลเผยแพร่ลง DB แล้ว · หน้าจอแสดง "เผยแพร่ลงฐานข้อมูลแล้ว แต่ระบบยังไม่โหลดแผนผังขั้นตอนใหม่ — รีสตาร์ตเซิร์ฟเวอร์เพื่อให้แผนผังใหม่ปรากฏ" (`frontend/src/lib/errors.ts:237-243`)
- **ผังใหม่ยังไม่ปรากฏ** ในหน่วยความจำ และ **ไม่ถูกเพิ่มเข้าดัชนีค้นหา** (เพราะ `addGraphs` อยู่หลัง reload) · ผังเดิมยังใช้ได้ เพราะ `GraphRepository` สร้างชุดใหม่ให้เสร็จก่อนค่อยสลับ ถ้า build ไม่ได้ของเดิมคงอยู่ (`graph.repository.ts:148-150`, `:179-182`)
- กด publish ซ้ำจะได้ 409 `DRAFT_NOT_READY` เพราะสถานะเป็น `published` แล้ว (`drafts.store.ts:218`) → ต้อง **รีสตาร์ต backend**: ตอนบูต `GraphRepository.load()` (เรียกที่ `app.ts:75`) โหลดผังทั้งหมดจาก DB (`graph.repository.ts:80-81`) และ `SymptomSearchService` สร้างดัชนีใหม่ทั้งหมด (`symptom-search.service.ts:46-54`) ผังใหม่จึงปรากฏทั้งในรายการและการค้น
- **ความกำกวมของคอมเมนต์:** `drafts.service.ts:191` เขียนว่า "ล้มเหลวไม่ทำให้ publish ที่สำเร็จแล้วกลายเป็นล้ม" — ใช้จริงกับ **ขั้นดัชนีค้นหา** เท่านั้น (`addGraphs` ไม่โยน error: `symptom-search.service.ts:112-158` คืน `{indexed:false, reason}`) ส่วน **reload ล้มเหลว API ยังตอบ 500** ตามข้างบน
- **ความเสี่ยงที่เกี่ยวเนื่อง (อ่านจากโค้ด ไม่ได้ทดสอบ):** คอมเมนต์ `graph.repository.ts:150` ระบุว่าตอนบูตถ้าข้อมูลเสียจน build ผังไม่ได้ จะ throw และแอปไม่ขึ้น → หน้าที่ของ validator + ตรวจซ้ำตอน publish คือกันไม่ให้ผังที่ build ไม่ได้เข้า DB (ด่านเหล่านี้ลดความเสี่ยงแต่ไม่ได้พิสูจน์ว่าเป็นศูนย์)

### 4.6.6 ผังที่ publish แล้วเหมือนผังเดิมแค่ไหน
ประกอบด้วย `assembleManual` (`source_chunk_id = draft:<draftId>:<graphId>`, `page_range` คำนวณจาก `source_page` ของโหนด) → `toDbRows` แปลงเป็นแถว `manuals/graphs/nodes` — `draft-manual.ts:14-47`, คอลัมน์ `:50-58` · หลัง publish ผู้ใช้เลือกผังนั้นได้จาก "อาการทั้งหมด" ทันที และค้นด้วยข้อความได้ (ถ้าดัชนีค้นหาเปิดและ reload สำเร็จ)

---

## 4.7 Error handling: `ApiError` + `errorHandler` ตัวเดียว

**สรุป:** จุดที่เกิดปัญหาโยน `ApiError(status, code, message)` แล้ว error ทุกตัวไปจบที่ **`errorHandler` ตัวเดียว** ใน `common/error-handler.ts` ซึ่งเป็น middleware ตัวสุดท้ายของแอป (`app.ts:97`) · ประวัติ: งาน simplify รวม filter 6 ตัวเป็นตัวเดียว (ส่วนที่ 5) แล้วตอนย้ายเป็น Express เปลี่ยนจาก filter ของ Nest เป็น error middleware ธรรมดา (§5.7) โดย body ที่ตอบออกไปเหมือนเดิมทุกไบต์

**Express ส่ง error มาถึง `errorHandler` ได้อย่างไร:** middleware ที่รับ **4 พารามิเตอร์** `(err, req, res, next)` Express ถือว่าเป็นตัวจัดการ error · เมื่อที่ไหนเรียก `next(err)` Express ข้ามไปหาตัวนี้ทันที · handler แบบ `async` ต้องห่อด้วย `asyncRoute` (`error-handler.ts:111-115`) เพราะ Express 4 ไม่จับ Promise ที่ล้มเอง ไม่ห่อ = คำขอค้าง ไม่มีคำตอบ

**ไล่ตามเส้นทางของ error ตัวหนึ่ง** (ตัวอย่าง: ผู้ใช้ส่ง action ผิดชนิด)
1. จุดที่เกิดปัญหาโยน error: ถ้าเป็น error ของแอป โยน `ApiError` พร้อม status+code+ข้อความเลย (เช่น `invalidRequestBody` → 400 `INVALID_ACTION` `traversal.dto.ts:10`) · `ApiError` คือคลาสที่เก็บ `status`, `code`, `message` — `common/api-error.ts:1-10`
2. error ของ **engine** (4 ชนิด) ยังเป็นคลาสธรรมดาที่ไม่รู้จัก HTTP (`types.ts:116-144`) errorHandler แปลงเองด้วยตาราง `ENGINE_ERRORS` — `error-handler.ts:38-43`
3. route ไม่ได้ `try/catch` เลย `asyncRoute` ส่งต่อด้วย `next(err)` · middleware ตรวจสิทธิ์ก็ส่ง 401/403 เป็น `ApiError` ผ่าน `next(...)` เหมือนกัน (`auth.middleware.ts:91-92`, `:98`, `:102`)
4. `errorHandler` ตัดสินตามลำดับ (`error-handler.ts:74-100`):
   1. JSON ผิดไวยากรณ์จาก body parser (`type === 'entity.parse.failed'`) หรือ path ถอดรหัสไม่ได้ (`URIError`) → 400 รูปแบบเดิมของ Nest `{message, error:'Bad Request', statusCode:400}` (`:82-86`)
   2. error ที่มี `statusCode` 400–599 ของมันเอง (เช่น 413 body ใหญ่เกิน / 415 จาก body parser) และไม่ใช่ `ApiError` → ตอบ `{statusCode, message}` ตาม status นั้น (`:89-92`, ตรวจด้วย `hasHttpStatus` `:49-60`)
   3. `toBody()` (`:62-72`): `ApiError` → ใช้ status/code/message ตามที่โยน · error ของ engine → ตาราง `ENGINE_ERRORS` · ที่เหลือ (บั๊ก, error ของ mysql2, ค่าที่ไม่ใช่ Error) → **500 `INTERNAL_ERROR`** เสมอ (`:71`)
5. response รูปแบบเดียว `{ statusCode, code, message }` (`:99`) · log stack เฉพาะ 5xx (`:96-98`)
6. path ที่ไม่มี route → `notFoundHandler` ตอบ 404 `{message:'Cannot GET /x', error:'Not Found', statusCode:404}` (`error-handler.ts:103-105`, ลงทะเบียน `app.ts:96` ก่อน errorHandler)
7. ฝั่งหน้าจอ: `api/http.ts:83-99` แปลง body เป็น `ApiError` ของ frontend (ถ้าไม่มี code ใช้ `UNKNOWN_ERROR`) → `describeError` **ตัดสินจาก `code` ไม่ใช้ `message`** แล้วเลือกข้อความไทยและวิธีกู้สถานการณ์ (`retry`, `reload-session`, `login` ฯลฯ) — `lib/errors.ts:6-15` · ข้อความอยู่ในตาราง `MESSAGES` (แถวละ code) `:43-243` · `describeError` `:245-273` · ไม่รู้จัก → `UNKNOWN_ERROR` `:247-249`, `:259-261`

**ข้อยกเว้นเดียว:** error ของ multer ตอนอัปโหลด PDF แปลงใน `uploadPdf()` ของ route นั้นเอง (`drafts.routes.ts:64-77`) → 413 `PDF_TOO_LARGE` / 400 `INVALID_DRAFT_REQUEST` เพราะต้องรู้ว่าเป็น error ของการอัปโหลดจึงจะใส่ `code` ให้ได้ ส่วน error แบบอื่นส่งต่อ `next(err)` ให้ errorHandler ตามปกติ

**หลักฐานว่าพฤติกรรมไม่เปลี่ยน:** (1) ตอนรวม filter (B3+C1): HTTP 120 กรณีตรง baseline 120/120 · error 35 ชนิดตรง 35/35 (2) ตอนย้ายเป็น Express: ชุด HTTP 120 กรณีเดิม + error 54 ชนิด (46 ชนิดเทียบได้ ตรง 46/46 · อีก 8 เป็น exception ของ Nest ที่ไม่มีแล้ว) รันทุกเฟส และรันกับ Express ล้วนตอนจบ — **สคริปต์ชุดนี้อยู่นอก repo (โฟลเดอร์ชั่วคราว) ใช้ DB จำลอง ไม่ได้ทดสอบกับ LLM จริง/เบราว์เซอร์** (ดู 5.5, 5.7)

**ข้อจำกัดที่ต้องรู้:**
- error 500 ส่ง `message` ของ error ภายในออกไปด้วย (`error-handler.ts:67`, `:71`) — เช่นข้อความจาก mysql2 อาจหลุดถึงผู้เรียก (สังเกตจากโค้ด เอกสาร `docs/study/READING_ROADMAP_v2.md` ก็บันทึกไว้เป็นความเสี่ยง R6) · คงไว้ตั้งใจตอนย้าย เพราะข้อตกลงคือ body ต้องเหมือนเดิม
- **ผู้แพ้ในการส่ง action ซ้อนกัน** ได้ 500 แทน 409 (ดูส่วนที่ 2 หัวข้อ 2.5) เพราะเป็น error ของ MySQL ที่ไม่ได้ห่อเป็น `ApiError`

---

## 4.8 จุดที่ต้องระวังตอนสอบ (ส่วนที่ 4)
1. **guest ไม่ใช่ผู้ใช้ที่ "ไม่ปลอดภัย" แต่ไม่ได้ยืนยันตัวตน** — ตัวระบุคือ UUID ในเบราว์เซอร์ ใครรู้ UUID เห็นประวัติของ guest นั้นได้ และ session ของ guest ใช้ session id เป็นกุญแจ (ผู้ล็อกอินบังคับ token)
2. **ไม่มีการย้ายประวัติ guest เข้าบัญชีหลังล็อกอิน** (ตั้งใจ: ไม่มี "claim") — ผู้ใช้จะเห็นประวัติใหม่ในบัญชีแยกจากที่เคยทำตอนเป็น guest
3. **ไม่มี rate limit ที่ login** (ค้นไม่พบ) และ token เก็บใน localStorage
4. **outcome ข้อความเก็บแต่ไม่มีเครื่องมือสรุป** — อย่าพูดว่ามีการวิเคราะห์ผลลัพธ์
5. **publish ไม่เขียนทับผังเดิม** (INSERT ล้วน + ปฏิเสธ id ชน) ผลคือ **แก้ผังเดิมผ่านระบบนี้ไม่ได้** ต้องเป็นคู่มือใหม่เท่านั้น (`drafts.dto.ts` หมายเหตุหัวฟังก์ชัน `parseUploadFields`, `drafts.service.ts:61-63`)
6. **`PUBLISH_RELOAD_FAILED` = 500 ทั้งที่ข้อมูลลง DB แล้ว** — ต้องรีสตาร์ต backend (ดู 4.6.5)
7. **LLM ไม่ได้ตรวจความถูกต้องกับคู่มือ** — validator ตรวจโครงสร้าง/กฎ/ช่วงหน้า/ตัวแปร/ด่านความปลอดภัยเชิงรูปแบบ **ไม่ได้ตรวจว่าข้อความตรงกับคู่มือ** ส่วนนั้นเป็นหน้าที่ของคนตรวจ (หน้าจอแสดงข้อความหน้าต้นฉบับคู่กัน และบังคับติ๊กยืนยันว่า "ตรวจเทียบแล้ว" — แต่ระบบพิสูจน์ไม่ได้ว่าตรวจจริง เหมือนด่าน safety)

---

## 📦 ถ้ากรรมการถามว่า... (ส่วนที่ 4)

**Q1. guest กับผู้ล็อกอินต่างกันอย่างไร?**
- guest: ไม่มี token ใช้งานได้เหมือนกัน (ค้นอาการ เดินผัง ดูประวัติ ให้ feedback บันทึกผลลัพธ์) ตัวระบุคือ UUID `X-Client-Id` จากเบราว์เซอร์ → ประวัติผูกกับเบราว์เซอร์นั้น ล้าง localStorage = ประวัติหาย (`clientId.ts:34-53`)
- ผู้ล็อกอิน: ส่ง Bearer token, session เก็บ `user_id` → ประวัติตามบัญชี ดูได้จากเครื่องอื่น (`HistoryPage.tsx` ข้อความ "เข้าสู่ระบบจากเครื่องอื่นก็เห็นประวัติเดียวกัน") และ session ของ user ต้องมี token ของเจ้าของจึงเข้าถึงได้ (`traversal.service.ts:138-143`)
- ฝั่ง admin: ต้องเป็น role `admin` เท่านั้น (สร้างได้ทางสคริปต์ seed) · ข้อจำกัด: ไม่มีการย้ายประวัติ guest → บัญชี และ guest ไม่ได้ยืนยันตัวตน

**Q2. ทำไมตอน publish ไม่เขียนทับผังเดิม?**
ตามที่บันทึกในโค้ด: `seed-graphs.js` เดิม **เขียนทับเงียบๆ** ส่วนระบบนี้ให้ id ชนของเดิม = **ปฏิเสธ ไม่แตะผังที่ใช้งานอยู่** และใช้ INSERT ล้วน (`drafts.store.ts:7-9`, ตรวจซ้ำ `:247-257`) · ผลคือผู้ใช้ที่กำลังเดินผังเดิมไม่ถูกกระทบ และ session/ประวัติที่อ้างผังเดิมไม่เพี้ยน (history มี replay ตรวจว่าผังยังพาไปจบโหนดเดิม `history.service.ts:160-162` แสดงว่าระบบกังวลเรื่องผังเปลี่ยน) · **เหตุผลเชิงนโยบายอื่นนอกจากที่เขียนในคอมเมนต์ — ไม่ทราบ** (ไม่มีเอกสารบอก) · ข้อแลกเปลี่ยน: แก้ผังเดิมผ่านระบบ authoring ไม่ได้

**Q3. ทำไมตรวจผัง "2 ด่าน"?**
ผมนับได้ **อย่างน้อย 3 ชั้น** ไม่ใช่ 2 — ถ้ากรรมการหมายถึง "ตรวจตอนร่าง กับตอนเผยแพร่": (1) ตอนร่าง/แก้: parse เข้ม (`draft-schema.ts`) + validator (`drafts.service.ts:110`, `:172`) ให้ผู้ตรวจเห็นรายงานล่วงหน้า (2) ตอนเผยแพร่: **ตรวจซ้ำกับข้อมูลที่ล็อกไว้ใน transaction** เพราะระหว่างนั้นร่างอาจถูกแก้ ผังที่ใช้งานอยู่อาจเปลี่ยน หรือข้อมูลใน DB ถูกแก้นอกระบบ (`drafts.service.ts:187-198` คอมเมนต์ "ไม่เชื่อรายงานที่เก็บไว้") (3) ชั้น DB: ตรวจ id ชนและ UNIQUE (`drafts.store.ts:247-257`, `:240`) · เหตุผลเชิงออกแบบที่ **มีหลักฐานในคอมเมนต์**: ไม่มีช่องว่างให้ร่างถูกแก้ระหว่างตรวจกับเขียน (`drafts.store.ts:7-8`) · ⚠️ ผมไม่ทราบว่าผู้พัฒนาตั้งใจนับเป็นกี่ด่าน ให้ตอบตามโค้ดที่ชี้ได้

**Q4. ทำไมต้องมีคนกดเผยแพร่ ให้ LLM เผยแพร่เองไม่ได้หรือ?**
ผังมีเนื้อหาความปลอดภัย LLM อาจผิดหรือข้ามคำเตือน (prompt เองเขียนว่า "you only DRAFT … a validator and a human reviewer check everything" `draft-llm.client.ts:33-34`) · validator ตรวจเชิงรูปแบบ **ไม่ตรวจว่าตรงคู่มือ** ต้องมีคนเทียบกับหน้าต้นฉบับ · ระบบจึงบังคับ: error = เผยแพร่ไม่ได้ (ไม่มี override), warning = ต้องรับทราบ, และ admin ติ๊กยืนยันว่าตรวจแล้ว · ข้อจำกัด: ระบบพิสูจน์ไม่ได้ว่าคนตรวจจริง

**Q5. ทำไมจัดการ error ที่จุดเดียว และแน่ใจได้อย่างไรว่าไม่พัง?**
เหตุผลที่บันทึกในงาน simplify: เดิมมี filter 6 ตัวที่คัดลอกโครงเดียวกัน และต้องจำว่า controller ไหนต้องติด `@UseFilters` ตัวไหน (ถ้าลืม 401/403 กลายเป็น 500 — `docs/auth/auth-step1.md` เดิมบันทึกไว้) ตอนนี้มี `errorHandler` ตัวเดียวท้ายแอป (`app.ts:97`, `error-handler.ts:74-100`) และ `ApiError` ให้ status+code อยู่ที่จุดที่เกิดปัญหา · ความมั่นใจมาจากการทดสอบเทียบ: HTTP 120 กรณี ตรง baseline 120/120 และ error 35 ชนิด ตรง 35/35 + unit ของ filter 27 กรณี (สคริปต์ชั่วคราวนอก repo) · ตอนย้ายเป็น Express รันชุดเดิมซ้ำอีกครั้ง: HTTP 120/120 และ error 46/46 ตรงกับตอนเป็น NestJS (§5.7) · **ไม่ได้ทดสอบ:** MySQL จริง, LLM จริง, เบราว์เซอร์ · ข้อแลกเปลี่ยน: error ภายในที่ไม่ใช่ `ApiError` (เช่น mysql2) กลายเป็น 500 ทุกกรณี

---

✅ ส่วนที่ 4 ยืนยันแล้ว

---

# ส่วนที่ 5 — สรุปงาน simplify: ลบอะไร รวมอะไร เก็บอะไร และตัวเลขก่อน-หลัง

> ที่มาของเหตุผล: ใช้เฉพาะที่คุยตกลงกันจริงในงานนี้ (ตอบคำถามท้าย `docs/SIMPLIFY_REPORT.md` และการยืนยันทีละกลุ่ม) · ข้อที่ไม่มีเหตุผลเพิ่มเติมที่คุยกัน เขียนว่า "ไม่ได้ให้เหตุผลเพิ่ม" และใส่ข้อพิจารณาจากรายงาน Phase 1 แยกป้ายไว้
> ตัวเลขทั้งหมดนับใหม่จากโค้ดจริงด้วยคำสั่งในหัวข้อ 5.1 ไม่ใช้ตัวเลขใน SIMPLIFY_REPORT Phase 0
> ⚠️ **5.1–5.6 เขียนตอน backend ยังเป็น NestJS** — ชื่อ `*.module.ts`, `*.controller.ts`, `AllExceptionsFilter`, `APP_FILTER`, `UploadErrorsFilter`, `nest build` ในหัวข้อเหล่านี้คือไฟล์/คำสั่ง **ที่ถูกลบไปแล้ว** เก็บไว้เป็นประวัติ · โค้ดปัจจุบันดู 5.7 และส่วนที่ 1

## 5.1 ตัวเลขก่อน-หลัง (นับใหม่)

**วิธีนับ:** ทุกไฟล์ใต้ `backend/src` และ `frontend/src` นับด้วยจำนวนขึ้นบรรทัดใหม่ (`wc -l` รวมคอมเมนต์และบรรทัดว่าง) · **"ก่อน" = commit ล่าสุดใน git คือ `142ea2d` (17 ต.ค. 2569) นับด้วย `git ls-tree` + `git show` ซึ่งใครก็ตรวจซ้ำได้** · **"หลัง" = ไฟล์บนดิสก์ตอนนี้**

| ส่วน | ก่อน (HEAD `142ea2d`) | หลัง (ตอนนี้) | เปลี่ยน |
|---|---|---|---|
| `backend/src` | 64 ไฟล์ / 7,831 บรรทัด | 59 ไฟล์ / 6,751 บรรทัด | **−5 ไฟล์ · −1,080 บรรทัด (−13.8%)** |
| `frontend/src` | 95 ไฟล์ / 7,167 บรรทัด | 87 ไฟล์ / 6,553 บรรทัด | **−8 ไฟล์ · −614 บรรทัด (−8.6%)** |
| **รวม 2 ส่วนที่ต้องอธิบายตอนสอบ** | **159 ไฟล์ / 14,998 บรรทัด** | **146 ไฟล์ / 13,304 บรรทัด** | **−13 ไฟล์ · −1,694 บรรทัด (−11.3%)** (หลังรอบ 2 · ก่อนรอบ 2 เป็น 144 ไฟล์ / 13,467 บรรทัด) |

**ข้อควรระวังเรื่องตัวเลข (อ่านก่อนอ้างกับกรรมการ):**
1. **ตัวเลขใน `SIMPLIFY_REPORT.md` ส่วน Phase 0 (backend 64/7,453 · frontend 95/7,097) ไม่ตรงกับการนับ HEAD ตอนนี้** (7,831 / 7,167) ผม **ไม่ทราบสาเหตุที่แน่ชัด** (สันนิษฐานว่าตอนนับ Phase 0 บนดิสก์มีการแก้ที่ยังไม่ commit อยู่แล้ว เช่น การปรับ `graph-validator.ts`) จึงใช้ HEAD เป็น "ก่อน" เพราะตรวจซ้ำได้ด้วย git
2. **ส่วนต่างรวมสิ่งที่ทำก่อนเริ่ม Phase 2 ด้วย:** `graph-validator.ts` 583 → 503 บรรทัด (−80: −55 ถูกปรับก่อนงาน simplify และ −25 จากรอบ 2 ที่ลบโหมด `existing` — ตรวจด้วยสคริปต์เทียบผลทั้งสองครั้ง) และอยู่ใน −1,080 ของ backend · ผมแยกไม่ได้ว่าส่วนต่างที่เหลือมาจากกลุ่มไหนกี่บรรทัดอย่างละเอียด เพราะ **ยังไม่มีการ commit แยกกลุ่ม** (git ทั้งหมดยังเป็น uncommitted เทียบกับ HEAD)
3. ช่วงที่วัดเฉพาะกลุ่มได้ชัด: **B3+C1** — `backend/src` 62 ไฟล์ / 7,135 บรรทัด → 58 ไฟล์ / 6,789 บรรทัด (−4 ไฟล์ · −346 บรรทัด) วัดด้วยสำเนาสำรองก่อนเริ่มกลุ่มนี้
4. จำนวนบรรทัดที่เพิ่ม/ลดขึ้นกับสไตล์ (คอมเมนต์ไทยจำนวนมากคงไว้) จึงเป็นตัวชี้วัด "ปริมาณที่ต้องอ่าน" ไม่ใช่ความซับซ้อนทางตรรกะโดยตรง

### ไฟล์ที่ถูกลบ / เพิ่ม (เทียบ HEAD) — นับบรรทัดจาก HEAD
| ไฟล์ที่ถูกลบ | บรรทัดเดิม | กลุ่ม |
|---|---|---|
| backend: exception filter 6 ไฟล์ (`traversal` 141, `auth` 81, `drafts` 70, `symptom-search` 61, `history` 49, `admin` 38) | 440 | B3+C1 |
| backend: `embedding/embedding.module.ts` 9 · `health/health.module.ts` 6 | 15 | B4 |
| frontend: `components/history/HistoryFilters.tsx` 146 · `lib/historyParams.ts` 73 | 219 | D3 |
| frontend: `lib/search.ts` 43 · `lib/feedback.ts` 44 · `lib/reference.ts` 13 · `components/step/stepProps.ts` 7 · `step/CheckpointStep.tsx` 19 · `step/InstructionStep.tsx` 14 | 140 | B6 |
| frontend: `components/SessionErrorNotice.tsx` 37 · `components/SymptomsErrorNotice.tsx` 33 · `components/history/HistoryErrorNotice.tsx` 50 | 120 | B5 |

| ไฟล์ที่เพิ่ม | บรรทัด | กลุ่ม |
|---|---|---|
| `backend/src/common/api-error.ts` + `all-exceptions.filter.ts` | 135 | B3+C1 |
| `frontend/src/lib/textInput.ts` (รวมตรวจข้อความค้นหา + feedback) | 86 | B6 |
| `frontend/src/components/ErrorNotice.tsx` (กล่อง error ตัวเดียว) | 63 | B5 (รอบ 2 เพิ่ม `children` ให้ใส่ลิงก์ต่อท้ายได้) |
| (ไม่นับใน src) `backend/scripts/study-measure.js` สคริปต์วัดสำหรับเอกสารเตรียมสอบ | — | งานเอกสาร ไม่ใช่ simplify |

### ไฟล์ที่ลดบรรทัดมากสุด (HEAD → ตอนนี้, ผมจัดกลุ่มตามเนื้อหาที่เปลี่ยน)
| ไฟล์ | HEAD | ตอนนี้ | เกี่ยวกับกลุ่ม |
|---|---|---|---|
| `history/history.dto.ts` | 271 | 189 | D3 (ตัดตัวกรอง/facets) + B3+C1 |
| `history/history.service.ts` | 336 | 260 | D3 + B3+C1 |
| `admin/admin.store.ts` | 320 | 226 | B1 (ลบ `/admin/sessions`) |
| `admin/admin.dto.ts` | 284 | 231 | B1 |
| `admin/admin.service.ts` | 189 | 137 | B1 + A4 |
| `authoring/graph-validator.ts` | 583 | 503 | ปรับโครงสร้างก่อน Phase 2 (ไม่ใช่กลุ่มใน simplify) + ลบโหมด `existing` (รอบ 2) |
| `lib/draftView.ts` (frontend) | 261 | 222 | A2 + ส่วนอื่น (ไม่ได้แยก) |
| `lib/clientId.ts` (frontend) | 70 | 53 | C4 |
| `components/step/StepView.tsx` (frontend) | 34 | 71 | **เพิ่มขึ้น** เพราะรวม CheckpointStep/InstructionStep เข้ามา (B6) |

> ตัวเลขรายไฟล์มาจาก `git diff --numstat` / `wc -l` เทียบ HEAD · **การระบุกลุ่มเป็นการอนุมานจากเนื้อไฟล์** ไม่ใช่ตัวเลขที่บันทึกแยกกลุ่มไว้

## 5.2 ตารางสรุป

### (ก) ทำแล้ว
| รหัส | ทำอะไร | เหตุผลที่คุยกัน | พฤติกรรมเปลี่ยนไหม |
|---|---|---|---|
| **A** (A1–A6) | ลบโค้ดที่ไม่มีใครเรียก (`resetAuthStorageForTests`, `manualIssues`, field `nowEpoch`) · แก้คอมเมนต์ที่อ้างเทสต์ที่ถูกลบแล้ว · เอา `export` ออกจากค่าที่ใช้แค่ในไฟล์ตัวเอง · **ถอด dependency `ts-node`** | เป็นโค้ดตกค้างจากเทสต์ที่ลบไปแล้ว/ไม่มีผู้ใช้ (ตามรายงาน Phase 1 ที่ยืนยันด้วย grep) · คุณอนุมัติให้ถอด `ts-node` ตอนตอบคำถามท้ายรายงาน | ไม่เปลี่ยน (ตรวจจาก build + tsc) |
| **C3** | ลบฟังก์ชัน `restartVariables` ที่คืนค่าที่รับมาตรงๆ แล้วเขียน object ตรงจุดเรียก | ฟังก์ชันว่างเปล่า (รายงาน Phase 1) | ไม่เปลี่ยน |
| **C4** | `clientId.ts` เลิกประกอบ UUID เองเมื่อไม่มี `crypto.randomUUID` ใช้ `crypto.randomUUID()` อย่างเดียว | รายงาน Phase 1: GitHub Pages เป็น https และ localhost เป็น secure context ทั้งคู่ | **เปลี่ยนเล็กน้อย:** เบราว์เซอร์เก่ามากที่ไม่มี `randomUUID` สร้าง client id ไม่ได้ (ดู 5.3) |
| **B4** | ลบโมดูลห่อของชิ้นเดียว: ย้าย `EmbeddingService` เป็น provider ของ `SymptomSearchModule` · ย้าย `HealthController` เข้า `AppModule` | โมดูลที่ห่อ provider/controller ตัวเดียว (รายงาน Phase 1) · ตรวจ DI ด้วยการบูตจริงโดยผู้พัฒนา (คุณแจ้งว่าจะ boot เอง) | ไม่เปลี่ยน |
| **B6** | รวมไฟล์เล็กที่ซ้ำแพตเทิร์น: `search.ts` + `feedback.ts` → `textInput.ts` · `CheckpointStep`/`InstructionStep` → `StepView.tsx` · `formatSourceLine` → `ReferenceLine.tsx` · ลบ `stepProps.ts` | แพตเทิร์นเดียวกัน (normalize → check → counter) และไฟล์สั้นมาก (รายงาน Phase 1) | ไม่เปลี่ยน · หมายเหตุ: `lib/outcome.ts` **ยังอยู่แยก** ไม่ได้รวมเข้า `textInput.ts` |
| **B7** | ให้ `DEVICE_CATEGORIES`/`OUTCOME_KINDS` เหลือชุดเดียวใน `graph-validator.ts` (ที่ `drafts.dto.ts` import ไปใช้) — สำเนาที่ซ้ำใน `history.dto.ts` ไม่มีแล้ว (ที่ HEAD อยู่ `history.dto.ts:28`, `:37` ใช้ตรวจตัวกรองซึ่งหายไปพร้อม D3) | ค่าซ้ำ 2 ที่ใน backend (รายงาน Phase 1) | ไม่เปลี่ยน |
| **B1** | ลบ `GET /admin/sessions` ทั้ง controller, service, store, dto + อัปเดต `docs/auth/auth-step3.md` | frontend ไม่เรียกเลย ไม่มีหน้าใช้ (รายงาน Phase 1) · คุณยืนยัน "ไปกลุ่มถัดไป: B1" | **เปลี่ยน:** endpoint นี้ตอบ 404 (ดู 5.3) |
| **D3** | ตัดตัวกรอง/ค้นหา/เรียง/facets ของหน้าประวัติ เหลือ "ใหม่สุดก่อน + แบ่งหน้า" ทั้ง backend และ frontend | คุณเลือกตัด D3 ตอนตอบ "ฟีเจอร์ D ที่ตัด" (invariant ต้องการแค่ list + detail) | **เปลี่ยน:** ดู 5.3 · ไม่แตะ `/history/:id` และ feedback ตามข้อกำหนด |
| **B5** | รวมกล่อง error 3 แบบ (`SessionErrorNotice`/`SymptomsErrorNotice`/`HistoryErrorNotice`) เป็น `components/ErrorNotice.tsx` ตัวเดียวที่ใช้ `describeError` · แก้ผู้ใช้ 15 ไฟล์ (หน้า/ฟอร์ม) | คุณสั่งให้ทำ ("ผมลืมใส่ในรายการเลือก แต่ตั้งใจให้ทำ") และ **ยอมรับให้ข้อความ error เป็นภาษาไทย** (คำตอบข้อ 6 ท้ายรายงาน) · เหตุผลเชิงโค้ดจากรายงาน Phase 1: กล่อง error 3 แบบซ้ำกัน และ `SymptomsErrorNotice` โชว์ "HTTP 500" ดิบแทนข้อความไทยจาก `describeError` | **เปลี่ยน:** ดู 5.3 ข้อ 5 |
| **B3+C1** | รวม exception filter 6 ตัวเป็น `AllExceptionsFilter` ตัวเดียว (`APP_FILTER`) และเปลี่ยนคลาส error ~34 คลาสเป็น `ApiError(status, code, message)` ที่จุดโยน · error ของ traversal-engine ยังไม่รู้จัก HTTP · เหลือ filter เล็กเฉพาะ `POST /admin/drafts` สำหรับ multer | เดิม filter ส่งต่อกันเป็นทอด และถ้าลืม `@UseFilters` ที่ controller ใด 401/403 จะกลายเป็น 500 (รายงาน Phase 1 + `docs/auth/auth-step1.md` เดิม) · รวมแล้วมีที่เดียวที่บอกว่า error ไหน = รหัสไหน · เงื่อนไขที่คุณตั้งคือ **ต้องคงรหัส/สถานะ/ข้อความเดิมทุกตัว** | **ไม่เปลี่ยน** ตามที่ตรวจ (120 กรณี / 35 ชนิด — ดู 5.5) |

### (ข) เก็บไว้ตั้งใจ
| รหัส | เก็บอะไร | เหตุผลที่คุยกัน |
|---|---|---|
| **D1** rephrase | โค้ด `rephrase/*`, `displayText`, `RephraseNote` | **TOR กำหนดไว้** — คุณสั่ง "เก็บ ห้ามลบโค้ด rephrase" · คุณให้คืน `REPHRASE_ENABLED: "true"` ใน `render.yaml` (ไฟล์ไม่ต่างจาก HEAD) และให้บอกว่าบน Render ต้องตั้ง `GROQ_API_KEY` / `GROQ_MODEL` / `JWT_SECRET` |
| **D4** outcome (ข้อความที่ผู้ใช้พิมพ์หลังจบ) | endpoint, `OutcomeForm`, error 3 ชนิด, ข้อมูลใน DB | **ตัวเลือก A: เก็บทั้งหมด ไม่แก้อะไรของ D4** เพราะเป็นข้อกำหนดตาม TOR (คุณจะเช็ก TOR ฉบับจริงเอง; ผมไม่ได้อ่าน TOR) · ข้อความ/รหัส/สถานะของ `INVALID_OUTCOME`, `SESSION_NOT_COMPLETED`, `OUTCOME_ALREADY_SUBMITTED` ต้องไม่เปลี่ยน (ตรวจแล้วใน 5.5) |
| **D5** โหมด "ไม่ทราบรุ่น" + `model_selection` | เก็บไว้ | คุณตัดสิน "เก็บ D5, D6, D7" — **ไม่ได้ให้เหตุผลเพิ่ม** · (ข้อพิจารณาจากรายงาน Phase 1 ไม่ใช่เหตุผลที่คุณระบุ: ไว้แยกเคสตอนวัดผล) |
| **D6** แผงอุปกรณ์ที่ต้องใช้ (equipment) | เก็บไว้ | เช่นเดียวกัน — คุณตัดสินเก็บ **ไม่ได้ให้เหตุผลเพิ่ม** (ข้อพิจารณาในรายงาน: เป็นข้อมูลประกอบ ไม่เกี่ยวกับการเดินขั้นตอน) |
| **D7 / B2** `GET /symptom-search/status` | เก็บไว้ | คุณตัดสินเก็บ D7 — **ไม่ได้ให้เหตุผลเพิ่ม** (รายงานระบุว่ามีไว้ดูความคืบหน้า/หน่วยความจำบน Render) |
| **C2** อ่านประวัติ session ทุกครั้ง · **C5** แคช `identity` + `clear()` สองชั้น · **C6** `AuthProvider` locationRef/state (ขอบเขตเดิมของรอบ 1) | ไม่ทำ (รอบ 1) | คุณสั่ง "ข้าม" — **ไม่ได้ให้เหตุผลเพิ่ม** · รายงาน Phase 1 ประเมินความเสี่ยงระดับกลาง และจัดไว้เป็น "ถ้ายังมีเวลา" · ในรอบ 2 (F7) แก้เฉพาะ error ของ eslint ที่ `AuthProvider.tsx` โดยย้ายการอัปเดต ref ไปไว้ใน `useEffect` โครงสร้าง locationRef ไม่ถูกรื้อ (ดู 5.6) |
| **C7** เปลี่ยนการคำนวณวันเวลาไทยไปให้ MySQL ทำ · **C8** `replayReaches` ในหน้าประวัติ | ไม่ทำ | คุณสั่ง "ข้าม" · รายงาน Phase 1: **ไม่แนะนำก่อนสอบ** — C7 เสี่ยงให้ตัวเลขสถิติเลื่อนวัน (ยังไม่ได้ตรวจว่า MySQL บน Aiven เก็บเวลาเป็น UTC หรือไม่), C8 เสี่ยงโชว์ขั้นตอนเก่าคู่ผลใหม่ที่ไม่ตรงกัน |
| **B9** `jest`/`vitest` | เก็บ dependency และ `jest.config.js` | ตามข้อตกลงเดิมของโปรเจกต์ (ห้ามถอด jest/vitest) — ทั้งที่ ไม่มีไฟล์เทสต์ |

### (ค) ยังค้าง / ยังไม่ได้ทำ
| รหัส | สถานะ | รายละเอียด |
|---|---|---|
| **B8** `draft/`, `check/`, `scripts/old/` | **ค้าง** | คุณจะ **ย้ายออกนอก repo เอง (ไม่ลบ)** แล้วให้ผมลบออกจาก git + อัปเดต `.gitignore` — ยังไม่ได้ทำ รอคำสั่ง · ข้อสังเกต: `git status` ตอนนี้มี `data/check/` ที่ยังไม่ track ซึ่ง **ผมไม่ได้สร้าง** (⚠️ ไม่แน่ใจว่าคุณคัดลอกมาไว้หรือไม่) |

## 5.3 พฤติกรรมที่เปลี่ยนไปที่ผู้ใช้เห็นได้ (ครบตามโค้ดที่เปรียบเทียบกับ HEAD)
1. **หน้าประวัติการซ่อมไม่มีตัวกรองแล้ว (D3):** ตัดช่องค้นหา ตัวกรองประเภทเครื่อง/ยี่ห้อ/ผลลัพธ์ และการเรียง · เหลือ "ใหม่สุดก่อน + แบ่งหน้า"
   - API `GET /history` รับเฉพาะ `page`, `pageSize` (`history.dto.ts:63-73`) · พารามิเตอร์ที่ frontend เคยส่งและตอนนี้ **ถูกทิ้ง:** `q`, `category`, `brand`, `status`, `sort` (HEAD: `HistoryQuery` ที่ `history.dto.ts:64-72`) · ลิงก์เก่าที่มี `?status=…` เปิดได้ แต่ถูกเมินเป็นรายการปกติ (ไม่ได้ 400 — โค้ดอ่านแค่ 2 ฟิลด์)
   - response ไม่มี `facets` แล้ว (เดิมคือรายการประเภทเครื่อง/ยี่ห้อที่ใช้ทำตัวเลือกตัวกรอง)
   - ข้อความ error ของหน้านี้เปลี่ยน: `INVALID_HISTORY_QUERY` เดิม "ตัวกรองประวัติไม่ถูกต้อง / ล้างตัวกรองแล้วลองอีกครั้ง" → ตอนนี้ "ขอหน้าประวัติไม่ถูกต้อง / กลับไปหน้าแรกของประวัติแล้วลองอีกครั้ง" (`lib/errors.ts`)
2. **`GET /admin/sessions` ไม่มีแล้ว (B1):** เรียกแล้วได้ 404 แบบมาตรฐานของ Nest (ไม่มี route — ตอนนี้ `notFoundHandler` ใน `error-handler.ts:103-105` ตอบรูปแบบเดียวกัน) — frontend ไม่เคยเรียก จึงไม่มีผลต่อหน้าจอ แต่ใครที่เรียกด้วยมือ/เอกสารเก่าจะเจอ 404 (`docs/auth/auth-step3.md` อัปเดตแล้ว)
3. **เบราว์เซอร์เก่ามากที่ไม่มี `crypto.randomUUID`** สร้าง `X-Client-Id` ไม่ได้ (C4) — กระทบเฉพาะเบราว์เซอร์เก่ามากหรือหน้าที่ไม่ใช่ secure context (ไม่ใช่ https/localhost) · ⚠️ ผมไม่ได้ทดสอบกับเบราว์เซอร์เก่าจริง
4. **ไม่เปลี่ยน (ตรวจแล้ว):** รหัส/สถานะ/ข้อความของ error ที่ API ส่งออก (B3+C1)
5. **กล่องแจ้ง error รวมเป็นตัวเดียว (B5)** — ข้อความที่ผู้ใช้เห็นเปลี่ยนตรงนี้ (เทียบ HEAD กับโค้ดตอนนี้; ไม่ได้ดูด้วยตาในเบราว์เซอร์):
   - **หน้ารายการเครื่อง / อาการทั้งหมด / เลือกอาการ (ตอนโหลดรายการหรือเริ่ม session ไม่สำเร็จ):** เดิม error ที่ไม่ใช่เครือข่ายแสดงทุกกรณีว่า "เกิดข้อผิดพลาด — เซิร์ฟเวอร์ตอบกลับผิดปกติ (HTTP 500)" · **ตอนนี้แสดงข้อความไทยตามรหัส error** จาก `describeError` เช่น `GRAPH_MANUAL_MISMATCH` → "อาการนี้ไม่ใช่ของรุ่นที่เลือก", รหัสที่ไม่รู้จัก → "เกิดข้อผิดพลาดที่ระบบไม่รู้จัก ลองอีกครั้ง…" (`lib/errors.ts:36-40`, `:71-75`)
   - **ปัญหาเครือข่าย:** เดิม "ตรวจการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง" → ตอนนี้ข้อความยาวขึ้นเป็น "…ถ้าเพิ่งเปิดเว็บ เซิร์ฟเวอร์อาจใช้เวลาเริ่มทำงานสักครู่" (`lib/errors.ts:44-48`)
   - **ปุ่ม "ลองอีกครั้ง" ของรายการ:** เดิมขึ้นทุก error ที่โหลดรายการไม่ได้ · ตอนนี้ขึ้นเฉพาะ error ที่ `describeError` ระบุว่าลองซ้ำได้ (`recovery = retry`) · error ที่ต้องเลือกอาการใหม่ จะเป็นลิงก์ "เลือกอาการใหม่" แทน
   - **หน้าเดินผัง (SessionPage):** ปุ่ม "เลือกอาการใหม่" (เมื่อ session หาย/ผังไม่ตรงรุ่น) เดิมเป็น **ปุ่ม** ไป `/symptoms` (ซึ่งเด้งไป `/devices` ถ้าไม่มีรุ่นใน URL) → ตอนนี้เป็น **ลิงก์** ไป `/symptoms/all` · ข้อความอื่นและป้าย "ดึงขั้นตอนล่าสุด" เหมือนเดิม
   - **ทุกจุดที่เคยใช้กล่องของหน้าประวัติ/admin:** ข้อความและปุ่มเหมือนเดิม (ใช้โค้ดชุดเดียวกัน)
   - **การเข้าถึง:** กล่องใหม่ห่อด้วย `role="alert"` ทุกจุด (เดิมมีเฉพาะกล่องของหน้าประวัติ/admin)
   - **รหัสเทคนิค "รหัส: …"** จะโผล่ในกล่องของหน้ารายการอาการด้วย เมื่อ error นั้นมีรหัสให้แสดง (เดิมมีเฉพาะหน้าเดินผัง/ประวัติ)
   - ข้อความไทยอื่นที่เปลี่ยนจากงานนี้: ข้อ 1 (error ของหน้าประวัติ)

## 5.4 ผลต่อความเข้าใจโค้ด (สำหรับตอบกรรมการ)
- เพิ่ม error ใหม่ตอนนี้แก้ที่ **2 ที่** (จุดโยน `ApiError` + ข้อความใน `lib/errors.ts` ฝั่งหน้าจอ) จากเดิม 3 ที่ (คลาส error, filter, หน้าจอ) — ตามที่ประเมินไว้ในรายงาน Phase 1 (C1)
- ไม่มี filter ที่ต้องจำว่า controller ไหนติดตัวไหน (ตอนนั้น `APP_FILTER` ตัวเดียว · ตอนนี้ `errorHandler` ตัวเดียวที่ `app.ts:97`)
- ขนาดโค้ดที่ต้องอ่านลดลง ~11.3% ของ `backend/src` + `frontend/src` (13 ไฟล์สุทธิ หลังรอบ 2) — ไม่ได้ลดฟีเจอร์ที่เป็นแกนหลัก (เดินผัง, ค้นอาการ, auth, ประวัติ, feedback, admin authoring)

## 5.5 วิธีตรวจที่ใช้ และที่ไม่ได้ทดสอบ

### ที่ตรวจแล้ว
| วิธี | ครอบคลุมอะไร | ผล |
|---|---|---|
| **ชั้น 2: 120 กรณี HTTP** — บูต `AppModule` ที่ build แล้วด้วย "ฐานข้อมูลจำลองในหน่วยความจำ" (แทน `createPool` ของ mysql2) ยิงคำขอจริงทั้งกรณีปกติและกรณีผิดพลาด (เช่น 400, 401, 403, 404, 409, 413, 415) รวม 11 กรณีอัปโหลด PDF (multer) บันทึก status+code+body เป็น baseline **ก่อนแก้** แล้วเทียบ **หลังจบแต่ละโมดูล** | พฤติกรรม error ของ API ทั้งหมดที่เข้าถึงได้โดยไม่ต้องมี MySQL/LLM จริง | **120/120 เหมือน baseline** ณ จบงาน |
| **ชั้น 1: 35 ชนิด error** — ส่ง error จากโค้ดจริงผ่าน filter กลาง เทียบกับผลของ filter เดิมที่เป็นเจ้าของ error นั้น (58 ชนิดในรายการ) | การแปลง error → status/code/message | **ตรง 35/35** (อีก 23 ชนิด: 14 ตัวเป็นฟังก์ชันสร้างแบบ private เข้าถึงจากสคริปต์ไม่ได้ จึงตรวจข้อความด้วย grep เทียบซอร์สเดิม และ status/code ด้วยการอ่านโค้ด + ครอบด้วยชั้น 2 · 9 ตัวเป็น error ของ Nest ที่ filter กลาง "ส่งต่อให้ Nest ตอบเอง" หรือเป็น error ภายในที่ไม่ออก HTTP) |
| **unit ของ filter กลาง 27 กรณี** (เช่น `ApiError` ต้องชนะ error ที่มี `statusCode` ปน, error 413 จาก body-parser ต้องส่งต่อให้ Nest) | ลำดับตัดสินใน `toBody()` | 27/27 |
| `tsc --noEmit` + `nest build` ของ backend | ชนิดข้อมูล/คอมไพล์ | ✅ ผ่าน (รันซ้ำตอนเขียนส่วนนี้) |
| frontend: `npm run build` (tsc -b + vite) | ชนิดข้อมูล/คอมไพล์ | ✅ ผ่าน (รันซ้ำตอนเขียนส่วนนี้) |
| frontend: `npx eslint .` | lint | ✅ **สะอาด** — error เดิม (`AuthProvider.tsx` react-hooks/refs) ถูกแก้ในรอบ 2 (F7) โดยย้ายการอัปเดต ref ไปไว้ใน `useEffect` (`AuthProvider.tsx:30-36`) |
| สคริปต์เทียบผลเฉพาะจุด | ก่อนหน้านี้ใช้เทียบ `graph-validator.ts` (583 → 503 บรรทัด) และหน้าประวัติ (D3) | ตามที่รายงานในแต่ละรอบ |

### ที่ไม่ได้ทดสอบ (ต้องบอกกรรมการตรงๆ)
- **ไม่มีเทสต์อัตโนมัติใน repo เลย** (ทั้ง backend และ frontend) — ค้นไม่พบ `*.spec.*`/`*.test.*` · ตัวเลข 120/35/27 มาจาก **สคริปต์ชั่วคราวที่อยู่นอก repo** (โฟลเดอร์ชั่วคราวของเซสชัน) จึงไม่ได้ติดไปกับ repo ที่ส่ง
- **ไม่ได้ทดสอบกับ MySQL จริง** — ชั้น 2 ใช้ฐานข้อมูลจำลอง จึงไม่ครอบคลุม: SQL จริง, transaction/rollback, constraint (เช่น UNIQUE), ความต่างของ collation/เขตเวลา
- **ไม่ได้ทดสอบกับ LLM จริง** (Groq) ทั้ง rephrase และการร่างผังจาก PDF · **ไม่ได้ทดสอบ publish จริง** (เขียนลง DB + reload ผัง + เพิ่มดัชนี)
- **ไม่ได้ทดสอบในเบราว์เซอร์จริง** — ไม่ได้เปิดดูหน้าจอ D3 (หน้าประวัติ) หรือ flow ใดด้วยตา; `eslint` + `tsc` ตรวจได้แค่โค้ด · คุณแจ้งว่าจะทดสอบหน้าประวัติและบูต backend เอง
- **ไม่ได้ทดสอบบน Render/Aiven** (เวลาบูต โหลดโมเดล CORS ฯลฯ)
- error ที่เกิดจากข้อมูลเสียในฐานข้อมูล (เช่น ผังที่ build ไม่ได้) ไม่อยู่ในชุดทดสอบ
- ไม่ได้เทียบ **ข้อความ error ภาษาไทยฝั่งหน้าจอ** ก่อน/หลังแบบอัตโนมัติ (ชุดเทียบทำที่ response ของ API) · **หน้าจอของ B5 ผ่านเพียง `tsc`/`vite build`/`eslint` ยังไม่ได้เปิดดูด้วยตา**

### สิ่งที่ git ต้องรู้ก่อนคุณ commit (ข้อเท็จจริงจาก `git status`)
- ยังไม่มี commit ของงาน simplify เลย (`HEAD` ยังเป็น `142ea2d` 17 ต.ค.) — ไฟล์ที่เปลี่ยนใต้ `backend/` และ `frontend/` ทั้งหมดเป็น uncommitted
- `backend/migrations/006,007,008,009,012` ต่างจาก HEAD **เฉพาะบรรทัดคอมเมนต์** (แก้ path เอกสารหลังจัดโฟลเดอร์ `docs/`) **ไม่มีการแก้ DDL** (ตรวจด้วย `git diff`) · `backend/package.json` ต่างจาก HEAD เพียงถอด `ts-node` 1 บรรทัด (และ `package-lock.json` เปลี่ยนตาม)
- มีคำเตือนเรื่องปลายบรรทัด (LF/CRLF) จาก git เท่านั้น ไม่ใช่ปัญหาของโค้ด

## 5.6 simplify รอบที่ 2 (ลดโค้ดซ้ำ โดยพฤติกรรมภายนอกเหมือนเดิม)

> รายละเอียดเต็ม (ก่อน-หลังรายไฟล์ เหตุผลรายข้อ) อยู่ที่ `docs/SIMPLIFY_REPORT_2.md` · ส่วนนี้สรุปเฉพาะที่ต้องตอบกรรมการได้ · เลขบรรทัดทั้งเอกสารนี้ถูกตรวจใหม่หลังรอบ 2 แล้ว (เปิดโค้ดจริงทีละจุด)

**ตัวเลข (นับด้วยคำสั่งเดียวกับ 5.1):** `backend/src` 58 ไฟล์ / 6,789 → **59 / 6,751** (−38 บรรทัด) · `frontend/src` 86 ไฟล์ / 6,678 → **87 / 6,553** (−125 บรรทัด) · รวม 144 / 13,467 → **146 / 13,304** (**−163 บรรทัด แต่ +2 ไฟล์**) · เทียบ HEAD `142ea2d` รวมทั้งสองรอบ: 159 / 14,998 → 146 / 13,304 (−1,694 บรรทัด)
**ทำไมน้อยกว่าที่ประเมินไว้ตอนแรก (−300…−400):** `errors.ts` ลดได้แค่ −43 บรรทัด (ข้อความไทยแต่ละ code ต้องคงไว้ทุกตัว) · รายการที่เสี่ยงเกินคุ้มถูกข้าม (ด้านล่าง) · และการรวมโค้ดซ้ำต้องเพิ่มไฟล์ใหม่ 2 ไฟล์ (`common/helpers.ts`, `components/LoadingText.tsx`)

### ทำแล้ว
| รายการ | ทำอะไร | ตรวจอย่างไร |
|---|---|---|
| ฟังก์ชันซ้ำใน backend | รวม `isPlainObject`, `round3`, `numOrNull`, `isoFromEpoch`, `UUID_PATTERN` ไว้ที่ `common/helpers.ts` แล้วให้ dto/service/store ของ admin, auth, authoring, history, symptom-search, traversal import ไปใช้ | tsc (`--noUnusedLocals`) + ชุดเทียบ HTTP 120 / error 35 / filter 27 เหมือน baseline |
| `getOutcomeKind` | ฟังก์ชันหา `outcome_kind` ของโหนดจบ เคยเขียนซ้ำใน history.service กับ admin.service → รวมไว้ใน `traversal-engine.ts:35-38` | เทียบกับโค้ดเดิม 5,478 คู่ (ผัง × โหนด) ไม่ต่างแม้คู่เดียว |
| validator เหลือโหมดเดียว (F2) | ลบโหมด `existing` และพารามิเตอร์ `mode` — ไม่มีโค้ดส่วนใดเรียกโหมดนั้น (`validateManual(manual, pages)` — `graph-validator.ts:117-119`) | เทียบกับตัวตรวจเดิมแบบ `draft` 10,976 กรณี ไม่ต่างกัน · **ไม่ได้ลองกับร่างจาก LLM จริง** |
| ข้อความ "กำลังโหลด…" | ไอคอนหมุน + ข้อความ ที่เคยเขียนซ้ำ 10 หน้า → `components/LoadingText.tsx` | tsc + build + eslint (ไม่ได้เปิดดูด้วยตา) |
| `errors.ts` ฝั่งหน้าจอ | `describeError` จาก `switch` ยาว เป็นตาราง `MESSAGES` (code → ข้อความ) + ส่วนตัดสินสั้นๆ (`lib/errors.ts:43-273`) | เทียบกับ `errors.ts` เดิม 456 กรณี (ทุก code × รูปแบบ error) ข้อความ/recovery/code ตรงกันทั้งหมด |
| `queries.ts` | เขียนใหม่: hook ที่ใส่ session ลงแคช (เริ่ม/ตอบ/บันทึกผล) ใช้ `useCacheSession` ตัวเดียว (`:154-160`) · `queryOptions` เฉพาะ key ที่ใช้หลายที่ | tsc + build + ตรวจ queryKey ด้วยตาว่าไม่เปลี่ยน |
| ชุดอื่นๆ ของ frontend | `DEVICE_CATEGORIES` เหลือชุดเดียวใน `lib/labels.ts` · `toAuthUser` ใน `api/auth.ts` · `patchFeedbackParams` ใน `lib/adminParams.ts` · เอา `export` ที่ไม่มีใครใช้ออก (`adminView`, `authStorage`, `models`, `textInput`) · คืนคอมเมนต์ของ `AdminDraftReviewPage` ที่หายไป (F3) | tsc (`noUnusedLocals`) + build + eslint |
| Login/Register (F6) | ใช้ `ErrorNotice` ตัวเดียวกับหน้าอื่น (เพิ่ม `children` ให้ใส่ลิงก์ต่อท้ายได้ — กรณี `EMAIL_TAKEN` ที่มีลิงก์ไปหน้าเข้าสู่ระบบ) | ข้อความมาจาก `describeError` (ตัดสินจาก `code`) · ตอนทำตรวจแล้วว่าหัวข้อ/รายละเอียดตรงของเดิม และ `role="alert"` เหมือนเดิม แต่บาง code อาจมีปุ่ม/ลิงก์เพิ่มตาม `recovery` (เช่นลิงก์ "เข้าสู่ระบบ") · **ผู้ใช้ต้องดูด้วยตา** |
| `AuthProvider` (F7) | แก้ error ของ eslint (react-hooks/refs): เดิมกำหนด `locationRef.current` ระหว่าง render → ย้ายไปอัปเดตใน `useEffect` (`AuthProvider.tsx:30-36`) · ผลคือ eslint สะอาด | eslint + tsc · **ต้องทดสอบมือ: ล็อกอิน/ออก/รีเฟรช/401** |

### ข้ามไว้ (พร้อมเหตุผล)
| รายการ | เหตุผล |
|---|---|
| รวมค่าคลาสลิงก์ `LINK_CLASSES` (B9) | ประเมินไว้ได้ราว 4 บรรทัดเท่านั้น (รายงานรอบ 2 ตาราง B9) |
| รวม `Field`/`TextField` (B10) | รายงานรอบ 2 ประเมินว่าเสี่ยงกลาง: `UploadDraftForm` มีทั้ง input/select/file ต้องดูว่ารวมแล้วไม่ซับซ้อนกว่าเดิม |
| สร้าง query string ของ feedback ใช้ร่วมกัน (B13: `api/admin.ts` กับ `lib/adminParams.ts`) | รวมแล้วไฟล์ import วนกัน (circular import) |
| รวมตัวแปลงของ `list()`/`toDetail()` ใน `drafts.service.ts` | ได้ราว 10 บรรทัด (รายงานรอบ 2) ไม่คุ้มกับการแตะโค้ดที่เป็นแกน authoring |
| ฟังก์ชันรวบรวม `safety_warning` ของหน้าประวัติ | ไม่ได้ทำ · เหตุผลรายข้อดู `docs/SIMPLIFY_REPORT_2.md` |
| C5 (แคช `identity` + `clear()` สองชั้น) | ผู้ใช้สั่งไม่ทำ (F5) |
| ถอด dependency | ผู้ใช้สั่งไม่ถอดสักตัว (F4) · ที่พบ: `@types/multer` ปรากฏแค่ `backend/package.json` ไม่มีไฟล์ใดใน `src` import · `@nestjs/schematics` เก็บไว้ |

### ผลที่ผู้ใช้เห็นได้
- **หน้าเข้าสู่ระบบ/สมัคร:** กล่องแจ้ง error เปลี่ยนมาใช้ `ErrorNotice` (ลิงก์ในกรณีอีเมลซ้ำยังอยู่ · อาจมีปุ่ม/ลิงก์ตาม `recovery` เพิ่มบาง code) — เป็นการเปลี่ยนเดียวที่ตั้งใจ ที่เหลือพฤติกรรมเหมือนเดิม
- ไม่มี endpoint/status/code/ข้อความ error ของ API ที่เปลี่ยน (ตรวจด้วยชุดเทียบเดิม 120/35/27)

### ไม่ได้ทดสอบ
ไม่ได้ทดสอบกับ MySQL/LLM จริง · ไม่ได้เปิดเบราว์เซอร์ (หน้าจอ LoadingText/ErrorNotice/Login/Register ตรวจด้วย tsc + build + eslint เท่านั้น) · ชุดเทียบ HTTP 120 ไม่ได้เทียบ body ของกรณีสำเร็จของ history list/admin summary/feedback (จึงเขียนตัวเทียบเฉพาะจุดเพิ่มสำหรับ `getOutcomeKind`, validator, `describeError`) · ไม่มีเทสต์อัตโนมัติใน repo

### หมายเหตุเรื่อง git
ผู้พัฒนาแจ้งว่า commit รอบ 1 แล้วและสร้าง branch `simplify-2` — แต่ตอนตรวจ `git` แสดง branch `refactor/cleanup`, HEAD `142ea2d` และมีไฟล์เปลี่ยนที่ยังไม่ commit หลายรายการ (ไม่พบ `simplify-2`) · รอบ 2 ไม่ได้แตะ git · ตรวจสถานะจริงก่อน commit

## 5.7 ย้าย backend จาก NestJS เป็น Express (21 ต.ค. 2569)

### ทำไมเปลี่ยนจาก NestJS เป็น Express
- **เหตุผลจริง (ผู้พัฒนาตัดสินเอง):** ตอนไล่อ่านโค้ดทีละไฟล์เพื่อเตรียมสอบ ส่วนที่อ่านแล้วงงและอธิบายต่อไม่ได้คือ "กลไกของ Nest" ไม่ใช่ตรรกะของระบบ — decorator (`@Controller`, `@UseGuards`, `@Injectable`), `CanActivate`, `ExecutionContext`, DI (Nest สร้างของให้เองจาก constructor) และ guard · Express เป็นฟังก์ชันธรรมดา อ่านจากบนลงล่างแล้วรู้ว่าใครเรียกใคร จึงอธิบายให้กรรมการฟังได้เอง
- **สิ่งที่ไม่ได้เปลี่ยน:** ตรรกะทั้งหมด (engine, service, store, dto, validator, rephrase, matcher) แค่ถอด `@Injectable`/`@Inject` ออก · API เหมือนเดิมทุกอย่าง (endpoint, status, code, ข้อความ, body) · frontend ไม่ต้องแก้ · schema/migration ไม่แตะ
- **ข้อแลกเปลี่ยนที่ยอมรับ:** ต้องประกอบของเองใน `app.ts` (เพิ่มบริการใหม่ = เพิ่มบรรทัด `new …` เอง) และต้องจำห่อ handler ด้วย `asyncRoute` · ไม่มีโครงบังคับของ framework แล้ว ความเป็นระเบียบขึ้นกับการตั้งชื่อไฟล์ (`*.routes.ts`, `*.service.ts`, `*.store.ts`)
- **ไม่ใช่เหตุผล:** ประสิทธิภาพ (ไม่ได้วัด และไม่ใช่ปัญหาที่เจอ)

### NestJS → Express เทียบกันอย่างไร
| เดิม (NestJS) | ตอนนี้ (Express) | ที่อยู่ |
|---|---|---|
| `main.ts` `NestFactory.create(AppModule)` | `main.ts` เรียก `createApp()` แล้ว `listen` | `main.ts`, `app.ts:58-100` |
| `@Module({ imports, providers, controllers })` + DI | `new Service(...)` เองตามลำดับ (composition root) | `app.ts:63-72` |
| `@Injectable()` / `@Inject(TOKEN)` | ไม่มี — constructor รับของตรงๆ | ทุก `*.service.ts` / `*.store.ts` |
| `@Controller('traversal')` + `@Get()` `@Post()` | ฟังก์ชัน `traversalRoutes(service, mw)` คืน `Router` | `traversal.routes.ts` · ติดที่ `app.ts:88-94` |
| `@Body()` `@Param()` `@Query()` `@Req()` | `request.body` / `request.params` / `request.query` | ไฟล์ `*.routes.ts` |
| `@HttpCode(202)` | `response.status(202).json(...)` | เช่น `drafts.routes.ts:93` |
| `JwtAuthGuard` / `OptionalJwtAuthGuard` / `AdminGuard` (`CanActivate` + `ExecutionContext`) | middleware `requireAuth` / `optionalAuth` / `requireAdmin` (`(req, res, next)`) | `auth.middleware.ts:70-109` |
| `@nestjs/jwt` `JwtService` + `JwtModule.registerAsync` | `TokenService` เรียก `jsonwebtoken` ตรงๆ | `auth/token.ts` |
| `AllExceptionsFilter` + `APP_FILTER` | `errorHandler` (middleware 4 พารามิเตอร์) ท้ายแอป | `common/error-handler.ts`, `app.ts:97` |
| 404 อัตโนมัติของ Nest | `notFoundHandler` (ข้อความรูปแบบเดิม) | `error-handler.ts:103-105` |
| `FileInterceptor('file')` + `UploadErrorsFilter` | `uploadPdf()` ห่อ multer แล้วแปลง error เอง | `drafts.routes.ts:52-80` |
| `onModuleInit` / `onApplicationBootstrap` | เรียก `load()` / `start()` / `failInterruptedDrafts()` ตามลำดับใน `createApp` | `app.ts:75-78` |
| `Logger` ของ Nest | `createLogger(name)` (ห่อ `console`) | `common/logger.ts` |
| `DatabaseModule` + token `DATABASE_POOL` | `createDbPool()` คืน pool ให้ส่งต่อเอง | `database/pool.ts`, `app.ts:61` |
| `app.enableCors(...)` | `app.use(cors(...))` | `app.ts:84` |
| `nest build` / `nest start --watch` | `tsc` (`npm run build`) / `npm run build:watch` + `npm run start:dev` คนละหน้าต่าง | `backend/package.json` |

### ทำอย่างไรให้แน่ใจว่าไม่พัง
- ทำทีละโมดูล 8 เฟส (P1 common+health → P2 symptom-search → P3 traversal → P4 history → P5 auth → P6 admin → P7 authoring → P8 ถอด Nest) ระหว่างเฟส 1–7 Nest กับ Express อยู่ในแอปเดียวกัน (โมดูลที่ย้ายแล้วตอบด้วย Express) จึงเทียบผลได้ทุกเฟส
- **ชุดเทียบ (นอก repo, DB จำลอง):** HTTP 120 กรณี เทียบ baseline ที่บันทึกตอนยังเป็น NestJS ล้วน → **ตรง 120/120 ทุกเฟส** · error 54 ชนิด → **ตรง 46/46** (8 ชนิดเป็น exception ของ Nest ที่ไม่มีในโค้ดใหม่แล้ว จึงเทียบไม่ได้) · **รันครั้งสุดท้ายกับ Express ล้วน** (ไม่มีแพ็กเกจ `@nestjs/*` ในเครื่องแล้ว) ผลเหมือนกัน
- `tsc` แบบเข้ม (`--noUnusedLocals --noUnusedParameters`) ผ่าน
- **บูตกับ DB จริงบนเครื่องผู้พัฒนา:** `/health` ok · โหลดผัง 631 / โหนด 4,739 · อุปกรณ์ 29 · เดิน session จริง (ผิด action 400, ต้องยืนยันความปลอดภัย 400, ยืนยันแล้วผ่าน, รีเฟรช, ทิ้ง session 204 แล้ว 404) · admin ไม่มี token 401 · login ผิด 401 · ค้นอาการ 503 ระหว่างโหลดแล้ว ready (3,814 ข้อความ/631 ผัง) · CORS preflight 204
- **ตัวเลข `backend/src`:** 58 ไฟล์ / 6,426 บรรทัด → **50 ไฟล์ / 6,321 บรรทัด** · ลบ: `app.module.ts`, `*.module.ts` 8 ไฟล์, `database.module.ts`, `database.constants.ts`, `all-exceptions.filter.ts`, guard 3 ไฟล์, controller 7 ไฟล์, `nest-cli.json` · เพิ่ม: `app.ts`, `common/error-handler.ts`, `common/logger.ts`, `auth/token.ts`, `auth/auth.middleware.ts`, `database/pool.ts`, `*.routes.ts` 7 ไฟล์
- dependency: เพิ่ม `express`, `multer`, `jsonwebtoken`, `cors`, `@types/jsonwebtoken` · ถอด `@nestjs/*`, `reflect-metadata`, `rxjs`

### ที่ยังไม่ได้ทดสอบ (ต้องทดสอบมือ)
register/login/me/logout ผ่านหน้าเว็บจริง · อัปโหลด PDF จริงจนร่างผังเสร็จ (ต้องมี LLM) · publish แล้วรีสตาร์ต · rephrase กับ Groq จริง · หน้าเว็บ (GitHub Pages) เรียก backend ข้าม origin · deploy บน Render

---

✅ ส่วนที่ 5 ยืนยันแล้ว (รวม B5 ที่ทำเพิ่มและเอกสารปรับตัวเลขแล้ว)

---

# ส่วนที่ 6 — คำถามที่กรรมการน่าจะถาม 25 ข้อ + "ทำไมไม่ใช้ X"

> **กติกาของส่วนนี้:** คำตอบทุกข้อมาจากส่วน 1–5 หรือโค้ดจริงที่ระบุ `path:บรรทัด` / เลข `§` ให้เปิดอ่านต่อได้ · คำถามเรื่องจุดอ่อนตอบตรงๆ + "ทางแก้ที่ทำได้" (ป้าย 🛠 = **ข้อเสนอ ยังไม่ได้ทำในโค้ด** ห้ามพูดว่าระบบมีอยู่แล้ว) · เหตุผลที่ไม่มีหลักฐานเขียนว่า **"ไม่ทราบเหตุผล"** · เลข `§` = หัวข้อในเอกสารนี้ (เช่น §2.6 = ด่านความปลอดภัย)
> รูปแบบ: **คำถาม** → คำตอบสั้น (ที่พูดได้ใน 20–30 วินาที) → หลักฐาน

---

## หมวด 1 — สถาปัตยกรรม (5 ข้อ)

**ข้อ 1. ระบบนี้คืออะไร ต่างจาก chatbot หรือ RAG อย่างไร?**
ผู้ใช้เลือกรุ่น → พิมพ์อาการ → ระบบหาผังขั้นตอนที่ใกล้เคียง (embedding) → ผู้ใช้เลือก → **เดินผังทีละขั้นด้วยเครื่องสถานะที่เขียนด้วยโค้ด** ไม่มีขั้นที่ให้ LLM สร้างคำตอบ LLM ทำได้แค่ปรับถ้อยคำบางโหนด (ผ่าน guard) และช่วยร่างผังให้ admin ตรวจ
หลักฐาน: §1.0, §2.0 · `traversal.service.ts:97`, `:100-103` (เรียก engine แล้วบันทึกเท่านั้น) · `SymptomsPage.tsx:23`

**ข้อ 2. ทำไมแยก `traversal-engine` ออกจาก service และ routes?**
engine เป็นฟังก์ชันล้วน (รับ session+ผัง+action คืน session ใหม่) ไม่รู้จัก HTTP/DB จึงเป็นที่เดียวที่ตัดสินขั้นถัดไปและด่านความปลอดภัย ทั้งหน้าเดินผัง และหน้าประวัติ (ใช้ replay ตรวจ) ใช้ตัวเดียวกัน ผลคือกฎไม่ซ้ำและอธิบายได้ที่เดียว · เหตุผลที่คอมเมนต์เขียนไว้คือ "การตัดสินว่าขั้นถัดไปคืออะไรต้องมาจาก engine เท่านั้น" ส่วนแรงจูงใจอื่นของผู้พัฒนา **ไม่ทราบ**
หลักฐาน: `traversal-engine.ts:41-72`, `types.ts:116-144` (error ของ engine ไม่รู้จัก HTTP) · `history.service.ts:232-258` · §3.4

**ข้อ 3. ทำไมโหลดผังทั้งหมดเข้าหน่วยความจำตอนบูต?**
ผลที่เห็นในโค้ด: `listGraphs`/`listManuals` และการหาผังตอนเดินไม่ต้อง query SQL และการสลับชุดข้อมูลทำทีเดียวหลังสร้างเสร็จ (ถ้าโหลดพังของเดิมยังอยู่) ข้อแลกเปลี่ยน: ผังใหม่ต้อง `reload()` หลัง publish (ถ้า reload ล้ม ต้องรีสตาร์ต — §4.6.5) · **เหตุผลที่ผู้พัฒนาตัดสินใจเลือกแนวนี้ ไม่มีบันทึกตรงๆ** (คอมเมนต์ใน `history.service.ts` แค่ใช้ข้อเท็จจริงนี้เป็นเหตุผลให้จัดหน้าในหน่วยความจำ)
หลักฐาน: `graph.repository.ts:80-81`, `:121-173`, `:149-151`, `:180-183` · §1.9 ข้อ 5

**ข้อ 4. deploy ที่ไหน และมีข้อจำกัดอะไร?**
backend บน Render (แผน free) ผ่าน `render.yaml` มี health check `/health` · frontend บน GitHub Pages (`npm run deploy` ใช้ `gh-pages`) · ฐานข้อมูล Aiven MySQL ใช้ร่วมกับโปรเจกต์เก่า · ข้อจำกัดที่โค้ดรับรู้: Render free หลับเมื่อไม่มีคนใช้ ตื่นช้า — หน้าจอแสดงข้อความเตือนหลังรอ 4 วินาที และการค้นอาการตอบ 503 ระหว่างโหลดโมเดล · **ไม่ได้ทดสอบบน Render จริงในการเขียนเอกสารนี้** (ภาคผนวกข้อ 7)
หลักฐาน: `render.yaml` · `frontend/package.json` (script `deploy`) · `useSlowWait.ts:3` · `SymptomsPage.tsx:48` · `symptom-search.service.ts:15-16`, `:161-162` · `app.ts:84` (CORS ตาม `CORS_ORIGIN`) · `docs/ops/DEPLOY.md` (**ไม่ได้อ่านรายละเอียด**)

**ข้อ 5. จัดการ error อย่างไร และการรวม filter เป็นตัวเดียวช่วยอะไร?**
จุดที่เกิดปัญหาโยน `ApiError(status, code, message)` → `errorHandler` ตัวเดียว (middleware ท้ายแอป) แปลงเป็น `{statusCode, code, message}` ส่วน error ของ engine แปลงด้วยตารางในไฟล์เดียว หน้าจอตัดสินจาก `code` ไม่ใช่ `message` · ข้อดีคือมีที่เดียวที่บอกว่า error ไหน = รหัสไหน (สมัยแยก filter ต่อโมดูล ถ้าลืมติด 401/403 กลายเป็น 500) · ข้อจำกัด: error ภายในที่ไม่ใช่ `ApiError` (เช่นของ mysql2) กลายเป็น 500 พร้อม `message` ภายในออกไปด้วย
หลักฐาน: §4.7 · `error-handler.ts:62-72`, `:74-100` · `app.ts:96-97` · `lib/errors.ts:245-273`

---

## หมวด 2 — การค้นอาการ / embedding (5 ข้อ)

**ข้อ 6. embedding กับ cosine similarity คืออะไร (อธิบายให้คนไม่เคยเรียน)?**
แปลงข้อความเป็นพิกัด 384 ตัวเลข ข้อความที่ความหมายใกล้กันได้พิกัดใกล้กัน cosine วัดมุมระหว่างพิกัดสองจุด ใกล้ 1 = ทิศเดียวกัน · ตัวอย่างจริง: "อาหารไม่สุก" เทียบ "อาหารไม่สุกเลย" ได้ 0.959
หลักฐาน: §3.1–3.2 · `embedding.service.ts:5-6`, `:45-55` · `symptom-matcher.ts:20-41` · ผลวัด: `backend/scripts/study-measure.js search` (§3.9)

**ข้อ 7. เกณฑ์ 0.55 กับ top 3 มาจากไหน และดีแค่ไหน?**
ตอบตรงๆ: **top 3 ไม่ทราบเหตุผล** · 0.55 เอกสารเก่าบันทึกว่าเป็นค่าที่ยืมจากงานก่อนหน้า ตั้งจากคำค้นที่ AI ร่างเองและยังไม่ได้ตรวจ จึง **ไม่ใช่ค่าความแม่นยำ** · ผลวัดของผม: ตัดคำค้นนอกเรื่องได้บางส่วน (4 จาก 7 ตัวอย่าง; "สวัสดี" ยังได้ 0.730) และไม่ได้จัดอันดับความตรง (ภายในรุ่นเดียว 8 จาก 9 ผังผ่านเกณฑ์) · จึงให้ผู้ใช้เลือกเองจาก ≤ 3 อัน · 🛠 ทางแก้: ทำชุดคำค้นที่มนุษย์ตรวจแล้ววัด precision/recall แล้วปรับเกณฑ์ หรือเพิ่มเงื่อนไข (เช่นช่องว่างระหว่างอันดับ 1 กับ 2)
หลักฐาน: §3.3, §3.9 Q6 · `symptom-search.service.ts:11-12` · `docs/archive/HANDOFF.md:179`, `docs/features/PLAN-MODEL-SELECTION.md:14`

**ข้อ 8. ถ้าระบบเสนอผังผิด / ไม่เจอเลย ผู้ใช้เจออะไร?**
ผู้ใช้เป็นคนเลือกเอง ระบบไม่ตัดสินแทน: ไม่มีผังผ่านเกณฑ์ → "ไม่พบอาการที่ใกล้เคียง ระบบไม่เดาให้" + ทางไป "อาการทั้งหมด" · เลือกผังผิดรุ่นไม่ได้ เพราะ backend ตรวจรุ่น (400 `GRAPH_MANUAL_MISMATCH`) · คะแนนที่แสดงเป็นข้อมูลประกอบ ไม่เข้าสูตรตัดสิน
หลักฐาน: `SymptomSearchResults.tsx:13-24` · `traversal.service.ts:64-66`, `:186` · `SessionHeader.tsx:34-36` · §2.2

**ข้อ 9. ทำไมรันโมเดล embedding ในเครื่องเอง ไม่เรียก API ภายนอก และเลือกโมเดลนี้เพราะอะไร?**
ข้อเท็จจริงในโค้ด: โหลดจากโฟลเดอร์ `backend/model` และตั้ง `allowRemoteModels = false` (ไม่ดึงจากอินเทอร์เน็ตตอนรัน) ผลคือข้อความค้นไม่ออกนอกระบบ · ข้อแลกเปลี่ยน: ใช้หน่วยความจำและบูตช้า (ตอบ 503 ระหว่างโหลด) · **ไม่ทราบเหตุผลที่เลือกโมเดล `paraphrase-multilingual-MiniLM-L12-v2` เทียบกับตัวอื่น** (ไม่มีบันทึก/ผลเทียบ) ที่ทราบคือเป็นโมเดลหลายภาษา (ชื่อโมเดลระบุ multilingual)
หลักฐาน: `embedding.service.ts:5-8`, `:33-34` · `symptom-search.service.ts:46-54`

**ข้อ 10. ผังที่ admin เพิ่งเผยแพร่ ค้นเจอทันทีไหม?**
ถ้า reload ผังสำเร็จและระบบค้นหาเปิดอยู่ → เพิ่มข้อความของผังใหม่เข้าดัชนีทันที (embed เฉพาะผังใหม่ ไม่ทำ 644 ผังใหม่) · ถ้าไม่ (ระบบค้นปิด/ดัชนียังไม่พร้อม/reload ล้ม) เลือกจาก "อาการทั้งหมด" ได้หรือค้นได้หลังรีสตาร์ต
หลักฐาน: `drafts.service.ts:208-222` · `symptom-search.service.ts:112-158` · §4.6.5

---

## หมวด 3 — ความปลอดภัย (5 ข้อ)

**ข้อ 11. ผู้ใช้ข้ามคำเตือนความปลอดภัยได้ไหม?**
ผ่านหน้าจอไม่ได้ และยิง API ตรงก็ไม่ได้: ขั้น `safety_critical` รับเฉพาะ `confirm_safety` ถ้าส่ง `continue` ได้ 400 และ service เรียก engine **ก่อน** บันทึก ดังนั้น DB ไม่ขยับ · ข้อจำกัด: ระบบพิสูจน์ไม่ได้ว่าผู้ใช้ "อ่านจริง" ด่านนี้ครอบเฉพาะโหนดที่ผู้เขียนผังทำเครื่องหมายไว้ (validator มีคำเตือนเมื่อข้อความดูอันตรายแต่ไม่ได้ติดธง)
หลักฐาน: §2.6, §3.5 · `traversal-engine.ts:90-97` · `traversal.service.ts:97-100` · `graph-validator.ts:334-335`, `:417-425` · ผลรันจริง: `study-measure.js engine`

**ข้อ 12. ระบบล็อกอิน/สิทธิ์ปลอดภัยแค่ไหน? สมัครเป็น admin เองได้ไหม?**
สมัครได้เป็น `user` เท่านั้น (role ตั้งในโค้ด ไม่รับจากผู้ใช้) · admin สร้างได้ทางสคริปต์ seed ทางเดียว · รหัสผ่านเก็บเป็น bcrypt (10 rounds) · ล็อกอินผิดทุกกรณีตอบข้อความเดียว + เทียบ hash หลอก · token HS256 หมดอายุ 7 วัน · endpoint admin ตรวจ token และ role ที่ backend (หน้าจอซ่อนเมนูเป็นแค่ UX)
หลักฐาน: §4.1 · `auth.service.ts:50-82`, `:61`, `:43`, `:76` · `token.ts:26-40` · `auth.middleware.ts:96-106` · `migrations/010…:12-13`

**ข้อ 13. ป้องกัน SQL injection และการเห็นข้อมูลข้ามผู้ใช้อย่างไร?**
ค่าจากผู้ใช้ไปทางพารามิเตอร์ `?` ของ mysql2 ทุก store ที่ผมอ่าน · ส่วนที่ต่อสตริงเป็น SQL ค่าคงที่ในไฟล์ (เช่น `ownerWhere`) · การแยกเจ้าของ: user → `user_id = ?`, guest → `client_id = ? AND user_id IS NULL` และไม่ใช่เจ้าของได้ 404 (ไม่บอกว่ามี session นั้น) · ข้อจำกัดที่ต้องรู้: guest ไม่ได้ยืนยันตัวตน ใครรู้ UUID ของ guest เห็นประวัติของ guest นั้นได้ · ⚠️ ผมไม่ได้ตรวจทุก query ทีละบรรทัด (อ่านหลัก: session/history/users/drafts/admin store)
หลักฐาน: §4.1.3 · `session-owner.ts:25-30` · `history.store.ts:66-129` · `users.store.ts:67-90` · `drafts.store.ts:117-257`

**ข้อ 14. มี rate limit กันเดารหัสผ่านไหม? token รั่ว/ขโมยได้ไหม?**
**ไม่มี rate limit** (ค้น throttle/rate limit ใน backend ไม่พบ) และ logout ฝั่งเซิร์ฟเวอร์ไม่มี (ล้างแค่ token ในเบราว์เซอร์; token ยังใช้ได้จนหมดอายุ 7 วัน) · token เก็บใน localStorage ซึ่งสคริปต์ในหน้าเว็บอ่านได้ ถ้ามีช่องโหว่ XSS จะรั่ว · 🛠 ทางแก้: จำกัดจำนวนครั้งต่อ IP/อีเมล (ต้องเพิ่ม dependency หรือเขียนเอง ต้องขออนุมัติตามข้อตกลงโปรเจกต์), ย่น `JWT_EXPIRES_IN` (มี env อยู่แล้ว `token.ts:35`), ย้าย token ไปคุกกี้ `HttpOnly`
หลักฐาน: §4.1.2, §4.1.4, §4.8 ข้อ 3 · `AuthProvider.tsx:106-112` · `authStorage.ts:19`, `:70-77`

**ข้อ 15. LLM ถูกใช้กับข้อมูลอะไร และมีความเสี่ยงอะไร (rephrase guard พอไหม)?**
ส่งไป Groq: ข้อความโหนด (ถ้าเปิด rephrase) และข้อความหน้าคู่มือ (ตอน admin ร่างผัง) ไม่ส่งรหัสผู้ใช้ · rephrase ข้ามโหนด safety และโหนดจบ มี guard ตรวจตัวเลข/คำอังกฤษ/จำนวนคำ "ไม่"/ความยาว · **guard ไม่ใช่การรับประกันความหมาย** ผมทดสอบแล้ว "ถอดปลั๊ก" → "เสียบปลั๊ก" ผ่านได้ จึงมีปุ่มดูข้อความต้นฉบับทุกครั้งและปิดได้ด้วย env · 🛠 ทางแก้: จำกัด rephrase เฉพาะ checkpoint หรือเพิ่มรายการคำกริยาเสี่ยงให้ guard ปฏิเสธ
หลักฐาน: §3.6 · `rephrase.service.ts:38-40`, `rephrase-guard.ts:26-61` · `RephraseNote.tsx` · `docs/study/READING_ROADMAP_v2.md` (Q "ข้อมูลอะไรออกไปนอกระบบ")

---

## หมวด 4 — ข้อมูล / ผัง (4 ข้อ)

**ข้อ 16. ข้อมูลผังมาจากไหน มีเท่าไร?**
มาจากคู่มือ PDF ของ Samsung → แยกเป็น chunk (`data/chuck`) → แปลงเป็นผัง JSON (`data/manuals`) → seed ลง MySQL · นับจากไฟล์: 22 คู่มือ, 644 ผัง ใน 5 หมวดเครื่อง (แอร์ 13, ไมโครเวฟ 105, ตู้เย็น 100, ทีวี 288, เครื่องซักผ้า 138) · เอกสารเตรียมอ่านบันทึกว่ามี 4,834 โหนด, `safety_critical` 371 (ตัวเลขจากการนับเมื่อ 17 ต.ค. ในเอกสาร ผมไม่ได้นับซ้ำ)
หลักฐาน: §1.6 · `docs/study/READING_ROADMAP_v2.md` (ภาคผนวกตัวเลข) · ⚠️ ไม่ได้เปิดอ่านสคริปต์แปลง `scripts/convert_chunks_to_graphs.py` จึงไม่อธิบายขั้นตอนข้างในเกินที่เห็นจากชื่อ

**ข้อ 17. ใครรับรองว่าเนื้อหาผังตรงกับคู่มือ?**
ต้องแยก 2 อย่าง: (1) **โครงสร้าง/กฎ** ตรวจด้วยโค้ด (validator 29 รหัส error + 5 warning; ใช้กับผังที่ publish ผ่านระบบ authoring และทดสอบกับผังจริง 644 ผังตามคอมเมนต์) (2) **เนื้อหาตรงคู่มือไหม** ระบบไม่ตรวจเอง — เป็นหน้าที่ของคนตรวจ (หน้าจอแสดงข้อความหน้าต้นฉบับคู่โหนด และบังคับติ๊กยืนยัน) และมีเอกสารขั้นตอนตรวจ chunk/ผังเทียบ PDF ใน `docs/ops/` (**ผมไม่ได้อ่านเนื้อหาและไม่ทราบผลการตรวจ**)
หลักฐาน: §4.6.3, §4.8 ข้อ 7 · `graph-validator.ts` หัวไฟล์ · `docs/ops/VERIFY-GRAPHS-AGAINST-SOURCE.md`, `VERIFY-CHUNKS-AGAINST-PDF.md` (มีอยู่ ยังไม่ได้อ่าน)

**ข้อ 18. เพิ่มคู่มือใหม่จาก PDF ทำอย่างไร ปลอดภัยแค่ไหน?**
admin อัปโหลด PDF (≤ 10 MB เลือกได้ ≤ 10 หน้า) → ระบบแยกข้อความ → LLM ร่างทีละ 2 หน้า → parse เข้ม → validator → เก็บเป็นร่าง (แยกตารางจากผังจริง ผู้ใช้ไม่เห็น) → admin ตรวจ/แก้ → เผยแพร่ใน transaction เดียว ตรวจซ้ำ และ **ไม่เขียนทับของเดิม** · error กัน publish ไม่มี override, warning ต้องรับทราบ · ข้อจำกัด: รองรับเฉพาะ PDF ที่คัดลอกข้อความได้ (ไม่ทำ OCR), ทีละ 1 งาน, ต้องเป็นคู่มือใหม่เท่านั้น
หลักฐาน: §4.6 · `drafts.service.ts:53-85`, `:193-223` · `drafts.store.ts:210-257` · `pdf-text.ts:3-6`

**ข้อ 19. ถ้าผังถูกแก้/เพิ่มทีหลัง ประวัติเก่าของผู้ใช้เป็นอย่างไร?**
หน้ารายละเอียดประวัติเดินขั้นที่บันทึกไว้ซ้ำผ่าน engine ในผังปัจจุบัน ถ้าไม่ไปจบโหนดเดิมจะตอบ `available: false` (200) พร้อมข้อความที่ผู้ใช้บันทึกเอง ไม่ใช่ 500 และไม่แสดงขั้นเก่าคู่กับข้อสรุปใหม่ · และเพราะ publish เป็น INSERT ล้วน ผังที่ใช้อยู่จึงไม่ถูกแก้ผ่านระบบ authoring
หลักฐาน: §4.2 · `history.service.ts:126-187`, `:232-258` · `drafts.store.ts:7-9`

---

## หมวด 5 — การทดสอบ / ข้อจำกัด (4 ข้อ)

**ข้อ 20. ทดสอบระบบอย่างไร ทำไมไม่มีเทสต์อัตโนมัติ?**
ตอบตรงๆ: **ใน repo ไม่มีไฟล์เทสต์อัตโนมัติเลย** (ค้น `*.spec.*`/`*.test.*` ไม่พบ ทั้งสองฝั่ง; มีแค่ config ของ jest/vitest) · สิ่งที่ทำจริง: build + `tsc` + eslint ทั้งสองฝั่ง, สคริปต์เทียบผลก่อน/หลังแก้ (HTTP 120 กรณี, error 35 ชนิด, unit ของ filter 27 กรณี และตอนย้ายเป็น Express รัน HTTP 120 + error 46 ชนิดซ้ำทุกเฟส §5.7 — **สคริปต์ชุดนี้อยู่นอก repo**), สคริปต์วัดที่ `backend/scripts/study-measure.js` และทดสอบมือ · เหตุผลที่ไม่มีเทสต์ **ไม่ทราบ** (เอกสารเตรียมอ่านบันทึกว่าเคยมีและถูกลบเมื่อ 16–17 ต.ค. โดยไม่ระบุเหตุผล) · 🛠 ทางแก้: เขียน unit test ให้ส่วนที่เป็นฟังก์ชันล้วนก่อน (engine, validator, guard, `rankGraphs`, `toBody`) แล้วเก็บสคริปต์เทียบ HTTP เข้า repo
หลักฐาน: §5.5 · `docs/study/READING_ROADMAP_v2.md` (Q "ทดสอบอย่างไร") · `backend/jest.config.js`

**ข้อ 21. ถ้ามีคนส่งคำสั่งเดินผังพร้อมกันสองคำขอ (race condition) เกิดอะไร?**
ในโค้ดไม่มีล็อกแถว/เวอร์ชัน แต่ DB มี `UNIQUE (session_id, step_order)` และการเขียนอยู่ใน transaction → คำขอหนึ่งสำเร็จ อีกคำขอ INSERT ชน → rollback ข้อมูลไม่เสีย ผู้แพ้ได้ **500 แทนที่จะเป็น 409** · หน้าจอกันกดซ้ำในแท็บเดียวแล้ว (`isSendingRef`) · ข้อสรุปมาจากการอ่านโค้ด/migration ยังไม่ทดสอบกับ MySQL จริง และต้องตรวจว่า DB จริงมี UNIQUE นี้ (ภาคผนวกข้อ 1) · 🛠 ทางแก้: จับ `ER_DUP_ENTRY` ใน `SessionStore.update` แล้วโยน `ApiError` 409 หรือเพิ่มเงื่อนไข `WHERE current_node_id = ?` / `SELECT … FOR UPDATE`
หลักฐาน: §2.5 · `session.store.ts:89-142` · `migrations/002…:36` · `SessionPage.tsx:46-52`

**ข้อ 22. ข้อจำกัดของระบบที่คุณยอมรับมีอะไรบ้าง?**
ตามที่บันทึกไว้ในเอกสารนี้: ประวัติแสดงได้สูงสุด 50 รายการล่าสุดต่อผู้ใช้ · ไม่ย้ายประวัติ guest เข้าบัญชี · ข้อความ outcome เก็บไว้แต่ยังไม่มีเครื่องมือสรุป · ไม่มี rate limit · ฐานข้อมูลใช้ร่วมกับโปรเจกต์เก่า สถิติ admin แยกเฉพาะโปรเจกต์นี้ไม่ได้ทั้งหมด · เกณฑ์ค้นหายังไม่ได้ประเมินด้วยชุดทดสอบที่มนุษย์ตรวจ · error 500 ส่งข้อความภายในออกไป · ร่างผังรองรับเฉพาะ PDF ที่คัดลอกข้อความได้
หลักฐาน: §4.2 (`history.store.ts:25`), §4.4, §4.8, §3.9 Q6, `admin.service.ts` (คอมเมนต์หัวไฟล์), §4.7

**ข้อ 23. ระบบรองรับผู้ใช้จำนวนมากได้ไหม?**
**ตอบไม่ได้ด้วยตัวเลข เพราะไม่ได้ทดสอบโหลด** · สิ่งที่รู้จากโค้ด: ดัชนีค้นหาและผังอยู่ในหน่วยความจำของโปรเซสเดียว (ถ้าเปิดหลาย instance แต่ละตัวจะมีสำเนาของตัวเองและ reload ได้เฉพาะตัวที่รับ publish — การอนุมานจากโครงสร้าง ไม่ได้ทดสอบ) · มี endpoint ดูหน่วยความจำ `GET /symptom-search/status` (`memoryRssMb`) · ขนาดดัชนีตอนนี้ (คำนวณจากตัวเลขที่วัด): เวกเตอร์ไม่ซ้ำ 1,972 ตัว × 384 × 4 ไบต์ ≈ 3 MB (ขอบบนถ้าไม่ใช้ร่วมกัน ≈ 5.9 MB)
หลักฐาน: `symptom-search.service.ts:29`, `:78-88`, `:200-212` · §3.1

---

## หมวด 6 — การลดโค้ด (2 ข้อ)

**ข้อ 24. งาน simplify ทำอะไร ทำไมทำ และได้ผลเท่าไร?**
ทบทวนโค้ดเพื่อให้ "อ่านและอธิบายได้ภายในเวลาสอบ": ลบโค้ดที่ไม่มีใครใช้, รวมไฟล์เล็ก/โมดูลที่ห่อของชิ้นเดียว, ลบ endpoint ที่ frontend ไม่เรียก, ตัดตัวกรองหน้าประวัติ, รวม exception filter 6 ตัวเป็นตัวเดียว + `ApiError`, รวมกล่อง error 3 แบบ · ผล (นับใหม่เทียบ commit `142ea2d`): 159 → 146 ไฟล์, 14,998 → 13,304 บรรทัด (−11.3%; รอบ 2 ลดอีก 163 บรรทัด ดู §5.6) · **ไม่ตัดฟีเจอร์แกนหลัก** และเก็บ rephrase กับ outcome ไว้เพราะเป็น TOR (ตามที่คุณตัดสิน; ผมไม่ได้อ่าน TOR) · เก็บรายการอื่นไว้โดยคุณไม่ได้ให้เหตุผลเพิ่ม
หลักฐาน: §5.1–5.2 · `docs/SIMPLIFY_REPORT.md`

**ข้อ 25. พิสูจน์ได้อย่างไรว่าการลดโค้ดไม่ทำให้ระบบเปลี่ยนพฤติกรรม?**
ก่อนแก้ บันทึก baseline ของ response 120 กรณี (status+code+body) แล้วเทียบหลังจบแต่ละโมดูล: 120/120 ตรง · เทียบ error 35 ชนิดผ่าน filter กลางกับ filter เดิม: 35/35 · unit ของ filter 27/27 · build + tsc ผ่านทั้งสองฝั่ง · **พฤติกรรมที่เปลี่ยนและบอกไว้ตรงๆ:** หน้าประวัติไม่มีตัวกรอง, `/admin/sessions` เป็น 404, ข้อความ error ของกล่องแจ้งเตือนเปลี่ยน (B5), เบราว์เซอร์เก่ามากที่ไม่มี `crypto.randomUUID` สร้าง client id ไม่ได้ · **ไม่ได้ทดสอบ:** MySQL/LLM/เบราว์เซอร์จริง, Render/Aiven, ไม่มีเทสต์อัตโนมัติ
หลักฐาน: §5.3, §5.5

---

## 📦 ถ้าถูกถามว่า "ทำไมไม่ใช้ X"

**ทำไมไม่ใช้ ORM (เช่น Prisma/TypeORM)?**
สิ่งที่ยืนยันได้จากโค้ด: ใช้ `mysql2` เขียน SQL ตรงด้วยพารามิเตอร์ `?` ทุก store ผลคือเห็นคำสั่งจริงและตรวจ injection/เจ้าของข้อมูลได้ในไฟล์เดียว (เช่น `ownerWhere`) และ transaction (`beginTransaction/commit`) เขียนชัด (`session.store.ts:102-141`, `drafts.store.ts:210-245`) · เหตุผลชุดนี้มาจากเอกสารเตรียมอ่านที่เขียนภายหลัง ไม่ใช่บันทึกการตัดสินใจตอนออกแบบ — **เหตุผลเดิมของผู้พัฒนาตอนเลือก ไม่ทราบ** (บันทึกเก่าเพียงเขียนว่า "ห้ามสมมติ stack ว่าเป็น Prisma/Supabase/pgvector" — `docs/archive/HANDOFF.md:128`) · ข้อแลกเปลี่ยนที่ควรยอมรับ: ต้องดูแล SQL/การแปลงชนิดข้อมูลเอง และไม่มี migration แบบอัตโนมัติจาก schema (ใช้สคริปต์ `run-migrations.js` กับไฟล์ `.sql`)

**ทำไมไม่ใช้ vector database และทำไมคำนวณ cosine ใน TypeScript?**
สิ่งที่ยืนยันได้: ข้อความอาการ 3,850 ข้อความ (ไม่ซ้ำ 1,972) × 384 มิติ เก็บในหน่วยความจำ ≈ 3 MB และค้นด้วยการคำนวณ cosine กับทุกข้อความ (ผ่าน `rankGraphs`) แล้วกรองตามรุ่นก่อน ข้อมูลระดับนี้ไม่ต้องมีบริการเพิ่ม · **ผมไม่ได้วัดเวลาค้นต่อคำขอ** (เป็นการคำนวณเชิงเส้นตามจำนวนข้อความ) · ข้อกำหนดที่ให้ไว้ตอนทำ simplify ระบุว่า "cosine ใน TypeScript" ไว้เป็นเงื่อนไขของระบบ (`docs/SIMPLIFY_REPORT.md` ตาราง I1) · **เหตุผลเดิมของผู้พัฒนาที่ไม่ใช้ vector DB ไม่ทราบ** · ข้อสังเกตทางวิศวกรรม (ไม่ใช่หลักฐานของโปรเจกต์): ถ้าข้อความโตเป็นหลักแสนหรือต้องหลาย instance ควรพิจารณา vector DB/ดัชนีโดยประมาณ
หลักฐาน: §3.1 · `symptom-matcher.ts:64-88` · `symptom-search.service.ts:78-88`, `:165-169`

**ทำไมไม่ให้ LLM ตอบเองไปเลย?**
เพราะเรื่องซ่อมเครื่องใช้ไฟฟ้ามีความเสี่ยง (ไฟช็อต ความร้อน) ถ้า LLM แต่งขั้นตอนเอง ตรวจสอบย้อนไม่ได้ ระบบนี้ให้ทุกขั้นมาจากผังที่แปลงจากคู่มือและชี้หน้าคู่มือ และให้ LLM ทำแค่ปรับถ้อยคำบางโหนด (ผ่าน guard, ข้ามโหนด safety/โหนดจบ) กับร่างผังให้คนตรวจ — ข้อความหน้าแรกบอกผู้ใช้ตรงๆ ว่า "ไม่ได้ให้ AI เดาเอาเอง" · ข้อแลกเปลี่ยน: ตอบได้เฉพาะอาการที่มีผัง (644 ผัง) ที่เหลือแนะนำศูนย์บริการ
หลักฐาน: §3 Q2, §2.0 · `HomePage.tsx:15` · `draft-llm.client.ts:33-34`

**ทำไมไม่ทำ RAG แบบเต็ม (ดึงเอกสารมาให้ LLM เขียนคำตอบ)?**
ตามโค้ดจริง การ "ดึง" ที่มีคือเลือกผังด้วย embedding แล้ว **เดินผังที่กำหนดไว้** ไม่มีขั้นที่ให้ LLM สร้างคำตอบจากข้อความที่ดึงมา (§1.9 ข้อ 1) · เหตุผลที่อธิบายได้จากหลักฐานคือเรื่องความปลอดภัยและการตรวจสอบย้อน (ข้อบนและด่าน `safety_critical`) · **ถ้า TOR/สไลด์ใช้คำว่า RAG ให้ยอมรับว่าระบบทำต่างจากภาพ RAG ทั่วไป** แล้วอธิบายว่า retrieval ของระบบคือ "ค้นผัง" และการ generation ถูกจำกัดไว้ที่การปรับถ้อยคำ — ผมไม่ได้อ่าน TOR จึงไม่ทราบว่า TOR ระบุไว้อย่างไร (ภาคผนวกข้อ 9)
หลักฐาน: `docs/SIMPLIFY_REPORT.md` ตาราง I4 · §1.0 · §1.9

---

⏸ **หยุดรอยืนยันส่วนที่ 6** — จากนั้นเหลือ "สรุปก่อนเข้าห้องสอบ" ท้ายเอกสาร (เพิ่มแล้วอยู่หลังภาคผนวก)

---

---

<!-- APPENDIX: ต้องตรวจก่อนสอบ (ย้ายไว้ท้ายเอกสารเสมอ เมื่อเพิ่มส่วนใหม่ให้แทรกก่อนหัวข้อนี้) -->
# ภาคผนวก — ต้องตรวจก่อนสอบ

รวมเรื่องที่ **ผมอ่านจากโค้ด แต่ยืนยันกับระบบจริงไม่ได้** (ไม่ได้ต่อ DB/Render/LLM) ให้คุณตรวจเองก่อนวันสอบ แล้วตอบกรรมการด้วยผลที่ตรวจจริง

| # | ต้องตรวจ | คำสั่ง / วิธีตรวจ | ทำไมต้องตรวจ | อ้างจาก |
|---|---|---|---|---|
| 1 | **ตาราง `session_history` ใน DB จริงมี UNIQUE KEY `(session_id, step_order)` หรือไม่** | `SHOW CREATE TABLE session_history;` (ดูหา `UNIQUE KEY uq_history_step (session_id, step_order)`) | คำตอบเรื่อง "สองคำขอ action พร้อมกัน" พึ่ง UNIQUE นี้ — migration ใช้ `CREATE TABLE IF NOT EXISTS` และตารางใช้ร่วมกับโปรเจกต์เก่า ถ้าตารางถูกสร้างไว้ก่อนด้วย schema อื่น อาจไม่มี | ส่วนที่ 2 หัวข้อ 2.5 · `migrations/002_create_session_tables.sql:36` |
| 2 | ตารางอื่นที่ข้อความในเอกสารพึ่ง constraint | `SHOW CREATE TABLE session_feedback;` (PK `session_id`, FK CASCADE) · `SHOW CREATE TABLE users;` (UNIQUE `uq_users_email`) · `SHOW CREATE TABLE sessions;` (คอลัมน์ `user_id`, `client_id`, `outcome_text`) | เช่นเดียวกับข้อ 1: เอกสารอ้าง migration ไม่ใช่ DB จริง | `migrations/009…:8-13`, `010…:31`, `011…` |
| 3 | rephrase เปิดอยู่บน Render หรือไม่ และใช้โมเดลไหน | ดู env บน Render: `REPHRASE_ENABLED`, `GROQ_API_KEY` (มี/ไม่มี), `GROQ_MODEL` · (ผมไม่ได้อ่านค่า env ใดๆ) | ส่วนที่ 3.6 ระบุว่าไม่ทราบสถานะจริง | `groq-llm.client.ts:47-52`, `render.yaml` |
| 4 | ระบบร่างผังจาก PDF พร้อมใช้หรือไม่ | ดู env: `GROQ_API_KEY` + `AUTHORING_LLM_MODEL` (ไม่ตั้ง = ร่างจะ `failed: LLM_NOT_CONFIGURED`) และ migration 012 รันแล้ว | ส่วนที่ 4.6.2 | `draft-llm.client.ts:137-140` · `drafts.service.ts:91-94` |
| 5 | ผังใน DB ตรงกับ `data/manuals` หรือไม่ (จำนวนผัง/รุ่น) | `SELECT COUNT(*) FROM graphs;` (เทียบ 644 จากไฟล์ — DB ใช้ร่วมกับโปรเจกต์เก่าและอาจมีผังจาก authoring) | ตัวเลขในส่วนที่ 3 วัดจากไฟล์ ไม่ใช่ DB | `study-measure.js`, ส่วนที่ 3 |
| 6 | ตัวเลขการค้นหา (คะแนน, ผังที่ผ่าน 0.55) ยังตรงหลังมีการเพิ่ม/แก้ผัง | `cd backend && npm run build && node scripts/study-measure.js search --out ผล.json` | ผังที่เพิ่มใหม่เปลี่ยนผลได้ | ส่วนที่ 3.9 |
| 7 | **Render จริง**: เวลาบูต/โหลดโมเดล และ `GET /symptom-search/status` เป็น `ready` | เปิด `<URL backend>/symptom-search/status` และ `/health` | ส่วนที่ 3 วัดบนเครื่องผู้พัฒนาเท่านั้น | `symptom-search.routes.ts:31-33` |
| 8 | วันสอบ: ทดสอบ flow หลักด้วยมือหนึ่งรอบ | ค้นอาการ → เลือกผัง → เดินจนจบ (มีด่าน safety) → บันทึกผลลัพธ์ → ให้ 👍 → ดูประวัติ → (admin) อัปโหลด PDF เล็ก 1–2 หน้า → ตรวจ → reject | ยืนยันว่า deploy จริงทำงานตามที่เอกสารอธิบาย (การทดสอบอัตโนมัติไม่มีใน repo) | ส่วนที่ 2, 4 |
| 9 | ไฟล์ `TOR-COMPLIANCE` / TOR ฉบับจริงเทียบกับพฤติกรรมในเอกสารนี้ | เปิด TOR เทียบเรื่อง RAG, outcome, rephrase | เอกสารนี้ยึดพฤติกรรมตามโค้ด ไม่ใช่ TOR; ผมไม่ได้อ่าน TOR | ข้อกำหนดของงานนี้ |
| 10 | `draft/` ที่ยังไม่ย้ายออก: ชุดคำค้น 56 ข้อและผลวัดเก่าที่เอกสารอ้าง | เปิดดูเอง ก่อนย้ายออก repo (ถ้าจะอ้างตัวเลข) | ส่วนที่ 3 อ้างจากเอกสารเท่านั้น ไม่ได้ตรวจ | `docs/reference/FILES-BACKEND.md:279` |

---

# 📄 สรุปก่อนเข้าห้องสอบ (1 หน้า)

1. **คืออะไร:** เลือกรุ่น → พิมพ์อาการ → embedding หาผังใกล้เคียง (≤ 3) → ผู้ใช้เลือก → เดินผังด้วยเครื่องสถานะ (engine) จนถึงโหนดจบ **ไม่ใช่ chatbot / ไม่ใช่ RAG แบบให้ LLM เขียนคำตอบ** (§1.0, §2.0)
2. **ตัวเลขที่ต้องจำ:** 22 คู่มือ · 644 ผัง · 5 หมวดเครื่อง · เวกเตอร์ 384 มิติ · เกณฑ์ 0.55 · top 3 · session เดิน 24 ชม./จบแล้วเก็บ 90 วัน (§3, §2.3)
3. **LLM ทำ 2 อย่างเท่านั้น:** ปรับถ้อยคำบางโหนด (ข้ามโหนด safety/โหนดจบ มี guard + ปุ่มดูต้นฉบับ) และร่างผังจาก PDF ให้ admin ตรวจ (§3.6, §4.6)
4. **ด่านความปลอดภัยอยู่ที่ backend:** `safety_critical` รับเฉพาะ `confirm_safety`; service เรียก engine ก่อนบันทึกเสมอ (`traversal-engine.ts:90-97`, §2.6)
5. **เจ้าของข้อมูล:** ล็อกอิน = `user_id` · guest = UUID ในเบราว์เซอร์ (`client_id` + `user_id IS NULL`) · ไม่ใช่เจ้าของ = 404 · ไม่มีการย้ายประวัติ guest (§4.1)
6. **publish ผังใหม่:** transaction + `FOR UPDATE` + ตรวจซ้ำ + INSERT ล้วน ไม่เขียนทับ; reload ล้ม = 500 `PUBLISH_RELOAD_FAILED` ทั้งที่ลง DB แล้ว ต้องรีสตาร์ต (§4.6.5)
7. **error:** `ApiError(status, code, message)` + `errorHandler` ตัวเดียว; หน้าจอตัดสินจาก `code` (§4.7)
8. **simplify:** 159 → 146 ไฟล์, 14,998 → 13,304 บรรทัด (−11.3%, เทียบ commit `142ea2d`; รวมรอบ 2); เก็บ rephrase/outcome ไว้เพราะ TOR (§5)
9. **พฤติกรรมที่เปลี่ยน:** หน้าประวัติไม่มีตัวกรอง · `/admin/sessions` = 404 · ข้อความกล่อง error เปลี่ยน (B5) · เบราว์เซอร์ที่ไม่มี `randomUUID` ใช้ไม่ได้ (§5.3)
10. **จุดอ่อนที่ยอมรับตรงๆ:** ไม่มีเทสต์อัตโนมัติ · ไม่มี rate limit · token ใน localStorage · race ผู้แพ้ได้ 500 · 0.55 ไม่ใช่ค่าความแม่นยำ · guard ไม่กัน "ถอด→เสียบ" · outcome ยังไม่มีเครื่องมือสรุป (§6 ข้อ 7, 14, 15, 20–22)
11. **ห้ามพูด:** "มั่นใจ x%" จากคะแนน cosine · "AI ตรวจผังให้" · "ทดสอบครบ" · ตัวเลขความแม่นยำของการค้นหา (ไม่มีชุดทดสอบที่มนุษย์ตรวจ)
12. **ตอบไม่ได้ให้บอกว่า "ไม่ทราบเหตุผล":** top 3 · 0.5–1.6 และ 3 วินาทีของ rephrase · เหตุผลเลือกโมเดล embedding · เหตุผลเลือก NestJS ตอนแรก (ตอนนี้เป็น Express — เหตุผลการย้ายมีจริง §5.7)/ไม่ใช้ ORM/vector DB (§3, §6)
13. **ก่อนเข้าห้อง:** ทำรายการ "ภาคผนวก — ต้องตรวจก่อนสอบ" โดยเฉพาะ `SHOW CREATE TABLE session_history;` และเทียบกับ TOR
14. **รันซ้ำให้ดูได้:** `cd backend && npm run build && node scripts/study-measure.js engine|guard|search` (§3.9)

