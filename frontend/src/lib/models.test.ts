import { describe, expect, it } from 'vitest'
import { manualMatches, manualTitle, matchesPattern, patternsOf } from './models'
import { symptomsPath } from './modelSelection'

describe('matchesPattern', () => {
  const cases: Array<[string, string, boolean, string]> = [
    ['WA21A8376GW', 'WA21A8376G*', true, '* แทน 1 อักขระ'],
    ['wa21a', 'WA21A8376G*', true, 'พิมพ์สั้นกว่า = คำนำหน้า และไม่สนตัวพิมพ์'],
    ['WA40F10E1ABC', 'WA40F10E1*', true, 'พิมพ์ยาวกว่า (รหัสตลาด) ตรงถ้ารูปแบบทั้งหมดตรง'],
    ['WA22A', 'WA21A8376G*', false, 'ต่างกันที่ตัวที่ 4'],
    ['AR70HSSFAWKNST', 'AR70H**D1***', false, 'F ไม่ตรง D'],
    ['AR70HSSD1XXX', 'AR70H**D1***', true, '** แทน 2 ตัว'],
    ['DA6802676A', 'DA68-02676A', true, 'ตัดขีดกลางทั้งสองฝั่ง'],
    ['wa21a-8376 g', 'WA21A8376G*', true, 'ตัดช่องว่าง/ขีด'],
    ['', 'WA21A8376G*', false, 'ว่าง'],
    ['W', 'WT10J7', true, 'พิมพ์ตัวเดียวก็กรองได้ (ใช้กรองรายการเท่านั้น)'],
  ]
  for (const [input, pattern, expected, why] of cases) {
    it(`${JSON.stringify(input)} ~ ${pattern} = ${expected} (${why})`, () => {
      expect(matchesPattern(input, pattern)).toBe(expected)
    })
  }
})

describe('manualMatches / patternsOf / manualTitle', () => {
  const multi = { modelPattern: 'RF195AC/RF197AC/RF18HFENB', modelAliases: undefined }
  it('แยกหลายรุ่นด้วย /', () => {
    expect(patternsOf(multi)).toEqual(['RF195AC', 'RF197AC', 'RF18HFENB'])
    expect(manualMatches(multi, 'rf197ac')).toBe(true)
    expect(manualMatches(multi, 'RF300')).toBe(false)
  })
  it('ใช้ modelAliases ด้วย (กรณีรหัสคู่มือไม่ใช่เลขรุ่นที่สติกเกอร์)', () => {
    const tv = { modelPattern: 'KM2DVBADN-2.1.5', modelAliases: ['UA55AU7700'] }
    expect(manualMatches(tv, 'ua55au7700kxxt')).toBe(true)
    expect(manualMatches({ modelPattern: 'KM2DVBADN-2.1.5' }, 'ua55au7700kxxt')).toBe(false)
  })
  it('manualTitle: displayName ถ้ามี ไม่งั้น modelPattern (ไม่เดาชื่อ)', () => {
    expect(manualTitle({ modelPattern: 'WT10J7' })).toBe('WT10J7')
    expect(manualTitle({ modelPattern: 'WT10J7', displayName: 'เครื่องซักผ้า Samsung WT10J7' })).toBe('เครื่องซักผ้า Samsung WT10J7')
  })
})

describe('symptomsPath', () => {
  it('สร้างลิงก์ตามรุ่น + ไม่ทราบรุ่น + หน้าอาการทั้งหมด + escape', () => {
    expect(symptomsPath('samsung_ac_ar70h', 'selected')).toBe('/symptoms?manual=samsung_ac_ar70h')
    expect(symptomsPath('samsung_ac_ar70h', 'unknown')).toBe('/symptoms?manual=samsung_ac_ar70h&unknown=1')
    expect(symptomsPath('m', 'selected', 'all')).toBe('/symptoms/all?manual=m')
    expect(symptomsPath('a b&c', 'selected')).toBe('/symptoms?manual=a+b%26c')
  })
})
