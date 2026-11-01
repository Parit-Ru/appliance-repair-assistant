export type StateType = 'checkpoint' | 'instruction' | 'input' | 'resolution' | 'escalation';
export type InputType = 'error_code' | 'model_number' | 'number' | 'text';
export type OutcomeKind = 'user_fixed' | 'normal_behavior' | 'handoff_informed' | 'handoff_unknown';

interface BaseState {
  state_id: string;
  safety_critical?: boolean;
  safety_warning?: string;
}

interface CheckpointState extends BaseState {
  type: 'checkpoint';
  question: string;
  on_yes: string;
  on_no: string;
}

interface InstructionState extends BaseState {
  type: 'instruction';
  content: string;
  next: string;
}

interface InputState extends BaseState {
  type: 'input';
  prompt: string;
  input_type: InputType;
  pattern?: string;
  store_as: string;
  next: string;
  on_invalid?: string;
}

export interface ResolutionState extends BaseState {
  type: 'resolution';
  content: string;
  outcome_kind: OutcomeKind;
}

export interface EscalationState extends BaseState {
  type: 'escalation';
  content: string;
  outcome_kind: OutcomeKind;
}

export type TroubleshootingState =
  | CheckpointState
  | InstructionState
  | InputState
  | ResolutionState
  | EscalationState;

export type DeviceCategory =
  | 'Microwave'
  | 'Refrigerator'
  | 'Washing Machine'
  | 'Television';

export interface TroubleshootingFlow {
  flow_id: string;
  manual_id: string;
  device_category: DeviceCategory;
  brand: string;
  model_pattern: string;
  entry_symptom: string;
  entry_symptom_th?: string;
  entry_symptom_aliases?: string[];
  source: string;
  page_range: [number, number];
  source_chunk_id: string;
  initial_state: string;
  states: TroubleshootingState[];
}

export type SessionStatus = 'in_progress' | 'completed';

export interface SessionHistoryEntry {
  stateId: string;
  action?: ExecutionAction;
}

export interface SessionState {
  sessionId: string;
  flowId: string;
  currentStateId: string;
  status: SessionStatus;
  variables: Record<string, string>;
  confidence?: number | null;
  history: SessionHistoryEntry[];
}

export type ExecutionAction =
  | { type: 'answer'; value: 'yes' | 'no' } 
  | { type: 'continue' } 
  | { type: 'confirm_safety' } 
  | { type: 'input'; value: string };

export interface StateReference {
  source: string;
  pageRange: [number, number];
}

export interface RenderedState {
  stateId: string;
  type: StateType;
  text: string;
  safetyCritical: boolean;
  safetyWarning?: string;
  requiresSafetyConfirmation: boolean;
  inputType?: InputType;
  isTerminal: boolean;
  outcomeKind?: OutcomeKind;
  reference: StateReference;
}

export class ExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class StateNotFoundError extends ExecutionError {
  constructor(stateId: string, flowId: string) {
    super(`ไม่พบสถานะ '${stateId}' ใน flow '${flowId}' — ผังขั้นตอนอาจเสียหรือยังไม่ผ่าน validate_flow.py`);
  }
}

export class InvalidActionError extends ExecutionError {
  constructor(actionType: string, stateType: StateType, stateId: string) {
    super(`Action '${actionType}' ใช้กับสถานะ '${stateId}' (type=${stateType}) ไม่ได้`);
  }
}

export class SafetyConfirmationRequiredError extends ExecutionError {
  constructor(stateId: string) {
    super(`สถานะ '${stateId}' เป็น safety_critical ต้องส่ง action 'confirm_safety' เท่านั้น จะใช้ 'continue' เฉยๆ ไม่ได้`);
  }
}

export class SessionAlreadyCompletedError extends ExecutionError {
  constructor(sessionId: string) {
    super(`Session '${sessionId}' จบไปแล้ว ส่ง action เพิ่มไม่ได้อีก`);
  }
}