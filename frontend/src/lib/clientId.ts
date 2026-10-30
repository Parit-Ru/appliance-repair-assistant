const STORAGE_KEY = 'fixstep.clientId'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let memoryId: string | undefined

function isClientId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function readStored(): string | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isClientId(stored) ? stored.toLowerCase() : undefined
  } catch {
    return undefined
  }
}

export function getClientId(): string {
  if (memoryId !== undefined) return memoryId

  const stored = readStored()
  if (stored !== undefined) {
    memoryId = stored
    return memoryId
  }

  const created = crypto.randomUUID().toLowerCase()
  try {
    localStorage.setItem(STORAGE_KEY, created)
  } catch {
  }

  memoryId = readStored() ?? created
  return memoryId
}
