interface RephraseNoteProps {
  original: string
}

export function RephraseNote({ original }: RephraseNoteProps) {
  return (
    <details className="mt-3 text-sm text-ink-soft">
      <summary className="cursor-pointer">ข้อความนี้ปรับถ้อยคำด้วย AI — ดูข้อความต้นฉบับจากคู่มือ</summary>
      <p className="mt-2 rounded-lg border border-line p-3">{original}</p>
    </details>
  )
}
