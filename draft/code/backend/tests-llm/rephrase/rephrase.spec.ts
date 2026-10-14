import * as fs from 'fs';
import * as path from 'path';
import { checkRephrase, extractLatinTokens, extractNumbers } from './rephrase-guard';
import { RephraseService, type LlmClient } from './rephrase.service';
import { GroqLlmClient, createGroqClientFromEnv } from './groq-llm.client';

// ข้อมูลจริง: ข้อความของโหนดทุกโหนดในผังแอร์ 13 ผัง (ใช้ทดสอบด่านกับเนื้อหาจริง ไม่ใช่ตัวอย่างที่แต่งเอง)
const manual = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../data/manuals/samsung_ac_ar70h.json'), 'utf-8')) as {
  graphs: Array<{ graph_id: string; nodes: Array<Record<string, unknown>> }>;
};
const textOf = (n: Record<string, unknown>): string => String(n.question ?? n.content ?? n.prompt ?? '');
const allNodes = manual.graphs.flatMap((g) => g.nodes);

const fake = (impl: (text: string, signal: AbortSignal) => Promise<string>): LlmClient & { calls: number } => {
  const f = { calls: 0, rephrase: (t: string, s: AbortSignal) => { f.calls++; return impl(t, s); } };
  return f;
};

describe('rephrase-guard: checkRephrase', () => {
  const orig = 'ให้มีพื้นที่ว่างรอบเครื่องอย่างน้อย 30 ซม. และปิดฟังก์ชัน Good Sleep ก่อน ถ้าไม่ได้ผล ให้ลองใหม่';

  it('ยอมรับการเรียบเรียงที่คงตัวเลข ชื่อเฉพาะ และจำนวนคำปฏิเสธ', () => {
    const good = 'เว้นพื้นที่ว่างรอบเครื่องอย่างน้อย 30 ซม. แล้วปิดฟังก์ชัน Good Sleep ก่อน หากยังไม่ได้ผล ให้ลองใหม่';
    expect(checkRephrase(orig, good)).toEqual({ ok: true });
  });

  it('ปฏิเสธเมื่อตัวเลขเปลี่ยน', () => {
    const r = checkRephrase(orig, 'เว้นพื้นที่ว่างรอบเครื่องอย่างน้อย 50 ซม. แล้วปิดฟังก์ชัน Good Sleep ก่อน หากยังไม่ได้ผล ให้ลองใหม่');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('ตัวเลข');
  });

  it('ปฏิเสธเมื่อตัวเลขหาย หรือมีตัวเลขเพิ่ม', () => {
    expect(checkRephrase(orig, 'เว้นพื้นที่ว่างรอบเครื่องแล้วปิดฟังก์ชัน Good Sleep ก่อน หากยังไม่ได้ผล ให้ลองใหม่').ok).toBe(false);
    expect(checkRephrase(orig, 'เว้นพื้นที่ว่างรอบเครื่อง 30 ซม. ทุก 2 สัปดาห์ แล้วปิดฟังก์ชัน Good Sleep ก่อน หากยังไม่ได้ผล ให้ลองใหม่').ok).toBe(false);
  });

  it('เทียบเลขไทยกับเลขอารบิกเป็นค่าเดียวกัน', () => {
    expect(extractNumbers('๓๐ ซม.')).toEqual(extractNumbers('30 ซม.'));
  });

  it('ปฏิเสธเมื่อชื่อเฉพาะภาษาอังกฤษ/รหัสหาย หรือมีเพิ่ม', () => {
    expect(checkRephrase(orig, 'เว้นพื้นที่ว่างรอบเครื่องอย่างน้อย 30 ซม. แล้วปิดฟังก์ชันโหมดหลับก่อน หากยังไม่ได้ผล ให้ลองใหม่').ok).toBe(false);
    expect(checkRephrase(orig, 'เว้นพื้นที่ว่างรอบเครื่องอย่างน้อย 30 ซม. แล้วปิดฟังก์ชัน Good Sleep และ Turbo ก่อน หากยังไม่ได้ผล ให้ลองใหม่').ok).toBe(false);
  });

  it('ปฏิเสธเมื่อจำนวนคำว่า "ไม่" เปลี่ยน (กันกลับความหมาย)', () => {
    expect(checkRephrase('เครื่องไม่เย็น', 'เครื่องเย็น').ok).toBe(false);
    expect(checkRephrase('เครื่องไม่เย็น', 'เครื่องไม่เย็นเลย').ok).toBe(true);
  });

  it('ปฏิเสธลิงก์ markdown/HTML หลายย่อหน้า ว่าง สั้น/ยาวเกิน', () => {
    expect(checkRephrase('ตรวจปลั๊ก', 'ตรวจปลั๊ก ดูเพิ่มที่ https://example.com').ok).toBe(false);
    expect(checkRephrase('ตรวจปลั๊กให้แน่น', '```ตรวจปลั๊กให้แน่น```').ok).toBe(false);
    expect(checkRephrase('ตรวจปลั๊กให้แน่น', '<b>ตรวจปลั๊กให้แน่น</b>').ok).toBe(false);
    expect(checkRephrase('ตรวจปลั๊กให้แน่น', 'ตรวจปลั๊ก\n\nให้แน่น').ok).toBe(false);
    expect(checkRephrase('ตรวจปลั๊ก', '   ').ok).toBe(false);
    expect(checkRephrase('ตรวจสอบให้แน่ใจว่าปลั๊กเสียบแน่นและเต้ารับมีไฟฟ้า', 'ตรวจปลั๊ก').ok).toBe(false);
    expect(checkRephrase('ตรวจปลั๊ก', 'ตรวจปลั๊กให้แน่นแล้วลองเปิดเครื่องอีกครั้งหนึ่งและดูว่ามีไฟขึ้นหรือไม่ให้ละเอียด').ok).toBe(false);
  });

  it('extractLatinTokens: เก็บชื่อเฉพาะ ไม่ซ้ำ', () => {
    expect(extractLatinTokens('ปิด Good Sleep แล้วดู E1 และ E1 อีกครั้ง')).toEqual(['Good', 'Sleep', 'E1']);
  });
});

describe('RephraseService', () => {
  const instruction = { nodeType: 'instruction' as const, safetyCritical: false };

  it('ปิดอยู่เป็นค่าเริ่มต้น: คืนต้นฉบับ ไม่เรียก LLM', async () => {
    const llm = fake(async (t) => `${t} (แก้)`);
    const svc = new RephraseService(llm); // ไม่ส่ง options
    expect(await svc.rephrase('ตรวจปลั๊ก', instruction)).toEqual({ text: 'ตรวจปลั๊ก', rephrased: false, reason: 'disabled', detail: undefined });
    expect(llm.calls).toBe(0);
  });

  it('เปิดอยู่แต่ไม่มี LLM: คืนต้นฉบับ', async () => {
    const svc = new RephraseService(null, { enabled: true });
    expect((await svc.rephrase('ตรวจปลั๊ก', instruction)).rephrased).toBe(false);
  });

  it('ไม่แตะโหนด safety_critical และโหนดสิ้นสุด (ไม่เรียก LLM เลย)', async () => {
    const llm = fake(async (t) => t);
    const svc = new RephraseService(llm, { enabled: true });
    expect((await svc.rephrase('ปิดเบรกเกอร์ก่อน', { nodeType: 'instruction', safetyCritical: true })).reason).toBe('excluded_node');
    expect((await svc.rephrase('ติดต่อศูนย์บริการ', { nodeType: 'escalation', safetyCritical: false })).reason).toBe('excluded_node');
    expect((await svc.rephrase('แก้ได้แล้ว', { nodeType: 'resolution', safetyCritical: false })).reason).toBe('excluded_node');
    expect(llm.calls).toBe(0);
  });

  it('ผลผ่านด่าน → ใช้ข้อความที่เรียบเรียง (ตัดเครื่องหมายคำพูดที่ห่อมา)', async () => {
    const svc = new RephraseService(fake(async () => '"ตรวจให้แน่ใจว่าปลั๊กเสียบแน่นดีแล้ว"\n'), { enabled: true });
    const r = await svc.rephrase('ตรวจสอบว่าปลั๊กเสียบแน่น', instruction);
    expect(r).toEqual({ text: 'ตรวจให้แน่ใจว่าปลั๊กเสียบแน่นดีแล้ว', rephrased: true });
  });

  it('LLM โยน error → ใช้ต้นฉบับ ไม่โยนต่อ', async () => {
    const svc = new RephraseService(fake(async () => { throw new Error('HTTP 500'); }), { enabled: true });
    const r = await svc.rephrase('ตรวจปลั๊ก', instruction);
    expect(r).toMatchObject({ text: 'ตรวจปลั๊ก', rephrased: false, reason: 'llm_error', detail: 'HTTP 500' });
  });

  it('LLM ช้าเกินกำหนด → ใช้ต้นฉบับ และสั่งยกเลิกคำขอ', async () => {
    let aborted = false;
    const llm = fake((_t, signal) => new Promise<string>((resolve) => {
      signal.addEventListener('abort', () => { aborted = true; });
      setTimeout(() => resolve('ช้าไป'), 500);
    }));
    const svc = new RephraseService(llm, { enabled: true, timeoutMs: 30 });
    const r = await svc.rephrase('ตรวจปลั๊ก', instruction);
    expect(r).toMatchObject({ text: 'ตรวจปลั๊ก', rephrased: false, reason: 'timeout' });
    expect(aborted).toBe(true);
  });

  it('ผลไม่ผ่านด่าน → ใช้ต้นฉบับ พร้อมเหตุผล', async () => {
    const svc = new RephraseService(fake(async () => 'เว้นระยะ 50 ซม.'), { enabled: true });
    const r = await svc.rephrase('เว้นระยะ 30 ซม.', instruction);
    expect(r).toMatchObject({ text: 'เว้นระยะ 30 ซม.', rephrased: false, reason: 'guard_rejected' });
    expect(r.detail).toContain('ตัวเลข');
  });

  it('logFailures: บันทึก warn เมื่อ fallback (timeout/llm_error/guard) แต่ไม่บันทึกกรณีปกติ', async () => {
    const { Logger } = await import('@nestjs/common');
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      const bad = new RephraseService(fake(async () => 'เว้นระยะ 50 ซม.'), { enabled: true, logFailures: true });
      await bad.rephrase('เว้นระยะ 30 ซม.', instruction); // guard_rejected
      const boom = new RephraseService(fake(async () => { throw new Error('HTTP 500'); }), { enabled: true, logFailures: true });
      await boom.rephrase('ตรวจปลั๊ก', instruction); // llm_error
      expect(warn).toHaveBeenCalledTimes(2);
      const off = new RephraseService(fake(async (t) => t), { enabled: false, logFailures: true });
      await off.rephrase('ตรวจปลั๊ก', instruction); // disabled: ไม่ใช่ความผิดพลาด
      await new RephraseService(fake(async (t) => t), { enabled: true, logFailures: true }).rephrase('ปิดเบรกเกอร์', { nodeType: 'instruction', safetyCritical: true });
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
    }
  });

  describe('circuit breaker', () => {
    const mk = (impl: () => Promise<string>, clock: { t: number }) => {
      const llm = fake(impl);
      const svc = new RephraseService(llm, { enabled: true, failureThreshold: 3, cooldownMs: 1000, now: () => clock.t });
      return { llm, svc };
    };

    it('ล้มติดกัน 3 ครั้ง → หยุดเรียก LLM ทันที (ไม่รอ timeout) แล้วกลับมาลองใหม่หลังครบเวลา', async () => {
      const clock = { t: 0 };
      let healthy = false;
      const { llm, svc } = mk(async () => { if (!healthy) throw new Error('down'); return 'ตรวจให้แน่ใจว่าปลั๊กเสียบแน่น'; }, clock);
      for (const t of ['ก1', 'ก2', 'ก3']) expect((await svc.rephrase(t, instruction)).reason).toBe('llm_error');
      expect(llm.calls).toBe(3);
      const open = await svc.rephrase('ข้อความใหม่', instruction);
      expect(open).toMatchObject({ rephrased: false, reason: 'circuit_open' });
      expect(llm.calls).toBe(3); // ไม่ได้เรียกเพิ่ม
      clock.t = 1500; healthy = true;
      expect((await svc.rephrase('ตรวจสอบว่าปลั๊กเสียบแน่น', instruction)).rephrased).toBe(true);
      expect(llm.calls).toBe(4);
    });

    it('สำเร็จคั่น → นับใหม่ ไม่ตัดวงจร', async () => {
      const clock = { t: 0 };
      let n = 0;
      const { svc } = mk(async () => { n++; if (n % 3 === 0) return 'ตรวจปลั๊กให้แน่น'; throw new Error('x'); }, clock);
      for (let i = 0; i < 9; i++) await svc.rephrase('ตรวจปลั๊กให้แน่น' + i, instruction);
      expect(n).toBe(9); // ไม่เคยถูกตัดวงจร เพราะมีสำเร็จคั่นทุก 3
    });

    it('ข้อความไม่ผ่านด่านไม่นับเป็นความล้มเหลวของ LLM', async () => {
      const clock = { t: 0 };
      const { llm, svc } = mk(async () => 'เว้นระยะ 99 ซม.', clock);
      for (let i = 0; i < 6; i++) expect((await svc.rephrase('เว้นระยะ 30 ซม.' + ' '.repeat(i), instruction)).reason).toBe('guard_rejected');
      expect(llm.calls).toBe(6);
    });

    it('ข้อความที่แคชไว้ยังใช้ได้ตอนวงจรตัด', async () => {
      const clock = { t: 0 };
      let healthy = true;
      const { svc } = mk(async () => { if (!healthy) throw new Error('down'); return 'ตรวจให้แน่ใจว่าปลั๊กเสียบแน่น'; }, clock);
      await svc.rephrase('ตรวจสอบว่าปลั๊กเสียบแน่น', instruction);
      healthy = false;
      for (const t of ['ข1', 'ข2', 'ข3']) await svc.rephrase(t, instruction);
      expect((await svc.rephrase('ข4', instruction)).reason).toBe('circuit_open');
      expect((await svc.rephrase('ตรวจสอบว่าปลั๊กเสียบแน่น', instruction)).rephrased).toBe(true);
    });
  });

  it('แคช: ข้อความเดิมเรียก LLM ครั้งเดียว', async () => {
    const llm = fake(async () => 'ตรวจให้แน่ใจว่าปลั๊กเสียบแน่น');
    const svc = new RephraseService(llm, { enabled: true });
    await svc.rephrase('ตรวจสอบว่าปลั๊กเสียบแน่น', instruction);
    await svc.rephrase('ตรวจสอบว่าปลั๊กเสียบแน่น', instruction);
    expect(llm.calls).toBe(1);
  });
});

describe('กับข้อมูลจริง (โหนดทั้งหมดของผังแอร์)', () => {
  const eligible = allNodes.filter((n) => ['checkpoint', 'instruction', 'input'].includes(String(n.type)) && n.safety_critical !== true);

  it('LLM ที่คืนข้อความเดิมเป๊ะ ผ่านด่านทุกโหนด', async () => {
    const svc = new RephraseService(fake(async (t) => t), { enabled: true });
    for (const n of eligible) {
      const r = await svc.rephrase(textOf(n), { nodeType: n.type as 'instruction', safetyCritical: false });
      expect({ id: n.node_id, rephrased: r.rephrased, detail: r.detail }).toEqual({ id: n.node_id, rephrased: true, detail: undefined });
    }
    expect(eligible.length).toBeGreaterThan(50);
  });

  it('LLM ที่เปลี่ยนตัวเลข ถูกปฏิเสธทุกโหนดที่มีตัวเลข', async () => {
    const withDigits = eligible.filter((n) => extractNumbers(textOf(n)).length > 0);
    expect(withDigits.length).toBeGreaterThan(0);
    const svc = new RephraseService(fake(async (t) => t.replace(/\d+/g, (d) => String(Number(d) + 1))), { enabled: true });
    for (const n of withDigits) {
      const r = await svc.rephrase(textOf(n), { nodeType: n.type as 'instruction', safetyCritical: false });
      expect({ id: n.node_id, rephrased: r.rephrased }).toEqual({ id: n.node_id, rephrased: false });
    }
  });

  it('LLM ที่ตัดข้อความเหลือครึ่งเดียว ถูกปฏิเสธ', async () => {
    const svc = new RephraseService(fake(async (t) => t.slice(0, Math.floor(t.length * 0.3))), { enabled: true });
    const longNodes = eligible.filter((n) => textOf(n).length > 40);
    for (const n of longNodes) {
      const r = await svc.rephrase(textOf(n), { nodeType: n.type as 'instruction', safetyCritical: false });
      expect(r.rephrased).toBe(false);
    }
  });
});

describe('GroqLlmClient (fetch ปลอม ไม่ต่อเครือข่าย)', () => {
  const okResponse = (content: string) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) }) as unknown as Response;

  it('ส่งคำขอรูปแบบ chat completions พร้อม key และอ่านคำตอบ', async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const client = new GroqLlmClient({
      apiKey: 'k', model: 'm',
      fetchImpl: (async (url: string, init: RequestInit) => { captured = { url, init }; return okResponse('คำตอบ'); }) as unknown as typeof fetch,
    });
    expect(await client.rephrase('ต้นฉบับ', new AbortController().signal)).toBe('คำตอบ');
    const body = JSON.parse(String(captured!.init.body));
    expect(captured!.url).toContain('/chat/completions');
    expect((captured!.init.headers as Record<string, string>).authorization).toBe('Bearer k');
    expect(body).toMatchObject({ model: 'm', temperature: 0 });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'ต้นฉบับ' });
  });

  it('HTTP ไม่ ok หรือรูปแบบคำตอบผิด → โยน error', async () => {
    const bad = new GroqLlmClient({ apiKey: 'k', model: 'm', fetchImpl: (async () => ({ ok: false, status: 429 })) as unknown as typeof fetch });
    await expect(bad.rephrase('x', new AbortController().signal)).rejects.toThrow('429');
    const weird = new GroqLlmClient({ apiKey: 'k', model: 'm', fetchImpl: (async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch });
    await expect(weird.rephrase('x', new AbortController().signal)).rejects.toThrow('รูปแบบ');
  });

  it('createGroqClientFromEnv: ปิดเป็นค่าเริ่มต้น และต้องมีครบทั้ง 3 ตัวแปร', () => {
    expect(createGroqClientFromEnv({})).toBeNull();
    expect(createGroqClientFromEnv({ REPHRASE_ENABLED: 'true' })).toBeNull();
    expect(createGroqClientFromEnv({ REPHRASE_ENABLED: 'true', GROQ_API_KEY: 'k' })).toBeNull();
    expect(createGroqClientFromEnv({ REPHRASE_ENABLED: 'TRUE', GROQ_API_KEY: 'k', GROQ_MODEL: 'm' })).toBeNull();
    expect(createGroqClientFromEnv({ REPHRASE_ENABLED: 'true', GROQ_API_KEY: 'k', GROQ_MODEL: 'm' })).toBeInstanceOf(GroqLlmClient);
  });

  it('createGroqClientFromEnv: อ่าน GROQ_ENDPOINT (ไม่บังคับ) ถ้ามี', () => {
    const c = createGroqClientFromEnv({ REPHRASE_ENABLED: 'true', GROQ_API_KEY: 'k', GROQ_MODEL: 'm', GROQ_ENDPOINT: 'http://127.0.0.1:9/x' });
    expect((c as unknown as { config: { endpoint?: string } }).config.endpoint).toBe('http://127.0.0.1:9/x');
  });
});
