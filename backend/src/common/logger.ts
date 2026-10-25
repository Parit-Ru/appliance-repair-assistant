/**
 * logger.ts — log สั้นๆ แบบ "[ชื่อส่วน] ข้อความ" (แทน Logger ของ NestJS)
 *
 * ใช้ console ตรงๆ: log = ข้อมูลทั่วไป · warn = เตือน · error = ผิดพลาด (แนบ stack ได้)
 */
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
