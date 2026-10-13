/**
 * graph.module.ts — ที่อยู่ของ GraphRepository (ผังขั้นตอนทั้งหมดในหน่วยความจำ)
 *
 * แยกออกมาเป็นโมดูลของตัวเองเพื่อตัดการพึ่งกันเป็นวงกลม:
 *   TraversalModule ต้องใช้ SymptomSearchService (คิดคะแนนความมั่นใจ)
 *   SymptomSearchModule ต้องใช้ GraphRepository (สร้างดัชนีอาการ)
 * ถ้าให้สองโมดูลนี้ import กันตรงๆ จะวนกลับหากัน
 * จึงให้ทั้งคู่ import โมดูลนี้ที่ไม่พึ่งใครเลย
 *
 * โมดูลเดียวจึงมี GraphRepository ตัวเดียว: โหลดผังจาก MySQL ครั้งเดียวตอนบูต
 * (onModuleInit) แล้วทุกโมดูลใช้ตัวเดียวกัน
 *
 * ต้องการ MYSQL_POOL จาก DatabaseModule ซึ่งเป็น @Global() จึงไม่ต้อง import ที่นี่
 */

import { Module } from '@nestjs/common';

import { GraphRepository } from './graph.repository';

@Module({
  providers: [GraphRepository],
  exports: [GraphRepository],
})
export class GraphModule {}