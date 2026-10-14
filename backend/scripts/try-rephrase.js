require('dotenv/config');

const fs = require('node:fs');
const path = require('node:path');

const DIST = path.resolve(__dirname, '../dist/rephrase');
const MANUAL = path.resolve(__dirname, '../../data/manuals/samsung_ac_ar70h.json');
const ARGS = process.argv.slice(2);
const COUNT = Number(ARGS.find((a) => /^\d+$/.test(a))) || 6;
// --model=<ชื่อ> : ลองโมเดลอื่นชั่วคราวโดยไม่ต้องแก้ backend/.env (ไว้เทียบหลายโมเดล)
const MODEL_ARG = ARGS.find((a) => a.startsWith('--model='));
if (MODEL_ARG) process.env.GROQ_MODEL = MODEL_ARG.slice('--model='.length);
// --effort=<ค่า> : ตั้ง GROQ_REASONING_EFFORT ชั่วคราว (ใช้กับโมเดลที่คิดก่อนตอบ เช่น --effort=low)
const EFFORT_ARG = ARGS.find((a) => a.startsWith('--effort='));
if (EFFORT_ARG) process.env.GROQ_REASONING_EFFORT = EFFORT_ARG.slice('--effort='.length);
const MODELS_URL = 'https://api.groq.com/openai/v1/models';

function textOf(node) {
  if (node.type === 'checkpoint') return node.question;
  if (node.type === 'instruction') return node.content;
  return node.prompt;
}

// เลือกโหนดที่ไม่ใช่ด่านความปลอดภัย กระจายห่างๆ กันทั่วผัง (ไม่สุ่ม ผลเทียบกันได้ทุกครั้ง)
function pickNodes(count) {
  const manual = JSON.parse(fs.readFileSync(MANUAL, 'utf-8'));
  const all = [];
  for (const graph of manual.graphs) {
    for (const node of graph.nodes) {
      const usable = ['checkpoint', 'instruction', 'input'].includes(node.type) && !node.safety_critical;
      if (usable && textOf(node)) all.push({ id: `${graph.graph_id.replace('samsung_ac_ar70h_', '')}/${node.node_id}`, type: node.type, text: textOf(node) });
    }
  }
  const step = Math.max(1, Math.floor(all.length / count));
  return all.filter((_, i) => i % step === 0).slice(0, count);
}

// node scripts/try-rephrase.js --models : ดูรายชื่อโมเดลที่ key นี้เรียกได้จริง (ใช้ตอนเจอ HTTP 404/400 เพราะชื่อโมเดลผิด)
async function listModels() {
  if (!process.env.GROQ_API_KEY) {
    console.error('ยังไม่ได้ตั้ง GROQ_API_KEY ใน backend/.env');
    process.exit(1);
  }
  const res = await fetch(MODELS_URL, { headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}` } });
  if (!res.ok) {
    console.error(`Groq ตอบ HTTP ${res.status}${res.status === 401 ? ' (key ผิดหรือหมดอายุ)' : ''}`);
    process.exit(1);
  }
  const json = await res.json();
  const ids = (json.data || []).map((m) => m.id).sort();
  console.log(`โมเดลที่ key นี้เรียกได้ ${ids.length} ตัว:`);
  for (const id of ids) {
    const notChat = /whisper|tts|guard|embed|orpheus/i.test(id) ? '(ไม่ใช่โมเดลแชท)' : '';
    console.log(`  ${id} ${notChat}`.trimEnd());
  }
  const current = process.env.GROQ_MODEL;
  console.log(`\nGROQ_MODEL ปัจจุบัน: ${current || '(ไม่ได้ตั้ง)'} → ${current && ids.includes(current) ? 'อยู่ในรายการ ✅' : 'ไม่อยู่ในรายการ ❌ ต้องแก้ใน backend/.env'}`);
  console.log('เลือกชื่อโมเดลแชทจากรายการ ใส่ GROQ_MODEL ใน backend/.env แล้วรัน node scripts/try-rephrase.js อีกครั้ง');
}

// --raw : พิมพ์สรุปคำตอบดิบของ Groq ทุกคำขอ (finish_reason, จำนวน token, ฟิลด์ในข้อความ, ความยาว content)
// ไว้ดูว่าทำไมผลลัพธ์ว่าง/ผิดรูป ไม่พิมพ์ header หรือ key
function enableRawLog() {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const res = await realFetch(url, init);
    try {
      const json = await res.clone().json();
      const choice = json.choices && json.choices[0];
      const message = (choice && choice.message) || {};
      const content = typeof message.content === 'string' ? message.content : '';
      console.log(`   [raw] HTTP ${res.status} · finish_reason=${choice ? choice.finish_reason : '-'} · usage=${JSON.stringify(json.usage || {})}`);
      console.log(`   [raw] ฟิลด์ใน message: ${Object.keys(message).join(', ') || '-'} · ความยาว content=${content.length}`);
      const reasoning = message.reasoning || message.reasoning_content;
      if (reasoning) console.log(`   [raw] reasoning (ตัด 200 ตัวแรก): ${String(reasoning).replace(/\s+/g, ' ').slice(0, 200)}`);
      if (content.includes('<think>')) console.log('   [raw] พบแท็ก <think> ใน content');
      if (!res.ok) console.log(`   [raw] error body: ${JSON.stringify(json).slice(0, 300)}`);
    } catch {
      console.log(`   [raw] HTTP ${res.status} (อ่านเป็น JSON ไม่ได้)`);
    }
    return res;
  };
}

async function main() {
  if (ARGS.includes('--models')) return listModels();
  if (ARGS.includes('--raw')) enableRawLog();

  const modelName = process.env.GROQ_MODEL;
  if (modelName && /[<>\s"']/.test(modelName)) {
    console.error(`ชื่อโมเดลมีเครื่องหมายที่ไม่ควรมี (< > ช่องว่าง หรือเครื่องหมายคำพูด): ${modelName}`);
    console.error('ใส่เฉพาะชื่อ ไม่ต้องมีวงเล็บ เช่น --model=openai/gpt-oss-20b');
    process.exit(1);
  }

  if (!fs.existsSync(path.join(DIST, 'rephrase.service.js'))) {
    console.error('ไม่พบโฟลเดอร์ dist/ — รัน npm run build ก่อน');
    process.exit(1);
  }
  const { RephraseService } = require(path.join(DIST, 'rephrase.service.js'));
  const { createGroqClientFromEnv } = require(path.join(DIST, 'groq-llm.client.js'));

  console.log('การตั้งค่า (ไม่แสดงค่าของ key):');
  console.log('  REPHRASE_ENABLED = true :', process.env.REPHRASE_ENABLED === 'true' ? 'ใช่' : 'ไม่ใช่');
  console.log('  GROQ_API_KEY ตั้งไว้     :', process.env.GROQ_API_KEY ? 'ใช่' : 'ไม่');
  console.log('  GROQ_MODEL              :', process.env.GROQ_MODEL || '(ไม่ได้ตั้ง)');
  console.log('  GROQ_REASONING_EFFORT   :', process.env.GROQ_REASONING_EFFORT || '(ไม่ได้ตั้ง = ไม่ส่งพารามิเตอร์)');

  const client = createGroqClientFromEnv();
  if (!client) {
    console.error('\nตั้งค่าไม่ครบ: ต้องมี REPHRASE_ENABLED=true, GROQ_API_KEY และ GROQ_MODEL ใน backend/.env');
    process.exit(1);
  }

  const timeoutMs = Number(process.env.REPHRASE_TIMEOUT_MS) || 3000;
  console.log(`  timeout                 : ${timeoutMs} ms`);
  const service = new RephraseService(client, { enabled: true, timeoutMs });

  const nodes = pickNodes(COUNT);
  console.log(`\nทดลอง ${nodes.length} ข้อความ (แต่ละข้อความนับเป็น 1 คำขอของโควตา Groq)\n`);

  let rephrased = 0;
  let totalMs = 0;
  for (const node of nodes) {
    const started = Date.now();
    const result = await service.rephrase(node.text, { nodeType: node.type, safetyCritical: false });
    const ms = Date.now() - started;
    totalMs += ms;

    console.log(`── ${node.id} (${node.type}) · ${ms} ms`);
    console.log(`   ต้นฉบับ : ${node.text}`);
    if (result.rephrased && result.text === node.text) {
      console.log('   = LLM ตอบข้อความเดิมทุกตัวอักษร (หน้าเว็บจะไม่แสดงป้าย AI)');
    } else if (result.rephrased) {
      rephrased += 1;
      console.log(`   ✅ เรียบเรียง : ${result.text}`);
    } else {
      console.log('   ↩ ใช้ต้นฉบับ (เหตุผลดูบรรทัด warn ด้านบน)');
    }
    console.log('');
  }

  console.log(`สรุป: เรียบเรียงสำเร็จ ${rephrased} / ${nodes.length} · เวลาเฉลี่ย ${Math.round(totalMs / nodes.length)} ms ต่อข้อความ`);
  console.log('อ่านผลทีละข้อ: ความหมายต้องเหมือนเดิม ตัวเลข/ชื่อ/รหัสต้องครบ ข้อที่ ↩ คือด่านตรวจหรือเครือข่ายตกไปใช้ต้นฉบับ (ทำงานถูกต้อง)');
}

main().catch((err) => {
  console.error('\nล้มเหลว:', err.message);
  process.exit(1);
});
