import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AiCareerService } from './ai/ai-career.service';
import { CareerService } from './career.service';
import {
  CreateSkillEvidenceDto,
  RequestEndorsementDto,
  SetCareerGoalDto,
  UpdateConsentDto,
  UpdateRecommendationStatusDto,
  CreateClubDto,
} from './dto/career.dto';
interface AuthUser { id: string; role: UserRole }

@ApiTags('career-student')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CareerStudentController {
  constructor(
    private readonly careerService: CareerService,
    private readonly aiCareerService: AiCareerService,
  ) {}

  @Get('students/me/opportunity-dashboard')
  @Roles(UserRole.STUDENT)
  async getDashboard(@CurrentUser() user: AuthUser) {
    const sid = await this.careerService.resolveStudentId(user.id);
    return this.careerService.getOpportunityDashboard(sid);
  }

  @Post('students/me/career-goal')
  @Roles(UserRole.STUDENT)
  async setCareerGoal(@CurrentUser() user: AuthUser, @Body() dto: SetCareerGoalDto) {
    const sid = await this.careerService.resolveStudentId(user.id);
    return this.careerService.setCareerGoal(sid, dto);
  }

  @Get('students/me/recommendations')
  @Roles(UserRole.STUDENT)
  async getRecommendations(@CurrentUser() user: AuthUser) {
    const sid = await this.careerService.resolveStudentId(user.id);
    return this.careerService.getRecommendations(sid);
  }

  @Post('students/me/clubs')
  @Roles(UserRole.STUDENT)
  async createClub(@CurrentUser() user: AuthUser, @Body() dto: CreateClubDto) {
    const sid = await this.careerService.resolveStudentId(user.id);
    const club = await this.careerService.createClub(sid, dto);
    return { id: club.id, title: club.title, topic: dto.topic, requiredSkills: club.requiredSkills };
  }

  @Patch('recommendations/:id')
  @Roles(UserRole.STUDENT)
  async updateRecommendation(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateRecommendationStatusDto,
  ) {
    const sid = await this.careerService.resolveStudentId(user.id);
    return this.careerService.updateRecommendationStatus(id, sid, dto.status);
  }

  @Post('students/me/endorsement-request')
  @Roles(UserRole.STUDENT)
  async requestEndorsement(@CurrentUser() user: AuthUser, @Body() dto: RequestEndorsementDto) {
    const sid = await this.careerService.resolveStudentId(user.id);
    return this.careerService.requestEndorsement(sid, dto);
  }

  @Post('students/me/skill-evidence')
  @Roles(UserRole.STUDENT)
  async addEvidence(@CurrentUser() user: AuthUser, @Body() dto: CreateSkillEvidenceDto) {
    const sid = await this.careerService.resolveStudentId(user.id);
    return this.careerService.addSkillEvidence(sid, dto);
  }

  @Get('students/me/consent')
  @Roles(UserRole.STUDENT)
  async getConsent(@CurrentUser() user: AuthUser) {
    const sid = await this.careerService.resolveStudentId(user.id);
    return this.careerService.getConsent(sid);
  }

  @Post('students/me/consent')
  @Roles(UserRole.STUDENT)
  async updateConsent(@CurrentUser() user: AuthUser, @Body() dto: UpdateConsentDto) {
    const sid = await this.careerService.resolveStudentId(user.id);
    return this.careerService.updateConsent(sid, dto);
  }

  // ── AI Endpoints ──────────────────────────────────────────────────────────

  @Post('students/me/recommendations/:recommendationId/explanation')
  @Roles(UserRole.STUDENT)
  async explainRecommendation(
    @Param('recommendationId') recommendationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const sid = await this.careerService.resolveStudentId(user.id);
    return this.careerService.explainRecommendation(recommendationId, sid, user.id, this.aiCareerService);
  }

  @Post('students/me/next-step')
  @Roles(UserRole.STUDENT)
  async getNextStep(@CurrentUser() user: AuthUser) {
    const sid = await this.careerService.resolveStudentId(user.id);
    return this.careerService.getNextStep(sid, user.id, this.aiCareerService);
  }

  @Post('students/me/skills/:skill/explanation')
  @Roles(UserRole.STUDENT)
  async explainSkillGap(
    @Param('skill') skill: string,
    @CurrentUser() user: AuthUser,
  ) {
    const sid = await this.careerService.resolveStudentId(user.id);
    return this.careerService.explainSkillGap(sid, skill, user.id, this.aiCareerService);
  }
}
