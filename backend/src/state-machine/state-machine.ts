import type {TroubleshootingFlow,TroubleshootingState, ResolutionState,EscalationState,OutcomeKind,SessionState, SessionStatus,ExecutionAction,RenderedState,StateReference } from './types';
import {StateNotFoundError,InvalidActionError,SafetyConfirmationRequiredError, SessionAlreadyCompletedError } from './types';

export function startSession(
  flow: TroubleshootingFlow,
  confidence: number | null = null,
): { session: SessionState; state: RenderedState } {
  const initialState = flow.states.find((n) => n.state_id === flow.initial_state);
  if (!initialState) {
    throw new StateNotFoundError(flow.initial_state, flow.flow_id);
  }

  const session: SessionState = {
    sessionId: globalThis.crypto.randomUUID(),
    flowId: flow.flow_id,
    currentStateId: flow.initial_state,
    status: 'in_progress',
    variables: {},
    confidence,
    history: [],
  };

  return { session, state: renderState(initialState, flow, session.variables) };
}

export function getCurrentState(session: SessionState, flow: TroubleshootingFlow): RenderedState {
  const state = flow.states.find((n) => n.state_id === session.currentStateId);
  if (!state) {
    throw new StateNotFoundError(session.currentStateId, flow.flow_id);
  }

  return renderState(state, flow, session.variables);
}

/** outcome_kind ของสถานะสิ้นสุด (resolution/escalation) · null = ไม่มีสถานะนี้ในผัง หรือไม่ใช่สถานะสิ้นสุด */
export function getOutcomeKind(flow: TroubleshootingFlow, stateId: string): OutcomeKind | null {
  const state = flow.states.find((n) => n.state_id === stateId);
  return state !== undefined && isTerminalState(state) ? state.outcome_kind : null;
}

export function submitAction(
  session: SessionState,
  flow: TroubleshootingFlow,
  action: ExecutionAction,
): { session: SessionState; state: RenderedState } {
  if (session.status === 'completed') {
    throw new SessionAlreadyCompletedError(session.sessionId);
  }

  const currentState = flow.states.find((n) => n.state_id === session.currentStateId);
  if (!currentState) {
    throw new StateNotFoundError(session.currentStateId, flow.flow_id);
  }
  const { nextStateId, updatedVariables } = resolveNextState(currentState, action, session.variables);

  const nextState = flow.states.find((n) => n.state_id === nextStateId);
  if (!nextState) {
    throw new StateNotFoundError(nextStateId, flow.flow_id);
  }

  const nextStatus: SessionStatus = isTerminalState(nextState) ? 'completed' : 'in_progress';

  const nextSession: SessionState = {
    ...session,
    currentStateId: nextStateId,
    status: nextStatus,
    variables: updatedVariables,
    history: [...session.history, { stateId: session.currentStateId, action }],
  };

  return { session: nextSession, state: renderState(nextState, flow, updatedVariables) };
}

function resolveNextState(
  state: TroubleshootingState,
  action: ExecutionAction,
  variables: Record<string, string>,
): { nextStateId: string; updatedVariables: Record<string, string> } {
  switch (state.type) {
    case 'checkpoint': {
      if (action.type !== 'answer') {
        throw new InvalidActionError(action.type, state.type, state.state_id);
      }
      return {
        nextStateId: action.value === 'yes' ? state.on_yes : state.on_no,
        updatedVariables: variables,
      };
    }

    case 'instruction': {
      if (state.safety_critical) {
        if (action.type === 'continue') {
          throw new SafetyConfirmationRequiredError(state.state_id);
        }
        if (action.type !== 'confirm_safety') {
          throw new InvalidActionError(action.type, state.type, state.state_id);
        }
      } else if (action.type !== 'continue') {
        throw new InvalidActionError(action.type, state.type, state.state_id);
      }
      return { nextStateId: state.next, updatedVariables: variables };
    }

    case 'input': {
      if (action.type !== 'input') {
        throw new InvalidActionError(action.type, state.type, state.state_id);
      }
      const isValid = !state.pattern || new RegExp(state.pattern).test(action.value);
      if (isValid) {
        return {
          nextStateId: state.next,
          updatedVariables: { ...variables, [state.store_as]: action.value },
        };
      }
      return {
        nextStateId: state.on_invalid ?? state.state_id,
        updatedVariables: variables,
      };
    }

    case 'resolution':
    case 'escalation':
      throw new InvalidActionError(action.type, state.type, state.state_id);
  }
}
function renderState(
  state: TroubleshootingState,
  flow: TroubleshootingFlow,
  variables: Record<string, string>,
): RenderedState {
  const reference: StateReference = {
    source: flow.source,
    pageRange: flow.page_range,
  };

  return {
    stateId: state.state_id,
    type: state.type,
    text: interpolate(getRawText(state), variables),
    safetyCritical: state.safety_critical === true,
    safetyWarning: state.safety_warning,
    requiresSafetyConfirmation: state.type === 'instruction' && state.safety_critical === true,
    inputType: state.type === 'input' ? state.input_type : undefined,
    isTerminal: isTerminalState(state),
    outcomeKind: isTerminalState(state) ? state.outcome_kind : undefined,
    reference,
  };
}

function getRawText(state: TroubleshootingState): string {
  switch (state.type) {
    case 'checkpoint':
      return state.question;
    case 'instruction':
      return state.content;
    case 'input':
      return state.prompt;
    case 'resolution':
    case 'escalation':
      return state.content;
  }
}

function isTerminalState(state: TroubleshootingState): state is ResolutionState | EscalationState {
  return state.type === 'resolution' || state.type === 'escalation';
}

function interpolate(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match;
  });
}
