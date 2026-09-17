import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { SubmissionsService } from './submissions.service';

@ApiTags('submissions')
@Controller()
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post('assessments/:id/submissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT, UserRole.ADMIN)
  submit(@Param('id') assessmentId: string, @Body() dto: CreateSubmissionDto) {
    return this.submissionsService.submit(assessmentId, dto);
  }

  @Get('submissions/:id')
  findOne(@Param('id') id: string) {
    return this.submissionsService.findOne(id);
  }
}
