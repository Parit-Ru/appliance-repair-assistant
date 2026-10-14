import { describe, expect, it } from 'vitest'
import { groupSymptoms, symptomName } from './symptoms'
import type { GraphSummary } from '../api/types'

/**
 * สร้าง GraphSummary ของแอร์ AR70H ใส่เฉพาะส่วนที่ต่างกันผ่าน overrides
 * ค่าเริ่มต้นตรงกับข้อมูลจริงใน data/manuals/samsung_ac_ar70h.json
 */
function acGraph(overrides: Partial<GraphSummary>): GraphSummary {
  return {
    graphId: 'test_graph',
    entrySymptom: 'Test symptom',
    deviceCategory: 'Air Conditioner',
    brand: 'Samsung',
    modelPattern: 'AR70H**D1***',
    ...overrides,
  }
}

// ชื่อจริง 4 อาการจากคู่มือแอร์ (ชื่อไทยตรงกับไฟล์ข้อมูล)
const TIMER = acGraph({
  graphId: 'samsung_ac_ar70h_timer_not_working',
  entrySymptom: 'The Timed on/off function does not work',
  entrySymptomTh: 'ตั้งเวลาเปิดปิดไม่ได้ ตั้งแล้วไม่ทำงาน',
})
const BLINKING = acGraph({
  graphId: 'samsung_ac_ar70h_indicator_blinking',
  entrySymptom: 'The indicator on the indoor unit display blinks continuously',
  entrySymptomTh: 'ไฟกะพริบที่หน้าจอแอร์ ไฟกระพริบไม่หยุด',
})
const STOPS_WORKING = acGraph({
  graphId: 'samsung_ac_ar70h_stops_working',
  entrySymptom: 'The air conditioner stops working',
  entrySymptomTh: 'แอร์ไม่ทำงาน เปิดไม่ติด',
})
const NOT_COLD = acGraph({
  graphId: 'samsung_ac_ar70h_improper_airflow_temperature',
  entrySymptom: 'Improper airflow temperature',
  entrySymptomTh: 'แอร์ไม่เย็น ลมออกมาไม่เย็น',
})

// ตู้เย็นสมมติ ใช้แค่ในเทสจัดกลุ่ม ยังไม่มีข้อมูลตู้เย็นจริง
const FRIDGE = acGraph({
  graphId: 'test_fridge_not_cooling',
  entrySymptom: 'Not cooling',
  entrySymptomTh: 'ตู้เย็นไม่เย็น',
  deviceCategory: 'Refrigerator',
  modelPattern: 'TEST-FRIDGE',
})

describe('symptomName', () => {
  it('ใช้ชื่อไทยถ้ามี', () => {
    expect(symptomName(STOPS_WORKING)).toBe('แอร์ไม่ทำงาน เปิดไม่ติด')
  })

  it('ไม่มีชื่อไทย ให้ถอยไปใช้ชื่ออังกฤษ', () => {
    const noThai = acGraph({ entrySymptom: 'Cannot change the fan speed' })
    expect(symptomName(noThai)).toBe('Cannot change the fan speed')
  })
})

describe('groupSymptoms', () => {
  it('เรียงอาการในกลุ่มตามลำดับภาษาไทย', () => {
    const groups = groupSymptoms([NOT_COLD, TIMER, STOPS_WORKING, BLINKING])

    expect(groups).toHaveLength(1)
    // สระหน้า (แ) ไม่นับตอนเรียง "แอร์..." จึงเรียงตาม อ ซึ่งอยู่ท้ายสุด
    expect(groups[0].symptoms.map((g) => g.graphId)).toEqual([
      TIMER.graphId,
      BLINKING.graphId,
      STOPS_WORKING.graphId,
      NOT_COLD.graphId,
    ])
  })

  it('แยกอาการของเครื่องคนละประเภทเป็นคนละกลุ่ม', () => {
    const groups = groupSymptoms([NOT_COLD, FRIDGE, TIMER])

    expect(groups).toHaveLength(2)

    // ไม่ได้กำหนดลำดับของกลุ่ม จึงหาด้วย find แทนการดูตำแหน่ง
    const ac = groups.find((g) => g.deviceCategory === 'Air Conditioner')
    const fridge = groups.find((g) => g.deviceCategory === 'Refrigerator')

    expect(ac?.modelPattern).toBe('AR70H**D1***')
    expect(ac?.symptoms.map((g) => g.graphId)).toEqual([TIMER.graphId, NOT_COLD.graphId])
    expect(fridge?.modelPattern).toBe('TEST-FRIDGE')
    expect(fridge?.symptoms.map((g) => g.graphId)).toEqual([FRIDGE.graphId])
  })

  it('ไม่แก้ลำดับของ array ที่ส่งเข้ามา', () => {
    const input = [NOT_COLD, TIMER]
    groupSymptoms(input)
    expect(input).toEqual([NOT_COLD, TIMER])
  })
})