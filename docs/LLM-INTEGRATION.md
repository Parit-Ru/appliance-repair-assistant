# การต่อ LLM เรียบเรียงถ้อยคำเข้ากับระบบ (Backend + Frontend · หน่วย 3–7)

> 14 ต.ค. 2569 · **สถานะ: พักไว้ รอตัดสินทิศทาง (ดู §11)** · ใส่ในโค้ดแล้ว **ปิดเป็นค่าเริ่มต้น** (ไม่ตั้งค่า = ระบบทำงานเหมือนเดิมทุกอย่าง) · commit/push แล้ว (`fa9162b`)
> เรียก Groq จริงแล้วและลองบนเว็บในเครื่องแล้ว (§10) · frontend deploy แล้ว (14 ต.ค. 19:33) · **ยังไม่ทำ:** ตั้งค่า LLM บน Render
> คู่กับ [FILES-BACKEND.md](FILES-BACKEND.md) (แผนที่ไฟล์) · แผนออกแบบเดิมอยู่ใน `draft/docs/LLM-REPHRASE-DESIGN.md`

---

## 1. สรุปในหน้าเดียว

**ทำอะไร:** ให้ LLM (Groq) เรียบเรียงข้อความของขั้นตอนให้อ่านง่ายขึ้น โดย **ไม่มีสิทธิ์ตัดสินว่าขั้นถัดไปคืออะไร** (ตาม TOR: engine เป็นผู้ตัดสิน LLM เรียบเรียงถ้อยคำเท่านั้น)

**หลักการ 4 ข้อ**

1. **ทำหลัง engine เสร็จและบันทึกแล้ว** LLM ไม่มีทางกระทบการเปลี่ยนสถานะ
2. **`node.text` ยังเป็นข้อความต้นฉบับจากคู่มือเสมอ** ข้อความเรียบเรียงอยู่ในฟิลด์แยก `displayText`
3. **ไม่แตะโหนดความปลอดภัย (`safety_critical`) และโหนดสิ้นสุด (`resolution`/`escalation`)**
4. **พังตรงไหนก็ได้ข้อความต้นฉบับ** ปิดอยู่ / ตั้งค่าไม่ครบ / LLM ล้ม / ช้าเกิน / ข้อความไม่ผ่านด่านตรวจ → `displayText = null`

---

## 2. จุดที่เพิ่ม/แก้ (ตามไฟล์)

> เลขบรรทัดคือตำแหน่ง ณ วันที่เขียน (หลังใส่แล้ว)

| # | ไฟล์ | บรรทัด | สิ่งที่ทำ |
|---|---|---|---|
| 1 | `backend/src/traversal/traversal.dto.ts` | 141 | เพิ่มฟิลด์ `displayText: string \| null;` ใน `SessionResponseDto` |
| 2 | `backend/src/traversal/traversal.service.ts` | 22 | เพิ่ม `import { RephraseService } ...` |
| 3 | `backend/src/traversal/traversal.service.ts` | 86 | เพิ่ม `private readonly rephrase: RephraseService,` ใน constructor |
| 4 | `backend/src/traversal/traversal.service.ts` | 217, 222 | `toResponse` เป็น `async` และคืน `Promise<SessionResponseDto>` |
| 5 | `backend/src/traversal/traversal.service.ts` | 234 | ใส่ `displayText: await this.displayTextOf(node),` ใน response |
| 6 | `backend/src/traversal/traversal.service.ts` | 238–248 | เพิ่มเมธอด `displayTextOf` (ถาม `RephraseService` มี try/catch คืน `null` เมื่อพัง) |
| 7 | `backend/src/traversal/traversal.module.ts` | 15 | `import { Logger, Module }` (เพิ่ม `Logger`) |
| 8 | `backend/src/traversal/traversal.module.ts` | 23–24 | import `createGroqClientFromEnv` และ `RephraseService` |
| 9 | `backend/src/traversal/traversal.module.ts` | 29–46 | `providers` เพิ่มสูตรสร้าง `RephraseService` (`useFactory`) |
| 10 | `backend/.env.example` | 31–40 | แทนบล็อก "LLM — ยังไม่ได้ใช้" ด้วยตัวแปร 4 ตัว |
| 11 | `render.yaml` | 25–27 | เพิ่ม `REPHRASE_ENABLED: "false"` |
| 12 | `frontend/src/api/types.ts` | 61 | เพิ่ม `displayText?: string \| null` ใน `SessionResponse` |
| 13 | `frontend/src/components/RephraseNote.tsx` | ไฟล์ใหม่ 12 บรรทัด | กล่องพับ "ข้อความนี้ปรับถ้อยคำด้วย AI — ดูข้อความต้นฉบับจากคู่มือ" |
| 14 | `frontend/src/pages/SessionPage.tsx` | 7 | เพิ่ม `import { RephraseNote }` |
| 15 | `frontend/src/pages/SessionPage.tsx` | 112–115 | รับ `displayText` และคำนวณ `canRephrase` / `rephrased` / `shownNode` |
| 16 | `frontend/src/pages/SessionPage.tsx` | 131 | ส่ง `node={shownNode}` ให้ `StepView` (`PathRail current={node}` ไม่เปลี่ยน) |
| 17 | `frontend/src/pages/SessionPage.tsx` | 132 | แสดง `<RephraseNote original={node.text} />` เมื่อใช้ข้อความเรียบเรียง |

### โค้ดที่เพิ่ม

**#1 `traversal.dto.ts`**
```ts
  displayText: string | null;
```

**#6 `traversal.service.ts` — `displayTextOf`**
```ts
  private async displayTextOf(node: RenderedNode): Promise<string | null> {
    try {
      const result = await this.rephrase.rephrase(node.text, {
        nodeType: node.type,
        safetyCritical: node.safetyCritical || node.requiresSafetyConfirmation,
      });
      return result.rephrased && result.text !== node.text ? result.text : null;
    } catch {
      return null;
    }
  }
```

**#9 `traversal.module.ts` — สูตรสร้าง**
```ts
    {
      provide: RephraseService,
      useFactory: () => {
        const client = createGroqClientFromEnv();
        if (!client && process.env.REPHRASE_ENABLED === 'true') {
          new Logger('RephraseService').warn('REPHRASE_ENABLED=true แต่ตั้ง GROQ_API_KEY/GROQ_MODEL ไม่ครบ — ใช้ข้อความต้นฉบับ');
        }
        return new RephraseService(client, {
          enabled: client !== null,
          timeoutMs: Number(process.env.REPHRASE_TIMEOUT_MS) || 3000,
        });
      },
    },
```

**#10 `.env.example`**
```
REPHRASE_ENABLED=false
GROQ_API_KEY=
GROQ_MODEL=
REPHRASE_TIMEOUT_MS=3000
```

**#11 `render.yaml`**
```yaml
      - key: REPHRASE_ENABLED
        value: "false"
```

**#12 `frontend/src/api/types.ts`**
```ts
  displayText?: string | null
```

**#13 `frontend/src/components/RephraseNote.tsx`** (ไฟล์ใหม่ทั้งไฟล์)
```tsx
interface RephraseNoteProps {
  original: string
}

export function RephraseNote({ original }: RephraseNoteProps) {
  return (
    <details className="mt-3 text-sm text-ink-soft">
      <summary className="cursor-pointer">ข้อความนี้ปรับถ้อยคำด้วย AI — ดูข้อความต้นฉบับจากคู่มือ</summary>
      <p className="mt-2 rounded-lg border border-line p-3">{original}</p>
    </details>
  )
}
```

**#15 `frontend/src/pages/SessionPage.tsx`** (แทนบรรทัด `const { node, graphId, ... } = session.data`)
```tsx
  const { node, graphId, equipment, confidence, outcome: savedOutcome, displayText } = session.data
  const canRephrase = !node.safetyCritical && !node.requiresSafetyConfirmation && !node.isTerminal
  const rephrased = canRephrase && displayText ? displayText : null
  const shownNode = rephrased === null ? node : { ...node, text: rephrased }
```
> `canRephrase` คือการกันซ้ำฝั่งหน้าจอ: ต่อให้ backend ส่ง `displayText` มาให้ขั้นความปลอดภัยหรือขั้นสิ้นสุด ก็ไม่ใช้

---

## 3. ไฟล์ใหม่ (ผู้ใช้พิมพ์เอง ใน `backend/src/rephrase/`)

| ไฟล์ | บรรทัด | หน้าที่ | หน่วย |
|---|---|---|---|
| `rephrase-guard.ts` | 61 | ด่านตรวจ 8 ข้อว่าข้อความที่ LLM เรียบเรียงยังเป็นความหมายเดิมพอไหม | 3 |
| `rephrase.service.ts` | 67 | ตัวประสาน: ข้ามโหนดที่ห้ามแตะ → เรียก LLM พร้อม timeout → ตรวจด้วย guard → แคช; ไม่เคยโยน error | 4 |
| `groq-llm.client.ts` | 46 | เรียก API ของ Groq ด้วย `fetch` ของ Node (ไม่เพิ่ม dependency) และ `createGroqClientFromEnv()` | 5 |
| `frontend/src/components/RephraseNote.tsx` | 12 | (ฝั่ง frontend) ป้ายบอกผู้ใช้ว่าข้อความถูกปรับด้วย AI + กล่องพับดูต้นฉบับ | 7 |

---

## 4. ตัวแปรสภาพแวดล้อมใหม่ (ชื่ออย่างเดียว)

| ชื่อ | อ่านที่ | จำเป็น | ความหมาย |
|---|---|---|---|
| `REPHRASE_ENABLED` | `groq-llm.client.ts`, `traversal.module.ts` | ไม่ | ต้องเป็น `true` เป๊ะ (`TRUE` ไม่เปิด) ไม่ตั้ง = ปิด |
| `GROQ_API_KEY` | `groq-llm.client.ts` | เมื่อเปิด | **ความลับ** ห้าม commit ใส่ใน `.env` และ Environment ของ Render |
| `GROQ_MODEL` | `groq-llm.client.ts` | เมื่อเปิด | ชื่อโมเดลที่ Groq มีอยู่ **ไม่มีค่าเริ่มต้น** (ขาด = ถือว่าไม่เปิด) |
| `GROQ_REASONING_EFFORT` | `groq-llm.client.ts` | ไม่ | ระดับการคิดของโมเดลที่คิดก่อนตอบ เช่น `low` เว้นว่าง = ไม่ส่งพารามิเตอร์ (**ยังไม่ได้ตรวจกับ API จริง** บางโมเดลอาจตอบ 400) |
| `REPHRASE_TIMEOUT_MS` | `traversal.module.ts` | ไม่ | เวลารอ LLM สูงสุด ค่าเริ่มต้น 3000 (ตั้งผิด/ไม่ตั้ง = 3000) |

---

## 5. ลำดับการทำงาน

```
POST /traversal/sessions/:id/actions
 1. traversal.controller.ts    รับ + ตรวจ body
 2. traversal.service.ts       submitAction()
 3.   traversal-engine.ts      ตัดสินขั้นถัดไป  ← ด่านความปลอดภัยอยู่ที่นี่ (ไม่เปลี่ยน)
 4.   session.store.ts         บันทึกสถานะ        (ไม่เปลี่ยน)
 5.   toResponse()             ประกอบคำตอบ
 6.     displayTextOf()        ← ใหม่: ถาม RephraseService
 7.       RephraseService      ปิดอยู่/ไม่มี LLM/โหนดห้ามแตะ/แคช → ตอบทันที (ไม่เรียกเน็ต)
 8.       GroqLlmClient        POST → api.groq.com (ช้าเกิน timeout → abort)
 9.       checkRephrase        ตรวจ: เลข / ชื่อเฉพาะ / "ไม่" / ความยาว / ลิงก์ ฯลฯ
10.   ตอบ { ..., node.text (ต้นฉบับ), displayText (เรียบเรียงหรือ null) }

frontend (SessionPage.tsx)
11.   canRephrase? (ไม่ใช่ safety / ไม่ใช่สิ้นสุด) และมี displayText
12.     ใช่  → StepView แสดง displayText + RephraseNote (กางดูต้นฉบับได้)
13.     ไม่  → StepView แสดง node.text ต้นฉบับ ไม่มีป้าย
```

---

## 6. เปิด / ปิด / ย้อนกลับ

**ปิด (สถานะตอนนี้):** ไม่ตั้ง `REPHRASE_ENABLED` หรือตั้งเป็น `false`

**เปิดบน Render** (ทำเมื่อพร้อมเท่านั้น): ที่ Environment ของ service ตั้ง `REPHRASE_ENABLED=true`, `GROQ_API_KEY`, `GROQ_MODEL` (แนะนำตั้ง `REPHRASE_TIMEOUT_MS` ให้สั้นลง เช่น 2000)
> `render.yaml` แค่ประกาศ `REPHRASE_ENABLED: "false"` ไว้ ไม่ได้ตั้ง key ให้ (ความลับตั้งในหน้า Render เท่านั้น)

**ลองกับ Groq จริงในเครื่อง (ทำก่อนเปิดบน Render):**

1. ใน `backend/.env` ตั้ง `REPHRASE_ENABLED=true`, `GROQ_API_KEY=<key>`, `GROQ_MODEL=<ชื่อโมเดลที่ Groq มีอยู่>` (ตรวจชื่อในหน้าโมเดลของ Groq เอง) และ (ไม่บังคับ) `REPHRASE_TIMEOUT_MS`
2. `cd backend` → `npm run build` → `node scripts/try-rephrase.js` (ใส่ตัวเลขท้ายคำสั่งเพื่อเปลี่ยนจำนวนข้อความ เช่น `node scripts/try-rephrase.js 3` · ใส่ `--model=openai/gpt-oss-20b` เพื่อลองโมเดลอื่นชั่วคราวโดยไม่แก้ `.env` · `--models` ดูรายชื่อที่ key เรียกได้)
3. อ่านผลทีละข้อ: ความหมายเหมือนเดิมไหม · ตัวเลข/ชื่อ/รหัสครบไหม · ข้อที่ `↩` ดูบรรทัด warn ว่าเพราะอะไร

| บรรทัด warn ที่เจอ | แปลว่า |
|---|---|
| `Groq ตอบ HTTP 401` | key ผิดหรือหมดอายุ |
| `Groq ตอบ HTTP 400/404` | ชื่อโมเดล (`GROQ_MODEL`) ผิดหรือไม่มีแล้ว → รัน `node scripts/try-rephrase.js --models` ดูรายชื่อที่ key นี้เรียกได้ |
| `Groq ตอบ HTTP 429` | ยิงถี่/โควตาหมด รอสักครู่ |
| `This operation was aborted` / `aborted` | **timeout** (เกิน `REPHRASE_TIMEOUT_MS`) ลองเพิ่มค่า |
| `ไม่ผ่านด่านตรวจ: …` | LLM เปลี่ยนตัวเลข/ชื่อ/เพิ่มลิงก์ ฯลฯ ด่านทำงานถูกต้อง ดูว่าเกิดบ่อยแค่ไหน |

**หน้าเว็บ:** โค้ดฝั่ง frontend ต้อง `npm run deploy` ใหม่ถึงจะขึ้นเว็บจริง (ถ้ายังไม่ deploy backend ที่ส่ง `displayText` มาก็ไม่ทำให้อะไรพัง หน้าเว็บเก่าไม่สนใจฟิลด์นี้)

**ย้อนกลับทั้งหมด**

| ไฟล์ | วิธี |
|---|---|
| `traversal.service.ts`, `traversal.module.ts`, `.env.example`, `render.yaml` | `git checkout HEAD -- <path>` (อยู่ใน git และยังไม่มีการแก้อื่นค้างอยู่) |
| `traversal.dto.ts` | **อย่า** `git checkout` (มีการแก้อื่นที่ยังไม่ commit) ให้ลบบรรทัด `displayText: string \| null;` เอง |
| `backend/src/rephrase/*` | ไม่ต้องลบ ถ้าย้อนไฟล์ข้างบนแล้ว จะไม่มีใคร import เหลือเป็นไฟล์ที่ไม่ถูกใช้ |
| `frontend/src/pages/SessionPage.tsx` | `git checkout HEAD -- frontend/src/pages/SessionPage.tsx` (ไม่มีการแก้อื่นค้างอยู่) |
| `frontend/src/api/types.ts` | **อย่า** `git checkout` (มีการแก้อื่นที่ยังไม่ commit) ให้ลบบรรทัด `displayText?: string \| null` เอง |
| `frontend/src/components/RephraseNote.tsx` | ลบไฟล์ (เป็นไฟล์ใหม่ ยังไม่อยู่ใน git) แล้วเอา `import` กับบรรทัด `<RephraseNote ...>` ออกจาก `SessionPage.tsx` ถ้าไม่ได้ย้อนไฟล์นั้น |

สำเนาไฟล์ก่อนแก้ (กรณีฉุกเฉิน) อยู่ที่ `...\scratchpad\unit6-backup\` (backend) และ `unit7-backup\` (frontend) ของเซสชันนี้

---

## 7. ผลการตรวจ

| ตรวจ | ผล |
|---|---|
| `tsc --noEmit` + `noUnusedLocals/Parameters` (backend) | ผ่าน |
| `nest build` | ผ่าน |
| ทดสอบทั้งสาย: `TraversalModule` จริง + Nest DI จริง + engine จริง + `GroqLlmClient` จริง (ปลอมเฉพาะ MySQL ในหน่วยความจำ และ `fetch`) | **21 / 21** |
| `GroqLlmClient` แยก (รูปคำขอ, error, ตัวแปร env) | 19 / 19 |
| `RephraseService` + guard (LLM ปลอม) | 15 / 15 |
| frontend: `tsc -b` + `vite build` + `eslint` ทั้งโปรเจกต์ | ผ่านทั้งหมด (ป้าย AI อยู่ในบันเดิล) |
| frontend: เรนเดอร์ `SessionPage` จริงเป็น HTML ด้วย vitest (ใส่ session ลงแคช ไม่เรียกเครือข่าย) | **5 / 5** |

กรณีที่ทดสอบในชุด 21 ข้อ:

| สถานการณ์ | ผลที่ได้ |
|---|---|
| ไม่ตั้งค่า | `displayText: null` ไม่เรียก LLM ไม่มี warn |
| เปิดครบ + LLM ตอบถูก | `displayText` = ข้อความเรียบเรียง · `node.text` ยังเป็นต้นฉบับ |
| โหนด `safety_critical` | `displayText: null` ไม่ส่งให้ LLM · ส่ง `continue` ข้ามด่าน → engine ปฏิเสธ |
| โหนดสิ้นสุด | `displayText: null` ไม่ส่งให้ LLM |
| LLM ล่ม (HTTP 500) | ตอบปกติ ใช้ต้นฉบับ มี warn เหตุผล |
| LLM เปลี่ยนตัวเลข | ถูกด่านปฏิเสธ มี warn "ตัวเลขไม่ตรง" |
| เปิดแต่ขาด `GROQ_MODEL` | ไม่เรียก LLM มี warn "ตั้งค่าไม่ครบ" |

กรณีที่ทดสอบฝั่งหน้าจอ (5 ข้อ):

| สถานการณ์ | ผลที่ได้ |
|---|---|
| `displayText = null` | แสดงต้นฉบับ ไม่มีป้าย AI |
| ไม่มีฟิลด์ `displayText` (backend รุ่นเก่า) | แสดงต้นฉบับ ไม่มีป้าย ไม่พัง |
| มี `displayText` | หัวข้อ (`h2`) เป็นข้อความเรียบเรียง + มีป้าย AI + ต้นฉบับอยู่ในกล่องพับ |
| ขั้นความปลอดภัย + ส่ง `displayText` มา | แสดงต้นฉบับ ไม่มีป้าย (กันซ้ำฝั่งหน้าจอทำงาน) |
| ขั้นสิ้นสุด + ส่ง `displayText` มา | แสดงต้นฉบับ ไม่มีป้าย |

---

## 8. ที่ต่างจาก patch 0003 ใน `draft/` (ตั้งใจ ทำให้สั้นลง)

| ใน draft/patch | ที่ใส่จริง | เหตุผล |
|---|---|---|
| `@Optional() @Inject(RephraseService) private readonly rephrase?` | `private readonly rephrase: RephraseService` | โมดูลลงทะเบียนเสมอ Nest หาเจอจากชนิดเอง |
| `if (!this.rephrase) return null;` | ไม่มี | ไม่จำเป็นเมื่อไม่ optional |
| `logFailures: true` | ไม่มี | `RephraseService` ฉบับสั้นไม่มีตัวเลือกนี้ (log เสมอ) |
| `const enabled = process.env.REPHRASE_ENABLED === 'true'` แล้วส่ง `enabled` | `enabled: client !== null` | เท่ากัน เพราะ `createGroqClientFromEnv` คืน `null` เมื่อไม่ครบ |
| `GROQ_ENDPOINT` ใน `.env.example` | ไม่มี | ตัดตัวเลือกชี้เซิร์ฟเวอร์จำลองออกจาก client |
| วงจรตัด (circuit breaker) 3 ครั้ง/60 วินาที | ไม่มี | ตัดออกตามที่ผู้ใช้ขอให้ลดความซับซ้อน |
| (patch 0004) ไฟล์ `lib/displayNode.ts` + `pickDisplayNode()` | คำนวณ 3 บรรทัดใน `SessionPage.tsx` | ลดจำนวนไฟล์ ตรรกะเท่ากัน (กันขั้นความปลอดภัย/สิ้นสุดฝั่งหน้าจอ) |
| (patch 0004) เช็ก `displayText` ว่าง/เท่าต้นฉบับฝั่งหน้าจอ | เช็กแค่ว่ามีค่า (falsy = ไม่ใช้) | backend คืน `null` เมื่อเท่าต้นฉบับอยู่แล้ว (`result.text !== node.text`) |

> ชุดทดสอบ Jest ใน `draft/code/backend/tests/` ส่วนที่อ้างวงจรตัด/`reason`/`logFailures` ไม่ตรงกับโค้ดจริงแล้ว (ผู้ใช้เลือกข้ามชุดทดสอบอยู่)

---

## 9. ข้อควรระวัง / ยังไม่ทำ

1. **ทุกคำตอบรอ LLM ก่อน** ตอนเปิดฟีเจอร์ ถ้า Groq ช้าจะรอถึง timeout ต่อขั้น และเมื่อ **ไม่มีวงจรตัด** ถ้า Groq ล่มจะรอแบบนี้ทุกขั้น ควรวัดเวลาจริงก่อนเปิดบน Render
2. **เรียก Groq จริงแล้ว (§10)** ชื่อโมเดลที่ใช้ได้ขึ้นกับ key (ดูด้วย `--models`) · เวลาตอบจริง 0.4–1.1 วินาทีต่อข้อความ (ไม่รวมรอคิวฝั่ง Groq) · **เจอ HTTP 429 `TPM 8000`** (§10 รอบ 6) ผู้ใช้หลายคนพร้อมกันจะตกไปใช้ต้นฉบับ
3. **หน้าจอแสดง `displayText` แล้วในโค้ด ผู้ใช้ลองบน localhost แล้ว (§10 รอบ 7) deploy แล้ว (เว็บจริงมีโค้ดป้าย AI แต่ LLM บน Render ปิดอยู่ จึงยังไม่แสดงอะไร) แต่ยังไม่ได้ทดสอบกับโปรแกรมอ่านหน้าจอ** · **เส้นทางที่ผ่านมา (`PathRail`) ยังแสดงข้อความต้นฉบับจากคู่มือเสมอ** มีแต่ขั้นปัจจุบันที่แสดงข้อความเรียบเรียง ผู้ใช้อาจเห็นถ้อยคำสองแบบเทียบกัน
4. **ความเป็นส่วนตัว:** ข้อความที่ส่งให้ Groq คือ `node.text` ที่แทนค่า `{{ตัวแปร}}` แล้ว ข้อมูลปัจจุบันมีแค่ `n_escalate_with_code` (ชนิด escalation จึงไม่ถูกส่ง และ `error_code` ถูกจำกัดด้วย regex `^[A-Za-z]{1,2}[0-9]{1,3}$`) ถ้าเพิ่มผังที่แทรกค่าที่ผู้ใช้กรอกลงในโหนด checkpoint/instruction/input ค่านั้นจะถูกส่งไป Groq
5. **ด่านตรวจมีช่องโหว่ที่ทดลองยืนยันแล้ว** (สลับ เปิด↔ปิด, สลับลำดับขั้นตอน, ตัดหน่วย, เพิ่มชื่อสั้นที่เป็นส่วนหนึ่งของคำเดิม) จึงต้องให้คนอ่านทบทวนข้อความที่เรียบเรียงก่อนเปิดใช้จริง และโหนดความปลอดภัยถูกกันไว้เสมอ
6. ผลที่ด่านปฏิเสธ **ไม่ถูกแคช** เปิดโหนดเดิมซ้ำจะเรียก LLM ใหม่ทุกครั้ง (เสียโควตา)

---

## 10. ผลลองกับ Groq จริง (ผู้ใช้รันเอง 14 ต.ค. 2569 ด้วย `scripts/try-rephrase.js`)

> ผมไม่ได้เรียก Groq เอง (กติกาไม่อ่านค่าใน `.env`) ข้อมูลนี้มาจากผลที่ผู้ใช้วางมา

| รอบ | ผล | ข้อสรุป |
|---|---|---|
| 1 | `GROQ_MODEL=llama-3.1-8b-instant` → **HTTP 404 ทั้ง 6 ข้อความ** (ตอบกลับใน 120–620 ms) | โมเดลนี้ **ไม่อยู่ในรายการของ key** (ยืนยันด้วย `--models`) fallback ทำงานถูกต้อง |
| รายการโมเดล | แชท: `allam-2-7b`, `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, `qwen/qwen3.8-27b` (ที่เหลือเป็นเสียง/ตัวคัดกรอง) | ชื่อโมเดลของ Groq เปลี่ยนตามเวลา → เหตุผลที่ `GROQ_MODEL` ไม่มีค่าเริ่มต้น |
| 2 (โมเดลที่ผู้ใช้ไม่ได้ระบุในผลที่วาง) | สำเร็จ **1 / 6** · เฉลี่ย **964 ms** · 4 ข้อ "ผลลัพธ์ว่าง" · 1 ข้อถูกด่าน "ไม่" ปฏิเสธ | ดูด้านล่าง |

**ข้อสังเกตรอบ 2**

- **ผลลัพธ์ว่าง 4 ข้อ (ทั้งหมดเป็นคำถาม checkpoint สั้นๆ):** สาเหตุยังไม่ยืนยัน สงสัยว่าโมเดลเป็นแบบ "คิดก่อนตอบ" แล้วใช้ `max_tokens: 400` หมดไปกับการคิด หรือเข้าใจคำถามเป็นสิ่งที่ต้องตอบ แทนที่จะเรียบเรียง → ใช้ `node scripts/try-rephrase.js 3 --raw` ดู `finish_reason` / `usage` / ฟิลด์ใน message
- **ข้อความที่สำเร็จ:** "ชาร์จรีโมท… ชาร์จทิ้งไว้อย่างน้อย 30 นาที…" → รวมประโยคให้ลื่นขึ้น คงตัวเลข ชื่อ `USB Type-C` และความหมาย (ผู้พัฒนาอ่านแล้ว)
- **ด่านปฏิเสธผิด 1 ข้อ:** "…ตั้งอุณหภูมิได้หรือไม่?" → LLM เปลี่ยนเป็น "…ได้ไหม?" ถูกปฏิเสธเพราะนับ "ไม่" 1 → 0 ทั้งที่ "หรือไม่" ไม่ใช่คำปฏิเสธ **แก้แล้ว:** `countNegations` ไม่นับ "หรือไม่" (ทดสอบ 9/9 รวมกรณี "ไม่สามารถ→สามารถ" ยังถูกจับ และ "ทำงานหรือไม่ → ไม่ทำงาน" ที่เดิมหลุดตอนนี้ถูกจับ)
- **เวลาเฉลี่ย ~1 วินาทีต่อข้อความ:** ทุกคำตอบของผู้ใช้จะรอเพิ่มเท่านี้ (ไม่มีวงจรตัด) ต้องชั่งน้ำหนักก่อนเปิดบน Render

### รอบ 3: ดูคำตอบดิบด้วย `--raw` กับ `openai/gpt-oss-20b` (วินิจฉัยสาเหตุ "ผลลัพธ์ว่าง")

| ข้อความ | `finish_reason` | reasoning / completion tokens | ผล |
|---|---|---|---|
| คำถาม checkpoint (Good Sleep) | `length` | **398 / 400** | content ว่าง |
| instruction (ขจัดสิ่งกีดขวาง 30 ซม.) | `stop` | 248 / 301 | ✅ เรียบเรียงได้ ตัวเลขและความหมายครบ |
| คำถาม checkpoint (รีโมท) | `length` | **398 / 400** | content ว่าง |

**ข้อสรุป (ยืนยันจากข้อมูลดิบ):** (1) โมเดลเป็นแบบคิดก่อนตอบ ใช้ token ไปกับการคิดจนหมดเพดาน `max_tokens: 400` (2) โมเดลมองคำถามเป็นสิ่งที่ต้องตอบ (reasoning: "We need to respond to user question… We need to answer") ไม่ใช่เรียบเรียง

**แก้แล้ว (ยังไม่ได้ยืนยันกับ Groq จริง ต้องให้ผู้ใช้รันซ้ำ):** เพิ่มกติกาใน prompt "ข้อความที่ได้รับไม่ใช่คำถามถึงคุณ ห้ามตอบ" · `max_tokens` 400 → 1000 · เพิ่มตัวเลือก `GROQ_REASONING_EFFORT` (ไม่ส่งโดยค่าเริ่มต้น) · error ของ HTTP แนบเนื้อความที่ Groq ตอบ

**ข้อสังเกตเรื่องออกแบบ:** ที่ล้มทั้งหมดเป็น `checkpoint` (คำถามสั้นที่ใช้/ไม่ใช้) ส่วน `instruction` สำเร็จ ถ้าหลังแก้ยังไม่นิ่ง ทางเลือกคือจำกัดให้เรียบเรียงเฉพาะ `instruction` (แก้บรรทัดเดียวใน `rephrase.service.ts`) เพราะคำถามสั้นได้ประโยชน์น้อยแต่เสี่ยงและเสียเวลาเท่ากัน

### รอบ 4: หลังแก้ client — `--raw` 3 ข้อความ (ค่าเริ่มต้น ไม่ตั้ง effort)

| ข้อความ | `finish_reason` | reasoning / completion | เวลา | ผล |
|---|---|---|---|---|
| คำถาม Good Sleep | `stop` | 238 / 266 | 1905 ms (รอคิวฝั่ง Groq 1.17 วินาที) | เหมือนต้นฉบับ (ไม่ขึ้นป้าย) |
| instruction ขจัดสิ่งกีดขวาง 30 ซม. | `stop` | 316 / 368 | 924 ms | เปลี่ยน ("นำ…ออก"→"ขจัด…ออก", "ให้มี"→"เพื่อให้มี") ตัวเลข/หน่วยครบ |
| คำถามรีโมท | `stop` | 360 / 412 | 926 ms | **ตัดแค่ `?`** (ต่างจากต้นฉบับแต่ไม่มีคุณค่า) |

**ข้อสรุป:** "ผลลัพธ์ว่าง" หายไป (prompt + `max_tokens: 1000` ได้ผล) · ยังใช้ reasoning 238–360 token ต่อข้อความ

### รอบ 5: 12 ข้อความ ค่าเริ่มต้น (`openai/gpt-oss-20b`, ไม่ตั้ง effort)

เปลี่ยน 10 · เหมือนเดิม 2 (1 ข้อเป็นแคชของข้อความซ้ำ 0 ms) · เฉลี่ย 712 ms (ข้อความที่เรียก Groq จริง 432–1125 ms) · ไม่มีข้อที่ถูกด่านปัด

อ่านทีละข้อ (ผู้พัฒนาไม่ได้เทียบทุกข้อ ผมอ่านจากผลที่วางมา):

| กลุ่ม | จำนวน | ตัวอย่าง |
|---|---|---|
| ถ้อยคำเล็กน้อย | 5 | เติม "หลังจาก", "อย่างต่อเนื่อง", "และ", "ลองดู→ตรวจสอบ", "สามารถ" |
| ตัด/เติมเนื้อหา | 5 | ตัด "ตอนตั้งเวลา" (timer n1) · ตัด "หลัง" (recheck_filter) · คำถามกลายเป็น "ตรวจสอบว่า…หรือไม่" (remote n3) · "หรือไม่"→"หรือยัง" (2 ข้อ) · เติม "ถ้า"/"ควร" (n_fix_pipe) |

- **ไม่มีข้อไหนกลับคำตอบ ใช่/ไม่ใช่ และไม่แตะตัวเลข รหัส หน่วย ชื่อ**
- ด่านตรวจจับ "ตัดคำ" และ "เติมกริยา" ไม่ได้ (ช่องโหว่ที่รู้อยู่แล้วใน §9 ข้อ 5) ความคุ้มครองจริงคือ ใช้แสดงผลอย่างเดียว + กดดูต้นฉบับได้ + โหนดความปลอดภัย/สิ้นสุดถูกกัน

### รอบ 6: `--effort=low` 12 ข้อความ (รันต่อจากรอบ 5 ทันที)

| ผล | จำนวน | หมายเหตุ |
|---|---|---|
| เปลี่ยน | 3 | 1 ข้อต่างแค่ช่องว่าง ("แล้ว ตั้ง"→"แล้วตั้ง") · 1 ข้อตัด "กลับมา" และสลับลำดับวลี (n_recheck_power) |
| เหมือนเดิม | 5 | |
| ด่านตรวจปัด | 2 | `Type-C` หายจาก `USB Type-C` (ถูกต้อง) · "ไม่" 1→0 ใน n_invalid_code (ระมัดระวัง ไม่ทราบข้อความที่ถูกปัด) |
| **HTTP 429** | 2 | `Rate limit reached … tokens per minute (TPM): Limit 8000, Used 7388` |

**ข้อสรุป**

- **โควตา:** ต่อ key ราว **8000 token ต่อนาที** ~600 token ต่อคำขอ ≈ **12–16 คำขอต่อนาที** (ไม่ใช่ต่อผู้ใช้) · 429 ตกไปใช้ต้นฉบับใน ~130 ms (ไม่ทำให้ช้า)
- **ตัวช่วย:** คู่มือมีข้อความเข้าเกณฑ์ **62 ข้อความไม่ซ้ำ** (checkpoint 41 · instruction 21 · input 1 · ตัด safety_critical 3) แคชอยู่ตามข้อความต้นฉบับ ([rephrase.service.ts](../backend/src/rephrase/rephrase.service.ts) บรรทัด 42) จึงเรียก Groq สูงสุด 62 ครั้งต่อรอบการทำงานของเซิร์ฟเวอร์ (Render ที่หลับแล้วตื่นแคชจะว่าง)
- **เปรียบเทียบ effort ไม่สะอาด** เพราะ 2 ข้อถูก 429 และรอบนี้รันต่อจากรอบ 5 ในนาทีเดียวกัน · ที่เห็น: `low` เปลี่ยนน้อยลงและมีข้อที่ด่านต้องปัด 2 ข้อ (รอบ 5 ไม่มี) → **ไม่มีหลักฐานว่าดีกว่า แนะนำไม่ตั้ง `GROQ_REASONING_EFFORT`** · จำนวน token ที่ลดลงจริงหรือไม่ **ยังไม่ได้วัด**

### รอบ 7: ลองบนเว็บในเครื่อง (backend `start:dev` + frontend `dev`, localhost:5173)

| ตรวจ | ผล |
|---|---|
| หน้าสิ้นสุด `remote_not_working/n_resolved` (resolution) | ตรงต้นฉบับทุกตัวอักษร ไม่มีป้าย AI ✅ |
| หน้าสิ้นสุด `indicator_blinking/n_escalate_malfunction` (escalation) | ตรงต้นฉบับทุกตัวอักษร ไม่มีป้าย AI ✅ |
| กดดูต้นฉบับในป้ายของขั้นระหว่างทาง | ผู้ใช้รายงานว่า "ได้แต่ข้อความเดิมๆ" → ข้อความที่แสดงต่างจากต้นฉบับน้อยมาก (ตามผลรอบ 5–6) |

**ยังไม่ได้เก็บ:** บรรทัด `WARN` ใน backend · หน้า safety_critical (`n_power_off`, `n_power_back_on`) ว่าไม่มีป้ายจริงบนหน้าจอ (เส้นทางผ่านแล้วแต่ไม่ได้ดูหน้า) · ความรู้สึกเรื่องเวลา · JSON ของ `displayText` จาก DevTools

---

## 11. สถานะ: พักไว้ รอตัดสินทิศทาง (14 ต.ค. 2569)

**ผู้ใช้สั่ง "mark เรื่องนี้ไว้ก่อน"** ไม่มีการแก้โค้ดหลังรอบ 3

### ทางเลือกที่ค้าง

| ทางเลือก | ผลที่หน้าเว็บ | ความเสี่ยง |
|---|---|---|
| **A. คงเดิม + แก้เรื่องช่องว่าง/เครื่องหมาย** (แนะนำ) | ป้ายขึ้นเฉพาะตอนมีคำเปลี่ยนจริง เปลี่ยนเล็กน้อย | ต่ำ ตรงกับ TOR |
| **B. ให้เรียบเรียงมากขึ้น** (ภาษาพูดกว่าเดิม) | เห็นความต่างชัด | สูงขึ้น: ตัดเนื้อหา/เปลี่ยนน้ำเสียงคำสั่ง ด่านปัดมากขึ้น ต้องทดลองผ่านสคริปต์ก่อน (ยังไม่มีตัวเลือกใน `try-rephrase.js`) |
| **C. ปิดไว้บน Render** เปิดเฉพาะตอนสาธิต | ผู้ใช้ทั่วไปไม่เห็นอะไรเปลี่ยน | ต่ำสุด ไม่เสียโควตา |

### ข้อเสนอแก้เล็กๆ ที่ยังไม่ได้ทำ (รอผู้ใช้บอก "ใส่ให้")

1. **ต่างกันแค่ช่องว่าง/เครื่องหมายวรรคตอน → ถือว่าไม่เปลี่ยน** (หลักฐาน: รอบ 4 ตัด `?`, รอบ 6 "แล้ว ตั้ง"→"แล้วตั้ง") แก้ 2–3 บรรทัดใน `rephrase.service.ts`
2. **จำผลที่ด่านปัดไว้ในแคช** เพื่อไม่เรียก Groq ซ้ำทุกครั้งที่เปิดโหนดเดิม (ห้ามแคช 429/timeout เพราะเป็นเรื่องชั่วคราว)

### ถ้าจะเปิดบน Render (ยังไม่ได้ทำ)

1. ตั้งในแดชบอร์ด Render: `REPHRASE_ENABLED=true`, `GROQ_API_KEY`, `GROQ_MODEL=openai/gpt-oss-20b` (ไม่ตั้ง `GROQ_REASONING_EFFORT`)
2. **ค่าในแดชบอร์ดมีผลเหนือ [render.yaml](../render.yaml)** (หลักฐาน: ไฟล์ตั้ง `SYMPTOM_SEARCH_ENABLED: "false"` แต่ Render จริงตอบ `state: ready` อนุมานจากตัวแปรเดียว) จึงตั้ง `REPHRASE_ENABLED=true` ในแดชบอร์ดได้ · ควรแก้ค่าในไฟล์ให้ตรงด้วยเพื่อไม่ให้เอกสารหลอกตา (ยังไม่ได้ทำ)
3. ~~`npm run deploy` ฝั่ง frontend~~ ทำแล้ว (14 ต.ค. 19:33) ไม่ต้องทำซ้ำ
4. ไม่ต้อง commit โค้ดเพิ่ม (ตั้งค่าในแดชบอร์ดอย่างเดียว) แต่ Render จะรีสตาร์ทหลังเปลี่ยน env

### ปิด/ย้อนกลับ

ไม่ตั้ง `REPHRASE_ENABLED` (หรือตั้งเป็น `false`) = ระบบทำงานเหมือนก่อนเพิ่มฟีเจอร์ทุกอย่าง (§6)
