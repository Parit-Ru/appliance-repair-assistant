import type { DeviceCategory, GraphSummary } from '../api/types'

/**
 * จัดรายการอาการสำหรับหน้าเลือกอาการ
 *
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

/**
 * ส่วนของข้อมูลอาการที่ใช้แสดงชื่อ
 * แคบกว่า GraphSummary เพื่อให้ทั้งรายการอาการ (GraphSummary) และผลค้นหา (SymptomMatch) ส่งเข้ามาได้
 */
export type SymptomLabel = Pick<GraphSummary, 'entrySymptom' | 'entrySymptomTh'>

/** ชื่ออาการที่แสดงบนหน้าจอ ใช้ชื่อไทยถ้ามี ไม่มีก็ใช้ชื่ออังกฤษ */
export function symptomName(summary: SymptomLabel): string {
  return summary.entrySymptomTh ?? summary.entrySymptom
}

/** อาการกลุ่มหนึ่ง = เครื่องประเภทเดียวกัน ยี่ห้อเดียวกัน รุ่นเดียวกัน */
export interface SymptomGroup {
  deviceCategory: DeviceCategory
  brand: string
  modelPattern: string
  /** เรียงตามชื่อไทยแล้ว */
  symptoms: GraphSummary[]
}

/**
 * จัดกลุ่มอาการตาม ประเภทเครื่อง + ยี่ห้อ + รุ่น แล้วเรียงอาการในแต่ละกลุ่ม
 *
 * ต้องใช้ทั้งสามค่า ไม่ใช่ประเภทเครื่องอย่างเดียว
 * เพราะอนาคตประเภทเดียวอาจมีหลายรุ่น ถ้าจัดด้วยประเภทอย่างเดียว
 * หัวกลุ่มจะแสดงได้แค่รุ่นเดียว ทั้งที่อาการในกลุ่มมาจากคนละคู่มือ
 *
 * ลำดับของกลุ่ม = ลำดับที่พบครั้งแรกในข้อมูลที่ส่งเข้ามา
 * (Map จำลำดับที่ใส่ไว้ให้)
 */
export function groupSymptoms(graphs: GraphSummary[]): SymptomGroup[] {
  const groups = new Map<string, SymptomGroup>()

  for (const graph of graphs) {
    // ต่อสามค่าเป็นข้อความเดียวเพื่อใช้เป็น key ของ Map
    // ใช้ | คั่น เพราะไม่มีในชื่อประเภท ยี่ห้อ หรือรุ่น
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

    // push ลง array ใหม่ของกลุ่ม ไม่ได้แตะ array graphs ที่รับเข้ามา
    group.symptoms.push(graph)
  }

  // sort แก้ array ตัวที่ถูกเรียก ซึ่งเป็น array ของกลุ่มที่สร้างเองข้างบน จึงปลอดภัย
  for (const group of groups.values()) {
    group.symptoms.sort((a, b) => thaiCollator.compare(symptomName(a), symptomName(b)))
  }

  return Array.from(groups.values())
}