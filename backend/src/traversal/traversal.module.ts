/**
 * traversal.module.ts — ประกอบ controller, service และตัวอ่าน/เขียนข้อมูลของการตรวจเข้าเป็นโมดูลเดียว
 *
 * ไม่ต้อง import DatabaseModule ที่นี่ แม้ว่า EquipmentRepository และ SessionStore
 * ต้องใช้ MYSQL_POOL ก็ตาม เพราะ DatabaseModule ประกาศตัวเองเป็น @Global() ไว้แล้ว
 * (เห็นได้จากคอมเมนต์ใน app.module.ts)
 *
 * imports:
 *   GraphModule         — GraphRepository ตัวเดียวที่ใช้ร่วมกับงานค้นหาอาการ
 *   SymptomSearchModule — ให้ TraversalService คิดคะแนนความมั่นใจของ session
 *
 * ไม่มี exports เพราะยังไม่มีโมดูลอื่นต้องการของจากที่นี่
 */

import { Module } from '@nestjs/common';

import { GraphModule } from './graph.module';
import { EquipmentRepository } from './equipment.repository';
import { SessionStore } from './session.store';
import { TraversalService } from './traversal.service';
import { TraversalController } from './traversal.controller';
import { SymptomSearchModule } from '../symptom-search/symptom-search.module';

@Module({
  imports: [GraphModule, SymptomSearchModule],
  controllers: [TraversalController],
  providers: [EquipmentRepository, SessionStore, TraversalService],
})
export class TraversalModule {}