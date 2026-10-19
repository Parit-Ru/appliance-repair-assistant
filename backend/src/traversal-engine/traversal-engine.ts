import type {TroubleshootingGraph,TroubleshootingNode, ResolutionNode,EscalationNode,OutcomeKind,SessionState, SessionStatus,TraversalAction,RenderedNode,NodeReference } from './types';
import {NodeNotFoundError,InvalidActionError,SafetyConfirmationRequiredError, SessionAlreadyCompletedError,UnsupportedSchemaVersionError } from './types';

export function startSession(
  graph: TroubleshootingGraph,
  confidence: number | null = null,
): { session: SessionState; node: RenderedNode } {
  assertSupportedSchema(graph);

  const entryNode = graph.nodes.find((n) => n.node_id === graph.entry_node);
  if (!entryNode) {
    throw new NodeNotFoundError(graph.entry_node, graph.graph_id);
  }

  const session: SessionState = {
    sessionId: globalThis.crypto.randomUUID(),
    graphId: graph.graph_id,
    currentNodeId: graph.entry_node,
    status: 'in_progress',
    variables: {},
    confidence,
    history: [],
  };

  return { session, node: renderNode(entryNode, graph, session.variables) };
}

export function getCurrentNode(session: SessionState, graph: TroubleshootingGraph): RenderedNode {
  assertSupportedSchema(graph);

  const node = graph.nodes.find((n) => n.node_id === session.currentNodeId);
  if (!node) {
    throw new NodeNotFoundError(session.currentNodeId, graph.graph_id);
  }

  return renderNode(node, graph, session.variables);
}

/** outcome_kind ของโหนดสิ้นสุด (resolution/escalation) · null = ไม่มีโหนดนี้ในผัง หรือไม่ใช่โหนดสิ้นสุด */
export function getOutcomeKind(graph: TroubleshootingGraph, nodeId: string): OutcomeKind | null {
  const node = graph.nodes.find((n) => n.node_id === nodeId);
  return node !== undefined && isTerminalNode(node) ? node.outcome_kind : null;
}

export function submitAction(
  session: SessionState,
  graph: TroubleshootingGraph,
  action: TraversalAction,
): { session: SessionState; node: RenderedNode } {
  assertSupportedSchema(graph);

  if (session.status === 'completed') {
    throw new SessionAlreadyCompletedError(session.sessionId);
  }

  const currentNode = graph.nodes.find((n) => n.node_id === session.currentNodeId);
  if (!currentNode) {
    throw new NodeNotFoundError(session.currentNodeId, graph.graph_id);
  }
  const { nextNodeId, updatedVariables } = resolveNextNode(currentNode, action, session.variables);

  const nextNode = graph.nodes.find((n) => n.node_id === nextNodeId);
  if (!nextNode) {
    throw new NodeNotFoundError(nextNodeId, graph.graph_id);
  }

  const nextStatus: SessionStatus = isTerminalNode(nextNode) ? 'completed' : 'in_progress';

  const nextSession: SessionState = {
    ...session,
    currentNodeId: nextNodeId,
    status: nextStatus,
    variables: updatedVariables,
    history: [...session.history, { nodeId: session.currentNodeId, action }],
  };

  return { session: nextSession, node: renderNode(nextNode, graph, updatedVariables) };
}

function resolveNextNode(
  node: TroubleshootingNode,
  action: TraversalAction,
  variables: Record<string, string>,
): { nextNodeId: string; updatedVariables: Record<string, string> } {
  switch (node.type) {
    case 'checkpoint': {
      if (action.type !== 'answer') {
        throw new InvalidActionError(action.type, node.type, node.node_id);
      }
      return {
        nextNodeId: action.value === 'yes' ? node.on_yes : node.on_no,
        updatedVariables: variables,
      };
    }

    case 'instruction': {
      if (node.safety_critical) {
        if (action.type === 'continue') {
          throw new SafetyConfirmationRequiredError(node.node_id);
        }
        if (action.type !== 'confirm_safety') {
          throw new InvalidActionError(action.type, node.type, node.node_id);
        }
      } else if (action.type !== 'continue') {
        throw new InvalidActionError(action.type, node.type, node.node_id);
      }
      return { nextNodeId: node.next, updatedVariables: variables };
    }

    case 'input': {
      if (action.type !== 'input') {
        throw new InvalidActionError(action.type, node.type, node.node_id);
      }
      const isValid = !node.pattern || new RegExp(node.pattern).test(action.value);
      if (isValid) {
        return {
          nextNodeId: node.next,
          updatedVariables: { ...variables, [node.store_as]: action.value },
        };
      }
      return {
        nextNodeId: node.on_invalid ?? node.node_id,
        updatedVariables: variables,
      };
    }

    case 'resolution':
    case 'escalation':
      throw new InvalidActionError(action.type, node.type, node.node_id);
  }
}
function renderNode(
  node: TroubleshootingNode,
  graph: TroubleshootingGraph,
  variables: Record<string, string>,
): RenderedNode {
  const reference: NodeReference = {
    source: graph.source,
    pageRange: graph.page_range,
  };

  return {
    nodeId: node.node_id,
    type: node.type,
    text: interpolate(getRawText(node), variables),
    safetyCritical: node.safety_critical === true,
    safetyWarning: node.safety_warning,
    requiresSafetyConfirmation: node.type === 'instruction' && node.safety_critical === true,
    inputType: node.type === 'input' ? node.input_type : undefined,
    isTerminal: isTerminalNode(node),
    outcomeKind: isTerminalNode(node) ? node.outcome_kind : undefined,
    reference,
  };
}

function getRawText(node: TroubleshootingNode): string {
  switch (node.type) {
    case 'checkpoint':
      return node.question;
    case 'instruction':
      return node.content;
    case 'input':
      return node.prompt;
    case 'resolution':
    case 'escalation':
      return node.content;
  }
}

function isTerminalNode(node: TroubleshootingNode): node is ResolutionNode | EscalationNode {
  return node.type === 'resolution' || node.type === 'escalation';
}

function interpolate(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match;
  });
}

function assertSupportedSchema(graph: TroubleshootingGraph): void {
  if (graph.schema_version !== 2) {
    throw new UnsupportedSchemaVersionError(graph.schema_version, graph.graph_id);
  }
}