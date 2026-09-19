import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { CareerReadinessService } from "../career/career-readiness.service";
import { AiCareerService } from "../career/ai/ai-career.service";
import { AcademicService } from "./academic.service";
import { JobSearchService } from "./job-search.service";
import {
  EndorsementDecisionDto,
  EndorsementDto,
  ClubDto,
  ProfileDto,
  RecommendationDto,
} from "./integration.dto";
import {
  average,
  endorsementDatabase,
  endorsementDto,
  opportunityTypes,
  percent,
  readinessStates,
  recommendationDatabase,
  recommendationStates,
  slug,
  summary,
} from "./public-mappers";

type PublicOpportunityType =
  (typeof opportunityTypes)[keyof typeof opportunityTypes];

type RecommendationCandidate = {
  opportunityId: string;
  opportunity: {
    id: string;
    type: PublicOpportunityType;
    title: string;
    description: string;
    targetRoleIds: string[];
    skillIds: string[];
    gapSkillIds: string[];
    collaborative: boolean;
    relatedUserId: string | null;
    source: string | null;
    sourceUrl: string | null;
    clubMember: boolean;
  };
  matching: {
    targetRoleAlignment: number;
    demonstratedSkills: number;
    missingSkillRelevance: number;
    collaborationFit: number;
    evidenceStrength: number;
    weightedTotal: number;
  };
  matchedSkills: string[];
  missingSkills: string[];
  explanation: string;
};

@Injectable()
export class CareerApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly academic: AcademicService,
    private readonly readiness: CareerReadinessService,
    private readonly ai?: AiCareerService,
    private readonly jobSearch?: JobSearchService,
  ) {}
  /**
   * A transparent, deterministic readiness calculation. AI may explain this
   * output elsewhere, but never contributes to these scores or the stage.
   */
  async progress(user: AuthenticatedUser) {
    const studentId = await this.academic.profile(user);
    const [records, evidence, career, plans, consent] = await Promise.all([
      this.prisma.masteryRecord.findMany({
        where: { studentId },
        include: {
          course: { select: { id: true, title: true, code: true } },
          learningOutcome: { select: { id: true, title: true } },
          assessment: { select: { id: true, title: true, type: true } },
        },
        orderBy: { calculatedAt: 'desc' },
      }),
      this.prisma.skillEvidence.findMany({ where: { studentId } }),
      this.prisma.careerProfile.findUnique({ where: { studentId } }),
      this.prisma.learningPlan.findMany({
        where: { studentId },
        include: { tasks: true },
      }),
      this.prisma.consent.findUnique({ where: { studentId } }),
    ]);
    const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
    const averageMastery = records.length
      ? records.reduce((total, record) => total + Number(record.percentage), 0) / records.length
      : 0;
    const verified = evidence.filter((item) => item.professorVerified).length;
    const projects = evidence.filter((item) => item.sourceType === 'PROJECT').length;
    const coreSkills = career?.coreSkills ?? [];
    const demonstrated = new Set(
      evidence.filter((item) => Number(item.score) >= 60).map((item) => item.skill.toLowerCase()),
    );
    const aligned = coreSkills.length
      ? coreSkills.filter((skill) => demonstrated.has(skill.toLowerCase())).length / coreSkills.length
      : 0;
    const completedTasks = plans.flatMap((plan) => plan.tasks).filter((task) => task.completedAt !== null).length;
    const allTasks = plans.flatMap((plan) => plan.tasks).length;
    const profileCompleteness = career
      ? [career.targetRole, career.interests.length > 0, career.coreSkills.length > 0]
          .filter(Boolean).length / 3
      : 0;
    const factors = [
      { key: 'academicMastery', label: 'Akademik mastery', weight: 35, score: clamp(averageMastery), evidence: records.length ? `${records.length} ta baholash natijasi` : 'Baholash dalili yo‘q' },
      { key: 'verifiedSkills', label: 'Tasdiqlangan ko‘nikmalar', weight: 20, score: clamp(verified * 50), evidence: verified ? `${verified} ta professor tasdiqlagan dalil` : 'Professor tasdiqlagan dalil yo‘q' },
      { key: 'projects', label: 'Amaliy loyiha dalillari', weight: 15, score: clamp(projects * 50), evidence: projects ? `${projects} ta loyiha dalili` : 'Loyiha dalili yo‘q' },
      { key: 'profileCompleteness', label: 'Kasbiy profil to‘liqligi', weight: 10, score: clamp(profileCompleteness * 100), evidence: career ? 'Maqsad, qiziqish va asosiy ko‘nikmalar tekshirildi' : 'Kasbiy profil yaratilmagan' },
      { key: 'goalAlignment', label: 'Kasbiy maqsadga moslik', weight: 10, score: clamp(aligned * 100), evidence: coreSkills.length ? `${Math.round(aligned * coreSkills.length)}/${coreSkills.length} asosiy ko‘nikma namoyon bo‘lgan` : 'Kasbiy maqsad uchun ko‘nikmalar belgilanmagan' },
      { key: 'learningPlanActivity', label: 'O‘quv rejasi faolligi', weight: 5, score: allTasks ? clamp((completedTasks / allTasks) * 100) : 0, evidence: allTasks ? `${completedTasks}/${allTasks} vazifa bajarilgan` : 'O‘quv rejasi vazifalari yo‘q' },
      { key: 'endorsementReadiness', label: 'Tavsiyanomaga tayyorgarlik', weight: 5, score: consent?.professorReferralAllowed && verified > 0 ? 100 : 0, evidence: consent?.professorReferralAllowed ? 'Professor ko‘rib chiqishiga rozilik berilgan' : 'Professor ko‘rib chiqishiga rozilik berilmagan' },
    ];
    const score = clamp(factors.reduce((total, factor) => total + (factor.weight * factor.score) / 100, 0));
    const stage = score >= 80 ? 'JUNIOR_READY' : score >= 65 ? 'INTERNSHIP_READY' : score >= 45 ? 'PROJECT_READY' : 'FOUNDATION';
    const courseMap = new Map<string, { id: string; title: string; code: string; values: number[] }>();
    for (const record of records) {
      const course = courseMap.get(record.courseId) ?? { ...record.course, values: [] };
      course.values.push(Number(record.percentage));
      courseMap.set(record.courseId, course);
    }
    return {
      academic: {
        courses: [...courseMap.values()].map((course) => ({ ...course, mastery: clamp(course.values.reduce((sum, value) => sum + value, 0) / course.values.length) })),
        outcomes: records.slice(0, 30).map((record) => ({ id: record.id, courseId: record.courseId, courseTitle: record.course.title, outcomeTitle: record.learningOutcome.title, percentage: Number(record.percentage), assessmentType: record.assessment.type, assessmentTitle: record.assessment.title, recordedAt: record.calculatedAt.toISOString() })),
        nextAction: records.length ? 'Eng past mastery natijasiga tegishli mashqlarni bajaring.' : 'Kurs baholashini yakunlab, dastlabki dalil yarating.',
      },
      readiness: { score, stage, factors, nextAction: factors.find((factor) => factor.score < 60)?.evidence ?? 'Dalillaringizni amaliy loyiha bilan mustahkamlang.' },
    };
  }
  async nextStep(user: AuthenticatedUser) {
    const studentId = await this.academic.profile(user);
    const { profile, gaps } = await this.profile(studentId);
    const goal = await this.prisma.careerProfile.findUniqueOrThrow({
      where: { studentId },
    });
    const skills = profile.skills.map((skill) => ({
      skill: skill.label,
      score: skill.percentage,
      professorVerified: skill.sources.some(
        (source) => source.verification === "VERIFIED",
      ),
    }));
    const hasProjectEvidence = !!(await this.prisma.skillEvidence.findFirst({
      where: { studentId, sourceType: "PROJECT" },
    }));
    const readiness = this.readiness.calculate({
      coreSkills: goal.coreSkills,
      skills,
      hasProjectEvidence,
    });
    return this.ai!.suggestNextStep(
      {
        targetRole: goal.targetRole,
        readinessLevel: readiness.level,
        coreSkillsCovered: readiness.coreSkillsCovered,
        coreSkillsTotal: readiness.coreSkillsTotal,
        strongestSkills: [...skills]
          .sort((a, b) => b.score - a.score)
          .slice(0, 3),
        skillGaps: gaps.map((gap) => gap.label),
        hasProjectEvidence,
        verifiedEvidenceCount: readiness.verifiedEvidenceCount,
        recentMasteryTitles: [],
      },
      user.id,
    );
  }
  async explain(user: AuthenticatedUser, id: string) {
    const studentId = await this.academic.profile(user);
    const recommendation = (await this.recommendations(studentId)).find(
      (record) => record.id === id,
    );
    if (!recommendation) throw new NotFoundException();
    const { profile } = await this.profile(studentId);
    const goal = await this.prisma.careerProfile.findUniqueOrThrow({
      where: { studentId },
    });
    return this.ai!.explainOpportunity(
      {
        targetRole: goal.targetRole,
        opportunityType: recommendation.opportunity.type,
        opportunityTitle: recommendation.opportunity.title,
        opportunityDescription: recommendation.opportunity.description,
        requiredSkills: recommendation.opportunity.skillIds,
        matchScore: recommendation.matching.weightedTotal,
        matchedSkills: recommendation.opportunity.skillIds.filter((id) =>
          profile.skills.some(
            (skill) => skill.skillId === id && skill.percentage >= 60,
          ),
        ),
        missingSkills: recommendation.opportunity.skillIds.filter(
          (id) =>
            !profile.skills.some(
              (skill) => skill.skillId === id && skill.percentage >= 60,
            ),
        ),
        verifiedSkills: profile.skills
          .filter((skill) =>
            skill.sources.some((source) => source.verification === "VERIFIED"),
          )
          .map((skill) => skill.label),
      },
      user.id,
    );
  }
  async explainGap(user: AuthenticatedUser, skillId: string) {
    const studentId = await this.academic.profile(user);
    const { profile, gaps } = await this.profile(studentId);
    const gap = gaps.find((gap) => gap.skillId === skillId);
    if (!gap) throw new NotFoundException();
    const goal = await this.prisma.careerProfile.findUniqueOrThrow({
      where: { studentId },
    });
    return this.ai!.explainSkillGap(
      {
        skill: gap.label,
        targetRole: goal.targetRole,
        currentScore:
          profile.skills.find((skill) => skill.skillId === skillId)
            ?.percentage ?? null,
        relatedMasteryTitles: [],
      },
      user.id,
    );
  }
  async draft(user: AuthenticatedUser, studentId: string) {
    const evidence = await this.evidence(user, studentId);
    const goal = await this.prisma.careerProfile.findUniqueOrThrow({
      where: { studentId },
    });
    const skills = evidence.technicalSkills.map((skill) => ({
      skill: skill.label,
      score: skill.percentage,
      professorVerified: skill.sources.some(
        (source) => source.verification === "VERIFIED",
      ),
    }));
    const hasProjectEvidence = !!(await this.prisma.skillEvidence.findFirst({
      where: { studentId, sourceType: "PROJECT" },
    }));
    const readiness = this.readiness.calculate({
      coreSkills: goal.coreSkills,
      skills,
      hasProjectEvidence,
    });
    const outcomes = await this.prisma.learningOutcome.findMany({
      where: {
        id: {
          in: evidence.academic.flatMap((course) =>
            course.outcomes.map((outcome) => outcome.outcomeId),
          ),
        },
      },
    });
    return this.ai!.draftProfessorRecommendation(
      {
        studentName: evidence.student.fullName,
        targetRole: goal.targetRole,
        readinessLevel: readiness.level,
        masteryOutcomes: evidence.academic.flatMap((course) =>
          course.outcomes
            .filter((outcome) => outcome.evidence.length)
            .map((outcome) => ({
              title:
                outcomes.find((item) => item.id === outcome.outcomeId)?.title ??
                "",
              percentage: outcome.percentage,
              status: outcome.level,
            })),
        ),
        verifiedSkills: skills.filter((skill) => skill.professorVerified),
        projectEvidence: hasProjectEvidence,
        skillGaps: evidence.gaps.map((gap) => gap.label),
        coreSkillsCovered: readiness.coreSkillsCovered,
        coreSkillsTotal: readiness.coreSkillsTotal,
      },
      user.id,
    );
  }
  async profile(studentId: string) {
    const [profile, evidence, consent] = await Promise.all([
      this.prisma.careerProfile.findUnique({ where: { studentId } }),
      this.prisma.skillEvidence.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.consent.findUnique({ where: { studentId } }),
    ]);
    if (!profile) throw new NotFoundException("Set a career goal first");
    const bySkill = new Map<string, typeof evidence>();
    for (const item of evidence)
      bySkill.set(item.skill, [...(bySkill.get(item.skill) ?? []), item]);
    const skills = [...bySkill].map(([skill, entries]) => ({
      skillId: slug(skill),
      label: skill,
      percentage: average(entries.map((item) => Number(item.score))),
      sources: entries.map((item) => ({
        id: item.id,
        type:
          item.sourceType === "ASSESSMENT_MASTERY"
            ? ("ASSESSMENT" as const)
            : item.sourceType === "PROFESSOR_VERIFICATION"
              ? ("PROFESSOR_VERIFICATION" as const)
              : ("PROJECT" as const),
        verification: item.professorVerified
          ? ("VERIFIED" as const)
          : ("UNVERIFIED" as const),
        recordedAt: item.createdAt.toISOString(),
      })),
    }));
    const stage = this.readiness.calculate({
      coreSkills: profile.coreSkills,
      hasProjectEvidence: evidence.some(
        (item) => item.sourceType === "PROJECT",
      ),
      skills: skills.map((skill) => ({
        skill: skill.label,
        score: skill.percentage,
        professorVerified: skill.sources.some(
          (source) => source.verification === "VERIFIED",
        ),
      })),
    });
    const gaps = profile.coreSkills
      .filter(
        (skill) =>
          !skills.some((item) => item.label === skill && item.percentage >= 60),
      )
      .map((skill) => ({
        skillId: slug(skill),
        label: skill,
        reason: "Bu yo‘nalish uchun kamida 60 foizlik dalil zarur.",
        requiredEvidence: "Baholash yoki tekshirilgan amaliy loyiha dalili",
      }));
    // The old schema records project skill references, not project descriptions/collaboration.
    // Do not fabricate project artifacts from those references.
    return {
      profile: {
        studentId,
        targetRole: profile.targetRole,
        targetRoleId: slug(profile.targetRole),
        interests: profile.interests,
        readinessStage: readinessStates[stage.level],
        skills,
        consent: {
          discoverable: consent?.networkingVisible ?? false,
          peerRecommendations: consent?.peerRecommendations ?? false,
          professorEvidenceReview: consent?.professorReferralAllowed ?? false,
        },
      },
      gaps,
      projects: [],
    };
  }
  async updateProfile(user: AuthenticatedUser, input: ProfileDto) {
    const studentId = await this.academic.profile(user);
    if ((input.targetRole === undefined) !== (input.targetRoleId === undefined))
      throw new BadRequestException("Supply role label and ID together");
    const targetRole = input.targetRole?.trim();
    const analysis = targetRole
      ? await this.analyzeUpdatedDirection(studentId, targetRole, input.interests)
      : undefined;
    await this.prisma.$transaction(async (tx) => {
      if (targetRole)
        await tx.careerProfile.upsert({
          where: { studentId },
          create: {
            studentId,
            targetRole: analysis!.targetRole,
            coreSkills: analysis!.coreSkills,
            vacancyQueries: analysis!.vacancyQueries,
            interests: input.interests ?? [],
          },
          update: {
            targetRole: analysis!.targetRole,
            coreSkills: analysis!.coreSkills,
            vacancyQueries: analysis!.vacancyQueries,
            interests: input.interests,
          },
        });
      else if (input.interests)
        await tx.careerProfile.updateMany({
          where: { studentId },
          data: { interests: input.interests },
        });
      if (input.consent)
        await tx.consent.upsert({
          where: { studentId },
          create: {
            studentId,
            networkingVisible: input.consent.discoverable,
            peerRecommendations: input.consent.peerRecommendations,
            professorReferralAllowed: input.consent.professorEvidenceReview,
          },
          update: {
            networkingVisible: input.consent.discoverable,
            peerRecommendations: input.consent.peerRecommendations,
            professorReferralAllowed: input.consent.professorEvidenceReview,
          },
        });
      await tx.matchRecommendation.updateMany({
        where: { studentId },
        data: { explanationUz: null, nextActionUz: null },
      });
    });
    // Gemini chooses role-specific search phrases; HH is queried only with role/interests,
    // never with the student's name, email, grades, or other personal data.
    const saved = await this.prisma.careerProfile.findUniqueOrThrow({ where: { studentId } });
    await this.jobSearch?.refreshForProfile({
      targetRole: saved.targetRole,
      interests: saved.interests,
      coreSkills: saved.coreSkills,
      vacancyQueries: saved.vacancyQueries,
      userId: user.id,
    });
    return (await this.profile(studentId)).profile;
  }

  private async analyzeUpdatedDirection(
    studentId: string,
    statedDirection: string,
    interests?: string[],
  ) {
    const [student, evidence] = await Promise.all([
      this.prisma.studentProfile.findUnique({ where: { id: studentId } }),
      this.prisma.skillEvidence.findMany({ where: { studentId }, select: { skill: true } }),
    ]);
    const fallback = {
      targetRole: statedDirection,
      coreSkills: [...new Set(evidence.map((item) => item.skill))].slice(0, 6),
      vacancyQueries: [statedDirection],
    };
    if (!this.ai) return fallback;
    return this.ai.analyzeCareerProfile({
      statedDirection,
      major: student?.major ?? "ko'rsatilmagan",
      interests: interests ?? [],
      skills: evidence.map((item) => item.skill),
    });
  }
  async recommendations(studentId: string) {
    const { profile, gaps } = await this.profile(studentId);
    const opportunities = await this.prisma.opportunity.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        clubMemberships: {
          where: { studentId },
          select: { id: true },
        },
      },
    });
    // Resolve every peer privacy setting in one query. The prior implementation
    // performed one profile lookup per opportunity and one upsert per match,
    // which made opening the opportunities dashboard scale linearly in round
    // trips as the catalogue grew.
    const relatedUserIds = [
      ...new Set(
        opportunities
          .map((opportunity) => opportunity.relatedUserId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const relatedProfiles = relatedUserIds.length
      ? await this.prisma.studentProfile.findMany({
          where: { userId: { in: relatedUserIds } },
          include: { consent: true },
        })
      : [];
    const networkingVisibleByUserId = new Map(
      relatedProfiles.map((peer) => [
        peer.userId,
        peer.consent?.networkingVisible ?? false,
      ]),
    );
    const skillById = new Map(
      profile.skills.map((skill) => [skill.skillId, skill]),
    );
    const profileSkillIds = new Set(skillById.keys());
    const gapSkillIds = new Set(gaps.map((gap) => gap.skillId));
    const evidenceStrength = profile.skills.length
      ? percent(
          (profile.skills.filter((skill) =>
            skill.sources.some((source) => source.verification === "VERIFIED"),
          ).length /
            profile.skills.length) *
            100,
        )
      : 0;
    const visible: RecommendationCandidate[] = [];
    for (const opportunity of opportunities) {
      if (opportunity.type === "PERSON" && !profile.consent.peerRecommendations)
        continue;
      if (
        opportunity.type === "CLUB" &&
        opportunity.approvalStatus !== "APPROVED"
      )
        continue;
      if (opportunity.relatedUserId) {
        if (!networkingVisibleByUserId.get(opportunity.relatedUserId)) continue;
      }
      const skillIds = opportunity.requiredSkills.map(slug);
      const opportunityGapSkillIds = opportunity.gapSkills.map(slug);
      const directionMatches = opportunity.targetRoleIds.includes(
        profile.targetRoleId,
      );
      const isExternalOpportunity = Boolean(opportunity.source);
      const hasDeclaredAudience = opportunity.targetRoleIds.length > 0;
      // Records without a source or a declared audience are legacy/demo data.
      // They must not be offered merely because a generic skill overlaps.
      if (!isExternalOpportunity && !hasDeclaredAudience) continue;
      // An entry assigned to another direction is not a role-specific match,
      // even when it shares a transferable skill with the student's profile.
      if (hasDeclaredAudience && !directionMatches) continue;
      const skillMatches = [...skillIds, ...opportunityGapSkillIds].some(
        (skillId) => profileSkillIds.has(skillId) || gapSkillIds.has(skillId),
      );
      // External vacancies can be matched by extracted skills; catalog entries
      // have already passed the stricter direction check above.
      if (!directionMatches && !skillMatches) continue;
      const demonstratedSkills = skillIds.length
        ? average(
            skillIds.map(
              (id) => skillById.get(id)?.percentage ?? 0,
            ),
          )
        : 0;
      const matching = {
        targetRoleAlignment: directionMatches ? 100 : 0,
        demonstratedSkills,
        missingSkillRelevance: gaps.length
          ? percent(
              (gaps.filter((gap) =>
                [...skillIds, ...opportunityGapSkillIds].includes(gap.skillId),
              ).length /
                gaps.length) *
                100,
            )
          : 0,
        collaborationFit:
          opportunity.collaborative && profile.consent.peerRecommendations
            ? 100
            : 0,
        evidenceStrength,
        weightedTotal: 0,
      };
      matching.weightedTotal = percent(
        matching.targetRoleAlignment * 0.3 +
          matching.demonstratedSkills * 0.25 +
          matching.missingSkillRelevance * 0.2 +
          matching.collaborationFit * 0.15 +
          matching.evidenceStrength * 0.1,
      );
      const explanation = `Yo‘nalish mosligi: ${matching.targetRoleAlignment}%. Ko‘nikma dalillari: ${matching.demonstratedSkills}%. Yakuniy moslik deterministik hisoblandi.`;
      visible.push({
        opportunityId: opportunity.id,
        opportunity: {
          id: opportunity.id,
          type: opportunityTypes[opportunity.type],
          title: opportunity.title,
          description: opportunity.description,
          targetRoleIds: opportunity.targetRoleIds,
          skillIds,
          gapSkillIds: opportunityGapSkillIds,
          collaborative: opportunity.collaborative,
          relatedUserId: opportunity.relatedUserId,
          source: opportunity.source,
          sourceUrl: opportunity.sourceUrl,
          clubMember: opportunity.clubMemberships.length > 0,
        },
        matching,
        matchedSkills: skillIds.filter(
          (id) => (skillById.get(id)?.percentage ?? 0) >= 60,
        ),
        missingSkills: skillIds.filter(
          (id) => (skillById.get(id)?.percentage ?? 0) < 60,
        ),
        explanation,
      });
    }
    if (!visible.length) return [];

    // A single createMany persists first-time recommendation state. The match
    // itself remains recalculated from trusted evidence above on every request;
    // existing state (saved/dismissed/interested) is deliberately preserved.
    await this.prisma.matchRecommendation.createMany({
      data: visible.map((candidate) => ({
        studentId,
        opportunityId: candidate.opportunityId,
        matchScore: new Prisma.Decimal(candidate.matching.weightedTotal),
        matchedSkills: candidate.matchedSkills,
        missingSkills: candidate.missingSkills,
      })),
      skipDuplicates: true,
    });
    const records = await this.prisma.matchRecommendation.findMany({
      where: {
        studentId,
        opportunityId: { in: visible.map((candidate) => candidate.opportunityId) },
      },
      select: { id: true, opportunityId: true, status: true },
    });
    const recordByOpportunityId = new Map(
      records.map((record) => [record.opportunityId, record]),
    );
    return visible
      .flatMap((candidate) => {
        const record = recordByOpportunityId.get(candidate.opportunityId);
        return record
          ? [{
              id: record.id,
              studentId,
              opportunity: candidate.opportunity,
              matching: candidate.matching,
              explanation: candidate.explanation,
              status: recommendationStates[record.status],
            }]
          : [];
      })
      .sort((a, b) => b.matching.weightedTotal - a.matching.weightedTotal);
  }
  async dashboard(user: AuthenticatedUser) {
    const studentId = await this.academic.profile(user);
    const data = await this.profile(studentId);
    const [recommendations, endorsements, professors] = await Promise.all([
      this.recommendations(studentId),
      this.prisma.professorEndorsement.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.professorProfile.findMany({
        where: { courses: { some: { enrollments: { some: { studentId } } } } },
        include: { user: { select: { name: true } } },
      }),
    ]);
    return {
      ...data,
      recommendations,
      endorsementRequests: endorsements.map(endorsementDto),
      availableProfessors: professors.map((professor) => ({
        id: professor.id,
        fullName: professor.user.name,
      })),
    };
  }
  async updateRecommendation(
    user: AuthenticatedUser,
    id: string,
    input: RecommendationDto,
  ) {
    const studentId = await this.academic.profile(user);
    const recommendation = (await this.recommendations(studentId)).find(
      (record) => record.id === id,
    );
    if (!recommendation) throw new NotFoundException();
    await this.prisma.matchRecommendation.update({
      where: { id },
      data: { status: recommendationDatabase[input.status] },
    });
    return { ...recommendation, status: input.status };
  }
  async createClub(user: AuthenticatedUser, input: ClubDto) {
    const studentId = await this.academic.profile(user);
    const title = input.title.trim();
    const description = input.description.trim();
    const topic = input.topic.trim();
    if (!title || !description || !topic)
      throw new BadRequestException("Club title, description and topic are required");
    const analysis = await this.analyzeUpdatedDirection(studentId, topic, []);
    const requiredSkills = [
      ...new Set([
        ...analysis.coreSkills,
        ...(input.skills ?? []).map((skill) => skill.trim()).filter(Boolean),
      ]),
    ].slice(0, 12);
    const opportunity = await this.prisma.opportunity.create({
      data: {
        type: "CLUB",
        title,
        description,
        requiredSkills,
        targetRoleIds: [...new Set([slug(topic), slug(analysis.targetRole)])],
        collaborative: true,
        relatedUserId: user.id,
        source: "STUDENT_CLUB",
        creatorStudentId: studentId,
        approvalStatus: "PENDING",
        clubMemberships: { create: { studentId, role: "OWNER" } },
      },
    });
    return {
      id: opportunity.id,
      title: opportunity.title,
      topic,
      requiredSkills: opportunity.requiredSkills,
    };
  }
  async clubs(user: AuthenticatedUser) {
    const studentId = await this.academic.profile(user);
    const clubs = await this.prisma.opportunity.findMany({
      where: {
        type: "CLUB",
        OR: [
          { approvalStatus: "APPROVED" },
          { creatorStudentId: studentId },
        ],
      },
      include: {
        creatorStudent: { include: { user: { select: { name: true } } } },
        clubMemberships: { where: { studentId }, select: { role: true } },
        _count: { select: { clubMemberships: true } },
      },
      orderBy: [{ approvalStatus: "asc" }, { createdAt: "desc" }],
    });
    return clubs.map((club) => ({
      id: club.id,
      title: club.title,
      description: club.description,
      skills: club.requiredSkills,
      location: club.location,
      status: club.approvalStatus,
      creatorName: club.creatorStudent?.user.name ?? "UniLoop hamjamiyati",
      memberCount: club._count.clubMemberships,
      membershipRole: club.clubMemberships[0]?.role ?? null,
      mayJoin: club.approvalStatus === "APPROVED" && !club.clubMemberships.length,
      submittedAt: club.submittedAt.toISOString(),
    }));
  }
  async joinClub(user: AuthenticatedUser, opportunityId: string) {
    const studentId = await this.academic.profile(user);
    const membership = await this.prisma.$transaction(async (tx) => {
      const club = await tx.opportunity.findFirst({
        where: { id: opportunityId, type: "CLUB", approvalStatus: "APPROVED" },
        select: { id: true },
      });
      if (!club) throw new NotFoundException("Approved club not found");
      const record = await tx.clubMembership.upsert({
        where: { opportunityId_studentId: { opportunityId, studentId } },
        create: { opportunityId, studentId },
        update: {},
      });
      await tx.matchRecommendation.updateMany({
        where: { studentId, opportunityId },
        data: { status: recommendationDatabase.ACCEPTED },
      });
      return record;
    });
    return {
      opportunityId,
      studentId,
      role: membership.role,
      joinedAt: membership.createdAt.toISOString(),
    };
  }
  async relationship(professorId: string, studentId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, course: { professorId } },
    });
    if (!enrollment) throw new ForbiddenException("No teaching relationship");
  }
  async request(user: AuthenticatedUser, input: EndorsementDto) {
    const studentId = await this.academic.profile(user);
    await this.relationship(input.professorId, studentId);
    const consent = await this.prisma.consent.findUnique({
      where: { studentId },
    });
    if (!consent?.professorReferralAllowed || !input.consentToReview)
      throw new ForbiddenException("Review consent required");
    const profile = await this.profile(studentId);
    if (input.targetRole !== profile.profile.targetRole)
      throw new BadRequestException("Target role must match current profile");
    if (
      input.opportunityId &&
      !(await this.recommendations(studentId)).some(
        (record) => record.opportunity.id === input.opportunityId,
      )
    )
      throw new NotFoundException();
    const pendingKey = createHash("sha256")
      .update(
        JSON.stringify([
          studentId,
          input.professorId,
          input.opportunityId ?? null,
          input.targetRole,
        ]),
      )
      .digest("hex");
    const evidence = await this.prisma.skillEvidence.findMany({
      where: { studentId },
    });
    const record = await this.prisma.professorEndorsement.upsert({
      where: { pendingKey },
      create: {
        studentId,
        professorId: input.professorId,
        opportunityId: input.opportunityId,
        targetRole: input.targetRole,
        consentToReview: true,
        pendingKey,
        history: [
          { status: "REQUESTED", recordedAt: new Date().toISOString() },
        ],
        items: { create: evidence.map((item) => ({ evidenceId: item.id })) },
      },
      update: {},
    });
    return endorsementDto(record);
  }
  async reviewAccess(professorId: string, studentId: string) {
    await this.relationship(professorId, studentId);
    const [consent, requests] = await Promise.all([
      this.prisma.consent.findUnique({ where: { studentId } }),
      this.prisma.professorEndorsement.findMany({
        where: { studentId, professorId, consentToReview: true },
      }),
    ]);
    if (!consent?.professorReferralAllowed || !requests.length)
      throw new ForbiddenException("Consent and request required");
    return requests;
  }
  async candidates(user: AuthenticatedUser) {
    const professorId = await this.academic.profile(user);
    const requests = await this.prisma.professorEndorsement.findMany({
      where: {
        professorId,
        consentToReview: true,
        student: {
          consent: { professorReferralAllowed: true },
          enrollments: { some: { course: { professorId } } },
        },
      },
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(
      requests.map(async (request) => {
        const { profile } = await this.profile(request.studentId);
        const enrollments = await this.prisma.enrollment.findMany({
          where: { studentId: request.studentId, course: { professorId } },
        });
        const mastery = await Promise.all(
          enrollments.map((enrollment) =>
            this.academic.studentMastery(
              request.studentId,
              enrollment.courseId,
            ),
          ),
        );
        return {
          student: summary(
            request.studentId,
            request.student.user.name,
            "STUDENT",
          ),
          request: endorsementDto(request),
          overallMasteryPercentage: average(
            mastery.map((course) => course.overallPercentage),
          ),
          readinessStage: profile.readinessStage,
        };
      }),
    );
  }
  async evidence(user: AuthenticatedUser, studentId: string) {
    const professorId = await this.academic.profile(user);
    const requests = await this.reviewAccess(professorId, studentId);
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        enrollments: { where: { course: { professorId } } },
      },
    });
    if (!student) throw new NotFoundException();
    const data = await this.profile(studentId);
    return {
      student: summary(studentId, student.user.name, "STUDENT"),
      targetRole: data.profile.targetRole,
      readinessStage: data.profile.readinessStage,
      gaps: data.gaps,
      aiSummary: `${data.profile.skills.length} ko‘nikma bo‘yicha dalil mavjud. Tavsiya professor qarorini almashtirmaydi.`,
      academic: await Promise.all(
        student.enrollments.map((enrollment) =>
          this.academic.studentMastery(studentId, enrollment.courseId),
        ),
      ),
      projects: data.projects,
      technicalSkills: data.profile.skills,
      collaborationEvidence: [],
      communicationEvidence: [],
      reviewConsent: true,
      requestIds: requests.map((request) => request.id),
    };
  }
  async decide(user: AuthenticatedUser, input: EndorsementDecisionDto) {
    const professorId = await this.academic.profile(user);
    return this.prisma.$transaction(async (tx) => {
      // Serialize decisions before reading status; concurrent reviewers cannot decide twice.
      await tx.$queryRaw`SELECT "id" FROM "ProfessorEndorsement" WHERE "id" = ${input.requestId} FOR UPDATE`;
      const request = await tx.professorEndorsement.findUnique({
        where: { id: input.requestId },
        include: { items: true },
      });
      if (!request) throw new NotFoundException();
      if (request.professorId !== professorId || !request.consentToReview)
        throw new ForbiddenException();
      // Lock consent while deciding so a completed withdrawal immediately denies future decisions.
      await tx.$queryRaw`SELECT "id" FROM "Consent" WHERE "studentId" = ${request.studentId} FOR UPDATE`;
      const consent = await tx.consent.findUnique({
        where: { studentId: request.studentId },
      });
      if (
        !consent?.professorReferralAllowed ||
        !(await tx.enrollment.findFirst({
          where: { studentId: request.studentId, course: { professorId } },
        }))
      )
        throw new ForbiddenException();
      if (request.status !== "PENDING")
        throw new BadRequestException("Request already decided");
      const record = await tx.professorEndorsement.update({
        where: { id: request.id },
        data: {
          status: endorsementDatabase[input.status],
          comment: input.feedback?.trim() || null,
          pendingKey: input.status === "APPROVED" ? request.pendingKey : null,
          history: [
            ...(Array.isArray(request.history) ? request.history : []),
            { status: input.status, recordedAt: new Date().toISOString() },
          ],
        },
      });
      if (input.status === "APPROVED")
        await tx.skillEvidence.updateMany({
          where: {
            id: { in: request.items.map((item) => item.evidenceId) },
            studentId: request.studentId,
          },
          data: { professorVerified: true },
        });
      return endorsementDto(record);
    });
  }
}
