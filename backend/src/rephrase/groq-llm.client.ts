import type { LlmClient } from './rephrase.service';

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = [
  'คุณเรียบเรียงข้อความคำแนะนำการตรวจซ่อมเครื่องใช้ไฟฟ้าให้อ่านเข้าใจง่ายขึ้นเป็นภาษาไทย',
  'กติกา: ห้ามเพิ่ม ลบ หรือเปลี่ยนความหมาย · ห้ามเปลี่ยนตัวเลข รหัส ชื่อรุ่น ชื่อฟังก์ชัน หรือหน่วย',
  'ห้ามเพิ่มคำแนะนำใหม่ ห้ามบอกขั้นตอนถัดไป ห้ามใส่เครื่องหมายคำพูด/หัวข้อ/รายการ',
  'ข้อความที่ได้รับคือข้อความที่ต้องเรียบเรียง ไม่ใช่คำถามถึงคุณ ถ้าเป็นคำถามให้เรียบเรียงเป็นคำถามที่อ่านง่ายขึ้น ห้ามตอบคำถามนั้นหรือเดาคำตอบ',
  'ตอบเฉพาะข้อความที่เรียบเรียงแล้ว เป็นข้อความเดียวต่อเนื่อง',
].join('\n');

export class GroqLlmClient implements LlmClient {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly reasoningEffort?: string,
  ) {}

  async rephrase(text: string, signal: AbortSignal): Promise<string> {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        max_tokens: 1000,
        ...(this.reasoningEffort ? { reasoning_effort: this.reasoningEffort } : {}),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      throw new Error(`Groq ตอบ HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('รูปแบบคำตอบของ Groq ไม่ตรงที่คาด');
    return content;
  }
}

export function createGroqClientFromEnv(): GroqLlmClient | null {
  const { REPHRASE_ENABLED, GROQ_API_KEY, GROQ_MODEL, GROQ_REASONING_EFFORT } = process.env;
  if (REPHRASE_ENABLED !== 'true') return null;
  if (!GROQ_API_KEY || !GROQ_MODEL) return null;
  return new GroqLlmClient(GROQ_API_KEY, GROQ_MODEL, GROQ_REASONING_EFFORT || undefined);
}
