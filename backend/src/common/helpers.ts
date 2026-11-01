export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export const numOrNull = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

export const isoFromEpoch = (epochSeconds: number): string => new Date(epochSeconds * 1000).toISOString();

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
