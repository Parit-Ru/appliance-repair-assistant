import type { DeviceCategory, GraphSummary } from '../api/types'

/*
 * ศัพท์: 1 GraphSummary = เครื่องสถานะ 1 ชุด = 1 อาการ
 * (ในโค้ดยังเรียกว่า graph ตามชื่อเดิม)
 */

/**
 * ตัวเปรียบเทียบข้อความภาษาไทย
 * สร้างครั้งเดียวนอกฟังก์ชัน เพราะการสร้าง Collator แต่ละครั้งมีต้นทุน
 * ถ้าสร้างใหม่ทุกครั้งที่เรียงจะช้าลงโดยไม่จำเป็น
 *
 * ต้องใช้ Collator แทนการเทียบด้วย < > ธรรมดา
 * เพราะการเทียบธรรมดาดูแค่รหัสตัวอักษร ส่วน Collator เรียงตามพจนานุกรมไทย
 * (เช่น ไม่นับสระหน้า แ เ โ "แอร์" จึงเรียงตาม อ)
 */
const thaiCollator = new Intl.Collator('th')

export type SymptomLabel = Pick<GraphSummary, 'entrySymptom' | 'entrySymptomTh'>
export function symptomName(summary: SymptomLabel): string {
  return summary.entrySymptomTh ?? summary.entrySymptom
}

export interface SymptomGroup {
  deviceCategory: DeviceCategory
  brand: string
  modelPattern: string
  symptoms: GraphSummary[]
}

export function groupSymptoms(graphs: GraphSummary[]): SymptomGroup[] {
  const groups = new Map<string, SymptomGroup>()

  for (const graph of graphs) {
    const key = `${graph.deviceCategory}|${graph.brand}|${graph.modelPattern}`

    let group = groups.get(key)
    if (group === undefined) {
      group = {
        deviceCategory: graph.deviceCategory,
        brand: graph.brand,
        modelPattern: graph.modelPattern,
        symptoms: [],
      }
      groups.set(key, group)
    }

    group.symptoms.push(graph)
  }

  for (const group of groups.values()) {
    group.symptoms.sort((a, b) => thaiCollator.compare(symptomName(a), symptomName(b)))
  }

  return Array.from(groups.values())
}