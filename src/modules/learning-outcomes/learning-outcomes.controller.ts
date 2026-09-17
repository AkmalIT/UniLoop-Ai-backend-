import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateLearningOutcomeDto } from './dto/create-learning-outcome.dto';
import { LearningOutcomesService } from './learning-outcomes.service';

@ApiTags('learning outcomes')
@Controller('courses/:id/outcomes')
export class LearningOutcomesController {
  constructor(private readonly outcomesService: LearningOutcomesService) {}

  @Get()
  list(@Param('id') courseId: string) {
    return this.outcomesService.list(courseId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROFESSOR, UserRole.ADMIN)
  create(@Param('id') courseId: string, @Body() dto: CreateLearningOutcomeDto) {
    return this.outcomesService.create(courseId, dto);
  }
}
