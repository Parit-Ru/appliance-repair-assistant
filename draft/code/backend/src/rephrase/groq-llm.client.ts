/**
 * groq-llm.client.ts — LlmClient ที่เรียก Groq (API แบบเข้ากันได้กับ OpenAI) ด้วย fetch ของ Node (ไม่เพิ่ม dependency)
 * (ร่างใน draft/)
 *
 * ⚠️ ยังไม่เคยทดสอบกับ Groq จริง (ไม่มี API key ในการทำร่างนี้) — ทดสอบด้วย fetch ปลอมเท่านั้น
 *    ก่อนใช้จริงให้ตรวจ: URL ของ endpoint, ชื่อโมเดล (ตั้งผ่าน GROQ_MODEL — ไม่ตั้งค่าเริ่มต้นให้ เพราะชื่อโมเดลเปลี่ยนได้)
 *
 * ตัวแปรสภาพแวดล้อม (อ่านที่ createGroqClientFromEnv เท่านั้น):
 *   GROQ_API_KEY   ความลับ — ห้ามใส่ในไฟล์ที่ commit
 *   GROQ_MODEL     ชื่อโมเดลที่ Groq มีอยู่ (ไม่มีค่าเริ่มต้น)
 *   REPHRASE_ENABLED  ต้องเป็น 'true' ถึงจะเปิด (เหมือน SYMPTOM_SEARCH_ENABLED)
 *   GROQ_ENDPOINT  (ไม่บังคับ) URL ของ API แบบ chat completions ที่เข้ากันได้กับ OpenAI — ใช้ทดสอบกับเซิร์ฟเวอร์จำลองในเครื่องได้
 */

import type { LlmClient } from './rephrase.service';

const DEFAULT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = [
  'คุณเรียบเรียงข้อความคำแนะนำการตรวจซ่อมเครื่องใช้ไฟฟ้าให้อ่านเข้าใจง่ายขึ้นเป็นภาษาไทย',
  'กติกา: ห้ามเพิ่ม ลบ หรือเปลี่ยนความหมาย · ห้ามเปลี่ยนตัวเลข รหัส ชื่อรุ่น ชื่อฟังก์ชัน หรือหน่วย',
  'ห้ามเพิ่มคำแนะนำใหม่ ห้ามบอกขั้นตอนถัดไป ห้ามใส่เครื่องหมายคำพูด/หัวข้อ/รายการ',
  'ตอบเฉพาะข้อความที่เรียบเรียงแล้ว เป็นข้อความเดียวต่อเนื่อง',
].join('\n');

export interface GroqClientConfig {
  apiKey: string;
  model: string;
  endpoint?: string;
  /** ใส่ fetch ปลอมตอนทดสอบ */
  fetchImpl?: typeof fetch;
}

export class GroqLlmClient implements LlmClient {
  constructor(private readonly config: GroqClientConfig) {}

  async rephrase(text: string, signal: AbortSignal): Promise<string> {
    const doFetch = this.config.fetchImpl ?? fetch;
    const res = await doFetch(this.config.endpoint ?? DEFAULT_ENDPOINT, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0,
        max_tokens: 400,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Groq ตอบ HTTP ${res.status}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('รูปแบบคำตอบของ Groq ไม่ตรงที่คาด');
    return content;
  }
}

/** คืน null ถ้าไม่ได้เปิดหรือตั้งค่าไม่ครบ (ระบบทำงานต่อโดยใช้ข้อความต้นฉบับ) */
export function createGroqClientFromEnv(env: NodeJS.ProcessEnv = process.env): GroqLlmClient | null {
  if (env.REPHRASE_ENABLED !== 'true') return null;
  if (!env.GROQ_API_KEY || !env.GROQ_MODEL) return null;
  return new GroqLlmClient({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL, endpoint: env.GROQ_ENDPOINT || undefined });
}
