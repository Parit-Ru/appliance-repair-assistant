# 10 — การประเมินผล (Evaluation)

## 1. สถานะจริงตอนนี้ (พูดตรงๆ)

### อธิบายแบบง่าย
ระบบ**ยังไม่มีผลประเมินความแม่นยำที่อ้างได้** และยังไม่มีการทดสอบกับผู้ใช้จริง สิ่งที่มีคือ (1) การตรวจว่าข้อมูลในผังตรงกับ PDF ด้วยสคริปต์ และ (2) ตัวอย่างคะแนนการค้นหาไม่กี่คำค้น

### เชิงเทคนิค — มีอะไรบ้าง

| สิ่งที่มี | ผล | ข้อจำกัด | ที่มา |
|---|---|---|---|
| ตรวจ chunk ↔ PDF | 644 chunk: PASS 478 · WARN 49 · FAIL 12 · ตรวจไม่ได้ 74 | วัดว่า "คำอยู่ในหน้า" ไม่ใช่ความหมาย · สคริปต์ที่ใช้รัน**ไม่อยู่ใน repo แล้ว** | `docs/ops/VERIFY-CHUNKS-AGAINST-PDF.md:86-100` |
| ตรวจผัง ↔ PDF | 644 ผัง (รวมแอร์ 13): ผ่าน 559 · ข้อยกเว้น 6 · WARN 18 · FAIL 0 · ตรวจไม่ได้ 61 · ตัวเลข 1,448 ตัว | คำแปลไทยและลำดับขั้น "ยังไม่ได้ทำ" ให้คนตรวจ · สคริปต์ไม่อยู่ใน repo | `docs/ops/VERIFY-GRAPHS-AGAINST-SOURCE.md:15-32` |
| ตัวอย่างคะแนนค้นหา | 6 คำค้น เช่น "ไมโครเวฟไม่ร้อน" → อาการที่ถูกอยู่อันดับ 2 (0.822) · "วันนี้ฝนตก" → 0.301 ไม่พบ | เป็นตัวอย่าง ไม่ใช่ชุดทดสอบ | `docs/STUDY_GUIDE.md:604-629` (สร้างด้วย `backend/scripts/study-measure.js`) |
| ชุดตั้งเกณฑ์ 56 ข้อ | top-1 29/39 · top-3 37/39 · ในขอบเขตถูกปฏิเสธ 3/39 · นอกขอบเขตหลุด 8/17 | **AI (Claude) ร่าง ผู้พัฒนายังไม่ได้ตรวจ** และเป็นของ**คู่มือแอร์ AR70H ที่ไม่อยู่ในระบบแล้ว** · "ห้ามอ้างเป็นความแม่นยำของระบบ" | `troubleshoot-assistantv2/data/eval/review_sheet_tuning.md:3-17` · ชุดรายงานผล "ยังว่าง" (`troubleshoot-assistantv2/README.md:25`) |
| Test set จาก Pantip/Reddit | — | **ไม่พบในโปรเจกต์** | — |
| Feedback 👍/👎 | มีระบบเก็บ | ยังไม่มีผู้ใช้จริง และตัวเลขปนกับ DB ของโปรเจกต์เก่า | ไฟล์ 09 |
| ทดสอบ end-to-end | ทำในโปรเจกต์เก่า (39 ข้อผ่าน, 5 ต.ค.) | ทำก่อนย้ายมา Express · สคริปต์อยู่นอก repo | `troubleshoot-assistantv2/README.md:24` |

## 2. แผนประเมินที่ทำเสร็จได้ใน 2 วัน (ก่อนสอบ 2 พ.ย. 2569)

> วันสอบ 2 พ.ย. นับจากวันนี้ (29 ต.ค.) เหลือ ~3 วัน → วางงานประเมิน 2 วัน (30–31 ต.ค.) และเว้น 1 พ.ย. ไว้ซ้อมเดโม/แก้สไลด์
> ทุกอย่างทำนอก DB ได้ (ใช้ `data/manuals/*.json` + โมเดลในเครื่อง เหมือน `study-measure.js`) ไม่ต้องแตะฐานข้อมูลจริง

### สิ่งที่วัด (สิ่งที่ระบบทำจริง)
ระบบไม่ได้ "วินิจฉัย" แต่ "หาผังที่ใช่" เพราะฉะนั้นสิ่งที่ควรวัดคือ **retrieval quality ของการเลือกผัง** + **การปฏิเสธเมื่อไม่มีผังที่ใช่**

### วันที่ 1 (30 ต.ค.) — สร้างชุดทดสอบ
1. เลือกคู่มือ 1 เล่มต่อประเภท (4 เล่ม) ที่มีผังเยอะและตรวจกับ PDF ผ่าน เช่น GE83MDT (ไมโครเวฟ), RB6000D (ตู้เย็น), KM2DVBADN (ทีวี), WA5000R (เครื่องซักผ้า) (ทั้ง 4 เล่มมีหน้าเทียบใน `data/check/`)
2. ต่อเล่ม เขียน **15 คำค้นในขอบเขต + 5 คำค้นนอกขอบเขต** = 80 ข้อ
   - ในขอบเขต: ภาษาพูด, ภาษาอังกฤษ, สะกดผิด, พิมพ์สั้น, ถามแบบเล่าอาการ (ห้ามลอกข้อความป้าย/alias ตรงตัว)
   - นอกขอบเขต: ปัญหาจริงของเครื่องที่คู่มือไม่ครอบคลุม (เช่น "คอมเพรสเซอร์ตู้เย็นเสียงดังมาก" ถ้าไม่มีผัง) + เรื่องไม่เกี่ยว
   - ถ้ามีเวลา ขอเพื่อน 3–5 คนช่วยเขียนคนละ 5 ข้อ เพื่อลด bias ของผู้พัฒนา หรือถอดความ (paraphrase) จากกระทู้จริง โดยบันทึกว่าเป็น paraphrase
3. **เฉลย** = graphId ที่ถูก (อาจมีมากกว่า 1) ให้ตั้งจากการอ่านรายการผังของรุ่น (`GET /traversal/graphs?manualId=` หรือไฟล์ JSON) **ก่อน**ดูผลของระบบ
4. แบ่ง **tuning 40 ข้อ / report 40 ข้อ** (สุ่มแบบ stratified ตามรุ่นและในขอบเขต/นอกขอบเขต) ใช้ชุด tuning เลือก threshold แล้วรายงานผลบนชุด report เท่านั้น

### รูปแบบไฟล์ชุดทดสอบ (เสนอ `data/eval/queries.json`)
```json
{
  "version": 1,
  "created": "2026-10-30",
  "labeler": "ชื่อผู้ตั้งเฉลย",
  "queries": [
    {
      "id": "MW-001",
      "split": "tuning",
      "manualId": "samsung_ge83mdt_um_de68_04111e",
      "query": "อุ่นข้าวแล้วไม่ร้อนเลย",
      "inScope": true,
      "expected": ["samsung_ge83mdt_um_not_cooked_at_all"],
      "style": "colloquial",
      "source": "self",
      "note": ""
    },
    {
      "id": "MW-017",
      "split": "report",
      "manualId": "samsung_ge83mdt_um_de68_04111e",
      "query": "ไมโครเวฟมีกลิ่นไหม้ตอนใช้ครั้งแรก",
      "inScope": false,
      "expected": [],
      "style": "colloquial",
      "source": "friend",
      "note": "ตรวจแล้วว่าไม่มีผังเรื่องกลิ่นใช้ครั้งแรกในเล่มนี้"
    }
  ]
}
```
(ตัวอย่างคำค้น/เฉลยข้างบนเป็นรูปแบบเท่านั้น ต้องตรวจกับรายการผังจริงก่อนใช้)

### วันที่ 2 (31 ต.ค.) — รัน วัดผล และเลือก threshold
**Metric** (คำนวณแยกตามรุ่นและรวม)

| Metric | นิยาม | ทำไมสำคัญ |
|---|---|---|
| **Top-1 hit rate** | ในขอบเขต: อันดับ 1 ∈ expected และคะแนน ≥ threshold | ถ้าผู้ใช้เลือกอันแรกเสมอ จะถูกกี่ % |
| **Top-3 hit rate** | ในขอบเขต: มี expected อยู่ใน `matches` (≤ 3 และ ≥ threshold) | ตรงกับ UX จริง ที่ผู้ใช้เลือกเองจาก 3 อัน |
| Top-3 (ไม่ใช้ threshold) | expected อยู่ใน 3 อันดับแรกของ ranking | แยกว่าพลาดเพราะ ranking หรือเพราะ threshold |
| **False rejection rate** | ในขอบเขตแต่ `matches` ว่าง | ระบบเข้มเกินไป |
| **Out-of-scope rejection rate** | นอกขอบเขตและ `matches` ว่าง | ความสามารถ "ไม่เดา" |
| MRR (ทางเลือก) | ค่าเฉลี่ย 1/rank ของคำตอบถูก | ภาพรวมของ ranking |

**การเลือก threshold ใหม่**
- กวาด threshold 0.40 → 0.90 ทีละ 0.01 บนชุด **tuning**
- ต่อ threshold t คำนวณ TPR(t) = top-3 hit ในขอบเขต และ TNR(t) = อัตราปฏิเสธนอกขอบเขต
- เลือก t ที่ **J(t) = TPR + TNR − 1 สูงสุด** (Youden's J) หรือถ้าต้องการเน้นความปลอดภัย ให้กำหนด TNR ≥ 0.8 แล้วเลือก t ที่ TPR สูงสุด
- รายงานค่าของ t ที่เลือก **และ** ของ 0.55 เดิมบนชุด **report** เทียบกัน พร้อมกราฟ TPR/TNR ตาม t
- **ข้อควรระวัง:** ข้อมูลภายในรุ่นเดียวกันคะแนนสูงกันหมด (คำว่า "ไมโครเวฟ" ดันคะแนน `docs/STUDY_GUIDE.md:613-617`) threshold เดียวอาจแยกนอกขอบเขตได้ไม่ดี ให้รายงานตามจริง

### ร่างสคริปต์ประเมิน (ข้อเสนอในเอกสารเท่านั้น ยังไม่ได้สร้างไฟล์)
ใช้โค้ดจริงที่ build แล้วใน `backend/dist` แบบเดียวกับ `backend/scripts/study-measure.js:44-110` (ไม่ต่อ DB ไม่อ่าน .env)

```js
// ข้อเสนอ: backend/scripts/eval-search.js  —  รัน: cd backend && npm run build && node scripts/eval-search.js ../data/eval/queries.json
const fs = require('fs'), path = require('path');
const DIST = path.resolve(__dirname, '../dist');
const { EmbeddingService } = require(path.join(DIST, 'embedding/embedding.service.js'));
const { buildSymptomTexts, rankGraphs } = require(path.join(DIST, 'symptom-search/symptom-matcher.js'));
const MANUALS = path.resolve(__dirname, '../../data/manuals');
const MAX_RESULTS = 3;

async function main(file) {
  const set = JSON.parse(fs.readFileSync(file, 'utf8')).queries;
  const graphs = [];
  for (const f of fs.readdirSync(MANUALS).filter((x) => x.endsWith('.json'))) {
    const m = JSON.parse(fs.readFileSync(path.join(MANUALS, f), 'utf8'));
    for (const g of m.graphs) graphs.push({ ...g, manual_id: m.manual_id });
  }
  const manualOf = new Map(graphs.map((g) => [g.graph_id, g.manual_id]));

  const emb = new EmbeddingService(); await emb.load();
  const cache = new Map(), index = [];
  for (const t of buildSymptomTexts(graphs)) {            // เหมือน symptom-search.service.ts:78-88
    if (!cache.has(t.text)) cache.set(t.text, await emb.embed(t.text));
    index.push({ ...t, vector: cache.get(t.text) });
  }

  const rows = [];
  for (const q of set) {
    const qv = await emb.embed(q.query);
    const cands = index.filter((i) => manualOf.get(i.graphId) === q.manualId);   // pre-filter เหมือนระบบจริง
    rows.push({ ...q, ranked: rankGraphs(qv, cands).map((r) => ({ id: r.graphId, s: r.score })) });
  }

  const evalAt = (t, split) => {
    const sub = rows.filter((r) => r.split === split);
    const inS = sub.filter((r) => r.inScope), outS = sub.filter((r) => !r.inScope);
    const shown = (r) => r.ranked.filter((x) => x.s >= t).slice(0, MAX_RESULTS);
    const hit1 = inS.filter((r) => shown(r)[0] && r.expected.includes(shown(r)[0].id)).length;
    const hit3 = inS.filter((r) => shown(r).some((x) => r.expected.includes(x.id))).length;
    const falseRej = inS.filter((r) => shown(r).length === 0).length;
    const oosRej = outS.filter((r) => shown(r).length === 0).length;
    return { t, top1: hit1 / inS.length, top3: hit3 / inS.length, falseRej: falseRej / inS.length,
             oosRej: oosRej / outS.length, J: hit3 / inS.length + oosRej / outS.length - 1 };
  };

  const sweep = [];
  for (let t = 0.40; t <= 0.9001; t += 0.01) sweep.push(evalAt(+t.toFixed(2), 'tuning'));
  const best = sweep.reduce((a, b) => (b.J > a.J ? b : a));
  console.table([evalAt(0.55, 'report'), evalAt(best.t, 'report')]);
  fs.writeFileSync('eval-result.json', JSON.stringify({ sweep, best, rows }, null, 2), 'utf8');
}
main(process.argv[2]);
```

### งานเสริม (ถ้ามีเวลาเหลือ ครึ่งวัน)
- **ความถูกของ citation:** สุ่ม 20 ผัง × 1 โหนด เปิด PDF หน้าที่ระบบแสดง แล้วให้คะแนน 3 ระดับ (ตรงหน้า / อยู่หน้าอื่นในเล่ม / ไม่พบ) — สำคัญเพราะ reference เป็นระดับผัง (ไฟล์ 12)
- **ความถูกของคำแปล/ลำดับขั้น:** สุ่มตรวจ 10 ผังด้วยมือเทียบกับ PDF (เอกสารบอกว่ายังไม่ได้ทำ)
- **Safety coverage:** รัน `python scripts/simulate_paths.py --all data/manuals` ดูว่าเส้นทางที่ผ่านขั้นอันตรายมีด่านครบไหม
- **Rephrase guard:** `node scripts/study-measure.js guard` ทดสอบ 7 กรณีที่ LLM อาจตอบผิด (`backend/scripts/study-measure.js:14-15`)

### ผลที่ควรนำเสนอ (เทมเพลตสไลด์)
| ชุด report (n=40) | threshold 0.55 | threshold ใหม่ = ___ |
|---|---|---|
| Top-1 hit (ในขอบเขต, n=__) | __% | __% |
| Top-3 hit | __% | __% |
| False rejection | __% | __% |
| Out-of-scope rejection (n=__) | __% | __% |
พร้อมบอกข้อจำกัด: ชุดเล็ก, ผู้พัฒนาตั้งเฉลยเอง, 4 จาก 21 คู่มือ

## 3. เตรียมคำตอบ: "ไม่มีผู้ใช้จริงทดสอบ"

**คำตอบแนะนำ (พูดได้ทันที):**
"ครับ ยังไม่ได้ทดสอบกับผู้ใช้จริง ผมไม่อยากอ้างตัวเลขความพึงพอใจที่ไม่มี สิ่งที่ประเมินได้และทำแล้วคือส่วนที่วัดได้แบบวัตถุวิสัย คือ หนึ่ง ข้อมูลในผังตรงกับคู่มือ PDF แค่ไหน ตรวจด้วยสคริปต์แล้วไม่พบ FAIL แต่มี 48 ผังที่ตรวจอัตโนมัติไม่ได้ เพราะ PDF ไม่มีข้อความหรือไม่ทราบไฟล์ต้นทาง (61 ผังในรายงาน ลบผังแอร์ 13 ผังที่ไม่อยู่ในระบบแล้ว) และสอง การค้นหาเลือกผังถูกแค่ไหน ด้วยชุดคำค้น __ ข้อ ได้ top-3 __% ส่วนการทดสอบผู้ใช้ ระบบมีเครื่องมือเก็บไว้แล้ว ทั้ง feedback 👍/👎, ข้อความผลลัพธ์ และ dashboard ที่แยกผลจบว่าแก้ได้เองหรือส่งช่าง ขั้นต่อไปคือ usability test 5–8 คนแบบ task-based แล้ววัด task success rate กับ SUS"

**ถ้าถูกถามต่อว่า "แล้วรู้ได้ไงว่าใช้ได้จริง":**
- ระบบไม่สร้างคำแนะนำเอง → ความถูกต้องของคำแนะนำ = ความถูกต้องของผังเทียบกับคู่มือ ซึ่งตรวจได้โดยไม่ต้องมีผู้ใช้
- ความเสี่ยงที่เหลือคือ "เลือกผังผิด" → ลดด้วยการให้ผู้ใช้เลือกเองจาก ≤ 3 และมีหน้า "อาการทั้งหมด"
- ยอมรับว่ายังไม่ได้วัดว่าผู้ใช้ทั่วไปตอบคำถาม checkpoint ถูกไหม (เช่น "ฟิวส์ขาดไหม" อาจตอบไม่ได้)

**แผน usability test หลังสอบ (ถ้าถูกถามว่าจะทำอย่างไร):** 5–8 คน × 4 งาน (1 งานต่อประเภทเครื่อง) วัด task success, จำนวนขั้น, เวลา, จำนวนครั้งที่ค้นไม่เจอ, SUS 10 ข้อ และ think-aloud ใช้ dashboard (`/admin/analytics`) ดู outcome ประกอบ
