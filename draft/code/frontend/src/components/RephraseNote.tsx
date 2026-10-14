interface RephraseNoteProps {
  /** ข้อความต้นฉบับจากคู่มือ */
  original: string
}

/**
 * บอกผู้ใช้ตรงๆ ว่าข้อความของขั้นตอนนี้ถูกปรับถ้อยคำด้วย AI และให้เปิดดูต้นฉบับจากคู่มือได้
 * (ความโปร่งใสตาม TOR: ลำดับขั้นตอนและเนื้อหาตัดสินโดยเครื่องสถานะ ไม่ใช่ AI)
 */
export function RephraseNote({ original }: RephraseNoteProps) {
  return (
    <details className="mt-3 text-sm text-ink-soft">
      <summary className="cursor-pointer">ข้อความนี้ปรับถ้อยคำด้วย AI — ดูข้อความต้นฉบับจากคู่มือ</summary>
      <p className="mt-2 rounded-lg border border-line p-3">{original}</p>
    </details>
  )
}
