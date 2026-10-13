import { Button } from './ui/Button'

interface TerminalActionsProps {
  onOtherSymptom: () => void
  onRestart: () => void
  isRestarting: boolean
}

export function TerminalActions({ onOtherSymptom, onRestart, isRestarting }: TerminalActionsProps) {
  return (
    <>
      <Button variant="primary" className="w-full" onClick={onOtherSymptom}>
        ตรวจอาการอื่น
      </Button>
      <Button variant="secondary" className="w-full" onClick={onRestart} isLoading={isRestarting}>
        เริ่มอาการนี้ใหม่
      </Button>
    </>
  )
}
