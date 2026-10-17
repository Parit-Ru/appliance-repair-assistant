import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthoringModule } from './authoring/authoring.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { HistoryModule } from './history/history.module';
import { TraversalModule } from './traversal/traversal.module';
import { SymptomSearchModule } from './symptom-search/symptom-search.module';

@Module({
  imports: [
    // DatabaseModule เป็น @Global() จึงต้องอยู่ก่อนโมดูลที่ใช้ฐานข้อมูล
    DatabaseModule,
    HealthModule,
    AuthModule,
    TraversalModule,
    SymptomSearchModule,
    HistoryModule,
    AdminModule,
    AuthoringModule,
  ],
})
export class AppModule {}