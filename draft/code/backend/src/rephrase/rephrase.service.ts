/**
 * rephrase.service.ts — เรียบเรียงถ้อยคำของ "สถานะปัจจุบัน" ด้วย LLM แบบมีรั้วกั้น (ร่างใน draft/ ปิดเป็นค่าเริ่มต้น)
 *
 * บทบาทตาม TOR §3 ข้อ 3: LLM เรียบเรียงถ้อยคำเท่านั้น ไม่มีสิทธิ์กำหนดว่าขั้นตอนถัดไปคืออะไร
 * จึงทำงาน "หลัง" engine ตัดสินใจเสร็จแล้ว และรับ/คืนแค่ข้อความ (ไม่รู้จัก session, ไม่เห็นผัง, ไม่เห็นตัวเลือกถัดไป)
 *
 * รั้วกั้น (ทุกข้อ fail-safe = ใช้ข้อความต้นฉบับ ไม่โยน error):
 *   1. ปิดอยู่เป็นค่าเริ่มต้น (ต้องมี LlmClient และสั่งเปิด)
 *   2. ไม่แตะโหนด safety_critical และไม่แตะโหนดสิ้นสุด (คำแนะนำติดต่อศูนย์บริการต้องตรงตามคู่มือ)
 *   3. หมดเวลา/ล้ม/ผลลัพธ์ไม่ผ่านด่าน checkRephrase → ใช้ต้นฉบับ
 *   4. แคชตามข้อความ: ข้อความเดิมได้ผลเดิม ไม่ยิง LLM ซ้ำ (ลดค่าใช้จ่าย และผลคงที่ระหว่างการสาธิต)
 */

import { Logger } from '@nestjs/common';

import { checkRephrase, type GuardOptions } from './rephrase-guard';

export type RephraseNodeType = 'checkpoint' | 'instruction' | 'input' | 'resolution' | 'escalation';

/** ช่องเสียบ LLM — ทดสอบด้วยตัวปลอมได้ ไม่ผูกกับผู้ให้บริการรายใด */
export interface LlmClient {
  /** รับข้อความต้นฉบับ คืนข้อความที่เรียบเรียงใหม่ (โยน error ได้ ผู้เรียกจับเอง) */
  rephrase(text: string, signal: AbortSignal): Promise<string>;
}

export interface RephraseContext {
  nodeType: RephraseNodeType;
  safetyCritical: boolean;
}

export interface RephraseResult {
  text: string;
  /** true = ใช้ข้อความที่ LLM เรียบเรียง · false = ใช้ต้นฉบับ */
  rephrased: boolean;
  /** ทำไมถึงใช้ต้นฉบับ (ไว้ดู/บันทึก) */
  reason?: 'disabled' | 'excluded_node' | 'circuit_open' | 'timeout' | 'llm_error' | 'guard_rejected' | 'empty_text';
  detail?: string;
}

export interface RephraseOptions {
  enabled: boolean;
  timeoutMs?: number;
  /** ชนิดโหนดที่อนุญาตให้เรียบเรียง (ค่าเริ่มต้น: คำถาม/คำแนะนำ/ช่องกรอก) */
  allowedTypes?: RephraseNodeType[];
  guard?: GuardOptions;
  cacheSize?: number;
  /** บันทึก log (warn) เมื่อต้อง fallback เพราะ LLM ล้ม/ช้า/ข้อความไม่ผ่านด่าน ไว้ดูอัตราบน Render (ปิดไว้ในเทส) */
  logFailures?: boolean;
  /**
   * วงจรตัด (circuit breaker): LLM ล้ม/ช้าติดกันครบจำนวนนี้ → หยุดเรียก LLM ชั่วคราวและใช้ข้อความต้นฉบับทันที
   * ไม่ให้ผู้ใช้ต้องรอ timeout ทุกขั้นตอนตอนที่ผู้ให้บริการล่ม (ค่าเริ่มต้น 3)
   */
  failureThreshold?: number;
  /** ระยะเวลาที่หยุดเรียก LLM หลังวงจรตัด (มิลลิวินาที ค่าเริ่มต้น 60000) */
  cooldownMs?: number;
  /** นาฬิกา (ใส่ของปลอมตอนทดสอบ) */
  now?: () => number;
}

const DEFAULT_ALLOWED: RephraseNodeType[] = ['checkpoint', 'instruction', 'input'];

export class RephraseService {
  private readonly cache = new Map<string, string>();
  private readonly logger = new Logger(RephraseService.name);
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  constructor(
    private readonly llm: LlmClient | null,
    private readonly options: RephraseOptions = { enabled: false },
  ) {}

  async rephrase(original: string, ctx: RephraseContext): Promise<RephraseResult> {
    const keep = (reason: RephraseResult['reason'], detail?: string): RephraseResult => {
      if (this.options.logFailures && (reason === 'timeout' || reason === 'llm_error' || reason === 'guard_rejected')) {
        this.logger.warn(`ใช้ข้อความต้นฉบับ (${reason}): ${detail ?? ''}`);
      }
      return { text: original, rephrased: false, reason, detail };
    };

    if (!this.options.enabled || !this.llm) return keep('disabled');
    if (original.trim() === '') return keep('empty_text');
    const allowed = this.options.allowedTypes ?? DEFAULT_ALLOWED;
    if (ctx.safetyCritical || !allowed.includes(ctx.nodeType)) return keep('excluded_node');

    const cached = this.cache.get(original);
    if (cached !== undefined) return { text: cached, rephrased: true };

    const now = this.options.now ?? Date.now;
    if (now() < this.circuitOpenUntil) return keep('circuit_open');

    const controller = new AbortController();
    const timeoutMs = this.options.timeoutMs ?? 3000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let candidate: string;
    try {
      candidate = await Promise.race([
        this.llm.rephrase(original, controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('__timeout__'));
          }, timeoutMs);
        }),
      ]);
    } catch (err) {
      this.recordInfraFailure(now());
      const msg = err instanceof Error ? err.message : String(err);
      return msg === '__timeout__' ? keep('timeout', `เกิน ${timeoutMs} ms`) : keep('llm_error', msg);
    } finally {
      if (timer) clearTimeout(timer);
    }

    this.consecutiveFailures = 0; // LLM ตอบกลับได้ (แม้ข้อความจะไม่ผ่านด่าน) = ระบบปลายทางยังปกติ
    const cleaned = stripWrapping(candidate);
    const verdict = checkRephrase(original, cleaned, this.options.guard);
    if (!verdict.ok) return keep('guard_rejected', verdict.reason);

    this.remember(original, cleaned);
    return { text: cleaned, rephrased: true };
  }

  /** ล้ม/ช้าติดกันครบเกณฑ์ → เปิดวงจรตัด (ไม่นับกรณีข้อความไม่ผ่านด่าน เพราะนั่นคือ LLM ตอบกลับได้ปกติ) */
  private recordInfraFailure(nowMs: number): void {
    this.consecutiveFailures++;
    const threshold = this.options.failureThreshold ?? 3;
    if (this.consecutiveFailures >= threshold) {
      const cooldown = this.options.cooldownMs ?? 60_000;
      this.circuitOpenUntil = nowMs + cooldown;
      this.consecutiveFailures = 0;
      if (this.options.logFailures) this.logger.warn(`LLM ล้ม/ช้าติดกัน ${threshold} ครั้ง — หยุดเรียก ${Math.round(cooldown / 1000)} วินาที ใช้ข้อความต้นฉบับ`);
    }
  }

  private remember(key: string, value: string): void {
    const max = this.options.cacheSize ?? 500;
    if (this.cache.size >= max) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, value);
  }
}

/** LLM มักห่อคำตอบด้วยเครื่องหมายคำพูดหรือขึ้นบรรทัดใหม่ — ตัดออกก่อนตรวจ */
function stripWrapping(s: string): string {
  return s.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
}
