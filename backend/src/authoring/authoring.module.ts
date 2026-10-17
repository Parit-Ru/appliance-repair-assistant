/**
 * authoring.module.ts — อัปโหลด PDF → LLM ร่างผัง → ตรวจ → เผยแพร่ (Step 5)
 *
 * imports:
 *   AuthModule          — JwtAuthGuard / RolesGuard
 *   GraphModule         — GraphRepository (reload หลัง publish · ตรวจ id ชน)
 *   SymptomSearchModule — SymptomSearchService.addGraphs (เพิ่มผังใหม่เข้าดัชนีค้นหา)
 * MYSQL_POOL มาจาก DatabaseModule ที่เป็น @Global()
 *
 * ตัวแยกข้อความ PDF และ LLM client ผูกผ่าน token เพื่อให้เทสต์สลับเป็นของปลอมได้
 * LLM client เป็น null เมื่อยังไม่ตั้งค่า (GROQ_API_KEY + AUTHORING_LLM_MODEL) — ร่างจะล้มด้วย LLM_NOT_CONFIGURED
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SymptomSearchModule } from '../symptom-search/symptom-search.module';
import { GraphModule } from '../traversal/graph.module';
import { DRAFT_LLM_CLIENT, createDraftLlmFromEnv } from './draft-llm.client';
import { DraftsController } from './drafts.controller';
import { DraftsService } from './drafts.service';
import { DraftsStore } from './drafts.store';
import { PDF_TEXT_EXTRACTOR, UnpdfTextExtractor } from './pdf-text';

@Module({
  imports: [AuthModule, GraphModule, SymptomSearchModule],
  controllers: [DraftsController],
  providers: [
    DraftsStore,
    DraftsService,
    { provide: PDF_TEXT_EXTRACTOR, useClass: UnpdfTextExtractor },
    { provide: DRAFT_LLM_CLIENT, useFactory: () => createDraftLlmFromEnv() },
  ],
})
export class AuthoringModule {}
