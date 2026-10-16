/**
 * history.module.ts — หน้า "ประวัติการซ่อม"
 *
 * imports GraphModule เพื่อใช้ GraphRepository ตัวเดียวกับโมดูลอื่น (ผังโหลดครั้งเดียวตอนบูต)
 * MYSQL_POOL มาจาก DatabaseModule ที่เป็น @Global() ไม่ต้อง import
 * imports AuthModule เพื่อให้ OptionalJwtAuthGuard หา JwtService เจอ (รู้ว่าผู้เรียกล็อกอินอยู่หรือเป็น guest)
 * ไม่พึ่ง TraversalModule: ไม่ได้ใช้ SessionStore ตรงๆ (ใช้แค่ฟังก์ชันแปลงแถวที่ export จากไฟล์นั้น)
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { GraphModule } from '../traversal/graph.module';
import { HistoryController } from './history.controller';
import { HistoryService } from './history.service';
import { HistoryStore } from './history.store';

@Module({
  imports: [GraphModule, AuthModule],
  controllers: [HistoryController],
  providers: [HistoryStore, HistoryService],
})
export class HistoryModule {}
