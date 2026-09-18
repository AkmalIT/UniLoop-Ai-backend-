import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, TargetRole } from "@prisma/client";
import { createHash } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { CareerReadinessService } from "../career/career-readiness.service";
import { ROLE_CORE_SKILLS } from "../career/skill-map.constants";
import { AiCareerService } from "../career/ai/ai-career.service";
import { AcademicService } from "./academic.service";
import {
  EndorsementDecisionDto,
  EndorsementDto,
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
  roleIds,
  roleLabels,
  slug,
  summary,
} from "./public-mappers";

@Injectable()
export class CareerApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly academic: AcademicService,
    private readonly readiness: CareerReadinessService,
    private readonly ai?: AiCareerService,
  ) {}
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
      targetRole: goal.targetRole,
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
      targetRole: goal.targetRole,
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
      targetRole: profile.targetRole,
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
    const gaps = ROLE_CORE_SKILLS[profile.targetRole]
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
        targetRole: roleLabels[profile.targetRole],
        targetRoleId: roleIds[profile.targetRole],
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
    const targetRole = input.targetRoleId
      ? (Object.keys(roleIds) as TargetRole[]).find(
          (role) => roleIds[role] === input.targetRoleId,
        )
      : undefined;
    if (input.targetRoleId && !targetRole)
      throw new BadRequestException("Unknown target role");
    await this.prisma.$transaction(async (tx) => {
      if (targetRole)
        await tx.careerProfile.upsert({
          where: { studentId },
          create: { studentId, targetRole, interests: input.interests ?? [] },
          update: { targetRole, interests: input.interests },
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
    return (await this.profile(studentId)).profile;
  }
  async recommendations(studentId: string) {
    const { profile, gaps } = await this.profile(studentId);
    const opportunities = await this.prisma.opportunity.findMany({
      orderBy: { createdAt: "asc" },
    });
    const visible = [];
    for (const opportunity of opportunities) {
      if (opportunity.type === "PERSON" && !profile.consent.peerRecommendations)
        continue;
      if (opportunity.relatedUserId) {
        const peer = await this.prisma.studentProfile.findUnique({
          where: { userId: opportunity.relatedUserId },
          include: { consent: true },
        });
        if (!peer?.consent?.networkingVisible) continue;
      }
      const skillIds = opportunity.requiredSkills.map(slug);
      const gapSkillIds = opportunity.gapSkills.map(slug);
      const demonstratedSkills = skillIds.length
        ? average(
            skillIds.map(
              (id) =>
                profile.skills.find((skill) => skill.skillId === id)
                  ?.percentage ?? 0,
            ),
          )
        : 0;
      const matching = {
        targetRoleAlignment: opportunity.targetRoleIds.includes(
          profile.targetRoleId,
        )
          ? 100
          : 0,
        demonstratedSkills,
        missingSkillRelevance: gaps.length
          ? percent(
              (gaps.filter((gap) =>
                [...skillIds, ...gapSkillIds].includes(gap.skillId),
              ).length /
                gaps.length) *
                100,
            )
          : 0,
        collaborationFit:
          opportunity.collaborative && profile.consent.peerRecommendations
            ? 100
            : 0,
        evidenceStrength: profile.skills.length
          ? percent(
              (profile.skills.filter((skill) =>
                skill.sources.some(
                  (source) => source.verification === "VERIFIED",
                ),
              ).length /
                profile.skills.length) *
                100,
            )
          : 0,
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
      const recommendation = await this.prisma.matchRecommendation.upsert({
        where: {
          studentId_opportunityId: { studentId, opportunityId: opportunity.id },
        },
        create: {
          studentId,
          opportunityId: opportunity.id,
          matchScore: new Prisma.Decimal(matching.weightedTotal),
          matchedSkills: skillIds.filter((id) =>
            profile.skills.some(
              (skill) => skill.skillId === id && skill.percentage >= 60,
            ),
          ),
          missingSkills: skillIds.filter(
            (id) =>
              !profile.skills.some(
                (skill) => skill.skillId === id && skill.percentage >= 60,
              ),
          ),
        },
        update: { matchScore: new Prisma.Decimal(matching.weightedTotal) },
      });
      visible.push({
        id: recommendation.id,
        studentId,
        opportunity: {
          id: opportunity.id,
          type: opportunityTypes[opportunity.type],
          title: opportunity.title,
          description: opportunity.description,
          targetRoleIds: opportunity.targetRoleIds,
          skillIds,
          gapSkillIds,
          collaborative: opportunity.collaborative,
          relatedUserId: opportunity.relatedUserId,
        },
        matching,
        explanation,
        status: recommendationStates[recommendation.status],
      });
    }
    return visible.sort(
      (a, b) => b.matching.weightedTotal - a.matching.weightedTotal,
    );
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
