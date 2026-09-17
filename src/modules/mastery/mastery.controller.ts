import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MasteryService } from './mastery.service';

@ApiTags('student mastery')
@Controller('students/:studentId/mastery/:courseId')
export class MasteryController {
  constructor(private readonly masteryService: MasteryService) {}

  @Get()
  getStudentMastery(
    @Param('studentId') studentId: string,
    @Param('courseId') courseId: string,
  ) {
    return this.masteryService.getStudentMastery(studentId, courseId);
  }
}
