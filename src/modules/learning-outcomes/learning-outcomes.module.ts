import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { LearningOutcomesController } from './learning-outcomes.controller';
import { LearningOutcomesService } from './learning-outcomes.service';

@Module({
  imports: [CoursesModule],
  controllers: [LearningOutcomesController],
  providers: [LearningOutcomesService],
})
export class LearningOutcomesModule {}
