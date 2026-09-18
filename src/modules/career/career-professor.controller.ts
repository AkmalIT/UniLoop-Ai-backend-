import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AiCareerService } from './ai/ai-career.service';
import { CareerService } from './career.service';
import { CreateOpportunityDto, ReviewEndorsementDto } from './dto/career.dto';

interface AuthUser { id: string; role: UserRole }

@ApiTags('career-professor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CareerProfessorController {
  constructor(
    private readonly careerService: CareerService,
    private readonly aiCareerService: AiCareerService,
  ) {}

  @Get('professors/me/referral-candidates')
  @Roles(UserRole.PROFESSOR)
  async getReferralCandidates(@CurrentUser() user: AuthUser) {
    const pid = await this.careerService.resolveProfessorId(user.id);
    return this.careerService.getReferralCandidates(pid);
  }

  @Get('professors/me/students/:id/evidence')
  @Roles(UserRole.PROFESSOR)
  async getStudentEvidence(@CurrentUser() user: AuthUser, @Param('id') studentId: string) {
    const pid = await this.careerService.resolveProfessorId(user.id);
    return this.careerService.getStudentEvidenceForProfessor(pid, studentId);
  }

  @Post('professors/me/endorsements')
  @Roles(UserRole.PROFESSOR)
  async reviewEndorsement(@CurrentUser() user: AuthUser, @Body() dto: ReviewEndorsementDto) {
    const pid = await this.careerService.resolveProfessorId(user.id);
    return this.careerService.reviewEndorsement(pid, dto);
  }

  @Post('opportunities')
  @Roles(UserRole.PROFESSOR)
  async createOpportunity(@Body() dto: CreateOpportunityDto) {
    return this.careerService.createOpportunity(dto);
  }

  @Get('opportunities')
  async listOpportunities() {
    return this.careerService.listOpportunities();
  }

  // ── AI Endpoint ───────────────────────────────────────────────────────────

  @Post('professors/me/students/:studentId/recommendation')
  @Roles(UserRole.PROFESSOR)
  async draftRecommendation(
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const pid = await this.careerService.resolveProfessorId(user.id);
    return this.careerService.draftProfessorRecommendation(pid, studentId, user.id, this.aiCareerService);
  }
}
