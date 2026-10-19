# Step 5 — B1 (backend) : วิธีทดสอบด้วย PowerShell · ลบข้อมูล demo · สำรองข้อมูล

สถานะ: **B1 เขียนครบ** (migration 012, validator, อ่าน PDF, LLM client, drafts API, `reload()` / `addGraphs()`, เทสต์)
`npm run build` ผ่าน · `npx jest` ผ่าน 17 ชุด 381 เคส (รวมของ Step 1–3 เดิม) · ดูหัวข้อ 8 ว่าอะไรทดสอบจริง/ไม่ได้ทดสอบ
ยังไม่มีหน้าจอ (B2) · แผนเต็ม: `docs/authoring/PLAN-STEP5-AUTHORING.md`

---

## 1. ภาพรวมสั้นๆ

```
POST /admin/drafts (PDF + ข้อมูลคู่มือ + ช่วงหน้า ≤ 10)  → 202 {id}
   อ่านข้อความช่วงหน้า (ในหน่วยความจำ ไม่เก็บ PDF) → LLM ร่างทีละ 2 หน้า (เบื้องหลัง ทีละ 1 งาน)
   → parse เข้ม → validator (โค้ดล้วน) → สถานะ ready / failed
GET  /admin/drafts/:id            ดูผังร่าง + ข้อความหน้าต้นฉบับ + รายงาน validator + ความคืบหน้า
PUT  /admin/drafts/:id            แก้ผัง (ตรวจใหม่ทุกครั้ง)
POST /admin/drafts/:id/publish    {"acknowledgedWarnings": true|false}
POST /admin/drafts/:id/reject
```

หลักการที่เทสต์ล็อกไว้: LLM ไม่มีอำนาจ · publish ตรวจซ้ำฝั่งเซิร์ฟเวอร์ทุกครั้ง · **error ≥ 1 = เผยแพร่ไม่ได้ ไม่มี override** ·
**warning ≥ 1 = 409 เว้นแต่ส่ง `acknowledgedWarnings: true`** · id ชนของเดิม = ไม่เขียนทับ · ร่างอยู่ในตาราง `graph_drafts` ที่ผู้ใช้ไม่มีทางอ่าน

---

## 2. ⚠️ ก่อนทดสอบ publish ครั้งแรก: สำรองฐานข้อมูล

publish **เขียนลงฐานข้อมูลจริง** (Aiven ใช้ร่วมกับโปรเจกต์เก่า) แบบ INSERT อย่างเดียว (ไม่แก้/ลบของเดิม) แต่ให้สำรองก่อนเสมอ

```powershell
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\backend
node scripts\backup-graph-tables.js
```
ผลที่ควรเห็น: `สำรองสำเร็จ: …\backend\backups\graph-tables-<เวลา>.sql` พร้อมจำนวนแถว (ตอนนี้ manuals 22 · graphs 644 · nodes 4,834)
- สคริปต์อ่านอย่างเดียว ไม่แก้ฐานข้อมูล ไม่ต้องมี `mysqldump` ใช้ค่าเชื่อมต่อใน `.env` เอง
- ผมรันให้แล้วครั้งหนึ่งระหว่างพัฒนา (ได้ไฟล์ใน `backend\backups\`) แต่ **ให้รันใหม่ทันทีก่อน publish ครั้งแรกของคุณ** เพื่อให้ได้ข้อมูล ณ ตอนนั้น
- ไฟล์เป็น `INSERT` ล้วน (ไม่ลบอะไร) เก็บไว้เป็นหลักฐาน/กู้คืนเฉพาะแถวที่หาย · โฟลเดอร์ `backups/` อยู่ใน `.gitignore` แล้ว
- ถ้ามี `mysqldump` และต้องการสำรองทั้งฐานข้อมูล ใช้ได้เช่นกัน (ไม่จำเป็น)

---

## 3. ติดตั้งและตั้งค่า (ทำครั้งเดียว)

```powershell
cd C:\Users\SPS\Desktop\499\appliance-repair-assistant\backend
npm install unpdf
npm install --save-dev @types/multer     # ไม่บังคับ: โค้ดไม่พึ่งชนิดข้อมูลของมัน (ประกาศ interface เอง) แต่ติดตั้งไว้ตามที่อนุมัติ
npm run migrate                          # ต้องเห็น "รอรัน 1" แล้วสร้างตาราง graph_drafts (012)
npm run build
```

เพิ่มใน `backend\.env` (ผมไม่ได้อ่านไฟล์นี้ ใส่เองตามชื่อด้านล่าง):

| ตัวแปร | ความหมาย |
|---|---|
| `AUTHORING_LLM_MODEL` | **บังคับ** ชื่อโมเดลของ Groq ที่รองรับ JSON mode (ไม่มีค่าเริ่มต้น เพราะชื่อโมเดลเปลี่ยนได้) ไม่ตั้ง = ร่างจะล้มด้วย `LLM_NOT_CONFIGURED` |
| `GROQ_API_KEY` | ใช้ตัวเดียวกับ rephrase (มีอยู่แล้ว) · `REPHRASE_ENABLED` ไม่เกี่ยว |
| `AUTHORING_LLM_TIMEOUT_MS` | ไม่บังคับ ค่าเริ่มต้น 60000 |
| `AUTHORING_LLM_MAX_TOKENS` | ไม่บังคับ ค่าเริ่มต้น 6000 |
| `AUTHORING_MAX_PDF_MB` | ไม่บังคับ ค่าเริ่มต้น **10** (ดูหมายเหตุด้านล่าง) |

> **หมายเหตุขนาดไฟล์:** PDF คู่มือส่วนใหญ่ในโปรเจกต์ใหญ่กว่า 10 MB (เช่น 14–47 MB) ที่เล็กพอสำหรับค่าเริ่มต้นมีไม่กี่ไฟล์ — ตั้ง `AUTHORING_MAX_PDF_MB=50` ได้ถ้าจำเป็น แต่ไฟล์ทั้งก้อนอยู่ในหน่วยความจำ และ pdf.js ใช้ RAM มากกว่าขนาดไฟล์ (บน Render free 512 MB เสี่ยง) · `unpdf` ต้องการ Node ≥ 22 (เครื่องคุณใช้ 22.17 ใช้ได้ · ยังไม่ได้ตรวจเวอร์ชัน Node บน Render)

เริ่ม backend ใหม่ (หยุดตัวเก่าก่อน):
```powershell
npm run seed:admin      # ถ้ายังไม่มีบัญชี admin
npm run start:prod
```
ตรวจว่า endpoint ขึ้นแล้ว: `Invoke-WebRequest http://localhost:3000/admin/drafts` ต้องได้ **401** (ไม่ใช่ 404)

---

## 4. ขั้นตอนทดสอบ (PowerShell)

PDF ตัวอย่างที่ไฟล์ไม่เกิน 10 MB และมีข้อความ (ผมตรวจให้แล้ว):

| ไฟล์ (ใน `data\pdf\`) | ขนาด | หน้า Troubleshooting ที่เจอ |
|---|---|---|
| `BMF_RB6000D_DA68-04800B_EN_240305.pdf` (ตู้เย็น) | 9.2 MB · 80 หน้า | 68–73 |
| `OID138241_IB_21WA40F_NON-WIFI_GOOD_EN_260212.pdf` (เครื่องซักผ้า) | 5.2 MB · 48 หน้า | 39–41 (และอื่นๆ) |
| `ME73MD_XST-DE68-04091Q-01_TH-EN.pdf` (ไมโครเวฟ) | 6.2 MB · 48 หน้า | 26, 32, 44 |

> ชื่อ `manualId` ของการทดสอบ **ต้องขึ้นต้นด้วย `demo_`** เสมอ (เพื่อลบทีหลังได้ปลอดภัย ดูหัวข้อ 6) และต้องเป็นคู่มือใหม่ที่ยังไม่มีในระบบ

### 4.1 เข้าสู่ระบบเป็น admin
```powershell
$api = 'http://localhost:3000'
$email = Read-Host 'admin email'
$pass  = Read-Host 'admin password' -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pass))
$login = Invoke-RestMethod "$api/auth/login" -Method Post -ContentType 'application/json' -Body (@{ email=$email; password=$plain } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($login.accessToken)" }
function Show($sb) { try { & $sb | ConvertTo-Json -Depth 8 } catch { "HTTP $([int]$_.Exception.Response.StatusCode): $($_.ErrorDetails.Message)" } }
```

### 4.2 สิทธิ์ (ต้องปฏิเสธ)
```powershell
Show { Invoke-RestMethod "$api/admin/drafts" }                        # 401 UNAUTHENTICATED
# สมัครบัญชีธรรมดาแล้วลองด้วย token ของมัน → 403 FORBIDDEN
$u = Invoke-RestMethod "$api/auth/register" -Method Post -ContentType 'application/json' -Body (@{ email="u$(Get-Random)@example.com"; password='demo-pass-123'; displayName='U' } | ConvertTo-Json)
Show { Invoke-RestMethod "$api/admin/drafts" -Headers @{ Authorization = "Bearer $($u.accessToken)" } }
```

### 4.3 อัปโหลด (multipart ใช้ `curl.exe` เพราะ PowerShell 5.1 ไม่มี `-Form`)
```powershell
$pdf = 'C:\Users\SPS\Desktop\499\appliance-repair-assistant\data\pdf\BMF_RB6000D_DA68-04800B_EN_240305.pdf'
$resp = curl.exe -s -X POST "$api/admin/drafts" -H "Authorization: Bearer $($login.accessToken)" `
  -F "file=@$pdf;type=application/pdf" `
  -F manualId=demo_rb6000d_test -F deviceCategory=Refrigerator -F brand=Samsung -F modelPattern=RB6000D `
  -F "sourceManual=Samsung RB6000D User Manual (DEMO)" -F "displayName=DEMO RB6000D" `
  -F pageFrom=68 -F pageTo=69 | ConvertFrom-Json
$resp          # → id, status = drafting (HTTP 202)
```
ติดตามความคืบหน้า (LLM ทีละ 2 หน้า จึงมี 1 ขั้นสำหรับ 2 หน้า):
```powershell
do { Start-Sleep 3; $d = Invoke-RestMethod "$api/admin/drafts/$($resp.id)" -Headers $h; "$($d.status)  $($d.progress.done)/$($d.progress.total)" } while ($d.status -eq 'drafting')
```
ผลที่ควรเห็น: `ready` (หรือ `failed` พร้อม `$d.error.code` ถ้า LLM ไม่ตั้งค่า/ล้ม — ดู 4.6)

### 4.4 ตรวจร่าง
```powershell
$d.graphCount
$d.validation.errors   | Format-Table code, graphId, nodeId, message -AutoSize -Wrap
$d.validation.warnings | Format-Table code, graphId, nodeId, message -AutoSize -Wrap
$d.graphs[0].nodes | Format-Table node_id, type, source_page, safety_critical -AutoSize   # ทุกโหนดมี source_page
$d.pages | Select-Object page, @{n='chars';e={$_.text.Length}}                              # ข้อความหน้าต้นฉบับที่เก็บไว้
```
**สิ่งที่ผู้ตรวจต้องทำจริง (ไม่ใช่แค่ดูผ่าน/ไม่ผ่าน):** เทียบข้อความทุกโหนดกับ `$d.pages[].text` ของหน้าที่โหนดอ้าง และดูว่าขั้นตอนที่เกี่ยวกับไฟฟ้า/ความร้อนมี `safety_critical` ครบ
validator ตรวจโครงสร้างและความปลอดภัยเชิงกฎ แต่ **ตรวจความถูกต้องของคำแปล/เนื้อหาไม่ได้**

### 4.5 แก้ผัง (ไม่บังคับ) / ปฏิเสธ
```powershell
$graphs = $d.graphs                       # แก้ค่าใน $graphs แล้วส่งกลับ — ตรวจใหม่ทุกครั้ง
$body = @{ graphs = $graphs } | ConvertTo-Json -Depth 20
$d2 = Invoke-RestMethod "$api/admin/drafts/$($d.id)" -Method Put -Headers $h -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))
$d2.validation.errors.Count
# ปฏิเสธ: Show { Invoke-RestMethod "$api/admin/drafts/$($d.id)/reject" -Method Post -Headers $h -ContentType 'application/json' -Body '{"reason":"ทดสอบ"}' }
```

### 4.6 เผยแพร่ (ทำหลังสำรองข้อมูลแล้ว · หัวข้อ 2)
```powershell
# (1) ไม่ส่ง flag — ถ้ามี warning ต้องได้ 409 DRAFT_WARNINGS_UNACKNOWLEDGED · ถ้ามี error ต้องได้ 409 DRAFT_INVALID
Show { Invoke-RestMethod "$api/admin/drafts/$($d.id)/publish" -Method Post -Headers $h -ContentType 'application/json' -Body '{}' }
# (2) ยืนยันว่าอ่านคำเตือนแล้ว (error ยังกันอยู่เสมอ แม้ส่ง true)
Show { Invoke-RestMethod "$api/admin/drafts/$($d.id)/publish" -Method Post -Headers $h -ContentType 'application/json' -Body '{"acknowledgedWarnings":true}' }
```
สำเร็จ → `status: published`, `graphIds`, `searchIndex.indexed` (true ถ้าเปิด `SYMPTOM_SEARCH_ENABLED=true` และดัชนีพร้อม)

ตรวจว่าผังใหม่ใช้งานได้ **โดยไม่ต้องรีสตาร์ต** (ผ่าน `GraphRepository.reload()`):
```powershell
Invoke-RestMethod "$api/traversal/graphs?manualId=demo_rb6000d_test" | Select-Object graphId, entrySymptomTh
$g = (Invoke-RestMethod "$api/traversal/graphs?manualId=demo_rb6000d_test")[0].graphId
Show { Invoke-RestMethod "$api/traversal/sessions" -Method Post -ContentType 'application/json' -Body (@{ graphId=$g } | ConvertTo-Json) }
Invoke-RestMethod "$api/admin/drafts/$($d.id)/publish" -Method Post -Headers $h -ContentType 'application/json' -Body '{"acknowledgedWarnings":true}'   # ซ้ำ → 409 DRAFT_NOT_READY
```
ถ้าเปิดระบบค้นหาอยู่: `POST /symptom-search` ด้วยอาการของผังใหม่ ควรเจอผัง `demo_…` (ดัชนีเพิ่มผ่าน `addGraphs`)

### 4.7 ความล้มเหลวที่ควรลอง
```powershell
$txt = "$env:TEMP\not-a-pdf.txt"; 'hello' | Set-Content $txt
curl.exe -s -X POST "$api/admin/drafts" -H "Authorization: Bearer $($login.accessToken)" -F "file=@$txt" -F manualId=demo_x1 -F deviceCategory=Refrigerator -F brand=S -F modelPattern=X -F sourceManual=X -F pageFrom=1 -F pageTo=2   # → 415 PDF_UNSUPPORTED_TYPE
$big = 'C:\Users\SPS\Desktop\499\appliance-repair-assistant\data\pdf\DC68-04382A-13.pdf'                                                                                                       # 16 MB
curl.exe -s -X POST "$api/admin/drafts" -H "Authorization: Bearer $($login.accessToken)" -F "file=@$big;type=application/pdf" -F manualId=demo_x2 -F "deviceCategory=Refrigerator" -F brand=S -F modelPattern=X -F sourceManual=X -F pageFrom=1 -F pageTo=2   # → 413 PDF_TOO_LARGE
```
(ภาพสแกน / LLM ล่ม / JSON เสีย / ร่างซ้อนกัน / ID ชน ทดสอบด้วยเทสต์อัตโนมัติแล้ว — ดูหัวข้อ 8)

---

## 5. รหัส error ใหม่

| status | code | เมื่อ |
|---|---|---|
| 400 | `INVALID_DRAFT_REQUEST` | ฟิลด์ผิด / ไม่แนบไฟล์ / ช่วงหน้าผิด / body ผิดรูป |
| 413 | `PDF_TOO_LARGE` | ไฟล์เกิน `AUTHORING_MAX_PDF_MB` หรือเกิน 200 หน้า |
| 415 | `PDF_UNSUPPORTED_TYPE` | ไม่ใช่ PDF (ตรวจจากไบต์จริง) |
| 422 | `PDF_NO_TEXT` / `PDF_UNREADABLE` / `PDF_PAGE_TOO_LONG` | ภาพสแกน · ไฟล์เสีย/มีรหัสผ่าน · หน้าข้อความยาวเกิน 12,000 ตัวอักษร |
| 404 | `DRAFT_NOT_FOUND` | ไม่พบร่าง |
| 409 | `DRAFT_NOT_READY` · `DRAFT_BUSY` · `DRAFT_INVALID` · `DRAFT_WARNINGS_UNACKNOWLEDGED` · `DRAFT_ID_CONFLICT` | สถานะไม่ถูก · มีร่างอื่นกำลังร่าง · validator มี error · มี warning ยังไม่ยืนยัน · id ชนของเดิม |
| 500 | `PUBLISH_RELOAD_FAILED` | เขียนฐานข้อมูลแล้ว แต่โหลดเข้าหน่วยความจำไม่ได้ (รีสตาร์ต backend) |

สถานะที่เก็บในร่าง (`error.code`): `LLM_NOT_CONFIGURED` · `LLM_TIMEOUT` · `LLM_HTTP` · `LLM_BAD_RESPONSE` · `LLM_PARSE_ERROR` · `NO_GRAPHS_FOUND` · `INTERRUPTED` · `INTERNAL_ERROR` · `REJECTED`

---

## 6. ลบข้อมูล demo (ไม่มี endpoint ลบ — ใช้ SQL เอง)

ผังที่ publish จากการทดสอบมี `manual_id` ขึ้นต้น `demo_` และ `graph_id` ขึ้นต้นด้วย `manual_id` เสมอ (`demo_<คู่มือ>_<slug>`) จึงลบด้วย pattern นี้ได้ **ห้ามใช้ pattern กว้างกว่านี้**

> ⚠️ **session ที่อ้างผัง demo ทำให้ลบผังไม่ได้** — `sessions.graph_id` มี FK แบบ `ON DELETE RESTRICT` ถ้ามีใครเคยเริ่มตรวจด้วยผัง demo (รวมที่คุณทดสอบเอง) `DELETE FROM graphs` จะล้มด้วย error FK จนกว่าจะลบ session เหล่านั้นก่อน (ขั้นที่ 2 ด้านล่าง) การลบ session จะลบ `session_history` และ `session_feedback` ของมันตามไปด้วย (CASCADE) — ประวัติการซ่อมของผู้ใช้ที่เกี่ยวกับผัง demo จะหาย

รันด้วยโปรแกรม MySQL ใดก็ได้ที่ต่อ Aiven (เช่น คอนโซลของ Aiven, MySQL Workbench, DBeaver) **ตามลำดับนี้ในทรานแซกชันเดียว**:

```sql
-- 1) ดูก่อนว่าจะลบอะไร (ต้องมีแต่ของ demo)
SELECT manual_id, graph_count FROM manuals WHERE manual_id LIKE 'demo\_%';
SELECT graph_id FROM graphs WHERE manual_id LIKE 'demo\_%';
SELECT COUNT(*) AS sessions_ที่อ้างผัง_demo FROM sessions WHERE graph_id LIKE 'demo\_%';

-- 2) ลบ (ลำดับตาม FK: ลูกก่อนพ่อ)
START TRANSACTION;
DELETE FROM sessions WHERE graph_id LIKE 'demo\_%';   -- session_history + session_feedback ลบตามด้วย CASCADE
DELETE FROM nodes    WHERE graph_id LIKE 'demo\_%';   -- (nodes → graphs เป็น CASCADE อยู่แล้ว ลบตรงๆ ให้ชัดเจน)
DELETE FROM graphs   WHERE manual_id LIKE 'demo\_%';
DELETE FROM manuals  WHERE manual_id LIKE 'demo\_%';
DELETE FROM graph_drafts WHERE manual_id LIKE 'demo\_%';   -- ไม่บังคับ: ร่างที่เผยแพร่/ปฏิเสธแล้วเก็บไว้เป็นหลักฐานได้
-- 3) ตรวจจำนวนก่อนยืนยัน: ต้องกลับเป็น manuals 22 · graphs 644 · nodes 4834
SELECT (SELECT COUNT(*) FROM manuals) AS manuals, (SELECT COUNT(*) FROM graphs) AS graphs, (SELECT COUNT(*) FROM nodes) AS nodes;
COMMIT;   -- ถ้าตัวเลขไม่ตรง ให้ ROLLBACK;
```
หลังลบ **ต้องรีสตาร์ต backend** (ผังในหน่วยความจำยังมีผัง demo จนกว่าจะรีสตาร์ต — ไม่มี endpoint ลบ/reload แยก)
ถ้าจะกู้ข้อมูลเดิมจากไฟล์สำรอง (กรณีเกิดเหตุ): ไฟล์ `.sql` เป็น `INSERT` ล้วน ให้ลบแถวที่ต้องการแทนที่ก่อนแล้วรันไฟล์ (ตามลำดับ manuals → graphs → nodes)

---

## 7. ข้อควรรู้ / ข้อจำกัด

- **ผู้ตรวจต้องตรวจเนื้อหาเอง** validator ตรวจโครงสร้าง ลูกศร ความปลอดภัยเชิงกฎ และเลขหน้า แต่ตรวจ "คำแปลถูกไหม" "ขั้นตอนตรงคู่มือไหม" ไม่ได้ เหตุผลที่มี `source_page` รายโหนดและเก็บข้อความหน้าต้นฉบับไว้ข้างๆ คือให้คนเทียบได้
- **ผังข้ามขอบกลุ่มหน้า**: LLM เห็นทีละ 2 หน้า อาการที่ยาวข้ามกลุ่มจะถูกตัดหรือถูกข้าม (prompt สั่งให้ข้ามอาการที่ถูกตัด) ตรวจดูว่าผังสำคัญไม่หาย
- **คู่มือใหม่เท่านั้น** (`manual_id` ใหม่) เพิ่มอาการให้คู่มือเดิมผ่านทางนี้ไม่ได้
- **ผัง demo ปนในผลค้นหา/รายการเครื่อง** ของระบบจริงจนกว่าจะลบ และตัวเลขสถิติ admin รวมมันด้วย
- **ร่างทีละ 1 งาน** และเป็นงานเบื้องหลังในโปรเซสเดียว: เซิร์ฟเวอร์ดับกลางงาน → ร่างเป็น `failed` (`INTERRUPTED`) ต้องอัปโหลดใหม่ (ไม่มี retry แล้ว)
- **PDF ที่เป็นภาพสแกนไม่รองรับ** (ไม่ทำ OCR) · ไม่เก็บไฟล์ PDF — เก็บแค่ข้อความช่วงหน้าที่เลือก
- **ไม่มี endpoint ลบ/ย้อนการ publish** — ใช้ SQL ในหัวข้อ 6
- เทสต์ `pdf-text.spec.ts` รัน unpdf ในโปรเซส Node แยก เพราะ jest โหลด unpdf ตรงๆ ไม่ได้ (ต้องมี `--experimental-vm-modules`); โค้ดจริงบนเซิร์ฟเวอร์ไม่มีข้อจำกัดนี้

---

## 8. ทดสอบอะไรแล้ว / ยังไม่ได้ทดสอบ (ตรงไปตรงมา)

### ทดสอบจริงแล้ว
- **เทสต์อัตโนมัติ 381 เคส / 17 ชุด ผ่านทั้งหมด** (รวม Step 1–3 เดิม 74+93 เคส ไม่เสีย)
- **validator รันกับผังจริงทั้ง 644 ผัง (4,834 โหนด) ผ่านโดยไม่มี error** + เคสผิดทีละกฎ (รวมถึง LLM ถอดด่านความปลอดภัย → warning, ตัวแปร `{{var}}` ไม่การันตี, วงวนไม่มีทางออก, เส้นทางยาวเกิน, source_page แต่งเอง)
  - ข้อสังเกตของข้อมูลเดิม: โหนด 13 ตัวใน 2 ผังของ `samsung_rs5000fc` (`filter_icon`, `wifi_icon_blinking`) ใช้ node_id แบบ `g1`/`f1`/`c1` ซึ่งไม่ตรง `^n[a-z0-9_]+$` ที่ schema v2 กำหนด — validator บังคับ `n…` เฉพาะร่างใหม่ ข้อมูลเดิมไม่ถูกแตะ
- **อ่าน PDF ด้วย `unpdf` ตัวจริง** (PDF ที่สร้างในเทสต์ + PDF จริง 80 หน้า 9.2 MB อ่านได้ใน ~2 วินาที): เลือกช่วงหน้า, ภาพสแกน, ไฟล์เสีย, เกิน 200 หน้า, เกิน 10 หน้า, หน้ายาวเกิน
- **HTTP ผ่าน pipeline จริง** (guard → multer → controller → service → filter): 401/403/401(token เสีย) ทุก endpoint โดยไม่แตะอะไร · 413/415/422/400 ของการอัปโหลด · ร่างทีละ 1 งาน · LLM ล้มทุกแบบ + retry · publish: error = 409 ไม่มี override, warning ต้องมี flag, ตรวจซ้ำแม้รายงานที่เก็บไว้บอกว่าผ่าน, id ชนไม่เขียนทับ, เผยแพร่ซ้ำ, reload ล้ม, ดัชนีค้นหาเพิ่มไม่ได้
- **round trip**: แถวที่ publish เขียน → โหลดกลับด้วย `GraphRepository` ตัวจริง ได้ผังเดียวกับที่ตรวจ (รวมด่านความปลอดภัย) และ `reload()` ที่ล้มกลางทางไม่ทำให้ผังเดิมหาย
- **ร่างแยกจากข้อมูลผู้ใช้**: เทสต์สแกนซอร์สว่ามีแต่ `authoring/` ที่อ้าง `graph_drafts` และ `GraphRepository` query แค่ graphs/manuals/nodes
- **DI ของ `AuthoringModule` ตัวจริง** ประกอบได้ และ `/admin/drafts` ต้องมี token
- **ชื่อคอลัมน์ที่ publish จะ INSERT ตรงกับตารางจริงใน Aiven** (ตรวจด้วย `SHOW COLUMNS` อ่านอย่างเดียว) · สคริปต์สำรองรันสำเร็จกับฐานข้อมูลจริง
- **พิสูจน์ว่าเทสต์จับบั๊กได้**: ถอด `@Roles` → ล้ม 7 เคส · ถอด `@UseFilters` → ล้ม 46 เคส · ตัดการเช็ก warning → ล้ม 1 เคส · เปิดให้ ack ข้าม error → ล้ม 2 เคส (แล้วคืนไฟล์เดิม)
- เจอและแก้บั๊กระหว่างเทสต์: เพดานขนาดไฟล์ที่เป็นทศนิยม (เช่น `AUTHORING_MAX_PDF_MB=2.3`) ทำให้ busboy ไม่บังคับเพดานเลย → ปัดเป็นจำนวนเต็มแล้วและมีเทสต์กัน

### ยังไม่ได้ทดสอบ
- **ไม่เคยเรียก Groq จริงเลย** — LLM ถูกจำลองในเทสต์ทั้งหมด ตั้งแต่ prompt จนถึงคุณภาพผังที่ได้ (ขั้นตอนถูกไหม คำแปลดีไหม ใส่ safety_critical ครบไหม) **ไม่มีหลักฐานเลย** และยังไม่รู้ว่าโมเดลที่คุณเลือกตอบ JSON ตาม prompt ได้เสถียรแค่ไหน นี่คือความเสี่ยงที่ใหญ่สุดของ Step 5 และต้องลอง 4.3 จริง
- **ยังไม่ได้รัน migration 012** และยังไม่ได้รัน SQL ของ `DraftsStore` กับตาราง `graph_drafts` จริง (ตารางยังไม่มี) — SQL เทียบกับ MySQL จริงได้เฉพาะชื่อคอลัมน์ของ manuals/graphs/nodes · เทสต์ใช้ที่เก็บจำลองที่ทำตามกติกาเดียวกัน จึงยังไม่พิสูจน์ว่า MySQL ยอมรับ SQL ของ `graph_drafts` (เช่น `JSON_LENGTH`, `FOR UPDATE`, การ INSERT เป็นชุด) และ transaction publish จริง
- **ยังไม่ได้ publish จริงลงฐานข้อมูล**
- ยังไม่ได้ทดสอบกับ `unpdf` ที่ติดตั้งในโปรเจกต์ (ตอนทดสอบชี้ไปที่ที่ติดตั้งชั่วคราวนอกโปรเจกต์) — หลัง `npm install unpdf` ให้รัน `npx jest` อีกครั้ง
- ยังไม่ได้ทดสอบ PDF ภาษาไทย/ฟอนต์พิเศษ, PDF ที่เข้ารหัส, ไฟล์ใหญ่ใกล้เพดาน หรือหลายงานพร้อมกัน
- ยังไม่ได้ดูผลกับ RAM บน Render free
