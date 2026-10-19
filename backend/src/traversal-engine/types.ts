export type NodeType = 'checkpoint' | 'instruction' | 'input' | 'resolution' | 'escalation';
export type InputType = 'error_code' | 'model_number' | 'number' | 'text';
export type OutcomeKind = 'user_fixed' | 'normal_behavior' | 'handoff_informed' | 'handoff_unknown';

interface BaseNode {
  node_id: string;
  safety_critical?: boolean;
  safety_warning?: string;
}

interface CheckpointNode extends BaseNode {
  type: 'checkpoint';
  question: string;
  on_yes: string;
  on_no: string;
}

interface InstructionNode extends BaseNode {
  type: 'instruction';
  content: string;
  next: string;
}

interface InputNode extends BaseNode {
  type: 'input';
  prompt: string;
  input_type: InputType;
  pattern?: string;
  store_as: string;
  next: string;
  on_invalid?: string;
}

export interface ResolutionNode extends BaseNode {
  type: 'resolution';
  content: string;
  outcome_kind: OutcomeKind;
}

export interface EscalationNode extends BaseNode {
  type: 'escalation';
  content: string;
  outcome_kind: OutcomeKind;
}

export type TroubleshootingNode =
  | CheckpointNode
  | InstructionNode
  | InputNode
  | ResolutionNode
  | EscalationNode;

export type DeviceCategory =
  | 'Air Conditioner'
  | 'Microwave'
  | 'Refrigerator'
  | 'Washing Machine'
  | 'Television';

export interface TroubleshootingGraph {
  schema_version: 2;
  graph_id: string;
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
  entry_node: string;
  nodes: TroubleshootingNode[];
}

export type SessionStatus = 'in_progress' | 'completed';

export interface SessionHistoryEntry {
  nodeId: string;
  action?: TraversalAction;
}

export interface SessionState {
  sessionId: string;
  graphId: string;
  currentNodeId: string;
  status: SessionStatus;
  variables: Record<string, string>;
  confidence?: number | null;
  history: SessionHistoryEntry[];
}

export type TraversalAction =
  | { type: 'answer'; value: 'yes' | 'no' } 
  | { type: 'continue' } 
  | { type: 'confirm_safety' } 
  | { type: 'input'; value: string };

export interface NodeReference {
  source: string;
  pageRange: [number, number];
}

export interface RenderedNode {
  nodeId: string;
  type: NodeType;
  text: string;
  safetyCritical: boolean;
  safetyWarning?: string;
  requiresSafetyConfirmation: boolean;
  inputType?: InputType;
  isTerminal: boolean;
  outcomeKind?: OutcomeKind;
  reference: NodeReference;
}

export class TraversalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UnsupportedSchemaVersionError extends TraversalError {
  constructor(received: unknown, graphId: string) {
    super(`Graph '${graphId}' มี schema_version=${String(received)} แต่ engine รองรับเฉพาะ v2`);
  }
}

export class NodeNotFoundError extends TraversalError {
  constructor(nodeId: string, graphId: string) {
    super(`ไม่พบโหนด '${nodeId}' ใน graph '${graphId}' — กราฟอาจเสียหรือยังไม่ผ่าน validate_graph.py`);
  }
}

export class InvalidActionError extends TraversalError {
  constructor(actionType: string, nodeType: NodeType, nodeId: string) {
    super(`Action '${actionType}' ใช้กับโหนด '${nodeId}' (type=${nodeType}) ไม่ได้`);
  }
}

export class SafetyConfirmationRequiredError extends TraversalError {
  constructor(nodeId: string) {
    super(`โหนด '${nodeId}' เป็น safety_critical ต้องส่ง action 'confirm_safety' เท่านั้น จะใช้ 'continue' เฉยๆ ไม่ได้`);
  }
}

export class SessionAlreadyCompletedError extends TraversalError {
  constructor(sessionId: string) {
    super(`Session '${sessionId}' จบไปแล้ว ส่ง action เพิ่มไม่ได้อีก`);
  }
}