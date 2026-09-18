import { Module } from '@nestjs/common';
import { LlmModule } from '../../integrations/llm/llm.module';
import { AiCareerService } from './ai/ai-career.service';
import { CareerProfessorController } from './career-professor.controller';
import { CareerReadinessService } from './career-readiness.service';
import { CareerService } from './career.service';
import { CareerStudentController } from './career-student.controller';
import { OpportunityMatchingService } from './opportunity-matching.service';
import { SkillEvidenceService } from './skill-evidence.service';

@Module({
  imports: [LlmModule],
  controllers: [CareerStudentController, CareerProfessorController],
  providers: [
    CareerService,
    SkillEvidenceService,
    CareerReadinessService,
    OpportunityMatchingService,
    AiCareerService,
  ],
  exports: [SkillEvidenceService],
})
export class CareerModule {}
