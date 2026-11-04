import { totalPagesOf } from '../admin/admin.dto';
import { isoFromEpoch } from '../common/helpers';
import type { FlowRepository } from '../execution/flow.repository';
import type { SymptomSearchService } from '../symptom-search/symptom-search.service';
import { MAX_STATE_TEXT_LENGTH } from './flow-admin.dto';
import type { FlowDetailDto, FlowListPageDto, FlowListQuery, FlowStateDto, FlowStatus, UpdateFlowBody } from './flow-admin.dto';
import { adminFlowNotFound, flowReloadFailed, invalidFlowRequest } from './flow-admin.errors';
import type { FlowAdminStore, FlowDetailRecord, StateChange, StateRecord } from './flow-admin.store';

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
