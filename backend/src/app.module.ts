import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AdminModule } from './admin/admin.module';
import { AuthoringModule } from './authoring/authoring.module';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { HistoryModule } from './history/history.module';
import { TraversalModule } from './traversal/traversal.module';
import { SymptomSearchModule } from './symptom-search/symptom-search.module';

@Module({
  imports: [
    // DatabaseModule เป็น @Global() จึงต้องอยู่ก่อนโมดูลที่ใช้ฐานข้อมูล
    DatabaseModule,
    AuthModule,
    TraversalModule,
    SymptomSearchModule,
    HistoryModule,
    AdminModule,
    AuthoringModule,
  ],
  // GET /health ใช้แค่ MYSQL_POOL (มาจาก DatabaseModule ที่เป็น @Global) จึงไม่ต้องมีโมดูลของตัวเอง
  controllers: [HealthController],
  // แปลง error ทุกชนิดเป็น {statusCode, code, message} ที่เดียว (ดู common/all-exceptions.filter.ts)
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
