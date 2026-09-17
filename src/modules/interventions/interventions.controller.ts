import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateInterventionDto } from './dto/create-intervention.dto';
import { InterventionsService } from './interventions.service';

@ApiTags('interventions')
@Controller('professor/courses/:courseId/interventions')
export class InterventionsController {
  constructor(private readonly interventionsService: InterventionsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROFESSOR, UserRole.ADMIN)
  list(@Param('courseId') courseId: string) {
    return this.interventionsService.list(courseId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PROFESSOR, UserRole.ADMIN)
  create(@Param('courseId') courseId: string, @Body() dto: CreateInterventionDto) {
    return this.interventionsService.create(courseId, dto);
  }
}
