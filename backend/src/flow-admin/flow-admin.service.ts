import { totalPagesOf } from '../admin/admin.dto';
import { isoFromEpoch } from '../common/helpers';
import type { FlowRepository } from '../execution/flow.repository';
import type { SymptomSearchService } from '../symptom-search/symptom-search.service';
import { toDbRows } from '../authoring/draft-manual';
import { validateManual } from '../authoring/flow-validator';
import { MAX_STATE_TEXT_LENGTH } from './flow-admin.dto';
import type { FlowDetailDto, FlowListPageDto, FlowListQuery, FlowStateDto, FlowStatus, UpdateFlowBody, UpdateStructureBody } from './flow-admin.dto';
import { adminFlowNotFound, flowReloadFailed, invalidFlowRequest, stateInUse, stateTypeInUse, structureInvalid, structureWarningsUnacknowledged } from './flow-admin.errors';
import type { FlowAdminStore, FlowDetailRecord, NewStateRow, StateChange, StateRecord, StructurePlan } from './flow-admin.store';

const isoOrNull = (epoch: number | null): string | null => (epoch === null ? null : isoFromEpoch(epoch));
const statusOf = (deletedEpoch: number | null): FlowStatus => (deletedEpoch === null ? 'active' : 'deleted');

/** Result of keeping the search index in step: indexed false means the index was not updated (reason says why) */
type SearchIndexResult = { indexed: boolean; reason?: string };

// Which key carries the text of each state type (same keys as GET and as the user-facing flow)
const TEXT_KEY_BY_TYPE: Record<string, 'question' | 'prompt' | 'content'> = {
  checkpoint: 'question',
  input: 'prompt',
  instruction: 'content',
  resolution: 'content',
  escalation: 'content',
};

function cleanText(value: unknown, label: string): string {
  if (typeof value !== 'string') throw invalidFlowRequest(`${label} ต้องเป็นข้อความ`);
  const text = value.trim();
  if (text === '') throw invalidFlowRequest(`${label} ต้องไม่ว่าง`);
  if (text.length > MAX_STATE_TEXT_LENGTH) throw invalidFlowRequest(`${label} ยาวเกิน ${MAX_STATE_TEXT_LENGTH} ตัวอักษร`);
  return text;
}

/**
 * Checks the request against the states stored in the DB and keeps only the states whose text really changes.
 * Structure (type, edges, safety flag, input rules, author_note) is never read from the request.
 */
function planChanges(body: UpdateFlowBody, current: FlowDetailRecord): StateChange[] {
  const byId = new Map(current.states.map((state) => [state.stateId, state]));
  const changes: StateChange[] = [];

  for (const item of body.items) {
    const state = byId.get(item.stateId);
    if (!state) throw invalidFlowRequest(`ไม่พบขั้นตอน '${item.stateId}' ในผังนี้`);

    const key = TEXT_KEY_BY_TYPE[state.stateType];
    if (key === undefined || !(key in item.raw)) {
      throw invalidFlowRequest(`ขั้นตอน '${item.stateId}' ต้องส่งข้อความในฟิลด์ '${key ?? 'question/prompt/content'}'`);
    }

    const change: StateChange = { stateId: item.stateId };
    const text = cleanText(item.raw[key], `${item.stateId}.${key}`);
    if (text !== state.textContent) change.textContent = text;

    if ('safety_warning' in item.raw) {
      if (!state.safetyCritical) throw invalidFlowRequest(`ขั้นตอน '${item.stateId}' ไม่ใช่ขั้นตอนความปลอดภัย จึงแก้ safety_warning ไม่ได้`);
      const warning = cleanText(item.raw.safety_warning, `${item.stateId}.safety_warning`);
      if (warning !== state.safetyWarning) change.safetyWarning = warning;
    }

    if (change.textContent !== undefined || change.safetyWarning !== undefined) changes.push(change);
  }
  return changes;
}

/**
 * Builds the manual the validator expects from the flow in the DB plus the states in the request.
 * Flow-level fields (symptom, pages, severity, ...) always come from the DB; only initial_state and states come from the request.
 * author_note is not editable here and null values (as GET prints them) are dropped, so the validator sees the draft shape.
 */
function assembleForValidation(current: FlowDetailRecord, initialState: string, states: Array<Record<string, unknown>>): Record<string, unknown> {
  const cleanStates = states.map((state) => Object.fromEntries(Object.entries(state).filter(([key, value]) => value !== null && key !== 'author_note')));
  return {
    manual_id: current.manualId,
    device_category: current.deviceCategory,
    brand: current.brand,
    model_pattern: current.modelPattern,
    source_manual: current.sourceManual,
    flows: [
      {
        flow_id: current.flowId,
        device_category: current.deviceCategory,
        brand: current.brand,
        model_pattern: current.modelPattern,
        entry_symptom: current.entrySymptom,
        ...(current.entrySymptomTh !== null ? { entry_symptom_th: current.entrySymptomTh } : {}),
        entry_symptom_aliases: current.entrySymptomAliases,
        source: current.source,
        page_range: [current.pageStart, current.pageEnd],
        source_chunk_id: current.sourceChunkId,
        ...(current.severity !== null ? { severity: current.severity } : {}),
        ...(current.difficulty !== null ? { difficulty: current.difficulty } : {}),
        initial_state: initialState,
        states: cleanStates,
      },
    ],
  };
}

const stateRowKey = (s: NewStateRow): string => JSON.stringify([s.stateId, s.stateType, s.textContent, s.inputType, s.inputPattern, s.storeAs, s.outcomeKind, s.safetyCritical, s.safetyWarning, s.authorNote, s.displayOrder]);
const transitionKey = (t: { fromStateId: string; inputSymbol: string; toStateId: string }): string => `${t.fromStateId}\u0000${t.inputSymbol}\u0000${t.toStateId}`;

/**
 * Validates the requested structure and turns it into rows. Returns null when it equals the current structure.
 * Throws when the validator finds errors, when warnings are not acknowledged, or when a state that sessions stand on would be removed.
 */
function planStructure(body: UpdateStructureBody, current: FlowDetailRecord): StructurePlan | null {
  const validatorOptions = { skipSourcePage: true, anyStateIdPrefix: true };
  const manual = assembleForValidation(current, body.initialState, body.states);
  const report = validateManual(manual, new Map(), validatorOptions);
  if (report.errors.length > 0) throw structureInvalid(report.errors);

  // Warnings the flow already has (e.g. the retry loops of input states) are not asked about again: only new ones need acknowledgment
  const baseline = validateManual(
    assembleForValidation(current, current.initialState, toDetail(current).flow.states as unknown as Array<Record<string, unknown>>),
    new Map(),
    validatorOptions,
  );
  // W_CYCLE is one message listing every back edge ("a → b, c → d"), so it is compared edge by edge, not as text
  type Warning = { code: string; stateId?: string; message: string };
  const backEdges = (w: Warning): string[] => [...w.message.matchAll(/(\w+) → (\w+)/g)].map((m) => `${m[1]}>${m[2]}`);
  const knownEdges = new Set(baseline.warnings.filter((w) => w.code === 'W_CYCLE').flatMap(backEdges));
  const knownKeys = new Set(baseline.warnings.filter((w) => w.code !== 'W_CYCLE').map((w) => `${w.code}\u0000${w.stateId ?? ''}`));
  const newWarnings = report.warnings.filter((w) =>
    w.code === 'W_CYCLE' ? backEdges(w).some((edge) => !knownEdges.has(edge)) : !knownKeys.has(`${w.code}\u0000${w.stateId ?? ''}`),
  );
  if (newWarnings.length > 0 && !body.acknowledgedWarnings) throw structureWarningsUnacknowledged(newWarnings);

  // sessions.current_state_id has no foreign key: nothing in the DB stops a removed state from stranding a user
  const keptIds = new Set(body.states.map((state) => String(state.state_id)));
  const stranded = current.states.map((s) => s.stateId).filter((id) => !keptIds.has(id) && (current.usage.activeByState[id] ?? 0) > 0);
  if (stranded.length > 0) throw stateInUse(stranded);

  // A kept state may change text and edges while sessions stand on it, but not its type: the next action sent by that user
  // (answer / continue / input) was built for the old type
  const typeNow = new Map(body.states.map((state) => [String(state.state_id), String(state.type)]));
  const retyped = current.states
    .filter((s) => typeNow.has(s.stateId) && typeNow.get(s.stateId) !== s.stateType && (current.usage.activeByState[s.stateId] ?? 0) > 0)
    .map((s) => s.stateId);
  if (retyped.length > 0) throw stateTypeInUse(retyped);

  const rows = toDbRows(manual);
  const authorNotes = new Map(current.states.map((s) => [s.stateId, s.authorNote]));
  const states: NewStateRow[] = rows.states.map((row) => ({
    stateId: String(row.state_id),
    stateType: String(row.state_type),
    textContent: String(row.text_content),
    inputType: (row.input_type as string | null) ?? null,
    inputPattern: (row.input_pattern as string | null) ?? null,
    storeAs: (row.store_as as string | null) ?? null,
    outcomeKind: (row.outcome_kind as string | null) ?? null,
    safetyCritical: row.safety_critical === true,
    safetyWarning: (row.safety_warning as string | null) ?? null,
    authorNote: authorNotes.get(String(row.state_id)) ?? null,
    displayOrder: Number(row.display_order),
  }));
  const transitions = rows.transitions.map((row) => ({
    fromStateId: String(row.from_state_id),
    inputSymbol: String(row.input_symbol),
    toStateId: String(row.to_state_id),
  }));

  const currentStates: NewStateRow[] = current.states.map((s, index) => ({ ...s, displayOrder: index }));
  const same =
    body.initialState === current.initialState &&
    JSON.stringify(states.map(stateRowKey)) === JSON.stringify(currentStates.map(stateRowKey)) &&
    JSON.stringify(transitions.map(transitionKey).sort()) === JSON.stringify(current.transitions.map(transitionKey).sort());
  if (same) return null;

  return { initialState: body.initialState, states, transitions, snapshot: toDetail(current) };
}

export class FlowAdminService {
  constructor(
    private readonly store: FlowAdminStore,
    private readonly flows: FlowRepository,
    private readonly search: SymptomSearchService,
  ) {}

  async list(query: FlowListQuery): Promise<FlowListPageDto> {
    const { rows, total } = await this.store.list(query);
    return {
      items: rows.map((row) => ({
        flowId: row.flowId,
        manualId: row.manualId,
        deviceCategory: row.deviceCategory,
        brand: row.brand,
        modelPattern: row.modelPattern,
        displayName: row.displayName,
        entrySymptom: row.entrySymptom,
        entrySymptomTh: row.entrySymptomTh,
        stateCount: row.stateCount,
        status: statusOf(row.deletedEpoch),
        revision: row.revision,
        editedAt: isoOrNull(row.editedEpoch),
        editedByName: row.editedByName,
        deletedAt: isoOrNull(row.deletedEpoch),
        deletedByName: row.deletedByName,
        sessionCount: row.sessionCount,
        activeSessionCount: row.activeSessionCount,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: totalPagesOf(total, query.pageSize),
    };
  }

  async updateStates(flowId: string, actorId: string, body: UpdateFlowBody): Promise<{ detail: FlowDetailDto; changedStates: number }> {
    const { changed } = await this.store.updateStates(flowId, actorId, body.expectedRevision, (current) => ({
      changes: planChanges(body, current),
      snapshot: toDetail(current),
    }));

    if (changed > 0) await this.reloadAfterCommit();
    return { detail: await this.get(flowId), changedStates: changed };
  }

  /** Replace the structure (states and edges) of a flow. Only the text-only edit above existed before. */
  async updateStructure(flowId: string, actorId: string, body: UpdateStructureBody): Promise<{ detail: FlowDetailDto; changed: boolean }> {
    const { changed } = await this.store.replaceStructure(flowId, actorId, body.expectedRevision, (current) => planStructure(body, current));
    if (changed) await this.reloadAfterCommit();
    return { detail: await this.get(flowId), changed };
  }

  async remove(flowId: string, actorId: string): Promise<{ searchIndex: SearchIndexResult }> {
    await this.store.setDeleted(flowId, actorId, true);
    await this.reloadAfterCommit();
    return { searchIndex: this.search.removeFlows([flowId]) };
  }

  async restore(flowId: string, actorId: string): Promise<{ detail: FlowDetailDto; searchIndex: SearchIndexResult }> {
    await this.store.setDeleted(flowId, actorId, false);
    await this.reloadAfterCommit();
    const searchIndex = await this.search.addFlows([flowId]);
    return { detail: await this.get(flowId), searchIndex };
  }

  // Committed rows are the truth; the in-memory copy follows. A failed reload leaves the old copy serving users.
  private async reloadAfterCommit(): Promise<void> {
    try {
      await this.flows.reload();
    } catch {
      throw flowReloadFailed();
    }
  }

  async get(flowId: string): Promise<FlowDetailDto> {
    const record = await this.store.findDetail(flowId);
    if (!record) throw adminFlowNotFound(flowId);
    return toDetail(record);
  }
}

// Fold the transition rows back into on_yes / on_no / next / on_invalid, the same shape the user-facing flow uses
function buildState(state: StateRecord, edges: Map<string, string>): FlowStateDto {
  const base: FlowStateDto = {
    state_id: state.stateId,
    type: state.stateType,
    safety_critical: state.safetyCritical,
    safety_warning: state.safetyWarning,
    author_note: state.authorNote,
  };
  const edge = (symbol: string): string | undefined => edges.get(`${state.stateId}\u0000${symbol}`);

  switch (state.stateType) {
    case 'checkpoint':
      return { ...base, question: state.textContent, on_yes: edge('yes'), on_no: edge('no') };
    case 'input':
      return {
        ...base,
        prompt: state.textContent,
        input_type: state.inputType ?? undefined,
        pattern: state.inputPattern ?? undefined,
        store_as: state.storeAs ?? undefined,
        next: edge('next'),
        on_invalid: edge('invalid'),
      };
    case 'instruction':
      return { ...base, content: state.textContent, next: edge('next') };
    default:
      // resolution, escalation
      return { ...base, content: state.textContent, outcome_kind: state.outcomeKind ?? undefined };
  }
}

function toDetail(record: FlowDetailRecord): FlowDetailDto {
  const edges = new Map<string, string>();
  for (const t of record.transitions) edges.set(`${t.fromStateId}\u0000${t.inputSymbol}`, t.toStateId);

  return {
    flowId: record.flowId,
    manualId: record.manualId,
    deviceCategory: record.deviceCategory,
    brand: record.brand,
    modelPattern: record.modelPattern,
    displayName: record.displayName,
    sourceManual: record.sourceManual,
    source: record.source,
    sourceChunkId: record.sourceChunkId,
    status: statusOf(record.deletedEpoch),
    revision: record.revision,
    createdAt: isoFromEpoch(record.createdEpoch),
    updatedAt: isoFromEpoch(record.updatedEpoch),
    editedAt: isoOrNull(record.editedEpoch),
    editedByName: record.editedByName,
    deletedAt: isoOrNull(record.deletedEpoch),
    deletedByName: record.deletedByName,
    flow: {
      flow_id: record.flowId,
      entry_symptom: record.entrySymptom,
      entry_symptom_th: record.entrySymptomTh,
      entry_symptom_aliases: record.entrySymptomAliases,
      severity: record.severity,
      difficulty: record.difficulty,
      page_range: [record.pageStart, record.pageEnd],
      initial_state: record.initialState,
      states: record.states.map((state) => buildState(state, edges)),
    },
    usage: record.usage,
  };
}
