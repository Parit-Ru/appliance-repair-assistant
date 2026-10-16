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
 *   AuthModule          — ให้ OptionalJwtAuthGuard หา JwtService เจอ (รู้ว่าผู้เรียกล็อกอินอยู่หรือเป็น guest)
 *
 * ไม่มี exports เพราะยังไม่มีโมดูลอื่นต้องการของจากที่นี่
 */

import { Logger, Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { GraphModule } from './graph.module';
import { EquipmentRepository } from './equipment.repository';
import { SessionStore } from './session.store';
import { TraversalService } from './traversal.service';
import { TraversalController } from './traversal.controller';
import { SymptomSearchModule } from '../symptom-search/symptom-search.module';
import { createGroqClientFromEnv } from '../rephrase/groq-llm.client';
import { RephraseService } from '../rephrase/rephrase.service';

@Module({
  imports: [GraphModule, SymptomSearchModule, AuthModule],
  controllers: [TraversalController],
  providers: [
    EquipmentRepository,
    SessionStore,
    TraversalService,
    {
      provide: RephraseService,
      useFactory: () => {
        const client = createGroqClientFromEnv();
        if (!client && process.env.REPHRASE_ENABLED === 'true') {
          new Logger('RephraseService').warn('REPHRASE_ENABLED=true แต่ตั้ง GROQ_API_KEY/GROQ_MODEL ไม่ครบ — ใช้ข้อความต้นฉบับ');
        }
        return new RephraseService(client, {
          enabled: client !== null,
          timeoutMs: Number(process.env.REPHRASE_TIMEOUT_MS) || 3000,
        });
      },
    },
  ],
})
export class TraversalModule {}