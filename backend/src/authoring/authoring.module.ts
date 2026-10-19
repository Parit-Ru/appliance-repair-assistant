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
