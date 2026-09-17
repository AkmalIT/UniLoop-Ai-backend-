import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateLearningPlanDto } from './dto/create-learning-plan.dto';
import { LearningPlansService } from './learning-plans.service';

@ApiTags('learning plans')
@Controller('students/:studentId/learning-plan/:courseId')
export class LearningPlansController {
  constructor(private readonly learningPlansService: LearningPlansService) {}

  @Get()
  list(@Param('studentId') studentId: string, @Param('courseId') courseId: string) {
    return this.learningPlansService.list(studentId, courseId);
  }

  @Post()
  create(
    @Param('studentId') studentId: string,
    @Param('courseId') courseId: string,
    @Body() dto: CreateLearningPlanDto,
  ) {
    return this.learningPlansService.create(studentId, courseId, dto);
  }
}
