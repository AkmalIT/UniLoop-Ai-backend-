import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { InsightsService } from './insights.service';

@ApiTags('professor insights')
@Controller('professor/courses/:courseId/insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROFESSOR, UserRole.ADMIN)
  getInsights(@Param('courseId') courseId: string) {
    return this.insightsService.getProfessorInsights(courseId);
  }
}
