import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateGrowthPlanDto } from './dto/create-growth-plan.dto';
import { FacultyGrowthService } from './faculty-growth.service';

@ApiTags('faculty growth')
@Controller('professors/:professorId/growth-plan')
export class FacultyGrowthController {
  constructor(private readonly facultyGrowthService: FacultyGrowthService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROFESSOR, UserRole.ADMIN)
  list(@Param('professorId') professorId: string) {
    return this.facultyGrowthService.list(professorId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROFESSOR, UserRole.ADMIN)
  create(@Param('professorId') professorId: string, @Body() dto: CreateGrowthPlanDto) {
    return this.facultyGrowthService.create(professorId, dto);
  }
}
