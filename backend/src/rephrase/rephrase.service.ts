import { Logger } from '@nestjs/common';

import { checkRephrase } from './rephrase-guard';

type RephraseNodeType = 'checkpoint' | 'instruction' | 'input' | 'resolution' | 'escalation';

export interface LlmClient {
  rephrase(text: string, signal: AbortSignal): Promise<string>;
}

interface RephraseContext {
  nodeType: RephraseNodeType;
  safetyCritical: boolean;
}

interface RephraseResult {
  text: string;
  rephrased: boolean;
}

interface RephraseOptions {
  enabled: boolean;
  timeoutMs?: number;
}

export class RephraseService {
  private readonly cache = new Map<string, string>();
  private readonly logger = new Logger(RephraseService.name);

  constructor(
    private readonly llm: LlmClient | null,
    private readonly options: RephraseOptions = { enabled: false },
  ) {}

  async rephrase(original: string, ctx: RephraseContext): Promise<RephraseResult> {
    const keep: RephraseResult = { text: original, rephrased: false };

    if (!this.options.enabled || !this.llm) return keep;
    if (original.trim() === '') return keep;
    if (ctx.safetyCritical || ctx.nodeType === 'resolution' || ctx.nodeType === 'escalation') return keep;

    const cached = this.cache.get(original);
    if (cached !== undefined) return { text: cached, rephrased: true };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 3000);
    try {
      const candidate = stripWrapping(await this.llm.rephrase(original, controller.signal));
      const verdict = checkRephrase(original, candidate);
      if (!verdict.ok) {
        this.logger.warn(`ใช้ข้อความต้นฉบับ (ไม่ผ่านด่านตรวจ): ${verdict.reason}`);
        return keep;
      }
      this.cache.set(original, candidate);
      return { text: candidate, rephrased: true };
    } catch (err) {
      this.logger.warn(`ใช้ข้อความต้นฉบับ (LLM ล้มหรือช้าเกิน): ${err instanceof Error ? err.message : String(err)}`);
      return keep;
    } finally {
      clearTimeout(timer);
    }
  }
}

function stripWrapping(s: string): string {
  return s.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
}
