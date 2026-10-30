# 16 — อภิธานศัพท์

> เรียงตามหมวด · "ในระบบนี้" = ใช้ตรงไหน (ถ้ามี)

## AI / Retrieval

| ศัพท์ | อธิบายง่ายๆ | ในระบบนี้ |
|---|---|---|
| **Retrieval-guided troubleshooting state machine** | ใช้การค้นหาเพื่อเลือก "ผังขั้นตอน" ที่ใช่ แล้วให้เครื่องสถานะพาเดินทีละขั้นตามผัง | คำเรียกระบบทั้งระบบ |
| **RAG (Retrieval-Augmented Generation)** | ค้นเอกสารที่เกี่ยวข้องก่อน แล้วให้ LLM เขียนคำตอบโดยอิงเอกสารนั้น | ระบบนี้**ไม่ใช่** RAG มีส่วน retrieval แต่ไม่มี generation ของคำตอบ |
| **Embedding** | แปลงข้อความเป็นชุดตัวเลข (เวกเตอร์) ที่เก็บ "ความหมาย" ไว้ | `EmbeddingService.embed()` 384 มิติ |
| **Vector / เวกเตอร์** | รายการตัวเลขที่มองเป็นลูกศรในพื้นที่หลายมิติได้ | `Float32Array` ยาว 384 |
| **มิติ (dimension)** | จำนวนตัวเลขในเวกเตอร์ | 384 |
| **Cosine similarity** | วัดว่าลูกศร 2 อันชี้ทางเดียวกันแค่ไหน 1 = เหมือน, 0 = ไม่เกี่ยว | `symptom-matcher.ts:20-41` |
| **Normalize** | ทำให้เวกเตอร์ยาว 1 ทำให้ cosine = dot product | `normalize: true` |
| **Mean pooling** | เฉลี่ยเวกเตอร์ของทุก token ให้เหลือเวกเตอร์เดียวต่อประโยค | `pooling: 'mean'` |
| **Quantization (q8)** | ลดความละเอียดตัวเลขในโมเดลเป็น 8 บิต ให้เล็กและเร็วขึ้น เสียความแม่นยำเล็กน้อย | `EMBEDDING_DTYPE = 'q8'` |
| **ONNX / Transformers.js** | รูปแบบไฟล์โมเดลกลาง / ไลบรารีที่รันโมเดลใน Node.js | `@huggingface/transformers` |
| **Chunk** | ชิ้นข้อความที่ตัดจากเอกสาร | 1 chunk = 1 อาการในตาราง Troubleshooting (`data/chuck/`) ทำนอกระบบ |
| **Chunk size / overlap** | ความยาวต่อชิ้น / ส่วนที่ซ้อนกันระหว่างชิ้น | ไม่ได้ใช้ (ตัดตามความหมาย ไม่ใช่ตามความยาว) |
| **Top-K** | เอาผลลัพธ์ K อันที่คะแนนสูงสุด | ใกล้เคียงคือ `MAX_RESULTS = 3` |
| **Threshold** | เกณฑ์ขั้นต่ำ ต่ำกว่านี้ไม่นับว่าเจอ | `MATCH_THRESHOLD = 0.55` |
| **Metadata filter** | กรองด้วยข้อมูลประกอบ (เช่น รุ่น) ก่อน/หลังค้นหา | pre-filter ด้วย `manualId` |
| **Alias** | คำพ้องที่คนอาจพิมพ์ | `entry_symptom_aliases` |
| **Brute force / exact search** | เทียบกับทุกตัว ได้คำตอบที่ถูกแน่นอน | วิธีที่ระบบใช้ |
| **ANN (Approximate Nearest Neighbor)** | ค้นหาเพื่อนบ้านใกล้สุดแบบประมาณ เร็วมากเมื่อข้อมูลเยอะ แลกกับความแม่นยำเล็กน้อย | งานในอนาคต |
| **HNSW** | อัลกอริทึม ANN แบบกราฟหลายชั้น นิยมที่สุด | งานในอนาคต |
| **Vector DB / pgvector** | ฐานข้อมูลที่เก็บและค้นเวกเตอร์ได้ / extension ของ PostgreSQL | ไม่ได้ใช้ |
| **Hybrid search / BM25** | รวมการค้นแบบคำ (BM25) กับแบบความหมาย | งานในอนาคต |
| **Hit@K / Top-K hit rate** | สัดส่วนคำค้นที่คำตอบถูกอยู่ใน K อันดับแรก | metric ในไฟล์ 10 |
| **MRR** | ค่าเฉลี่ยของ 1/อันดับของคำตอบถูก | metric เสริม |
| **Youden's J** | TPR + TNR − 1 ใช้เลือกเกณฑ์ที่สมดุล | เลือก threshold ใหม่ |
| **Selection bias** | กลุ่มตัวอย่างเลือกตัวเอง ทำให้ผลเอียง | feedback 👍/👎 |

## LLM

| ศัพท์ | อธิบายง่ายๆ | ในระบบนี้ |
|---|---|---|
| **LLM** | โมเดลภาษาขนาดใหญ่ที่สร้างข้อความ | Groq API · rephrase + ร่างผัง |
| **Hallucination** | LLM แต่งข้อมูลที่ไม่จริงอย่างมั่นใจ | ป้องกันโดยไม่ให้ LLM สร้างคำแนะนำ |
| **Grounding** | บังคับให้คำตอบอิงแหล่งข้อมูลที่ตรวจได้ | ผังจากคู่มือ + reference |
| **Prompt / system prompt** | คำสั่งที่ส่งให้ LLM / คำสั่งระดับบทบาท | `groq-llm.client.ts:5-11`, `draft-llm.client.ts:33-62` |
| **Temperature** | ความสุ่มของคำตอบ 0 = นิ่งที่สุด | 0 ทั้งสองงาน |
| **max_tokens** | ความยาวคำตอบสูงสุด | 1000 / 6000 |
| **JSON mode** | บังคับให้ LLM ตอบเป็น JSON | `response_format: json_object` |
| **Prompt injection** | ข้อความแอบสั่ง LLM ให้ทำสิ่งที่ไม่ได้ตั้งใจ | เสี่ยงทาง PDF → มี schema + validator + คนตรวจ |
| **Guard / guardrail** | โค้ดตรวจผลของ LLM ก่อนใช้ | `checkRephrase()` |
| **Rephrase** | เรียบเรียงถ้อยคำใหม่โดยความหมายเดิม | ปิดเป็นค่าเริ่มต้น |
| **Fine-tuning** | เทรนโมเดลต่อด้วยข้อมูลของเรา | ไม่ได้ทำ |

## State machine / ผัง

| ศัพท์ | อธิบายง่ายๆ | ในระบบนี้ |
|---|---|---|
| **State machine (เครื่องสถานะ)** | ระบบที่อยู่ได้ทีละสถานะ และเปลี่ยนตามเงื่อนไข | `traversal-engine.ts` |
| **ผัง (graph)** | ขั้นตอนแก้ปัญหา 1 อาการ เป็นกราฟมีทิศทาง | 631 ผัง |
| **โหนด (node)** | ขั้นหนึ่งในผัง 5 ชนิด: checkpoint, instruction, input, resolution, escalation | ตาราง `nodes` |
| **Transition** | การย้ายจากโหนดหนึ่งไปอีกโหนดตาม action | `resolveNextNode()` |
| **Session** | การตรวจ 1 ครั้ง จำโหนดปัจจุบัน ตัวแปร และประวัติ | ตาราง `sessions` |
| **Terminal node** | โหนดจบ (resolution/escalation) | `isTerminal` |
| **outcome_kind** | ชนิดผลจบ: user_fixed, normal_behavior, handoff_informed, handoff_unknown | `types.ts:3` |
| **Escalation / handoff** | ส่งต่อศูนย์บริการ | โหนด escalation |
| **safety_critical** | ขั้นอันตรายที่ต้องยืนยันคำเตือน | 368 โหนด |
| **Pure function** | ฟังก์ชันที่ผลขึ้นกับ input อย่างเดียว ไม่แก้ของภายนอก | engine ทั้งไฟล์ |
| **Replay** | เดินขั้นที่บันทึกไว้ซ้ำเพื่อตรวจ | หน้าประวัติ |
| **Validator** | โปรแกรมตรวจกฎของผัง | `graph-validator.ts` 24 error + 5 warning |
| **Reachability** | ทุกโหนดเดินถึงได้จากจุดเริ่ม และไปถึงโหนดจบได้ | `E_UNREACHABLE`, `E_NO_EXIT` |

## Backend

| ศัพท์ | อธิบายง่ายๆ | ในระบบนี้ |
|---|---|---|
| **Express** | เฟรมเวิร์กเว็บของ Node.js แบบเรียบง่าย | backend ปัจจุบัน |
| **NestJS** | เฟรมเวิร์ก Node แบบมีโครงสร้าง ใช้ decorator + DI | backend เดิม (ยังอยู่บน `main`) |
| **Middleware** | ฟังก์ชันที่ทำงานก่อน handler เช่น ตรวจ token | `optionalAuth`, `requireAuth`, `requireAdmin` |
| **Guard** | (NestJS) ด่านตัดสินว่าคำขอผ่านได้ไหม | เทียบเท่า middleware ข้างบน |
| **DTO** | รูปร่างข้อมูลที่รับ/ส่งผ่าน API | `*.dto.ts` + ฟังก์ชัน `parse*` |
| **ValidationPipe** | (NestJS) ตรวจ DTO อัตโนมัติ | แทนด้วย `parse*` |
| **Interceptor** | (NestJS) ครอบ handler ทำงานก่อน/หลัง | ไม่มี · `uploadPdf()` ทำหน้าที่คล้าย FileInterceptor |
| **Exception filter / error handler** | จุดเดียวที่แปลง error เป็น HTTP response | `errorHandler` |
| **Composition root** | จุดเดียวที่สร้างและต่อทุก object | `createApp()` |
| **Repository pattern** | แยกโค้ดคุยกับ DB ออกจาก business logic | `*.store.ts`, `*.repository.ts` |
| **Raw SQL / ORM** | เขียน SQL เอง / ใช้ไลบรารีแปลง object ↔ ตาราง | raw SQL + mysql2 |
| **Parameterized query** | ใส่ค่าผ่าน `?` ให้ไลบรารี escape กัน SQL injection | ทุก query |
| **SQL injection** | แทรกคำสั่ง SQL ผ่าน input | ป้องกันด้วยข้อบน |
| **Transaction** | ชุดคำสั่งที่สำเร็จทั้งหมดหรือยกเลิกทั้งหมด | เดินขั้น, publish, seed |
| **Connection pool** | เก็บการเชื่อมต่อ DB ไว้ใช้ซ้ำ | 5 connections |
| **Race condition** | สองคำขอแย่งกันจนผลผิด | กันด้วย UNIQUE + คำสั่งเดียว |
| **Idempotent / upsert** | ทำซ้ำได้ผลเท่าเดิม / insert หรือ update ในคำสั่งเดียว | feedback `ON DUPLICATE KEY UPDATE` |
| **HTTP 201/202/204/400/401/403/404/409/413/422/503** | สร้างแล้ว / รับงานไว้ทำเบื้องหลัง / สำเร็จไม่มีเนื้อหา / ข้อมูลผิด / ไม่ได้ล็อกอิน / ไม่มีสิทธิ์ / ไม่พบ / ขัดกับสถานะ / ใหญ่เกิน / อ่านไม่ได้ / ยังไม่พร้อม | ใช้ครบในระบบ |

## Database

| ศัพท์ | อธิบายง่ายๆ | ในระบบนี้ |
|---|---|---|
| **Migration** | ไฟล์ SQL ที่สร้าง/แก้โครงตาราง รันตามลำดับ | `backend/migrations/001–006` |
| **Seed** | ใส่ข้อมูลตั้งต้น | `seed-graphs.js`, `seed-equipment.js`, `seed-admin.js` |
| **utf8mb4** | การเข้ารหัส UTF-8 เต็ม 4 ไบต์ รองรับไทย + อีโมจิ | ทุกตาราง |
| **Collation** | กฎการเรียง/เทียบตัวอักษร | `utf8mb4_unicode_ci` |
| **PK / FK** | คีย์หลัก / คีย์อ้างอิงตารางอื่น | ดู ERD ไฟล์ 06 |
| **CASCADE / RESTRICT / SET NULL** | ลบแม่แล้วลบลูกตาม / ห้ามลบแม่ / ลูกเหลือค่าว่าง | ใช้ทั้ง 3 แบบ |
| **Index** | โครงสร้างช่วยค้นเร็ว | เช่น `idx_sessions_user` |
| **UUID** | รหัสสุ่ม 128 บิต เดายาก | id ของ user/session/draft |
| **ENUM / JSON column** | คอลัมน์ที่รับค่าจากรายการ / เก็บ JSON | `device_category`, `variables` |
| **TTL / expires_at** | อายุของข้อมูล | 24 ชม. / 90 วัน |

## Auth / Security

| ศัพท์ | อธิบายง่ายๆ | ในระบบนี้ |
|---|---|---|
| **JWT** | บัตรผ่านแบบเซ็นด้วยกุญแจ เซิร์ฟเวอร์ตรวจได้โดยไม่ต้องเก็บ session | HS256, 7 วัน |
| **HS256** | อัลกอริทึมเซ็นแบบใช้กุญแจลับเดียวกัน | `token.ts:33` |
| **Bearer token** | แนบ token ใน header `Authorization: Bearer …` | `http.ts` |
| **bcrypt / hash / salt** | ฟังก์ชันแฮชรหัสผ่านที่ช้าโดยตั้งใจ และใส่ค่าสุ่มให้ทุกรหัส | cost 10 |
| **Timing attack** | เดาข้อมูลจากเวลาตอบที่ต่างกัน | กันด้วย `dummyHash` |
| **User enumeration** | รู้ได้ว่าอีเมลไหนมีบัญชี | register ยังบอกได้ |
| **Role / RBAC** | สิทธิ์ตามบทบาท user/admin | `role.enum.ts` |
| **Guest / X-Client-Id** | ผู้ใช้ไม่ล็อกอิน ระบุด้วย UUID ของเบราว์เซอร์ | `clientId.ts` |
| **IDOR** | เข้าถึงข้อมูลคนอื่นด้วยการเปลี่ยน id | กันด้วยเงื่อนไขเจ้าของใน SQL |
| **XSS** | แทรกสคริปต์ลงหน้าเว็บ | React escape ให้ |
| **CORS** | กติกาว่าเว็บ origin ไหนเรียก API ได้ | `CORS_ORIGIN` |
| **Rate limiting** | จำกัดจำนวนคำขอต่อเวลา | ยังไม่มี |
| **ReDoS** | regex ที่ทำให้ CPU ค้าง | `pattern` ของโหนด input |
| **Magic bytes** | ไบต์ต้นไฟล์ที่บอกชนิดไฟล์จริง | `%PDF-` |
| **OWASP Top 10** | รายการความเสี่ยงเว็บที่พบบ่อย | `docs/SECURITY_AUDIT.md` |

## Frontend / Deploy

| ศัพท์ | อธิบายง่ายๆ | ในระบบนี้ |
|---|---|---|
| **SPA** | เว็บหน้าเดียวที่เปลี่ยนหน้าด้วย JavaScript | React + React Router |
| **TanStack Query** | ไลบรารีจัดการข้อมูลจาก server (cache, loading, error) | `api/queries.ts` |
| **Query key / invalidate** | ชื่อของข้อมูลใน cache / สั่งให้โหลดใหม่ | `['history', identity, …]` |
| **Mutation** | คำขอที่เปลี่ยนข้อมูล | ค้นหา, เริ่ม session, ส่ง action |
| **React Context** | ส่ง state ให้ทั้งแอปโดยไม่ต้องส่งต่อทีละชั้น | `AuthContext` |
| **localStorage** | ที่เก็บข้อมูลในเบราว์เซอร์ | token, client id |
| **Vite** | เครื่องมือ build/dev ของ frontend | `vite.config.ts` |
| **PaaS** | บริการรันแอปโดยไม่ต้องดูแลเซิร์ฟเวอร์ | Render |
| **Cold start** | เซิร์ฟเวอร์หลับแล้วต้องปลุก คำขอแรกช้า | Render free ~1 นาที |
| **Health check** | endpoint ให้ระบบ deploy ตรวจว่าแอปยังดี | `/health` |
| **Docker / docker-compose** | แพ็กแอปเป็น container / รันหลาย container พร้อมกัน | ไม่มีในโปรเจกต์ |
| **Environment variable** | ค่าตั้งค่าที่ส่งให้แอปจากภายนอก (รวมความลับ) | `.env`, Render dashboard |
