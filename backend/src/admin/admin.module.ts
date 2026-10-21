/**
 * admin.module.ts — endpoint อ่านอย่างเดียวสำหรับ admin (feedback, สถิติ)
 *
 * imports:
 *   AuthModule  — JwtAuthGuard หา JwtService เจอ
 *   GraphModule — GraphRepository ตัวเดียวกับโมดูลอื่น ใช้แปลง graph_id เป็นประเภทเครื่อง/outcome
 * MYSQL_POOL มาจาก DatabaseModule ที่เป็น @Global()
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { GraphModule } from '../traversal/graph.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminStore } from './admin.store';

@Module({
  imports: [AuthModule, GraphModule],
  controllers: [AdminController],
  providers: [AdminStore, AdminService],
})
export class AdminModule {}
