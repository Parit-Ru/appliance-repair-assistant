/**
 * symptom-search.module.ts — ประกอบงานค้นหาอาการเป็นโมดูลเดียว
 *
 * imports GraphModule เพื่อขอยืม GraphRepository ตัวเดียวกัน
 * ไม่สร้าง repository ซ้ำ เพราะจะโหลดผังจาก MySQL สองรอบ และอาจได้ข้อมูลไม่ตรงกัน
 *
 * EmbeddingService (src/embedding/) ประกาศเป็น provider ที่นี่ที่เดียว จึงมีตัวเดียวทั้งแอป (โหลดโมเดลครั้งเดียว)
 *
 * exports เฉพาะ SymptomSearchService ให้ TraversalModule และ AuthoringModule ใช้
 */

import { Module } from '@nestjs/common';

import { EmbeddingService } from '../embedding/embedding.service';
import { GraphModule } from '../traversal/graph.module';
import { SymptomSearchController } from './symptom-search.controller';
import { SymptomSearchService } from './symptom-search.service';

@Module({
  imports: [GraphModule],
  // export ให้ TraversalModule ยืม SymptomSearchService ไปคิดคะแนนความมั่นใจของ session
  // และ AuthoringModule ใช้เพิ่มผังที่เพิ่ง publish เข้าดัชนีค้นหา
  exports: [SymptomSearchService],
  controllers: [SymptomSearchController],
  providers: [EmbeddingService, SymptomSearchService],
})
export class SymptomSearchModule {}
