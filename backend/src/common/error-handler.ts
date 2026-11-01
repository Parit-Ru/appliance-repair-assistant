import type { NextFunction, Request, RequestHandler, Response } from 'express';
import {InvalidActionError, StateNotFoundError, SafetyConfirmationRequiredError,SessionAlreadyCompletedError,} from '../state-machine/types';
import { ApiError } from './api-error';
import { createLogger } from './logger';

const logger = createLogger('ErrorHandler');

interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

const ENGINE_ERRORS: Array<[new (...args: never[]) => Error, number, string]> = [
  [SafetyConfirmationRequiredError, 400, 'SAFETY_CONFIRMATION_REQUIRED'],
  [InvalidActionError, 400, 'INVALID_ACTION'],
  [SessionAlreadyCompletedError, 409, 'SESSION_COMPLETED'],
  [StateNotFoundError, 500, 'FLOW_STATE_MISSING'],  
];

function hasHttpStatus(exception: unknown): exception is { statusCode: number; message: string } {
  if (typeof exception !== 'object' || exception === null) return false;
  const { statusCode, message } = exception as { statusCode?: unknown; message?: unknown };
  return (
    typeof statusCode === 'number' &&
    Number.isInteger(statusCode) &&
    statusCode >= 400 &&
    statusCode <= 599 &&
    typeof message === 'string' &&
    message !== ''
  );
}

function toBody(exception: unknown): ApiErrorBody {
  if (exception instanceof ApiError) {
    return { statusCode: exception.status, code: exception.code, message: exception.message };
  }

  const message = exception instanceof Error ? exception.message : 'ไม่ทราบสาเหตุ';
  const engine = ENGINE_ERRORS.find(([errorClass]) => exception instanceof errorClass);
  if (engine) return { statusCode: engine[1], code: engine[2], message };

  return { statusCode: 500, code: 'INTERNAL_ERROR', message };
}

export function errorHandler(exception: unknown, _request: Request, response: Response, next: NextFunction): void {
  if (response.headersSent) {
    next(exception);
    return;
  }

  const fromBodyParser = exception instanceof SyntaxError && (exception as { type?: unknown }).type === 'entity.parse.failed';
  if (fromBodyParser || exception instanceof URIError) {
    response.status(400).json({ message: exception.message, error: 'Bad Request', statusCode: 400 });
    return;
  }

  // error ที่มี status ของตัวเอง
  if (!(exception instanceof ApiError) && hasHttpStatus(exception)) {
    response.status(exception.statusCode).json({ statusCode: exception.statusCode, message: exception.message });
    return;
  }

  const body = toBody(exception);
  if (body.statusCode >= 500) {
    logger.error(`[${body.code}] ${body.message}`, exception instanceof Error ? exception.stack : undefined);
  }
  response.status(body.statusCode).json(body);
}

export function notFoundHandler(request: Request, response: Response): void {
  response.status(404).json({ message: `Cannot ${request.method} ${request.originalUrl}`, error: 'Not Found', statusCode: 404 });
}

export function asyncRoute(handler: (request: Request, response: Response) => Promise<void>): RequestHandler {
  return (request, response, next) => {
    handler(request, response).catch(next);
  };
}
