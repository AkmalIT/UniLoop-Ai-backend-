import { Module } from '@nestjs/common';
import { LlmModule } from '../../integrations/llm/llm.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [LlmModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
