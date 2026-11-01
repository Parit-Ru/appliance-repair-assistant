export interface AppLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string, stack?: string): void;
}

export function createLogger(name: string): AppLogger {
  return {
    log: (message) => console.log(`[${name}] ${message}`),
    warn: (message) => console.warn(`[${name}] ${message}`),
    error: (message, stack) => console.error(`[${name}] ${message}${stack ? `\n${stack}` : ''}`),
  };
}
