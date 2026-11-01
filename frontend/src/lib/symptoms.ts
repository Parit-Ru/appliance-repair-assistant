import type { DeviceCategory, FlowSummary } from '../api/types'

/*
 * ศัพท์: 1 FlowSummary = ผังขั้นตอน (เครื่องสถานะ) 1 ชุด = 1 อาการ
 */

/**
 * ตัวเปรียบเทียบข้อความภาษาไทย
 * สร้างครั้งเดียวนอกฟังก์ชัน เพราะการสร้าง Collator แต่ละครั้งมีต้นทุน
 * ถ้าสร้างใหม่ทุกครั้งที่เรียงจะช้าลงโดยไม่จำเป็น
 *
 * ต้องใช้ Collator แทนการเทียบด้วย < > ธรรมดา
 * เพราะการเทียบธรรมดาดูแค่รหัสตัวอักษร ส่วน Collator เรียงตามพจนานุกรมไทย
 * (เช่น ไม่นับสระหน้า แ เ โ "เตา" จึงเรียงตาม ต)
 */
const thaiCollator = new Intl.Collator('th')

type SymptomLabel = Pick<FlowSummary, 'entrySymptom' | 'entrySymptomTh'>
export function symptomName(summary: SymptomLabel): string {
  return summary.entrySymptomTh ?? summary.entrySymptom
}

interface SymptomGroup {
  manualId: string
  deviceCategory: DeviceCategory
  brand: string
  modelPattern: string
  symptoms: FlowSummary[]
}

export function groupSymptoms(flows: FlowSummary[]): SymptomGroup[] {
  const groups = new Map<string, SymptomGroup>()

  for (const flow of flows) {
    const key = flow.manualId

    let group = groups.get(key)
    if (group === undefined) {
      group = {
        manualId: flow.manualId,
        deviceCategory: flow.deviceCategory,
        brand: flow.brand,
        modelPattern: flow.modelPattern,
        symptoms: [],
      }
      groups.set(key, group)
    }

    group.symptoms.push(flow)
  }

  for (const group of groups.values()) {
    group.symptoms.sort((a, b) => thaiCollator.compare(symptomName(a), symptomName(b)))
  }

  return Array.from(groups.values())
}