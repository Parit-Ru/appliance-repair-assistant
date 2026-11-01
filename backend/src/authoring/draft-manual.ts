import type { DraftFlow } from './draft-schema';
type Json = Record<string, any>;

export interface DraftMeta {
  device_category: string;
  brand: string;
  model_pattern: string;
  source_manual: string;
  display_name?: string;
  page_from: number;
  page_to: number;
}

function sourceChunkId(draftId: string, flowId: string): string {
  return `draft:${draftId}:${flowId}`;
}

export function assembleManual(manualId: string, meta: DraftMeta, flows: DraftFlow[], draftId: string): Json {
  return {
    manual_id: manualId,
    device_category: meta.device_category,
    brand: meta.brand,
    model_pattern: meta.model_pattern,
    source_manual: meta.source_manual,
    ...(meta.display_name ? { display_name: meta.display_name } : {}),
    flows: flows.map((flow) => {
      const pages = flow.states.map((n) => n.source_page).filter((p): p is number => typeof p === 'number');
      const range = pages.length > 0 ? [Math.min(...pages), Math.max(...pages)] : [meta.page_from, meta.page_from];
      return {
        flow_id: flow.flow_id,
        device_category: meta.device_category,
        brand: meta.brand,
        model_pattern: meta.model_pattern,
        entry_symptom: flow.entry_symptom,
        ...(flow.entry_symptom_th !== undefined ? { entry_symptom_th: flow.entry_symptom_th } : {}),
        ...(flow.entry_symptom_aliases !== undefined ? { entry_symptom_aliases: flow.entry_symptom_aliases } : {}),
        source: meta.source_manual,
        page_range: range,
        source_chunk_id: sourceChunkId(draftId, flow.flow_id),
        ...(flow.severity !== undefined ? { severity: flow.severity } : {}),
        ...(flow.difficulty !== undefined ? { difficulty: flow.difficulty } : {}),
        initial_state: flow.initial_state,
        states: flow.states,
      };
    }),
  };
}


export const MANUAL_COLUMNS = ['manual_id', 'device_category', 'brand', 'model_pattern', 'source_manual', 'flow_count', 'display_name', 'model_aliases'] as const;
export const FLOW_COLUMNS = [
  'flow_id', 'manual_id', 'entry_symptom', 'entry_symptom_th', 'entry_symptom_aliases', 'source', 'page_start', 'page_end',
  'source_chunk_id', 'severity', 'difficulty', 'config', 'initial_state',
] as const;
export const STATE_COLUMNS = [
  'flow_id', 'state_id', 'state_type', 'text_content', 'input_type', 'input_pattern',
  'store_as', 'outcome_kind', 'safety_critical', 'safety_warning', 'has_image', 'image_url', 'author_note', 'external_reference', 'display_order',
] as const;
export const TRANSITION_COLUMNS = ['flow_id', 'from_state_id', 'input_symbol', 'to_state_id'] as const;

/** แถวที่จะ INSERT: ชื่อคอลัมน์ → ค่า (ชื่อต้องตรง MANUAL_COLUMNS / FLOW_COLUMNS / STATE_COLUMNS / TRANSITION_COLUMNS ด้านบน) */
export interface DbRows {
  manual: Record<string, unknown>;
  flows: Array<Record<string, unknown>>;
  states: Array<Record<string, unknown>>;
  transitions: Array<Record<string, unknown>>;
}

/** input_symbol ของ δ ← field ในร่างผัง (on_yes/on_no/next/on_invalid) · ค่าว่าง/ไม่มี = ไม่มีแถว */
const TRANSITION_FIELDS = [
  ['yes', 'on_yes'],
  ['no', 'on_no'],
  ['next', 'next'],
  ['invalid', 'on_invalid'],
] as const;

function textOf(state: Json): string {
  return String(state.question ?? state.prompt ?? state.content ?? '');
}

export function toDbRows(manual: Json): DbRows {
  const flows = manual.flows as Json[];
  return {
    manual: {
      manual_id: manual.manual_id,
      device_category: manual.device_category,
      brand: manual.brand,
      model_pattern: manual.model_pattern,
      source_manual: manual.source_manual,
      flow_count: flows.length,
      display_name: manual.display_name ?? null,
      model_aliases: manual.model_aliases ? JSON.stringify(manual.model_aliases) : null,
    },
    flows: flows.map((flow) => ({
      flow_id: flow.flow_id,
      manual_id: manual.manual_id,
      entry_symptom: flow.entry_symptom,
      entry_symptom_th: flow.entry_symptom_th ?? null,
      entry_symptom_aliases: flow.entry_symptom_aliases ? JSON.stringify(flow.entry_symptom_aliases) : null,
      source: flow.source,
      page_start: flow.page_range[0],
      page_end: flow.page_range[1],
      source_chunk_id: flow.source_chunk_id,
      severity: flow.severity ?? null,
      difficulty: flow.difficulty ?? null,
      config: null,
      initial_state: flow.initial_state,
    })),
    states: flows.flatMap((flow) =>
      (flow.states as Json[]).map((state, order) => ({
        flow_id: flow.flow_id,
        state_id: state.state_id,
        state_type: state.type,
        text_content: textOf(state),
        input_type: state.input_type ?? null,
        input_pattern: state.pattern ?? null,
        store_as: state.store_as ?? null,
        outcome_kind: state.outcome_kind ?? null,
        safety_critical: state.safety_critical === true,
        safety_warning: state.safety_warning ?? null,
        has_image: false,
        image_url: null,
        author_note: null,
        external_reference: null,
        display_order: order,
      })),
    ),
    transitions: flows.flatMap((flow) =>
      (flow.states as Json[]).flatMap((state) =>
        TRANSITION_FIELDS.filter(([, field]) => state[field] !== undefined && state[field] !== null && state[field] !== '').map(
          ([symbol, field]) => ({
            flow_id: flow.flow_id,
            from_state_id: state.state_id,
            input_symbol: symbol,
            to_state_id: state[field],
          }),
        ),
      ),
    ),
  };
}
