import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { CreateQuestionDto } from './dto/create-question.dto';

@ApiTags('assessments')
@Controller()
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Get('courses/:id/assessments')
  list(@Param('id') courseId: string) {
    return this.assessmentsService.list(courseId);
  }

  @Post('courses/:id/assessments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROFESSOR, UserRole.ADMIN)
  create(@Param('id') courseId: string, @Body() dto: CreateAssessmentDto) {
    return this.assessmentsService.create(courseId, dto);
  }

  @Get('assessments/:id')
  findOne(@Param('id') id: string) {
    return this.assessmentsService.findOne(id);
  }

  @Post('assessments/:id/questions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROFESSOR, UserRole.ADMIN)
  addQuestion(@Param('id') id: string, @Body() dto: CreateQuestionDto) {
    return this.assessmentsService.addQuestion(id, dto);
  }
}
