import type { DraftMeta } from './draft-manual';
import type { PageText } from './pdf-text';
export const DRAFT_LLM_CLIENT = 'DRAFT_LLM_CLIENT';
/** เปลี่ยนเลขนี้ทุกครั้งที่แก้ prompt — เก็บใน graph_drafts.prompt_version ไว้ย้อนดูว่าร่างมาจาก prompt ไหน */
export const PROMPT_VERSION = 'v1';

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_TOKENS = 6000;

type DraftLlmErrorCode = 'LLM_NOT_CONFIGURED' | 'LLM_TIMEOUT' | 'LLM_HTTP' | 'LLM_BAD_RESPONSE';

export class DraftLlmError extends Error {
  constructor(
    readonly code: DraftLlmErrorCode,
    message: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

interface DraftLlmInput {
  manualId: string;
  meta: DraftMeta;
  pages: PageText[];
}

export interface DraftLlmClient {
  readonly model: string;
  draft(input: DraftLlmInput): Promise<string>;
}

const SYSTEM_PROMPT = `You convert pages of a home-appliance user manual into troubleshooting decision graphs.
You only DRAFT. A deterministic validator and a human reviewer check everything you write, so never guess.

Reply with ONE JSON object and nothing else:
{"graphs":[{"slug":"...","entry_symptom":"...","entry_symptom_th":"...","aliases":["..."],"severity":"low|medium|high|critical","difficulty":"easy|medium|hard","entry_node":"n1","nodes":[...]}]}

Graph fields:
- slug: lowercase a-z 0-9 _ , 3-30 chars, describes the symptom (e.g. "no_power", "error_code").
- entry_symptom: the symptom heading in English exactly as the manual words it. entry_symptom_th: Thai translation. aliases: up to 5 short Thai phrases a user might type.
- severity and difficulty are optional; omit when unsure.
- entry_node: node_id of the first node.

Node types (every node needs node_id, type, source_page; node_id starts with "n", lowercase a-z 0-9 _ only):
- checkpoint: {"node_id","type":"checkpoint","question":"yes/no question","on_yes":"<node_id>","on_no":"<node_id>","source_page":N}
- instruction: {"node_id","type":"instruction","content":"ONE action for the user","next":"<node_id>","source_page":N}
  add "safety_critical":true and "safety_warning":"..." when the step involves electricity, unplugging/plugging, gas, heat, hot water, moving heavy parts, opening or removing covers, or refrigerant.
- input: only to ask the user for an error code shown on the display: {"node_id","type":"input","prompt":"...","input_type":"error_code","store_as":"error_code","pattern":"optional regex","next":"<node_id>","on_invalid":"<node_id>","source_page":N}. Reference the value elsewhere as {{error_code}}.
- resolution: {"node_id","type":"resolution","content":"...","outcome_kind":"user_fixed|normal_behavior","source_page":N}
- escalation: {"node_id","type":"escalation","content":"...","outcome_kind":"handoff_informed|handoff_unknown","source_page":N}
  use handoff_informed when the manual tells the user to contact service; handoff_unknown when the manual does not say.

Hard rules:
1. Use ONLY information in the supplied pages. Do not add steps, causes, numbers, or advice from your own knowledge.
2. source_page = the page number from the "=== PAGE n ===" marker where that node's information appears. Never use another number.
3. Never drop or soften a warning in the source. If the source warns about danger, the matching instruction MUST have safety_critical true with the warning in Thai.
4. Every path must end at a resolution or escalation node. Terminal nodes have no next/on_yes/on_no. Every edge must point to a node you defined.
5. When the manual does not say how to continue, end with an escalation node ("contact the service center") instead of inventing a step.
6. Write question/content/prompt/safety_warning in natural Thai. Keep model names, error codes, button names and numbers exactly as in the source.
7. If the pages contain no troubleshooting content, or a symptom is cut off at the page edge, omit it. Return {"graphs":[]} when nothing is usable.
8. At most 12 graphs and 40 nodes per graph. Do not output any key not listed above.`;

function buildPrompt(input: DraftLlmInput): { system: string; user: string } {
  const header = [
    `Manual: ${input.meta.source_manual}`,
    `Brand: ${input.meta.brand} | Model: ${input.meta.model_pattern} | Category: ${input.meta.device_category}`,
  ].join('\n');
  const pages = input.pages.map((p) => `=== PAGE ${p.page} ===\n${p.text}`).join('\n\n');
  return { system: SYSTEM_PROMPT, user: `${header}\n\n${pages}` };
}

class GroqDraftLlmClient implements DraftLlmClient {
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
    private readonly maxTokens: number = DEFAULT_MAX_TOKENS,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async draft(input: DraftLlmInput): Promise<string> {
    const { system, user } = buildPrompt(input);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          max_tokens: this.maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
    } catch (err) {
      clearTimeout(timer);
      if (controller.signal.aborted) throw new DraftLlmError('LLM_TIMEOUT', `LLM ไม่ตอบภายใน ${Math.round(this.timeoutMs / 1000)} วินาที`);
      throw new DraftLlmError('LLM_HTTP', `เรียก LLM ไม่ได้: ${err instanceof Error ? err.message : 'ไม่ทราบสาเหตุ'}`);
    }

    try {
      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 200);
        throw new DraftLlmError('LLM_HTTP', `LLM ตอบ HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
      }
      let json: { choices?: Array<{ message?: { content?: unknown }; finish_reason?: string }> };
      try {
        json = (await response.json()) as typeof json;
      } catch {
        if (controller.signal.aborted) throw new DraftLlmError('LLM_TIMEOUT', `LLM ไม่ตอบภายใน ${Math.round(this.timeoutMs / 1000)} วินาที`);
        throw new DraftLlmError('LLM_BAD_RESPONSE', 'รูปแบบคำตอบของ LLM อ่านไม่ได้');
      }
      const choice = json.choices?.[0];
      if (choice?.finish_reason === 'length') {
        throw new DraftLlmError('LLM_BAD_RESPONSE', 'คำตอบของ LLM ถูกตัดกลางคัน (เกินเพดาน token) ลองเลือกหน้าน้อยลง');
      }
      const content = choice?.message?.content;
      if (typeof content !== 'string' || content.trim() === '') {
        throw new DraftLlmError('LLM_BAD_RESPONSE', 'LLM ไม่ส่งข้อความตอบกลับ');
      }
      return content;
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createDraftLlmFromEnv(env: NodeJS.ProcessEnv = process.env): GroqDraftLlmClient | null {
  const apiKey = env.GROQ_API_KEY;
  const model = env.AUTHORING_LLM_MODEL;
  if (!apiKey || !model) return null;
  const timeout = Number(env.AUTHORING_LLM_TIMEOUT_MS);
  const maxTokens = Number(env.AUTHORING_LLM_MAX_TOKENS);
  return new GroqDraftLlmClient(
    apiKey,
    model,
    Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
    Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : DEFAULT_MAX_TOKENS,
  );
}
