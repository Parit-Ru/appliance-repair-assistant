/**
 * symptom-search.module.ts — ประกอบงานค้นหาอาการเป็นโมดูลเดียว
 *
 * imports GraphModule เพื่อขอยืม GraphRepository ตัวเดียวกัน
 * ไม่สร้าง repository ซ้ำ เพราะจะโหลดผังจาก MySQL สองรอบ และอาจได้ข้อมูลไม่ตรงกัน
 *
 * imports EmbeddingModule เพื่อขอยืม EmbeddingService ตัวเดียวกัน (โหลดโมเดลครั้งเดียว)
 * ต่างจาก FixStep ที่ provide EmbeddingService เองในโมดูลนี้ — โปรเจกต์นี้แยกเป็น src/embedding/
 *
 * exports เฉพาะ SymptomSearchService ให้ TraversalModule ใช้
 */

import { Module } from '@nestjs/common';

import { EmbeddingModule } from '../embedding/embedding.module';
import { GraphModule } from '../traversal/graph.module';
import { SymptomSearchController } from './symptom-search.controller';
import { SymptomSearchService } from './symptom-search.service';

@Module({
  imports: [GraphModule, EmbeddingModule],
  // export ให้ TraversalModule ยืม SymptomSearchService ไปคิดคะแนนความมั่นใจของ session
  exports: [SymptomSearchService],
  controllers: [SymptomSearchController],
  providers: [SymptomSearchService],
})
export class SymptomSearchModule {}