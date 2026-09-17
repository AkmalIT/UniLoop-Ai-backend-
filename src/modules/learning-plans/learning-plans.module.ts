import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { LearningPlansController } from './learning-plans.controller';
import { LearningPlansService } from './learning-plans.service';

@Module({
  imports: [CoursesModule],
  controllers: [LearningPlansController],
  providers: [LearningPlansService],
})
export class LearningPlansModule {}
