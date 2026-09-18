import { Module } from "@nestjs/common";
import { AcademicService } from "./academic.service";
import { CareerApiService } from "./career-api.service";
import {
  ProfessorApiController,
  StudentApiController,
  SurveysController,
} from "./integration.controller";
import { MasteryService } from "../mastery/mastery.service";
import { CoursesService } from "../courses/courses.service";
import { CareerReadinessService } from "../career/career-readiness.service";
import { AiCareerService } from "../career/ai/ai-career.service";
import { LlmModule } from "../../integrations/llm/llm.module";
import { JobSearchService } from "./job-search.service";
@Module({
  imports: [LlmModule],
  controllers: [
    StudentApiController,
    ProfessorApiController,
    SurveysController,
  ],
  providers: [
    AcademicService,
    CareerApiService,
    MasteryService,
    CoursesService,
    CareerReadinessService,
    AiCareerService,
    JobSearchService,
  ],
  exports: [JobSearchService, AiCareerService],
})
export class IntegrationModule {}
