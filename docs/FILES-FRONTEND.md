# แผนที่ไฟล์ฝั่ง Frontend (React 19 + Vite + Tailwind 3 + TanStack Query)

> เขียนเมื่อ 14 ต.ค. 2569 จากการ **อ่านโค้ดจริงทีละไฟล์** ใน `frontend/`
> ไม่ได้เปิดเบราว์เซอร์ทดสอบทุกหน้าในรอบนี้ ข้อความที่บอกพฤติกรรมมาจากการอ่านโค้ด
> ถ้าแก้โค้ดแล้วต้องมาแก้เอกสารนี้ด้วย · คู่กับ [FILES-BACKEND.md](FILES-BACKEND.md)
>
> ไม่ได้อ่านค่าในไฟล์ `.env.development` / `.env.production` (ตามกติกา) ระบุเฉพาะชื่อตัวแปร

---

## 1. ภาพรวมในหน้าเดียว

**หน้าจอทำอะไร:** ให้ผู้ใช้เลือกอาการ แล้วแสดง "ขั้นตอนปัจจุบัน" ที่เซิร์ฟเวอร์ส่งมาทีละขั้น พร้อมปุ่มตอบ **หน้าจอไม่ตัดสินว่าขั้นถัดไปคืออะไร** ทุกอย่างตัดสินที่ backend (`traversal-engine.ts`) หน้าจอแค่แสดงผลและส่ง action กลับไป

### หน้าทั้งหมด (5 เส้นทาง · ใช้ `HashRouter`)

| URL (หลัง `#`) | หน้า | ทำอะไร |
|---|---|---|
| `/` | `HomePage` | หน้าแรก: อธิบายสั้นๆ + ปุ่ม "เลือกอาการที่พบ" + รายการ "รองรับตอนนี้" |
| `/symptoms` | `SymptomsPage` | พิมพ์อาการให้ระบบค้นหาช่วยหา (สูงสุด 3 ผล) → เลือกแถวเพื่อเริ่มตรวจ |
| `/symptoms/all` | `AllSymptomsPage` | อาการทั้งหมด จัดกลุ่มตามเครื่อง/ยี่ห้อ/รุ่น → เลือกแถวเพื่อเริ่มตรวจ |
| `/session/:sessionId` | `SessionPage` | ตอบทีละขั้นจนจบ + บันทึกผลลัพธ์ |
| อื่นๆ | `NotFoundPage` | ไม่พบหน้า |

> เหตุผลที่ใช้ `HashRouter` (URL เป็น `…/#/symptoms`): GitHub Pages ไม่รู้จักเส้นทางย่อยของแอป เปิดลิงก์ตรงแล้วจะ 404 ถ้าใช้ BrowserRouter

### ชั้นของโค้ด (ลูกศร = เรียกใช้)

```
pages/        หน้า 5 หน้า ประกอบ components เข้าด้วยกัน
  ↓
components/   ชิ้นส่วนหน้าจอ (ฟอร์ม แถว กล่องแจ้งเตือน ขั้นตอนแต่ละชนิด) · ui/ = ปุ่ม ไอคอน กล่อง
  ↓
lib/          ตรรกะล้วน (ฟังก์ชันธรรมดา ไม่แตะ React ยกเว้น 2 hook) + ข้อความไทย
  ↓
api/          queries.ts (hook ของ React Query) → traversal.ts (ฟังก์ชันเรียก endpoint) → http.ts (fetch)
```

กติกา: หน้าจอเรียก backend ผ่าน `api/queries.ts` เท่านั้น ไม่เรียก `traversal.ts` หรือ `fetch` ตรงๆ

### ข้อมูลไหลยังไง (React Query เป็นแคช)

```
กดเลือกอาการ ──useStartSession──▶ POST /traversal/sessions ──▶ ใส่ผลลงแคช ['session', id]
      │                                                            │
      └──navigate('/session/id')──▶ SessionPage ◀──useSession อ่านจากแคช (ไม่ยิงซ้ำ)
                                         │
กด "ใช่/ถัดไป" ──useSubmitAction──▶ POST …/actions ──▶ ตอบ session ใหม่ ──▶ ใส่ลงแคช → หน้าเปลี่ยนขั้น
                                         │ ถูกปฏิเสธ (เช่น ยังไม่ติ๊กคำเตือน) → ไม่ใส่แคช → หน้าไม่ขยับ
```

### โครงของ SessionPage (หน้าที่ซับซ้อนที่สุด)

```
SessionPage → SessionView (key = sessionId)
 ├─ SessionHeader ......... ชื่ออาการ + รุ่น + ปุ่มยกเลิก + คะแนนความคล้าย (ถ้ามี)
 ├─ EquipmentPanel ........ อุปกรณ์ที่อาจต้องใช้ (พับได้บนมือถือ)
 ├─ SlowServerNotice / SessionErrorNotice
 └─ PathRail .............. เส้นทางที่ผ่านมา + ขั้นปัจจุบัน
     └─ StepView .......... เลือกหน้าตาตามชนิดโหนด
         ├─ node.isTerminal ................ OutcomeStep (+ OutcomeForm + TerminalActions)
         ├─ node.requiresSafetyConfirmation  SafetyGateStep  (ติ๊กรับคำเตือนก่อนจึงกดได้)
         ├─ type = checkpoint ............... CheckpointStep (ใช่ / ไม่ใช่)
         ├─ type = input .................... InputStep
         └─ อื่นๆ (instruction) ............. InstructionStep (ถัดไป)
            ทุกแบบห่อด้วย StepCard → ReferenceLine (ที่มา: คู่มือ หน้า…)
```

---

## 2. โครงสร้างโฟลเดอร์

```
frontend/
├─ index.html · vite.config.ts · tailwind.config.js · postcss.config.js
├─ eslint.config.js · tsconfig.json (+ .app.json, .node.json) · package.json
├─ .env.development · .env.production      (ไม่ได้อ่านค่า)
├─ public/favicon.svg
└─ src/
   ├─ main.tsx · App.tsx · index.css · env.d.ts
   ├─ api/         http.ts · traversal.ts · queries.ts · types.ts
   ├─ lib/         errors · labels · outcome · reference · search · symptoms · trail
   │               useSlowWait · useStartSymptom
   ├─ pages/       HomePage · SymptomsPage · AllSymptomsPage · SessionPage · NotFoundPage
   ├─ components/  EquipmentPanel · OutcomeForm · SessionErrorNotice · SessionHeader
   │               SlowServerNotice · SymptomRow · SymptomSearchForm · SymptomSearchResults
   │               SymptomsErrorNotice · TerminalActions · RephraseNote
   │   ├─ layout/  AppShell · ServerStatus
   │   ├─ step/    StepView · StepCard · ReferenceLine · PathRail · stepProps
   │   │           CheckpointStep · InstructionStep · InputStep · SafetyGateStep · OutcomeStep
   │   └─ ui/      Button · Icon · Notice
```

---

## 3. รายไฟล์ใน `frontend/src/`

### 3.1 จุดเริ่มต้น

| ไฟล์ | ทำอะไร |
|---|---|
| `main.tsx` | ต่อ React เข้ากับ `<div id="root">` ใน `index.html` ห่อด้วย `StrictMode` และ import `index.css` |
| `App.tsx` | ตั้ง `QueryClient` (ไม่ retry, ไม่ refetch ตอนกลับมาที่หน้าต่าง) + `HashRouter` + `AppShell` + ตารางเส้นทาง 5 เส้น |
| `index.css` | สั่งโหลด Tailwind 3 ชั้น + พื้นหลัง `bg-canvas` และสีตัวอักษร `text-ink` ของทั้งหน้า |
| `env.d.ts` | ประกาศชนิดของ `import.meta.env.VITE_API_URL` ให้ TypeScript รู้จัก |

### 3.2 `api/` (คุยกับ backend)

#### `http.ts`
- **ทำอะไร:** ฟังก์ชัน `request<T>(path, {method, body})` ตัวเดียวที่เรียก `fetch` ทั้งแอป
- **ทำงานยังไง:** ต่อ URL จาก `VITE_API_URL` + path (ไม่ตั้งค่า → โยน error บอกให้ตรวจ `.env`) ใส่ `Content-Type: application/json` เมื่อมี body
  - เชื่อมต่อไม่ได้ → `ApiError(0, 'NETWORK_ERROR', …)`
  - ตอบไม่ใช่ 2xx → อ่าน JSON `{code, message}` ถ้าอ่านไม่ได้ใช้ `UNKNOWN_ERROR` แล้วโยน `ApiError(status, code, message)`
  - 204 → `undefined`
- **ข้อควรรู้:** `VITE_API_URL` ต้องไม่มี `/` ท้าย ไม่งั้นได้ `//`

#### `traversal.ts`
- ฟังก์ชันละ 1 endpoint: `getHealth`, `listGraphs`, `startSession(graphId, query?)`, `searchSymptoms`, `getSession`, `submitAction`, `submitOutcome`, `abandonSession` (id ผ่าน `encodeURIComponent`)
- ชนิด `HealthResponse` ไม่มีฟิลด์ `databaseError` (ฝั่ง backend ส่งมา แต่หน้าจอไม่ใช้)

#### `queries.ts`
- **ทำอะไร:** hook ของ React Query ที่หน้าจอเรียกใช้ + `queryKeys` ที่รวม key แคชไว้ที่เดียว
- **hook:**

| hook | ชนิด | พฤติกรรม |
|---|---|---|
| `useHealth` | อ่าน | `staleTime` 30 วินาที |
| `useGraphs` | อ่าน | `staleTime: Infinity` (ข้อมูลไม่เปลี่ยนระหว่างใช้งาน) |
| `useSession(id)` | อ่าน | ปกติอ่านจากแคชที่ `useStartSession` ใส่ไว้ ยิง API จริงเมื่อเปิดลิงก์ตรง/กด F5 |
| `useSymptomSearch` | เปลี่ยน | `useMutation` ไม่แคช (ผลขึ้นกับสถานะโมเดลบนเซิร์ฟเวอร์) |
| `useStartSession` | เปลี่ยน | สำเร็จแล้วใส่ผลลงแคชทันที |
| `useSubmitAction(id)` | เปลี่ยน | สำเร็จแล้วใส่ session ใหม่ลงแคช → หน้าเปลี่ยนขั้นทันที |
| `useSubmitOutcome(id)` | เปลี่ยน | ใส่ session ที่มี `outcome` ลงแคช → ฟอร์มกลายเป็นอ่านอย่างเดียว |
| `useAbandonSession` | เปลี่ยน | ลบ session ออกจากแคชด้วย |

#### `types.ts`
- **ทำอะไร:** ชนิดข้อมูลที่หน้าจอใช้: `GraphSummary`, `SymptomMatch`, `SymptomSearchResponse`, `SessionResponse` (มี `displayText?: string | null` ข้อความที่ AI เรียบเรียง), `EquipmentItem`, `ApiErrorBody`
- **ข้อควรรู้ ⚠️:** ชนิดหลัก (`RenderedNode`, `TraversalAction`, `DeviceCategory` ฯลฯ) **import ตรงจาก `../../../backend/src/traversal-engine/types`** ผูก frontend กับโฟลเดอร์ backend ใน repo เดียวกัน (เป็น type อย่างเดียว ไม่เข้าไปใน bundle) ข้อดี: แก้ที่ backend แล้วหน้าจอรู้ทันที; ข้อเสีย: แยก repo ไม่ได้ถ้าไม่ลอกไฟล์

### 3.3 `lib/` (ตรรกะล้วน + ข้อความ)

| ไฟล์ | ทำอะไร |
|---|---|
| `errors.ts` | `describeError(error)` แปลง `ApiError.code` เป็นข้อความไทย `{title, detail, recovery, code?}` ตัดสินจาก **code เท่านั้น ไม่ใช้ message ของเซิร์ฟเวอร์** `recovery` มี 4 แบบ: `retry`, `reload-session`, `back-to-symptoms`, `stay` ครอบคลุม 14 รหัส (NETWORK_ERROR, SAFETY_CONFIRMATION_REQUIRED, INVALID_ACTION, SESSION_COMPLETED, SESSION_NOT_FOUND, GRAPH_NOT_FOUND, INVALID_QUERY, SEARCH_NOT_READY, SEARCH_UNAVAILABLE, INVALID_OUTCOME, SESSION_NOT_COMPLETED, OUTCOME_ALREADY_SUBMITTED, GRAPH_NODE_MISSING, GRAPH_SCHEMA_UNSUPPORTED) ที่เหลือ (รวม `INTERNAL_ERROR`) ได้ข้อความ "ข้อผิดพลาดที่ระบบไม่รู้จัก" |
| `labels.ts` | ตารางข้อความไทย: `DEVICE_CATEGORY_LABELS` (`Record<DeviceCategory, string>` ถ้าเพิ่มประเภทที่ backend แล้วลืมที่นี่ TypeScript ฟ้อง), `OUTCOME_TITLES`, `STEP_KIND_LABELS`, `INPUT_SUBMIT_LABELS` |
| `outcome.ts` | `MAX_OUTCOME_LENGTH = 1000` (ลอกจาก backend), `checkOutcome` (`ok`/`empty`/`too-long`), `normalizeOutcome` (trim), `formatOutcomeCounter` (`12/1000`) |
| `search.ts` | `MAX_QUERY_LENGTH = 200` (ลอกจาก backend), `checkQuery`, `normalizeQuery`, `formatScore` (ทศนิยม 3 ตำแหน่งเสมอ **ไม่แสดงเป็นเปอร์เซ็นต์** เพราะ cosine ไม่ใช่ความน่าจะเป็น) |
| `symptoms.ts` | `symptomName` (ชื่อไทย ถ้าไม่มีใช้ชื่ออังกฤษ), `groupSymptoms` (จัดกลุ่มตาม ประเภทเครื่อง+ยี่ห้อ+รุ่น แล้วเรียงด้วย `Intl.Collator('th')` ตามพจนานุกรมไทย) |
| `trail.ts` | `toTrailEntry(node, action)` สร้างบรรทัด "เส้นทางที่ผ่านมา" เช่น "ตอบ ใช่", "ยืนยันคำเตือนแล้ว" (marker `switch-off` สำหรับด่านความปลอดภัย) |
| `reference.ts` | `formatPages` (`หน้า 43` หรือ `หน้า 43–44`), `formatSourceLine` (`ที่มาของขั้นตอนนี้: …`) |
| `useSlowWait.ts` | hook: คืน `true` ถ้ารอเกิน **4 วินาที** (ไว้โชว์ "เซิร์ฟเวอร์กำลังเริ่มทำงาน" เพราะ Render free หลับเมื่อไม่มีคนใช้) |
| `useStartSymptom.ts` | hook: `start(graphId, query?)` เริ่ม session แล้ว `navigate` ไป `/session/:id`; เก็บ `startingId` ว่าแถวไหนกำลังเริ่ม (ใช้ในหน้า `SymptomsPage` และ `AllSymptomsPage`) |

> ค่าที่ "ลอกจาก backend" สองตัว (`MAX_OUTCOME_LENGTH`, `MAX_QUERY_LENGTH`) ไม่มีกลไกเช็กว่าตรงกัน ต้องแก้ทั้งสองที่เอง

### 3.4 `pages/`

| ไฟล์ | รายละเอียด |
|---|---|
| `HomePage.tsx` | `useGraphs` → `groupSymptoms` แสดง "รองรับตอนนี้: เครื่องปรับอากาศ Samsung `AR70H` — 13 อาการ" ปุ่มไป `/symptoms` (ตัดกล่อง "ตัวอย่าง" ที่ใช้ข้อมูลปลอมออกแล้ว) |
| `SymptomsPage.tsx` | `SymptomSearchForm` + `SymptomSearchResults`; กดค้นหา → `useSymptomSearch` → เลือกแถว → `start(graphId, query)` (ส่ง `query` เพื่อให้ได้คะแนนความคล้าย); ข้อผิดพลาดการค้นหา 3 รหัส (`INVALID_QUERY`, `SEARCH_NOT_READY`, `SEARCH_UNAVAILABLE`) ใช้กล่องสีฟ้า ไม่ใช่สีแดง; มีลิงก์ไป `/symptoms/all` เสมอ |
| `AllSymptomsPage.tsx` | `useGraphs` → แสดงเป็นกลุ่ม ใช้ `SymptomRow` (ไม่ส่ง `query` จึงไม่มีคะแนน); ทางสำรองที่ใช้ได้เสมอแม้ระบบค้นหาล่ม |
| `SessionPage.tsx` | ดูหัวข้อ 1; ตัวช่วยกันกดซ้ำด้วย `useRef` (`isSendingRef`, `isSavingOutcomeRef`); หลังเปลี่ยนขั้นจะเลื่อนหน้าและย้ายโฟกัสไปที่หัวข้อ (`h2[tabindex=-1]`) เพื่อโปรแกรมอ่านหน้าจอ; `trail` (เส้นทางที่ผ่านมา) เก็บใน `useState` ของหน้า; **ข้อความ AI:** ถ้ามี `displayText` และขั้นนี้ไม่ใช่ขั้นความปลอดภัย/สิ้นสุด จะส่ง `shownNode` (คัดลอกโหนด เปลี่ยนแค่ `text`) ให้ `StepView` พร้อมแสดง `RephraseNote` — `PathRail` ยังรับโหนดเดิม |
| `NotFoundPage.tsx` | แสดง path ที่ไม่พบ + ลิงก์กลับ |

### 3.5 `components/`

#### ระดับบน

| ไฟล์ | ทำอะไร |
|---|---|
| `SymptomSearchForm.tsx` | ช่องพิมพ์ + ปุ่มค้นหา; `maxLength` ตาม `MAX_QUERY_LENGTH`; กด Enter ส่งได้; ปิดตอนกำลังเริ่ม session |
| `SymptomSearchResults.tsx` | แสดงผลค้นหา: ไม่มีผล → กล่องแจ้ง "ไม่พบ… ระบบไม่เดาอาการให้" (ข้อความมีชื่อ "ศูนย์บริการ Samsung" ฝังอยู่); มีผล → รายการ `SymptomRow` พร้อมคะแนน |
| `SymptomRow.tsx` | 1 แถวอาการ (ชื่อไทย + ชื่ออังกฤษ + คะแนน/ข้อความที่ใกล้เคียง ถ้ามี) สถานะ "กำลังเริ่ม" / จางเมื่อมีแถวอื่นกำลังเริ่ม |
| `SymptomsErrorNotice.tsx` | กล่องแจ้งข้อผิดพลาดตอนโหลดรายการ/เริ่ม session: เชื่อมต่อไม่ได้ หรือแสดง `HTTP <status>` |
| `SessionHeader.tsx` | ชื่ออาการ + ยี่ห้อ/รุ่น + ปุ่ม "ยกเลิกการตรวจ" (ซ่อนเมื่อจบแล้ว) + บรรทัดคะแนนความคล้าย (ระบุว่าเป็นข้อมูลประกอบ) |
| `EquipmentPanel.tsx` | รายการอุปกรณ์ จอเล็กพับ/ขยายได้ จอใหญ่แสดงเลย; แต่ละรายการบอกที่มา (หน้าคู่มือ หรือ "ผู้พัฒนาแนะนำเพิ่ม") |
| `SessionErrorNotice.tsx` | กล่องแจ้งข้อผิดพลาดของหน้าตรวจ: ข้อความจาก `describeError` + ปุ่มตาม `recovery` (ลองอีกครั้ง / ดึงขั้นตอนล่าสุด / เลือกอาการใหม่) |
| `OutcomeForm.tsx` | ฟอร์มบันทึกผล (ไม่บังคับ, ได้ครั้งเดียว): ตัวนับตัวอักษร, ปุ่มบันทึก, แสดงข้อผิดพลาด; ถ้า session มี `outcome` แล้วแสดงข้อความอ่านอย่างเดียว "บันทึกผลแล้ว" |
| `TerminalActions.tsx` | ปุ่ม "ตรวจอาการอื่น" / "เริ่มอาการนี้ใหม่" ตอนจบ |
| `RephraseNote.tsx` | กล่องพับ (`<details>`) "ข้อความนี้ปรับถ้อยคำด้วย AI — ดูข้อความต้นฉบับจากคู่มือ" แสดงเมื่อขั้นปัจจุบันใช้ข้อความที่ AI เรียบเรียง (ความโปร่งใสตาม TOR) |
| `SlowServerNotice.tsx` | กล่องสีฟ้า "เซิร์ฟเวอร์กำลังเริ่มทำงาน" |

#### `layout/`

| ไฟล์ | ทำอะไร |
|---|---|
| `AppShell.tsx` | โครงทุกหน้า: มือถือแถบนำทางด้านบน / จอ ≥ 768px เป็น sidebar ซ้าย; เมนู 3 รายการ (หน้าแรก, เลือกอาการ, อาการทั้งหมด); ชื่อแอป `APP_NAME = 'FixStep'` |
| `ServerStatus.tsx` | ป้ายสถานะมุมล่างของ sidebar จาก `useHealth`: กำลังเชื่อมต่อ / พร้อมใช้งาน / ฐานข้อมูลมีปัญหา / เชื่อมต่อไม่ได้ |

#### `step/` (ขั้นตอนแต่ละชนิด)

| ไฟล์ | ทำอะไร |
|---|---|
| `StepView.tsx` | ตัวเลือกว่าจะแสดงขั้นแบบไหน ตามลำดับ: จบ → ด่านความปลอดภัย → checkpoint → input → instruction |
| `stepProps.ts` | ชนิด `StepProps` ที่ทุกขั้นรับ: `node`, `onAction`, `isPending`, `manualLabel?` |
| `StepCard.tsx` | กรอบการ์ดของทุกขั้น: ป้ายชนิด + หัวข้อ (`h2` รับโฟกัสได้ มี `aria-live`) + เนื้อหา + `ReferenceLine`; `tone="danger"` ขอบแดง |
| `CheckpointStep.tsx` | ปุ่ม "ใช่" / "ไม่ใช่" → `answer` |
| `InstructionStep.tsx` | ปุ่ม "ถัดไป" → `continue` |
| `InputStep.tsx` | ช่องกรอก 1 ช่อง → `input` (รหัส/รุ่นใช้ฟอนต์ monospace, ชนิด number ใช้แป้นตัวเลข) |
| `SafetyGateStep.tsx` | กล่องคำเตือนสีแดง + ช่องติ๊ก "ฉันอ่านคำเตือนแล้ว…" → ปุ่มกดได้เมื่อติ๊กแล้วเท่านั้น → `confirm_safety` |
| `OutcomeStep.tsx` | ผลสรุป: ไอคอน/สีตามชนิดผลลัพธ์ (แก้ได้ / ปกติ / ส่งศูนย์บริการ / คู่มือไม่ครอบคลุม) + ข้อความ + (ฟอร์ม + ปุ่ม) |
| `ReferenceLine.tsx` | "ที่มาของขั้นตอนนี้: … หน้า N" + ปุ่ม "ดูรหัสเอกสาร" |
| `PathRail.tsx` | เส้นแนวตั้งของ "ขั้นที่ผ่านมา" + ขั้นปัจจุบัน (สัญลักษณ์: จุด / สวิตช์เปิด-ปิด / สี่เหลี่ยมสีตามผลลัพธ์) |

> **ด่านความปลอดภัยฝั่งหน้าจอเป็นแค่ UX** (ปุ่มกดไม่ได้จนกว่าจะติ๊ก) ของจริงบังคับที่ backend: ต่อให้ส่ง `continue` ข้ามตรงๆ เซิร์ฟเวอร์ตอบ `SAFETY_CONFIRMATION_REQUIRED`

#### `ui/` (ชิ้นเล็กที่ใช้ซ้ำ)

| ไฟล์ | ทำอะไร |
|---|---|
| `Button.tsx` | ปุ่ม 4 แบบ (`primary`, `secondary`, `answer`, `text`) + `isLoading` (แสดง spinner และปิดปุ่ม) |
| `Icon.tsx` | ไอคอน SVG วาดเอง 12 ตัว (ไม่ใช้ไลบรารี) สีตาม `currentColor` ซ่อนจากโปรแกรมอ่านหน้าจอเสมอ (`aria-hidden`) เพราะทุกจุดมีข้อความคู่กัน |
| `Notice.tsx` | กล่องแจ้งเตือน 2 สี: `info` (ฟ้า) / `danger` (แดง) |

> **ลบไปแล้ว (14 ต.ค. 2569):** `src/mocks/fixtures.ts` (โหนดตัวอย่างที่ไม่มีไฟล์ใดนำเข้า) · prop `label` ของ `Icon` (ไม่มีใครส่งมา) · ชนิด `NodeType`, `Severity`, `Difficulty`, `SessionStatus` ที่ re-export ใน `api/types.ts` โดยไม่มีไฟล์อื่นนำเข้า
> ถ้าจะรันชุดทดสอบใน `draft/code/frontend/tests/` ต้องกู้ `fixtures.ts` กลับด้วย `git checkout HEAD -- frontend/src/mocks/fixtures.ts` (ไฟล์เดิมอยู่ใน git)

---

## 4. ไฟล์ตั้งค่า

| ไฟล์ | หน้าที่ |
|---|---|
| `package.json` | สคริปต์: `dev` (vite), `build` (`tsc -b && vite build`), `preview`, `test` (vitest), `deploy` (build แล้ว `gh-pages -d dist` ขึ้น GitHub Pages) |
| `vite.config.ts` | ปลั๊กอิน React; `base` = `/appliance-repair-assistant/` เมื่อ `mode === 'production'` (GitHub Pages ให้เว็บอยู่ใต้ชื่อ repo) นอกนั้น `/` — ถ้าเปลี่ยนชื่อ repo ต้องแก้บรรทัดนี้ |
| `index.html` | `lang="th"`, ธีมสีมืด, `<title>FixStep ผู้ช่วยตรวจอาการเครื่องใช้ไฟฟ้า`, คำอธิบายเว็บ |
| `tailwind.config.js` | ชุดสี: `canvas` `panel` `line` `accent` (เหลืองส้ม) `ink` (3 ระดับ) `success` `info` `danger`; ฟอนต์ไทย: Leelawadee UI → Noto Sans Thai → Thonburi → Tahoma |
| `postcss.config.js` | Tailwind + Autoprefixer |
| `eslint.config.js` | กฎแนะนำของ JS/TS + react-hooks + react-refresh |
| `tsconfig.json` | ตัวชี้ไปยังสองโปรเจกต์ย่อยด้านล่าง (ไม่มีกฎของตัวเอง) |
| `tsconfig.app.json` | กฎของโค้ดแอปใน `src/`: `jsx: react-jsx`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` |
| `tsconfig.node.json` | กฎของไฟล์ตั้งค่า `vite.config.ts` อย่างเดียว |
| `public/favicon.svg` | ไอคอนแท็บเบราว์เซอร์ |
| `.gitignore` | ไม่รวม `node_modules/`, `dist/`, `.env`, `.env.local` |
| `.env.development`, `.env.production` | ตั้ง `VITE_API_URL` (ไม่ได้อ่านค่า) ชุด production ชี้ backend บน Render |

### ตัวแปรสภาพแวดล้อม

| ชื่อ | ใช้ที่ | หมายเหตุ |
|---|---|---|
| `VITE_API_URL` | `api/http.ts` | **ฝังตอน build** (ไม่ใช่ตอนรัน) ต้องไม่มี `/` ท้าย; เปลี่ยนค่าแล้วต้อง build + deploy ใหม่ |

---

## 5. อยากแก้เรื่องนี้ ไปไฟล์ไหน

| งาน | ไฟล์ที่ต้องแตะ |
|---|---|
| เปลี่ยนข้อความไทยของข้อผิดพลาด | `lib/errors.ts` |
| เพิ่มประเภทเครื่องใหม่ | `DEVICE_CATEGORY_LABELS` ใน `lib/labels.ts` (ตัวชนิดมาจาก backend อัตโนมัติ) |
| เปลี่ยนชื่อแอป | `APP_NAME` ใน `components/layout/AppShell.tsx` **และ** `<title>` ใน `index.html` |
| เพิ่มหน้าใหม่ | ไฟล์ใน `pages/` + `<Route>` ใน `App.tsx` + (ถ้าจะให้อยู่ในเมนู) `NAV_ITEMS` ใน `AppShell.tsx` |
| เปลี่ยนสี/ฟอนต์ | `tailwind.config.js` |
| เปลี่ยนเวลาที่ขึ้น "เซิร์ฟเวอร์กำลังเริ่มทำงาน" | `SLOW_WAIT_MS` ใน `lib/useSlowWait.ts` |
| เพิ่มปุ่ม/ขั้นตอนชนิดใหม่ | `components/step/` + เงื่อนไขใน `StepView.tsx` (+ ชนิดโหนดใน backend `types.ts`) |
| ชี้ไป backend ตัวอื่น | `VITE_API_URL` ใน `.env.*` แล้ว build ใหม่; และ `CORS_ORIGIN` ฝั่ง backend ให้ตรง origin ของหน้าเว็บ |
| deploy | `npm run deploy` (ดูขั้นตอนใน `docs/DEPLOY.md`) |

---

## 6. ข้อสังเกต/ข้อจำกัดที่พบตอนอ่านโค้ด

ตรงไปตรงมา ไม่ได้แก้ไขอะไรในโค้ด:

1. **ไม่มีชุดทดสอบ** ตั้ง `vitest` ไว้ (`npm test`) แต่ไม่มีไฟล์ทดสอบใน `src/`
2. **เส้นทางที่ผ่านมา (`trail`) เก็บในหน้า ไม่ใช่ที่เซิร์ฟเวอร์** รีเฟรช (F5) หรือเปิดลิงก์ตรงแล้วจะเห็นแค่ขั้นปัจจุบัน ส่วนประวัติมีที่ฐานข้อมูลแต่หน้าจอไม่ได้ดึงมาแสดง
3. **ค่าความยาวสูงสุดลอกจาก backend สองตัว** ไม่มีการเช็กว่าตรงกัน (ดู 3.3)
4. **ฝังชื่อไว้ 2 แบบ:** ชื่อแอป `FixStep` ใน `AppShell.tsx` และ `index.html` (ตรวจด้วย grep แล้วมีแค่สองที่นี้) กับข้อความ "ติดต่อศูนย์บริการ Samsung" ที่ฝังตายตัวใน `SymptomSearchResults.tsx` (ไม่ได้มาจากข้อมูล ถ้าเพิ่มยี่ห้ออื่นต้องแก้) ส่วนชื่อยี่ห้อ/รุ่นที่แสดงในที่อื่นมาจากข้อมูลผัง
5. **frontend ผูกกับโฟลเดอร์ backend** ผ่านการ import ชนิดข้อมูล (ดู 3.2 `types.ts`)
6. **หน้าจอแสดงข้อความที่ LLM เรียบเรียงแล้ว (หน่วย 7) แต่ยังไม่ได้ deploy** ตอนนี้ backend ส่ง `displayText: null` เสมอ (ปิดอยู่) จึงไม่เห็นความต่าง; ขั้นที่ผ่านมาใน `PathRail` ยังแสดงข้อความต้นฉบับ รายละเอียดที่ [LLM-INTEGRATION.md](LLM-INTEGRATION.md)
7. **`ServerStatus` ไม่ได้ยิง `/health` ซ้ำเป็นระยะ** (ไม่มี `refetchInterval` และปิด refetch ตอนกลับมาที่หน้าต่างไว้ใน `App.tsx`) ป้ายจึงบอกสถานะ ณ ตอนโหลดหน้า ไม่ใช่สถานะสด
8. **การเข้าถึง (accessibility):** มีการจัดการโฟกัสและ `aria-live` ในหน้าตรวจ แต่ยังไม่ได้ทดสอบกับโปรแกรมอ่านหน้าจอจริงในรอบนี้
