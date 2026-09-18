import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EndorsementStatus, RecommendationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiCareerService } from './ai/ai-career.service';
import { CareerReadinessService } from './career-readiness.service';
import { OpportunityMatchingService } from './opportunity-matching.service';
import { SkillEvidenceService } from './skill-evidence.service';
import {
  CreateOpportunityDto,
  CreateSkillEvidenceDto,
  RequestEndorsementDto,
  ReviewEndorsementDto,
  SetCareerGoalDto,
  UpdateConsentDto,
} from './dto/career.dto';

@Injectable()
export class CareerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly skillEvidenceService: SkillEvidenceService,
    private readonly readinessService: CareerReadinessService,
    private readonly matchingService: OpportunityMatchingService,
  ) {}

  // ── Career Goal ──────────────────────────────────────────────────────────

  async setCareerGoal(studentId: string, dto: SetCareerGoalDto) {
    return this.prisma.careerProfile.upsert({
      where: { studentId },
      create: { studentId, ...dto, interests: dto.interests ?? [] },
      update: { ...dto, interests: dto.interests ?? [] },
    });
  }

  // ── Opportunity Dashboard ────────────────────────────────────────────────

  async getOpportunityDashboard(studentId: string) {
    const [careerProfile, aggregatedSkills] = await Promise.all([
      this.prisma.careerProfile.findUnique({ where: { studentId } }),
      this.skillEvidenceService.aggregateStudentSkills(studentId),
    ]);

    const hasProjectEvidence = await this.prisma.skillEvidence
      .findFirst({ where: { studentId, sourceType: 'PROJECT' } })
      .then(Boolean);

    const readiness = careerProfile
      ? this.readinessService.calculate({
          coreSkills: careerProfile.coreSkills,
          skills: aggregatedSkills,
          hasProjectEvidence,
        })
      : null;

    const recommendations = await this.prisma.matchRecommendation.findMany({
      where: { studentId },
      include: { opportunity: true },
      orderBy: { matchScore: 'desc' },
      take: 3,
    });

    return { careerProfile, skills: aggregatedSkills, readiness, recommendations };
  }

  // ── Skill Evidence ───────────────────────────────────────────────────────

  async addSkillEvidence(studentId: string, dto: CreateSkillEvidenceDto) {
    return this.skillEvidenceService.createManual({
      studentId,
      skill: dto.skill,
      sourceType: dto.sourceType,
      sourceId: dto.sourceId,
      score: dto.score,
    });
  }

  // ── Recommendations ──────────────────────────────────────────────────────

  async getRecommendations(studentId: string) {
    const skills = await this.skillEvidenceService.aggregateStudentSkills(studentId);
    await this.matchingService.refreshRecommendations(studentId, skills);

    return this.prisma.matchRecommendation.findMany({
      where: { studentId },
      include: { opportunity: true },
      orderBy: { matchScore: 'desc' },
      take: 3,
    });
  }

  async updateRecommendationStatus(
    recommendationId: string,
    studentId: string,
    status: RecommendationStatus,
  ) {
    const rec = await this.prisma.matchRecommendation.findUnique({
      where: { id: recommendationId },
    });
    if (!rec) throw new NotFoundException('Recommendation not found.');
    if (rec.studentId !== studentId) throw new ForbiddenException();
    return this.prisma.matchRecommendation.update({
      where: { id: recommendationId },
      data: { status },
    });
  }

  // ── Endorsements ─────────────────────────────────────────────────────────

  async requestEndorsement(studentId: string, dto: RequestEndorsementDto) {
    const evidence = await this.prisma.skillEvidence.findMany({
      where: { id: { in: dto.evidenceIds }, studentId },
    });
    if (evidence.length !== dto.evidenceIds.length) {
      throw new ForbiddenException('Some evidence items do not belong to this student.');
    }

    return this.prisma.professorEndorsement.create({
      data: {
        studentId,
        professorId: dto.professorId,
        items: { create: dto.evidenceIds.map((evidenceId) => ({ evidenceId })) },
      },
      include: { items: true },
    });
  }

  async reviewEndorsement(professorId: string, dto: ReviewEndorsementDto) {
    const endorsement = await this.prisma.professorEndorsement.findUnique({
      where: { id: dto.endorsementId },
      include: { items: true },
    });
    if (!endorsement) throw new NotFoundException('Endorsement not found.');
    if (endorsement.professorId !== professorId) throw new ForbiddenException();

    const updated = await this.prisma.professorEndorsement.update({
      where: { id: dto.endorsementId },
      data: { status: dto.status as EndorsementStatus, comment: dto.comment },
    });

    if (dto.status === 'ENDORSED') {
      const evidenceIds = endorsement.items.map((item) => item.evidenceId);
      await this.prisma.skillEvidence.updateMany({
        where: { id: { in: evidenceIds } },
        data: { professorVerified: true },
      });
    }

    return updated;
  }

  // ── Consent ──────────────────────────────────────────────────────────────

  async updateConsent(studentId: string, dto: UpdateConsentDto) {
    return this.prisma.consent.upsert({
      where: { studentId },
      create: {
        studentId,
        networkingVisible: dto.networkingVisible ?? false,
        professorReferralAllowed: dto.professorReferralAllowed ?? false,
      },
      update: dto,
    });
  }

  async getConsent(studentId: string) {
    return this.prisma.consent.findUnique({ where: { studentId } });
  }

  // ── Professor Referral Candidates ────────────────────────────────────────

  async getReferralCandidates(professorId: string) {
    void professorId;
    const consents = await this.prisma.consent.findMany({
      where: { professorReferralAllowed: true },
      include: {
        student: {
          include: {
            user: { select: { id: true, name: true } },
            careerProfile: true,
            skillEvidence: { where: { professorVerified: true } },
          },
        },
      },
    });

    return consents.map((consent) => ({
      studentId: consent.studentId,
      name: consent.student.user.name,
      targetRole: consent.student.careerProfile?.targetRole ?? null,
      verifiedSkills: consent.student.skillEvidence.map((e) => ({
        skill: e.skill,
        score: Number(e.score),
      })),
    }));
  }

  async getStudentEvidenceForProfessor(professorId: string, studentId: string) {
    void professorId;
    const consent = await this.prisma.consent.findUnique({ where: { studentId } });
    if (!consent?.professorReferralAllowed) {
      throw new ForbiddenException('Student has not granted professor referral permission.');
    }
    return this.skillEvidenceService.getStudentEvidence(studentId);
  }

  // ── Opportunities ─────────────────────────────────────────────────────────

  async createOpportunity(dto: CreateOpportunityDto) {
    return this.prisma.opportunity.create({ data: dto });
  }

  async listOpportunities() {
    return this.prisma.opportunity.findMany({ orderBy: { createdAt: 'asc' } });
  }

  // ── Profile resolution ────────────────────────────────────────────────────

  async resolveStudentId(userId: string): Promise<string> {
    const profile = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('Student profile not found.');
    return profile.id;
  }

  async resolveProfessorId(userId: string): Promise<string> {
    const profile = await this.prisma.professorProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('Professor profile not found.');
    return profile.id;
  }

  // ── AI Orchestration ──────────────────────────────────────────────────────

  async explainRecommendation(
    recommendationId: string,
    studentId: string,
    userId: string,
    ai: AiCareerService,
  ) {
    const rec = await this.prisma.matchRecommendation.findUnique({
      where: { id: recommendationId },
      include: { opportunity: true },
    });
    if (!rec) throw new NotFoundException('Recommendation not found.');
    if (rec.studentId !== studentId) throw new ForbiddenException();

    // Return cached explanation if already generated
    if (rec.explanationUz && rec.nextActionUz) {
      return { explanationUz: rec.explanationUz, nextActionUz: rec.nextActionUz };
    }

    const careerProfile = await this.prisma.careerProfile.findUnique({ where: { studentId } });
    const verifiedEvidence = await this.prisma.skillEvidence.findMany({
      where: { studentId, professorVerified: true },
    });

    const result = await ai.explainOpportunity(
      {
        targetRole: careerProfile?.targetRole ?? 'Kasbiy yo\'nalish',
        opportunityType: rec.opportunity.type,
        opportunityTitle: rec.opportunity.title,
        opportunityDescription: rec.opportunity.description,
        requiredSkills: rec.opportunity.requiredSkills,
        matchScore: Number(rec.matchScore),
        matchedSkills: rec.matchedSkills,
        missingSkills: rec.missingSkills,
        verifiedSkills: verifiedEvidence.map((e) => e.skill),
      },
      userId,
    );

    // Persist so subsequent calls are cached
    await this.prisma.matchRecommendation.update({
      where: { id: recommendationId },
      data: { explanationUz: result.explanationUz, nextActionUz: result.nextActionUz },
    });

    return result;
  }

  async getNextStep(studentId: string, userId: string, ai: AiCareerService) {
    const [careerProfile, aggregatedSkills] = await Promise.all([
      this.prisma.careerProfile.findUnique({ where: { studentId } }),
      this.skillEvidenceService.aggregateStudentSkills(studentId),
    ]);

    if (!careerProfile) throw new NotFoundException('Career profile not found. Set a career goal first.');

    const hasProjectEvidence = await this.prisma.skillEvidence
      .findFirst({ where: { studentId, sourceType: 'PROJECT' } })
      .then(Boolean);

    const readiness = this.readinessService.calculate({
      coreSkills: careerProfile.coreSkills,
      skills: aggregatedSkills,
      hasProjectEvidence,
    });

    const masteryRecords = await this.prisma.masteryRecord.findMany({
      where: { studentId },
      include: { learningOutcome: { select: { title: true } } },
      orderBy: { calculatedAt: 'desc' },
      take: 10,
    });

    const sorted = [...aggregatedSkills].sort((a, b) => b.score - a.score);
    const coreSkills = careerProfile.coreSkills;
    const skillGaps = coreSkills.filter(
      (s) => !aggregatedSkills.some((sk) => sk.skill === s && sk.score >= 60),
    );

    return ai.suggestNextStep(
      {
        targetRole: careerProfile.targetRole,
        readinessLevel: readiness.level,
        coreSkillsCovered: readiness.coreSkillsCovered,
        coreSkillsTotal: readiness.coreSkillsTotal,
        strongestSkills: sorted.slice(0, 3),
        skillGaps,
        hasProjectEvidence,
        verifiedEvidenceCount: readiness.verifiedEvidenceCount,
        recentMasteryTitles: masteryRecords
          .slice(0, 5)
          .map((r) => r.learningOutcome.title),
      },
      userId,
    );
  }

  async explainSkillGap(studentId: string, skill: string, userId: string, ai: AiCareerService) {
    const careerProfile = await this.prisma.careerProfile.findUnique({ where: { studentId } });
    if (!careerProfile) throw new NotFoundException('Career profile not found.');

    const evidence = await this.prisma.skillEvidence.findMany({
      where: { studentId, skill },
      orderBy: { score: 'desc' },
      take: 1,
    });

    const masteryRecords = await this.prisma.masteryRecord.findMany({
      where: { studentId },
      include: { learningOutcome: { select: { title: true } } },
      orderBy: { calculatedAt: 'desc' },
      take: 20,
    });

    return ai.explainSkillGap(
      {
        skill,
        targetRole: careerProfile.targetRole,
        currentScore: evidence[0] ? Number(evidence[0].score) : null,
        relatedMasteryTitles: masteryRecords.map((r) => r.learningOutcome.title),
      },
      userId,
    );
  }

  async draftProfessorRecommendation(
    professorId: string,
    studentId: string,
    userId: string,
    ai: AiCareerService,
  ) {
    void professorId;
    const consent = await this.prisma.consent.findUnique({ where: { studentId } });
    if (!consent?.professorReferralAllowed) {
      throw new ForbiddenException('Student has not granted professor referral permission.');
    }

    const [careerProfile, aggregatedSkills, masteryRecords, studentUser] = await Promise.all([
      this.prisma.careerProfile.findUnique({ where: { studentId } }),
      this.skillEvidenceService.aggregateStudentSkills(studentId),
      this.prisma.masteryRecord.findMany({
        where: { studentId },
        include: { learningOutcome: { select: { title: true } } },
        orderBy: { calculatedAt: 'desc' },
        take: 20,
      }),
      this.prisma.studentProfile.findUnique({
        where: { id: studentId },
        include: { user: { select: { name: true } } },
      }),
    ]);

    if (!careerProfile) throw new NotFoundException('Student has no career profile.');

    const hasProjectEvidence = await this.prisma.skillEvidence
      .findFirst({ where: { studentId, sourceType: 'PROJECT' } })
      .then(Boolean);

    const readiness = this.readinessService.calculate({
      coreSkills: careerProfile.coreSkills,
      skills: aggregatedSkills,
      hasProjectEvidence,
    });

    const coreSkills = careerProfile.coreSkills;
    const skillGaps = coreSkills.filter(
      (s) => !aggregatedSkills.some((sk) => sk.skill === s && sk.score >= 60),
    );

    // Deduplicate mastery outcomes
    const seenOutcomes = new Set<string>();
    const uniqueMastery = masteryRecords
      .filter((r) => {
        if (seenOutcomes.has(r.learningOutcomeId)) return false;
        seenOutcomes.add(r.learningOutcomeId);
        return true;
      })
      .slice(0, 6)
      .map((r) => ({
        title: r.learningOutcome.title,
        percentage: Number(r.percentage),
        status: r.status,
      }));

    return ai.draftProfessorRecommendation(
      {
        studentName: studentUser?.user.name ?? 'Student',
        targetRole: careerProfile.targetRole,
        readinessLevel: readiness.level,
        masteryOutcomes: uniqueMastery,
        verifiedSkills: aggregatedSkills.filter((s) => s.professorVerified),
        projectEvidence: hasProjectEvidence,
        skillGaps,
        coreSkillsCovered: readiness.coreSkillsCovered,
        coreSkillsTotal: readiness.coreSkillsTotal,
      },
      userId,
    );
  }
}
