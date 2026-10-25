# สรุปไฟล์ backend (หลังย้ายเป็น Express) — มีกี่ไฟล์ แต่ละไฟล์ทำอะไร

> นับจาก `backend/src` เมื่อ 21 ต.ค. 2569 · **50 ไฟล์ / 6,321 บรรทัด** (รวมคอมเมนต์และบรรทัดว่าง)
> ใช้คู่กับ `docs/STUDY_GUIDE.md` (เลขบรรทัดอ้างอิง) · เอกสารเก่า `docs/reference/FILE-MAP.md` ยังเป็นยุค NestJS ห้ามใช้อ้างอิงชื่อไฟล์

## 1. ภาพรวมจำนวนไฟล์

| โฟลเดอร์ | ไฟล์ | บรรทัด | หน้าที่โดยย่อ |
|---|---:|---:|---|
| (ราก) | 2 | 117 | จุดเริ่ม + ประกอบแอป |
| `common/` | 4 | 161 | ของกลาง: error, log, helper |
| `database/` | 1 | 82 | ต่อ MySQL |
| `auth/` | 8 | 601 | สมัคร/ล็อกอิน/JWT/ตรวจสิทธิ์/ระบุเจ้าของ session |
| `traversal-engine/` | 2 | 316 | เครื่องสถานะเดินผัง (ฟังก์ชันล้วน ไม่รู้จัก HTTP/DB) |
| `traversal/` | 6 | 1,083 | API เดินผัง + เก็บ session + ผังในหน่วยความจำ |
| `embedding/` | 1 | 55 | โหลดโมเดล AI แปลงข้อความเป็นเวกเตอร์ |
| `symptom-search/` | 4 | 422 | ค้นอาการที่ใกล้เคียง |
| `rephrase/` | 3 | 180 | LLM เรียบเรียงข้อความ + ด่านตรวจ |
| `history/` | 4 | 675 | หน้าประวัติการซ่อม + feedback |
| `admin/` | 4 | 633 | สถิติ + feedback สำหรับผู้ดูแล |
| `authoring/` | 10 | 1,958 | ผู้ดูแลอัปโหลด PDF → LLM ร่างผัง → ตรวจ → publish |
| `health/` | 1 | 38 | เช็กว่าระบบ/DB ยังอยู่ |
| **รวม** | **50** | **6,321** | |

นอก `src` ที่เกี่ยวกับ backend: `migrations/` 6 ไฟล์ (001–006 สร้างตาราง) · `scripts/` 6 ไฟล์ (`run-migrations`, `seed-admin`, `seed-equipment`, `seed-graphs`, `backup-graph-tables`, `study-measure`) · `model/` โฟลเดอร์โมเดล AI · `frontend/src` 87 ไฟล์ (อยู่นอกเอกสารนี้)

## 2. รูปแบบที่ซ้ำกันทุกโมดูล (จำแล้วอ่านได้เร็วขึ้นมาก)

```
คำขอ HTTP → *.routes.ts → *.dto.ts (ตรวจ input) → *.service.ts (ตรรกะ) → *.store.ts / *.repository.ts (SQL / ข้อมูลในหน่วยความจำ)
```

| ท้ายชื่อไฟล์ | ทำอะไร | ไม่ทำอะไร |
|---|---|---|
| `.routes.ts` | บอกว่า URL ไหน → เรียกอะไร, ติด middleware ตรวจสิทธิ์ | ไม่มีตรรกะธุรกิจ |
| `.dto.ts` | ตรวจรูปร่างข้อมูลที่เข้ามา/กำหนดรูปที่ส่งออก | ไม่แตะ DB |
| `.service.ts` | ตรรกะของงาน ต่อ store/engine เข้าด้วยกัน | ไม่เขียน SQL, ไม่รู้จัก Express |
| `.store.ts` / `.repository.ts` | SQL หรือที่เก็บข้อมูล | ไม่ตัดสินใจเรื่องสิทธิ์/ธุรกิจ |

## 3. รายไฟล์

### ราก
| ไฟล์ | บรรทัด | ทำอะไร |
|---|---:|---|
| `main.ts` | 17 | โหลด `.env` → เรียก `createApp()` → เปิดรับคำขอที่ `PORT` |
| `app.ts` | 100 | **แผนที่ของ backend**: ตรวจ JWT_SECRET + ต่อ DB → `new` ทุกชั้นตามลำดับ → โหลดผัง/อุปกรณ์ → เริ่มระบบค้นหา (ไม่รอ) → ติด CORS, parser, routes, 404, errorHandler |

### `common/` — ของกลาง
| ไฟล์ | บรรทัด | ทำอะไร |
|---|---:|---|
| `api-error.ts` | 10 | คลาส `ApiError(status, code, message)` — error ของแอปทุกตัวโยนตัวนี้ |
| `error-handler.ts` | 115 | `errorHandler` (แปลง error ทุกชนิดเป็น `{statusCode, code, message}`), `notFoundHandler` (404), `asyncRoute` (ห่อ handler async ให้ error ไปถึง errorHandler) |
| `logger.ts` | 18 | `createLogger(ชื่อ)` → log/warn/error แบบ `[ชื่อ] ข้อความ` |
| `helpers.ts` | 18 | ฟังก์ชันเล็ก: `isPlainObject`, `round3`, `numOrNull`, แปลง epoch → ISO |

### `database/`
| ไฟล์ | บรรทัด | ทำอะไร |
|---|---:|---|
| `pool.ts` | 82 | `createDbPool()` สร้าง connection pool MySQL (รองรับ SSL ของ Aiven) แล้ว ping — ต่อไม่ได้ = บูตไม่ขึ้น |

### `auth/` — บัญชีและสิทธิ์
| ไฟล์ | บรรทัด | ทำอะไร |
|---|---:|---|
| `role.enum.ts` | 18 | บทบาท `user` / `admin` (ที่เดียวฝั่ง backend) |
| `token.ts` | 53 | `TokenService`: `fromEnv()` ตรวจ `JWT_SECRET`/อายุ, `sign()` ออก JWT HS256, `verify()` ตรวจลายเซ็น |
| `auth.middleware.ts` | 109 | middleware 3 ตัว: `optionalAuth` (ไม่มี token = guest, token เสีย = 401), `requireAuth`, `requireAdmin` + `currentUser(request)` |
| `auth.dto.ts` | 141 | ตรวจ body ของสมัคร/ล็อกอิน (อีเมล รหัสผ่าน ชื่อ) |
| `users.store.ts` | 98 | SQL ตาราง `users` |
| `auth.service.ts` | 97 | สมัคร (hash รหัสผ่านด้วย bcryptjs) / ล็อกอิน / `me` / ออก token |
| `auth.routes.ts` | 46 | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| `session-owner.ts` | 39 | ตัดสินว่า session เป็นของใคร: ล็อกอิน = user, ไม่ล็อกอิน = guest ด้วย header `X-Client-Id` |

### `traversal-engine/` — แกนกลางที่ห้ามพัง
| ไฟล์ | บรรทัด | ทำอะไร |
|---|---:|---|
| `types.ts` | 144 | ชนิดข้อมูลผัง/โหนด 5 ชนิด/action 4 แบบ/สถานะ session + error ของ engine 4 ชนิด |
| `traversal-engine.ts` | 172 | `startSession`, `getCurrentNode`, `submitAction`: ตัดสินขั้นถัดไป + ด่านยืนยันความปลอดภัย · **ฟังก์ชันล้วน ไม่รู้จัก HTTP/DB** |

### `traversal/` — เดินผัง
| ไฟล์ | บรรทัด | ทำอะไร |
|---|---:|---|
| `traversal.routes.ts` | 94 | 7 endpoint ใต้ `/traversal` (รายการผัง/รุ่น, เริ่ม session, ดู, ส่ง action, outcome, ยกเลิก) |
| `traversal.dto.ts` | 203 | ตรวจ input: client id, body เริ่ม session, action 4 แบบ, outcome + รูป response |
| `traversal.service.ts` | 193 | เรียก engine **ก่อน** แล้วค่อยบันทึก (`:97` ก่อน `:100`), ตรวจเจ้าของ, outcome |
| `session.store.ts` | 236 | SQL ของ session/ประวัติ/outcome (transaction + UNIQUE กัน race) |
| `graph.repository.ts` | 298 | โหลดผังทั้งหมดจาก DB เข้าหน่วยความจำตอนบูต (`load()`), ค้น/จัดกลุ่มเป็นรุ่น, `reload` หลัง publish |
| `equipment.repository.ts` | 59 | โหลดรายการอุปกรณ์เข้าหน่วยความจำ ค้นตามประเภทเครื่อง |

### `embedding/` และ `symptom-search/` — ค้นอาการ
| ไฟล์ | บรรทัด | ทำอะไร |
|---|---:|---|
| `embedding/embedding.service.ts` | 55 | ⭐ ที่เดียวที่แตะโมเดล AI: `load()` (โหลดจาก `backend/model` ห้ามดึงเน็ต, q8, 1 thread), `embed()` (mean pooling + normalize → เวกเตอร์ 384 มิติ) |
| `symptom-matcher.ts` | 95 | คำนวณ cosine, จัดอันดับ "คะแนนสูงสุดต่อผัง", เลือก (เกณฑ์ 0.55 / ไม่เกิน 3) |
| `symptom-search.dto.ts` | 79 | ตรวจ body ค้นหา + รูป response/สถานะระบบค้นหา |
| `symptom-search.service.ts` | 212 | สร้างดัชนีเวกเตอร์ในหน่วยความจำ (`start()` เรียกแบบไม่รอ), กรองรุ่นก่อนจัดอันดับ, `addGraphs` หลัง publish |
| `symptom-search.routes.ts` | 36 | `POST /symptom-search`, `GET /symptom-search/status` |

### `rephrase/` — LLM เรียบเรียงข้อความ
| ไฟล์ | บรรทัด | ทำอะไร |
|---|---:|---|
| `groq-llm.client.ts` | 52 | เรียก Groq (prompt ห้ามเพิ่ม/เปลี่ยนความหมาย) · สร้างได้ต่อเมื่อมี `GROQ_API_KEY` + `GROQ_MODEL` |
| `rephrase-guard.ts` | 61 | ด่านตรวจผลลัพธ์ด้วยโค้ดล้วน: ตัวเลข, คำอังกฤษ/รหัส, จำนวนคำ "ไม่", ความยาว 0.5–1.6 เท่า, ไม่มีลิงก์/markdown |
| `rephrase.service.ts` | 67 | เรียก LLM ภายใน timeout (3 วินาที) → ผ่าน guard จึงใช้ ไม่งั้นคืนข้อความต้นฉบับ · ข้ามโหนด safety/โหนดจบ |

### `history/` — ประวัติการซ่อม
| ไฟล์ | บรรทัด | ทำอะไร |
|---|---:|---|
| `history.routes.ts` | 68 | `GET /history`, `GET /history/:id`, `POST /history/:id/feedback`, `DELETE /history/:id` |
| `history.dto.ts` | 189 | ตรวจ `page`/`pageSize`, body feedback + รูป response |
| `history.service.ts` | 258 | รายการ/รายละเอียด (เล่นเส้นทางซ้ำ), บันทึก feedback, ลบ |
| `history.store.ts` | 160 | SQL ของหน้าประวัติ |

### `admin/` — ผู้ดูแล (อ่านอย่างเดียว)
| ไฟล์ | บรรทัด | ทำอะไร |
|---|---:|---|
| `admin.routes.ts` | 44 | `GET /admin/feedback`, `GET /admin/analytics/summary` (ต้อง `requireAuth` + `requireAdmin`) |
| `admin.dto.ts` | 231 | ตรวจ query + รูป response |
| `admin.service.ts` | 135 | ประกอบตัวเลขสถิติ (ตัวหาร 0 → `null`) |
| `admin.store.ts` | 223 | SQL อ่านอย่างเดียว · ไม่ SELECT อีเมล/ชื่อ/user_id (ความเป็นส่วนตัว) |

### `authoring/` — PDF → ร่างผัง → publish
| ไฟล์ | บรรทัด | ทำอะไร |
|---|---:|---|
| `drafts.routes.ts` | 140 | 7 endpoint ใต้ `/admin/drafts`, `uploadPdf()` (multer + แปลง error อัปโหลด 413/400) |
| `drafts.dto.ts` | 148 | ตรวจ input ของ route ร่างผัง |
| `drafts.errors.ts` | 36 | ฟังก์ชันสร้าง `ApiError` ของงานร่าง (`draftBusy`, `draftInvalid` ฯลฯ) |
| `drafts.service.ts` | 280 | ควบคุมทั้งงาน: รับไฟล์ → แยก PDF → เรียก LLM (เบื้องหลัง) → ตรวจ → แก้ → reject → publish · `failInterruptedDrafts()` ตอนบูต |
| `drafts.store.ts` | 258 | SQL ของ `graph_drafts` + publish ลง manuals/graphs/nodes ใน transaction |
| `pdf-text.ts` | 110 | แยกข้อความจาก PDF (unpdf) จำกัดช่วงหน้า ≤ 10 หน้า |
| `draft-llm.client.ts` | 149 | เรียก Groq ให้ร่างผัง (prompt + เลขเวอร์ชัน prompt) · `null` ถ้าไม่ตั้ง env |
| `draft-schema.ts` | 212 | ตรวจรูปร่างผลที่ LLM ส่งกลับ |
| `draft-manual.ts` | 123 | ประกอบ manual + ผัง และแปลงเป็นแถว INSERT |
| `graph-validator.ts` | 502 | ตัวตรวจผังด้วยโค้ดล้วน (โครงสร้าง ตัวแปรแม่แบบ วนลูป เส้นทางยาวสุด ฯลฯ) → error = publish ไม่ได้ · 🔖 ต้องกลับมาอ่านทีละกฎ |

### `health/`
| ไฟล์ | บรรทัด | ทำอะไร |
|---|---:|---|
| `health.routes.ts` | 38 | `GET /health` ยิง `SELECT 1` (Render ใช้เช็กว่าระบบยังอยู่) |

## 4. ลำดับอ่านที่แนะนำ (ตรงกับ `READING-PROGRESS.md`)
1. `main.ts` → `app.ts` → `common/error-handler.ts` (แผนที่ + ทางออกของ error)
2. `traversal-engine/*` → `traversal/*` (แกนของระบบ)
3. `embedding` → `symptom-search`
4. `auth/*` (เริ่มที่ `token.ts`, `auth.middleware.ts`)
5. `rephrase/*` → `history/*` → `admin/*`
6. `authoring/*` (ปิดท้ายด้วย `graph-validator.ts`)

## 5. ที่ไม่ได้ตรวจ
คำอธิบายรายไฟล์มาจากส่วนหัวคอมเมนต์ของไฟล์และสิ่งที่ผมอ่านระหว่างย้าย ไฟล์ที่ผมยังไม่ได้อ่านเต็มทุกบรรทัดในรอบนี้ (เช่น `history.*`, `admin.*`, `draft-schema.ts`) ให้ถือคำอธิบายเป็นระดับภาพรวม ไม่ใช่รายละเอียด
