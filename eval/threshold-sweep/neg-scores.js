// วัดคะแนนของคำค้น "นอกขอบเขต" ต่อคู่มือ (เหมือนหน้าเว็บที่ค้นในคู่มือเดียว)
// อ่านเฉพาะ data/manuals + backend/dist · ไม่ต่อ DB · ไม่อ่าน .env
const fs = require('fs');
const path = require('path');
const BACKEND = path.resolve(__dirname, '../../backend');
const MANUALS = path.resolve(__dirname, '../../data/manuals');
const { EmbeddingService } = require(path.join(BACKEND, 'dist/embedding/embedding.service.js'));
const matcher = require(path.join(BACKEND, 'dist/symptom-search/symptom-matcher.js'));

const NEG = {
  // ทักทาย/คุยเล่น
  chat: ['สวัสดี', 'วันนี้ฝนตก', 'ขอบคุณครับ', 'คุณชื่ออะไร', 'ช่วยด้วย', 'ทดสอบ', 'วันนี้กินอะไรดี', 'ราคาทองวันนี้เท่าไหร่'],
  // เครื่องใช้ไฟฟ้า/ของอื่นที่ระบบไม่มีผัง
  other_appliance: ['แอร์ไม่เย็น', 'พัดลมไม่หมุน', 'หม้อหุงข้าวไม่สุก', 'มือถือชาร์จไม่เข้า', 'รถสตาร์ทไม่ติด', 'คอมพิวเตอร์ค้าง', 'เครื่องทำน้ำอุ่นไม่ร้อน', 'หลอดไฟดับ', 'ปั๊มน้ำไม่ทำงาน'],
  // คลุมเครือ/ไม่ใช่อาการ
  vague: ['เสีย', 'ไม่ทำงาน', 'มีปัญหา', 'ไม่รู้เป็นอะไร', 'เครื่องแปลกๆ', 'ใช้ไม่ได้'],
  // เรื่องเกี่ยวข้องแต่ไม่ใช่อาการเสีย
  related_nonfault: ['วิธีทำความสะอาดเครื่อง', 'ราคาค่าซ่อมเท่าไหร่', 'ประกันหมดหรือยัง', 'ซื้อรุ่นไหนดี', 'ศูนย์บริการอยู่ที่ไหน'],
};
// คำค้น "คนละอุปกรณ์กับคู่มือที่เลือก" (ผู้ใช้เลือกรุ่นผิด) ทำเฉพาะเมื่อคู่มือไม่ใช่ของอุปกรณ์นั้น
const CROSS = [
  ['ตู้เย็นไม่เย็น', 'Refrigerator'],
  ['น้ำไม่เข้าเครื่องซักผ้า', 'Washing Machine'],
  ['ไมโครเวฟไม่ร้อน', 'Microwave'],
  ['เครื่องซักผ้าไม่ปั่นแห้ง', 'Washing Machine'],
  ['ช่องแช่แข็งไม่แข็ง', 'Refrigerator'],
  ['จานหมุนไม่หมุน', 'Microwave'],
];

(async () => {
  const manuals = fs.readdirSync(MANUALS).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(MANUALS, f), 'utf8')));
  const flows = [];
  for (const m of manuals) for (const g of m.flows) flows.push({
    flow_id: g.flow_id, manual_id: m.manual_id, entry_symptom: g.entry_symptom,
    entry_symptom_th: g.entry_symptom_th, entry_symptom_aliases: g.entry_symptom_aliases,
  });
  const manualOf = new Map(flows.map((g) => [g.flow_id, g.manual_id]));
  const catOf = new Map(manuals.map((m) => [m.manual_id, m.device_category || m.category || m.device || '?']));
  console.error('manual keys sample', Object.keys(manuals[0]).join(','), '| cats', [...new Set(catOf.values())].join(','));

  const emb = new EmbeddingService(); await emb.load();
  const texts = matcher.buildSymptomTexts(flows);
  const cache = new Map(); const index = [];
  for (const it of texts) {
    let v = cache.get(it.text);
    if (v === undefined) { v = await emb.embed(it.text); cache.set(it.text, v); }
    index.push({ ...it, vector: v });
  }
  const byManual = new Map();
  for (const it of index) { const mid = manualOf.get(it.flowId); if (!byManual.has(mid)) byManual.set(mid, []); byManual.get(mid).push(it); }

  const rows = []; // {cat, query, manual, best}
  async function score(cat, query, mids) {
    const v = await emb.embed(query);
    for (const mid of mids) {
      const ranked = matcher.rankFlows(v, byManual.get(mid));
      rows.push({ cat, query, manual: mid, best: ranked.length ? ranked[0].score : 0, top: ranked[0] && ranked[0].matchedText });
    }
  }
  const allM = [...byManual.keys()];
  for (const [cat, qs] of Object.entries(NEG)) for (const q of qs) await score(cat, q, allM);
  for (const [q, dev] of CROSS) await score('wrong_device', q, allM.filter((m) => catOf.get(m) !== dev));
  fs.writeFileSync(process.argv[2], JSON.stringify({ cats: [...new Set(catOf.values())], rows }, null, 1), 'utf8');
  console.error('rows', rows.length);
})();
