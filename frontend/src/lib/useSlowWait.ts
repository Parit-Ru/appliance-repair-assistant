import { useEffect, useState } from 'react'

const SLOW_WAIT_MS = 4000

export function useSlowWait(isWaiting: boolean): boolean {
  const [isSlow, setIsSlow] = useState(false)

  useEffect(() => {
    if (!isWaiting) return
    const timer = setTimeout(() => setIsSlow(true), SLOW_WAIT_MS)
    return () => {
      clearTimeout(timer)
      setIsSlow(false)
    }
  }, [isWaiting])

  return isSlow
}
