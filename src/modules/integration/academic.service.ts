import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { MasteryService } from "../mastery/mastery.service";
import { AiCareerService } from "../career/ai/ai-career.service";
import { mapOutcomeToSkills } from "../career/skill-map.constants";
import {
  AnswersDto,
  CreateManagedCourseDto,
  EnrollmentRequestDecisionDto,
  InterventionDecisionDto,
  MaterialDto,
  UpdateManagedCourseDto,
} from "./integration.dto";
import { CourseAiService } from "./course-ai.service";
import {
  average,
  interventionStates,
  masteryLevels,
  percent,
  summary,
} from "./public-mappers";

const courseInclude = {
  professor: { include: { user: true } },
  enrollments: { include: { student: { include: { user: true } } } },
  learningOutcomes: { orderBy: { sortOrder: "asc" as const } },
  materials: true,
  modules: { include: { topics: { orderBy: { sortOrder: "asc" as const } } }, orderBy: { sortOrder: "asc" as const } },
  assessments: {
    include: {
      submissions: { select: { studentId: true } },
      _count: { select: { questions: true, submissions: true } },
    },
  },
} satisfies Prisma.CourseInclude;
const assessmentInclude = {
  questions: {
    orderBy: { sortOrder: "asc" as const },
    include: { outcomeLinks: true },
  },
  course: { include: { learningOutcomes: true } },
} satisfies Prisma.AssessmentInclude;
// Deliberately structural: these helpers are also exercised with safe fixtures.
type AssessmentRecord = any;

export function safeAssessment(record: AssessmentRecord) {
  if (
    record.type === "PRACTICE" ||
    record.questions.some(
      (question: any) => question.type === "CODE" || !question.outcomeLinks.length,
    )
  )
    throw new ServiceUnavailableException(
      "Assessment requires supported question configuration",
    );
  return {
    id: record.id,
    courseId: record.courseId,
    type: record.type,
    title: record.title,
    estimatedMinutes: Math.max(5, record.questions.length * 3),
    questions: record.questions.map((question: any) => ({
      id: question.id,
      outcomeId: question.outcomeLinks[0].learningOutcomeId,
      type: question.type,
      prompt: question.prompt,
      options: safeOptions(question.options),
    })),
  };
}
export function safeOptions(
  value: Prisma.JsonValue | null,
): { id: string; text: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((option) =>
    option &&
    typeof option === "object" &&
    !Array.isArray(option) &&
    typeof option.id === "string" &&
    typeof option.text === "string"
      ? [{ id: option.id, text: option.text }]
      : [],
  );
}
const normalize = (value: string) =>
  value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
export function gradeAnswers(record: AssessmentRecord, input: AnswersDto) {
  const seen = new Set(input.answers.map((answer) => answer.questionId));
  if (
    seen.size !== input.answers.length ||
    seen.size !== record.questions.length ||
    record.questions.some((question: any) => !seen.has(question.id))
  )
    throw new BadRequestException(
      "Provide each assessment question exactly once",
    );
  return record.questions.map((question: any) => {
    const answer = input.answers.find(
      (item) => item.questionId === question.id,
    )!;
    if (
      !question.correctAnswer ||
      question.type === "CODE" ||
      Number(question.maxScore) <= 0 ||
      Number(question.weight) < 0
    )
      throw new ServiceUnavailableException("Grading key unavailable");
    if (question.type === "MULTIPLE_CHOICE") {
      if (
        answer.answer !== undefined ||
        !answer.optionId ||
        !safeOptions(question.options).some(
          (option) => option.id === answer.optionId,
        )
      )
        throw new BadRequestException("Invalid choice");
    } else if (answer.optionId !== undefined || !answer.answer?.trim())
      throw new BadRequestException("Invalid short answer");
    const content = answer.optionId ?? answer.answer!;
    const correct = normalize(content) === normalize(question.correctAnswer);
    return {
      questionId: question.id,
      answer: content,
      score: correct ? Number(question.maxScore) : 0,
      correct,
    };
  });
}

@Injectable()
export class AcademicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly masteryCalculator: MasteryService,
    private readonly aiCareer?: AiCareerService,
    private readonly courseAi?: CourseAiService,
  ) {}

  async profile(user: AuthenticatedUser) {
    if (user.profileId) return user.profileId;
    const profile =
      user.role === "STUDENT"
        ? await this.prisma.studentProfile.findUnique({
            where: { userId: user.id },
          })
        : user.role === "PROFESSOR"
          ? await this.prisma.professorProfile.findUnique({
              where: { userId: user.id },
            })
          : null;
    if (!profile) throw new ForbiddenException();
    return profile.id;
  }
  async access(user: AuthenticatedUser, courseId: string) {
    const profileId = await this.profile(user);
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: courseInclude,
    });
    if (!course) throw new NotFoundException();
    if (
      user.role === "STUDENT"
        ? !course.enrollments.some(
            (enrollment) => enrollment.studentId === profileId,
          )
        : course.professorId !== profileId
    )
      throw new ForbiddenException();
    return { course, profileId };
  }
  async courses(user: AuthenticatedUser) {
    const id = await this.profile(user);
    const courses = await this.prisma.course.findMany({
      where:
        user.role === "STUDENT"
          ? { enrollments: { some: { studentId: id } } }
          : { professorId: id },
      include: {
        _count: { select: { enrollments: true, learningOutcomes: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return courses.map((course) => ({
      id: course.id,
      title: course.title,
      code: course.code,
      professorId: course.professorId,
      studentCount: course._count.enrollments,
      outcomeCount: course._count.learningOutcomes,
    }));
  }
  async createCourse(user: AuthenticatedUser, input: CreateManagedCourseDto) {
    const professorId = await this.profile(user);
    const title = input.title.trim();
    const code = input.code.trim().toUpperCase();
    if (!title || !code) throw new BadRequestException("Course title and code are required");
    try {
      const course = await this.prisma.course.create({
        data: { ...(this.courseData({ ...input, description: input.description?.trim() || null }) as Prisma.CourseUncheckedCreateInput), title, code, professorId },
        include: { _count: { select: { enrollments: true, learningOutcomes: true } } },
      });
      return {
        id: course.id,
        title: course.title,
        code: course.code,
        professorId: course.professorId,
        studentCount: course._count.enrollments,
        outcomeCount: course._count.learningOutcomes,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new BadRequestException("Course code already exists");
      throw error;
    }
  }
  private courseData(input: Record<string, unknown>) {
    const string = (key: string) => typeof input[key] === "string" ? input[key].trim() || null : undefined;
    const list = (key: string) => Array.isArray(input[key]) ? input[key].map((item) => String(item).trim()).filter(Boolean) : undefined;
    const date = (key: string) => {
      if (typeof input[key] !== "string" || !input[key]) return undefined;
      const result = new Date(input[key]);
      if (Number.isNaN(result.getTime())) throw new BadRequestException(`${key} must be an ISO date`);
      return result;
    };
    const result = {
      title: string("title"), code: string("code"), description: string("description"), shortDescription: string("shortDescription"), fullDescription: string("fullDescription"),
      subject: string("subject"), difficulty: string("difficulty"), language: string("language"), careerRelevance: string("careerRelevance"), coverImageUrl: string("coverImageUrl"),
      type: input.type, enrollmentMode: input.enrollmentMode, estimatedDurationMinutes: input.estimatedDurationMinutes, weeklyWorkloadHours: input.weeklyWorkloadHours, maximumEnrollment: input.maximumEnrollment,
      targetStudyYears: list("targetStudyYears")?.map(Number), targetPrograms: list("targetPrograms"), prerequisites: list("prerequisites"), startsAt: date("startsAt"), endsAt: date("endsAt"), professorId: input.professorId,
    };
    return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined));
  }
  async updateCourse(user: AuthenticatedUser, courseId: string, input: UpdateManagedCourseDto) {
    await this.access(user, courseId);
    if (input.code) input.code = input.code.trim().toUpperCase();
    const data = this.courseData(input as unknown as Record<string, unknown>);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.course.update({ where: { id: courseId }, data });
        if (input.outcomes) {
          await tx.learningOutcome.deleteMany({ where: { courseId } });
          await tx.learningOutcome.createMany({ data: input.outcomes.map((outcome, sortOrder) => ({ courseId, title: outcome.statement.trim(), description: outcome.description?.trim() || null, category: outcome.category?.trim() || null, careerRelevance: outcome.careerRelevance?.trim() || null, sortOrder, professorApprovedAt: new Date() })) });
        }
        if (input.modules) {
          await tx.courseModule.deleteMany({ where: { courseId } });
          for (const [sortOrder, module] of input.modules.entries()) {
            await tx.courseModule.create({ data: { courseId, title: module.title.trim(), description: module.description?.trim() || null, sortOrder, estimatedMinutes: module.estimatedMinutes, topics: { create: (module.topics ?? []).map((topic, topicOrder) => ({ title: topic.title.trim(), description: topic.description?.trim() || null, sortOrder: topicOrder, estimatedMinutes: topic.estimatedMinutes, outcomeIds: topic.outcomeIds ?? [] })) } } });
          }
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new BadRequestException("Course code already exists");
      throw error;
    }
    return this.course(user, courseId);
  }
  async publishCourse(user: AuthenticatedUser, courseId: string) {
    const { course } = await this.access(user, courseId);
    if (course.status === "ARCHIVED") throw new BadRequestException("Archived course cannot be published");
    if (!course.title || !course.learningOutcomes.length) throw new BadRequestException("A title and at least one learning outcome are required before publishing");
    await this.prisma.course.update({ where: { id: courseId }, data: { status: "PUBLISHED" } });
    return this.course(user, courseId);
  }
  async archiveCourse(user: AuthenticatedUser, courseId: string) {
    await this.access(user, courseId);
    await this.prisma.course.update({ where: { id: courseId }, data: { status: "ARCHIVED" } });
    return this.course(user, courseId);
  }
  async aiSuggestions(user: AuthenticatedUser, courseId: string, instruction?: string) {
    const { course } = await this.access(user, courseId);
    if (!this.courseAi) throw new ServiceUnavailableException("Course AI is unavailable");
    const result = await this.courseAi.suggest({ title: course.title, description: course.description, fullDescription: course.fullDescription, subject: course.subject, difficulty: course.difficulty, prerequisites: course.prerequisites, outcomes: course.learningOutcomes.map((outcome) => outcome.title) }, instruction);
    const saved = await this.prisma.courseAiSuggestion.create({ data: { courseId, suggestion: JSON.parse(JSON.stringify(result.suggestion)) as Prisma.InputJsonValue, provider: result.provider, fallback: result.fallback } });
    return { id: saved.id, courseId, suggestion: result.suggestion, provider: saved.provider, fallback: saved.fallback, approvedAt: null, createdAt: saved.createdAt.toISOString() };
  }
  async approveAiSuggestion(user: AuthenticatedUser, courseId: string, suggestionId: string, approved: boolean, draft?: UpdateManagedCourseDto) {
    await this.access(user, courseId);
    const suggestion = await this.prisma.courseAiSuggestion.findFirst({ where: { id: suggestionId, courseId } });
    if (!suggestion) throw new NotFoundException();
    if (approved && !draft) throw new BadRequestException("An edited professor-approved draft is required");
    if (approved && draft) await this.updateCourse(user, courseId, draft);
    const saved = await this.prisma.courseAiSuggestion.update({ where: { id: suggestionId }, data: { approvedAt: approved ? new Date() : null } });
    return { id: saved.id, courseId, approved, approvedAt: saved.approvedAt?.toISOString() ?? null };
  }
  async courseCatalog(user: AuthenticatedUser) {
    const studentId = await this.profile(user);
    const courses = await this.prisma.course.findMany({
      include: {
        professor: { include: { user: { select: { name: true } } } },
        _count: { select: { enrollments: true, learningOutcomes: true } },
        enrollments: { where: { studentId }, select: { createdAt: true } },
        enrollmentRequests: {
          where: { studentId },
          select: { id: true, status: true, createdAt: true, decisionNote: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return courses.map((course) => {
      const enrollment = course.enrollments[0];
      const request = course.enrollmentRequests[0];
      return {
        id: course.id,
        title: course.title,
        code: course.code,
        description: course.description ?? "",
        professorId: course.professorId,
        professorName: course.professor.user.name,
        studentCount: course._count.enrollments,
        outcomeCount: course._count.learningOutcomes,
        status: course.status,
        availableForEnrollment: true,
        enrollmentStatus: enrollment ? "ENROLLED" : (request?.status ?? "AVAILABLE"),
        enrollmentRequestId: request?.id ?? null,
        requestedAt: request?.createdAt.toISOString() ?? null,
        decisionNote: request?.decisionNote ?? null,
      };
    });
  }
  async requestEnrollment(user: AuthenticatedUser, courseId: string) {
    const studentId = await this.profile(user);
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, status: true, enrollmentMode: true, maximumEnrollment: true, _count: { select: { enrollments: true } } },
    });
    if (!course) throw new NotFoundException();
    if (course.maximumEnrollment !== null && course._count.enrollments >= course.maximumEnrollment)
      throw new BadRequestException("Course has reached maximum enrollment");
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { courseId_studentId: { courseId, studentId } },
      select: { createdAt: true },
    });
    if (enrollment)
      return {
        courseId,
        studentId,
        status: "ENROLLED",
        requestedAt: enrollment.createdAt.toISOString(),
        decisionNote: null,
      };
    if (course.enrollmentMode === "OPEN") {
      const created = await this.prisma.enrollment.create({ data: { courseId, studentId } });
      return { courseId, studentId, status: "ENROLLED", requestedAt: created.createdAt.toISOString(), decisionNote: null };
    }
    const request = await this.prisma.enrollmentRequest.upsert({
      where: { courseId_studentId: { courseId, studentId } },
      create: { courseId, studentId },
      update: { status: "PENDING", decisionNote: null, decidedAt: null },
    });
    return {
      id: request.id,
      courseId,
      studentId,
      status: request.status,
      requestedAt: request.createdAt.toISOString(),
      decidedAt: request.decidedAt?.toISOString() ?? null,
      decisionNote: request.decisionNote,
    };
  }
  async recommendedCourses(user: AuthenticatedUser) {
    const studentId = await this.profile(user);
    const student = await this.prisma.studentProfile.findUnique({ where: { id: studentId }, include: { careerProfile: true, skillEvidence: { where: { OR: [{ professorVerified: true }, { sourceType: "ASSESSMENT_MASTERY" }] } } } });
    if (!student) throw new ForbiddenException();
    const courses = await this.prisma.course.findMany({ where: { status: "PUBLISHED" }, include: { learningOutcomes: true, enrollments: { where: { studentId }, select: { id: true } }, enrollmentRequests: { where: { studentId }, select: { status: true } } }, orderBy: { createdAt: "desc" } });
    const interests = [student.careerProfile?.targetRole, ...(student.careerProfile?.interests ?? [])].filter((item): item is string => Boolean(item)).map((item) => item.toLowerCase());
    const trustedSkills = student.skillEvidence.map((item) => item.skill.toLowerCase());
    return courses.map((course) => {
      const factors: string[] = []; let score = 20;
      if (!course.targetStudyYears.length || (student.studyYear !== null && course.targetStudyYears.includes(student.studyYear))) { score += 20; factors.push("O‘qish yilingiz kurs auditoriyasiga mos."); }
      if (!course.targetPrograms.length || [student.faculty, student.major].some((value) => value && course.targetPrograms.some((program) => program.toLowerCase().includes(value.toLowerCase())))) { score += 15; factors.push("Fakultet yoki dasturingizga mos."); }
      const relevance = `${course.subject ?? ""} ${course.careerRelevance ?? ""} ${course.learningOutcomes.map((item) => item.title).join(" ")}`.toLowerCase();
      if (interests.some((interest) => relevance.includes(interest))) { score += 25; factors.push("Kasbiy qiziqishlaringiz bilan bog‘liq."); }
      const covered = course.learningOutcomes.filter((outcome) => trustedSkills.some((skill) => outcome.title.toLowerCase().includes(skill))).length;
      if (course.learningOutcomes.length && covered < course.learningOutcomes.length) { score += 15; factors.push("Mavjud dalillaringizda rivojlantirish mumkin bo‘lgan natijalar bor."); }
      const eligibility = course.prerequisites.length === 0 || trustedSkills.length > 0;
      return { course: { id: course.id, title: course.title, code: course.code, shortDescription: course.shortDescription ?? course.description ?? "", type: course.type, subject: course.subject, difficulty: course.difficulty, language: course.language, estimatedDurationMinutes: course.estimatedDurationMinutes, weeklyWorkloadHours: course.weeklyWorkloadHours, prerequisites: course.prerequisites, outcomes: course.learningOutcomes.map((outcome) => ({ id: outcome.id, statement: outcome.title })) }, matchScore: Math.min(score, 100), matchFactors: factors, eligibility: { eligible: eligibility, unmetPrerequisites: eligibility ? [] : course.prerequisites }, explanation: factors.length ? factors.join(" ") : "Kurs sizning umumiy o‘quv yo‘lingiz uchun tavsiya qilinadi.", mayEnroll: eligibility && !course.enrollments.length, professorApprovalRequired: course.enrollmentMode === "APPROVAL_REQUIRED", enrollmentStatus: course.enrollments.length ? "ENROLLED" : (course.enrollmentRequests[0]?.status ?? "AVAILABLE") };
    });
  }
  async enrollmentRequests(user: AuthenticatedUser, courseId: string) {
    const { course } = await this.access(user, courseId);
    const requests = await this.prisma.enrollmentRequest.findMany({
      where: { courseId },
      include: { student: { include: { user: { select: { name: true } }, careerProfile: true, skillEvidence: { where: { OR: [{ professorVerified: true }, { sourceType: "ASSESSMENT_MASTERY" }] }, select: { skill: true, score: true, professorVerified: true, sourceType: true } } } } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });
    return requests.map((request) => ({
      id: request.id,
      courseId: request.courseId,
      studentId: request.studentId,
      studentName: request.student.user.name,
      university: request.student.university ?? null,
      faculty: request.student.faculty ?? null,
      major: request.student.major ?? null,
      studyYear: request.student.studyYear ?? null,
      status: request.status,
      requestedAt: request.createdAt.toISOString(),
      decidedAt: request.decidedAt?.toISOString() ?? null,
      decisionNote: request.decisionNote,
      courseFit: this.enrollmentFit(course, request.student),
    }));
  }
  /** Deterministic fit score; the assistant wording must not make the admission decision. */
  private enrollmentFit(course: any, student: any) {
    const profile = student.careerProfile;
    const trustedSkills = student.skillEvidence.map((item: { skill: string }) => item.skill);
    const normal = (value: string) => value.toLowerCase().trim();
    const courseText = [course.title, course.subject, course.careerRelevance, ...course.learningOutcomes.map((outcome: { title: string }) => outcome.title)].filter(Boolean).join(" ").toLowerCase();
    const interests = [profile?.targetRole, ...(profile?.interests ?? [])].filter(Boolean) as string[];
    const programMatches = !course.targetPrograms.length || [student.faculty, student.major].some((value: string | null) => value && course.targetPrograms.some((program: string) => normal(program).includes(normal(value))));
    const yearMatches = !course.targetStudyYears.length || (student.studyYear !== null && course.targetStudyYears.includes(student.studyYear));
    const careerMatches = interests.some((value) => courseText.includes(normal(value)));
    const outcomeSkills: string[] = [...new Set<string>(course.learningOutcomes.flatMap((outcome: { title: string }) => mapOutcomeToSkills(outcome.title)) as string[])];
    const evidenceMatches = outcomeSkills.filter((skill) => trustedSkills.some((trusted: string) => normal(trusted) === normal(skill)));
    const prerequisiteSource = [...(profile?.coreSkills ?? []), ...trustedSkills].map(normal);
    const unmetPrerequisites = course.prerequisites.filter((item: string) => !prerequisiteSource.some((skill: string) => skill.includes(normal(item)) || normal(item).includes(skill)));
    const prerequisitesMet = unmetPrerequisites.length === 0;
    const factors: string[] = [];
    let score = 0;
    if (programMatches) { score += 20; factors.push("Fakultet yoki dasturi kurs auditoriyasiga mos."); }
    if (yearMatches) { score += 15; factors.push("O‘qish yili kurs darajasiga mos."); }
    if (careerMatches) { score += 25; factors.push("Onboardingdagi kasbiy maqsad yoki qiziqishlar kurs mavzusiga mos."); }
    if (evidenceMatches.length) { score += 25; factors.push(`Tasdiqlangan dalillarda mos ko‘nikmalar bor: ${evidenceMatches.join(", ")}.`); }
    if (prerequisitesMet) { score += 15; factors.push("Prerequisite shartlarida tasdiqlangan to‘siq topilmadi."); }
    const matchPercentage = Math.min(score, 100);
    return {
      matchPercentage,
      recommended: matchPercentage >= 60 && prerequisitesMet,
      prerequisitesMet,
      unmetPrerequisites,
      factors,
      profileSummary: { targetRole: profile?.targetRole ?? null, interests: profile?.interests ?? [], coreSkills: profile?.coreSkills ?? [], verifiedSkills: trustedSkills },
      assistantSummary: matchPercentage >= 60 && prerequisitesMet
        ? `Yordamchi tahlili: talaba kursga ${matchPercentage}% mos. Professor yakuniy qarorni mustaqil qabul qiladi.`
        : `Yordamchi tahlili: hozirgi moslik ${matchPercentage}%. Professor qo‘shimcha suhbat yoki dalil so‘rashi mumkin; yakuniy qaror faqat professor tomonidan beriladi.`,
      scoreMethod: "Deterministik: onboarding profili, kurs auditoriysi, prerequisite va faqat tasdiqlangan/assessment evidence asosida.",
    };
  }
  async decideEnrollmentRequest(
    user: AuthenticatedUser,
    courseId: string,
    requestId: string,
    input: EnrollmentRequestDecisionDto,
  ) {
    const professorId = await this.profile(user);
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "EnrollmentRequest" WHERE "id" = ${requestId} FOR UPDATE`;
      const request = await tx.enrollmentRequest.findUnique({
        where: { id: requestId },
        include: { course: { select: { professorId: true } } },
      });
      if (!request || request.courseId !== courseId) throw new NotFoundException();
      if (request.course.professorId !== professorId) throw new ForbiddenException();
      if (request.status !== "PENDING")
        throw new BadRequestException("Enrollment request is already decided");
      if (input.status === "APPROVED")
        await tx.enrollment.upsert({
          where: {
            courseId_studentId: {
              courseId: request.courseId,
              studentId: request.studentId,
            },
          },
          create: { courseId: request.courseId, studentId: request.studentId },
          update: {},
        });
      return tx.enrollmentRequest.update({
        where: { id: request.id },
        data: {
          status: input.status,
          decisionNote: input.feedback?.trim() || null,
          decidedAt: new Date(),
        },
      });
    });
    return {
      id: record.id,
      courseId: record.courseId,
      studentId: record.studentId,
      status: record.status,
      requestedAt: record.createdAt.toISOString(),
      decidedAt: record.decidedAt?.toISOString() ?? null,
      decisionNote: record.decisionNote,
    };
  }
  async dashboard(user: AuthenticatedUser) {
    const courses = await this.courses(user);
    const profileId = await this.profile(user);
    const first = courses[0];
    return {
      userId: profileId,
      courseIds: courses.map((course) => course.id),
      nextAction: first
        ? {
            label: "Kurs dalillarini ko‘rish",
            href: `/${user.role === "STUDENT" ? "student" : "professor"}/courses/${first.id}`,
          }
        : null,
      feedback: null,
    };
  }
  async course(user: AuthenticatedUser, courseId: string) {
    const { course, profileId } = await this.access(user, courseId);
    const enrollments =
      user.role === "STUDENT"
        ? course.enrollments.filter(
            (enrollment) => enrollment.studentId === profileId,
          )
        : course.enrollments;
    return {
      id: course.id,
      title: course.title,
      code: course.code,
      professorId: course.professorId,
      studentCount: course.enrollments.length,
      outcomeCount: course.learningOutcomes.length,
      description: course.description ?? "",
      shortDescription: course.shortDescription ?? course.description ?? "",
      fullDescription: course.fullDescription ?? course.description ?? "",
      status: course.status,
      type: course.type,
      subject: course.subject,
      difficulty: course.difficulty,
      language: course.language,
      estimatedDurationMinutes: course.estimatedDurationMinutes,
      weeklyWorkloadHours: course.weeklyWorkloadHours,
      targetStudyYears: course.targetStudyYears,
      targetPrograms: course.targetPrograms,
      prerequisites: course.prerequisites,
      careerRelevance: course.careerRelevance,
      coverImageUrl: course.coverImageUrl,
      startsAt: course.startsAt?.toISOString() ?? null,
      endsAt: course.endsAt?.toISOString() ?? null,
      enrollmentMode: course.enrollmentMode,
      maximumEnrollment: course.maximumEnrollment,
      professor: summary(
        course.professor.id,
        course.professor.user.name,
        "PROFESSOR",
        course.professor.department ?? "",
      ),
      students: enrollments.map((enrollment) =>
        summary(enrollment.studentId, enrollment.student.user.name, "STUDENT"),
      ),
      enrollments: enrollments.map((enrollment) => ({
        courseId,
        studentId: enrollment.studentId,
        enrolledAt: enrollment.createdAt.toISOString(),
      })),
      outcomes: course.learningOutcomes.map((outcome) => ({
        id: outcome.id,
        courseId,
        title: outcome.title,
        description: outcome.description ?? "",
        category: outcome.category,
        careerRelevance: outcome.careerRelevance,
      })),
      modules: course.modules.map((module) => ({ id: module.id, title: module.title, description: module.description, sortOrder: module.sortOrder, estimatedMinutes: module.estimatedMinutes, topics: module.topics.map((topic) => ({ id: topic.id, title: topic.title, description: topic.description, sortOrder: topic.sortOrder, estimatedMinutes: topic.estimatedMinutes, outcomeIds: topic.outcomeIds })) })),
      materials: course.materials.filter((material) => user.role === "PROFESSOR" || material.published).map((material) => ({
        id: material.id,
        courseId,
        title: material.title,
        content: material.content ?? "",
        uploadedAt: material.createdAt.toISOString(),
        description: material.description,
        moduleId: material.moduleId,
        outcomeId: material.outcomeId,
        published: material.published,
        visibility: material.visibility,
      })),
      assessments: course.assessments
        .filter((assessment) => user.role === "PROFESSOR" || assessment.published)
        .map((assessment) => ({
          id: assessment.id,
          courseId,
          title: assessment.title,
          type: assessment.type,
          questionCount: assessment._count.questions,
          submissionCount:
            user.role === "STUDENT"
              ? Number(
                  assessment.submissions.some(
                    (submission) => submission.studentId === profileId,
                  ),
                )
              : assessment._count.submissions,
        })),
      latestFeedback: null,
    };
  }
  async assessment(user: AuthenticatedUser, assessmentId: string) {
    const record = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: assessmentInclude,
    });
    if (!record) throw new NotFoundException();
    await this.access(user, record.courseId);
    return safeAssessment(record);
  }
  async assessments(user: AuthenticatedUser, courseId: string) {
    await this.access(user, courseId);
    return (await this.course(user, courseId)).assessments;
  }
  async studentMastery(studentId: string, courseId: string) {
    const [outcomes, records] = await Promise.all([
      this.prisma.learningOutcome.findMany({
        where: { courseId },
        orderBy: { sortOrder: "asc" },
      }),
      this.prisma.masteryRecord.findMany({
        where: { studentId, courseId },
        include: { assessment: { select: { type: true } } },
        orderBy: [{ calculatedAt: "desc" }, { id: "desc" }],
      }),
    ]);
    const mapped = outcomes.map((outcome) => {
      const evidence = records.filter(
        (record) => record.learningOutcomeId === outcome.id,
      );
      const current = evidence[0];
      const diagnostic = evidence.find(
        (record) => record.assessment.type === "DIAGNOSTIC",
      );
      const followUp = evidence.find(
        (record) =>
          record.assessment.type === "FOLLOW_UP" &&
          (!diagnostic || record.calculatedAt > diagnostic.calculatedAt),
      );
      return {
        outcomeId: outcome.id,
        percentage: current ? Number(current.percentage) : 0,
        level: masteryLevels[current?.status ?? "NOT_ASSESSED"],
        diagnosticPercentage: diagnostic ? Number(diagnostic.percentage) : null,
        followUpPercentage: followUp ? Number(followUp.percentage) : null,
        change:
          diagnostic && followUp
            ? Math.round(
                (Number(followUp.percentage) - Number(diagnostic.percentage)) *
                  100,
              ) / 100
            : 0,
        evidence: evidence.map((record) => ({
          id: record.id,
          type: "ASSESSMENT" as const,
          verification: "UNVERIFIED" as const,
          recordedAt: record.calculatedAt.toISOString(),
        })),
        misconceptionIds: [],
        misconceptionDescriptions: [],
        nextAction:
          current && Number(current.percentage) >= 80
            ? "Amaliy loyiha bilan mustahkamlang"
            : "Mashqlarni bajaring va qayta tekshiring",
      };
    });
    return {
      studentId,
      courseId,
      overallPercentage: average(
        mapped
          .filter((outcome) => outcome.evidence.length)
          .map((outcome) => outcome.percentage),
      ),
      outcomes: mapped,
    };
  }
  async mastery(user: AuthenticatedUser, courseId: string) {
    const { profileId } = await this.access(user, courseId);
    return this.studentMastery(profileId, courseId);
  }
  async submit(
    user: AuthenticatedUser,
    assessmentId: string,
    input: AnswersDto,
  ) {
    const record = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: assessmentInclude,
    });
    if (!record) throw new NotFoundException();
    const { profileId: studentId } = await this.access(user, record.courseId);
    if (
      (record.startsAt && record.startsAt > new Date()) ||
      (record.dueAt && record.dueAt < new Date())
    )
      throw new ForbiddenException("Assessment is not open");
    safeAssessment(record);
    const graded = gradeAnswers(record, input);
    const mastery = this.masteryCalculator.calculateSubmissionMastery({
      outcomes: record.course.learningOutcomes.map((outcome) => ({
        id: outcome.id,
        title: outcome.title,
      })),
      questions: record.questions.map((question) => ({
        id: question.id,
        weight: Number(question.weight),
        maxScore: Number(question.maxScore),
        outcomeLinks: question.outcomeLinks.map((link) => ({
          learningOutcomeId: link.learningOutcomeId,
          weight: Number(link.weight),
        })),
      })),
      answers: graded,
    });
    const result = await this.prisma.$transaction(async (tx) => {
      // Serialize replacements of this student's current attempt, including concurrent requests.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${studentId}:${assessmentId}`}))::text AS locked`;
      const previous = await tx.masteryRecord.findMany({
        where: { studentId, courseId: record.courseId },
        orderBy: { calculatedAt: "desc" },
      });
      const submission = await tx.submission.upsert({
        where: { assessmentId_studentId: { assessmentId, studentId } },
        create: { assessmentId, studentId },
        update: { submittedAt: new Date(), status: "SCORED" },
      });
      const endorsed = await tx.professorEndorsement.findMany({
        where: {
          studentId,
          status: "ENDORSED",
          items: { some: { evidence: { sourceId: submission.id } } },
        },
      });
      for (const endorsement of endorsed)
        await tx.professorEndorsement.update({
          where: { id: endorsement.id },
          data: {
            status: "NEEDS_DEVELOPMENT",
            pendingKey: null,
            comment: "Baholash dalili yangilandi; qayta ko‘rib chiqish zarur.",
            history: [
              ...(Array.isArray(endorsement.history)
                ? endorsement.history
                : []),
              {
                status: "NEEDS_DEVELOPMENT",
                recordedAt: new Date().toISOString(),
              },
            ],
          },
        });
      await tx.submissionAnswer.deleteMany({
        where: { submissionId: submission.id },
      });
      await tx.masteryRecord.deleteMany({
        where: { submissionId: submission.id },
      });
      await tx.submissionAnswer.createMany({
        data: graded.map((answer: any) => ({
          submissionId: submission.id,
          questionId: answer.questionId,
          answer: answer.answer,
          score: new Prisma.Decimal(answer.score),
        })),
      });
      const assessed = mastery.filter(
        (outcome) => outcome.status !== "NOT_ASSESSED",
      );
      await tx.masteryRecord.createMany({
        data: assessed.map((outcome) => ({
          studentId,
          courseId: record.courseId,
          assessmentId,
          submissionId: submission.id,
          learningOutcomeId: outcome.learningOutcomeId,
          percentage: new Prisma.Decimal(outcome.percentage),
          status: outcome.status,
        })),
      });
      // One conservative score per skill/source; outcome ordering cannot inflate evidence.
      const skills = new Map<string, number[]>();
      for (const outcome of assessed)
        for (const skill of mapOutcomeToSkills(outcome.title))
          skills.set(skill, [...(skills.get(skill) ?? []), outcome.percentage]);
      await tx.skillEvidence.deleteMany({
        where: {
          studentId,
          sourceType: "ASSESSMENT_MASTERY",
          sourceId: submission.id,
          skill: { notIn: [...skills.keys()] },
        },
      });
      for (const [skill, values] of skills)
        await tx.skillEvidence.upsert({
          where: {
            studentId_skill_sourceType_sourceId: {
              studentId,
              skill,
              sourceType: "ASSESSMENT_MASTERY",
              sourceId: submission.id,
            },
          },
          create: {
            studentId,
            skill,
            sourceType: "ASSESSMENT_MASTERY",
            sourceId: submission.id,
            score: new Prisma.Decimal(average(values)),
            professorVerified: false,
          },
          update: {
            score: new Prisma.Decimal(average(values)),
            professorVerified: false,
          },
        });
      await tx.cohortInsight.deleteMany({
        where: { courseId: record.courseId },
      });
      await tx.matchRecommendation.updateMany({
        where: { studentId },
        data: { explanationUz: null, nextActionUz: null },
      });
      const current = await tx.masteryRecord.findMany({
        where: { studentId, courseId: record.courseId },
        orderBy: { calculatedAt: "desc" },
      });
      await tx.learningPlan.create({
        data: {
          studentId,
          courseId: record.courseId,
          title: "Yangilangan o‘quv reja",
          rationale: "Joriy baholash dalillariga asoslangan mashqlar.",
          tasks: {
            create: record.course.learningOutcomes
              .filter((outcome) => {
                const evidence = current.find(
                  (item) => item.learningOutcomeId === outcome.id,
                );
                return !evidence || Number(evidence.percentage) < 80;
              })
              .map((outcome) => ({
                learningOutcomeId: outcome.id,
                title: `${outcome.title}: mashq bajaring`,
                description:
                  "Mavzuni ko‘rib chiqing, mashq bajaring va qayta tekshiring.",
              })),
          },
        },
      });
      return { submission, previous };
    });
    const denominator = record.questions.reduce(
      (sum: number, question: any) => sum + Number(question.weight),
      0,
    );
    const scorePercentage = denominator
      ? percent(
          (record.questions.reduce(
            (sum: number, question: any) =>
              sum +
              (graded.find((answer: any) => answer.questionId === question.id)!
                .score /
                Number(question.maxScore)) *
                Number(question.weight),
            0,
          ) /
            denominator) *
            100,
        )
      : 0;
    return {
      id: result.submission.id,
      assessmentId,
      studentId,
      submittedAt: result.submission.submittedAt.toISOString(),
      scorePercentage,
      feedback: record.questions.map((question: any) => ({
        questionId: question.id,
        outcomeId: question.outcomeLinks[0].learningOutcomeId,
        correct: graded.find((answer: any) => answer.questionId === question.id)!
          .correct,
        correctAnswer:
          safeOptions(question.options).find(
            (option) => option.id === question.correctAnswer,
          )?.text ?? question.correctAnswer!,
        explanation: "Javob belgilangan baholash mezoni bilan solishtirildi.",
        misconceptionId: null,
        misconception: null,
      })),
      outcomeImpacts: mastery
        .filter((outcome) => outcome.status !== "NOT_ASSESSED")
        .map((outcome) => {
          const previous = result.previous.find(
            (item) => item.learningOutcomeId === outcome.learningOutcomeId,
          );
          const before = previous ? Number(previous.percentage) : 0;
          return {
            outcomeId: outcome.learningOutcomeId,
            previousPercentage: before,
            percentage: outcome.percentage,
            change: Math.round((outcome.percentage - before) * 100) / 100,
          };
        }),
      aiExplanation:
        "Natija javoblar va savol og‘irliklari asosida deterministik hisoblandi.",
      nextRecommendedAction: {
        label: "O‘quv rejasini ko‘rish",
        href: `/student/learning-plan/${record.courseId}`,
      },
    };
  }
  async learningPlan(
    user: AuthenticatedUser,
    courseId: string,
    generate = false,
  ) {
    const { profileId: studentId, course } = await this.access(user, courseId);
    let plan = await this.prisma.learningPlan.findFirst({
      where: { studentId, courseId },
      include: { tasks: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
      orderBy: { createdAt: "desc" },
    });
    if (plan && (!plan.tasks.length || !plan.tasks.some((task) => task.learningOutcomeId))) {
      generate = true;
    }
    if (!plan && !generate)
      throw new NotFoundException("Generate a current learning plan first");
    if (generate) {
      if (course.learningOutcomes.length === 0) {
        const topic = course.subject || course.title || "Kurs";
        await this.prisma.learningOutcome.createMany({
          data: [
            {
              courseId,
              title: `${topic} asosiy tushunchalari va tamoyillari`,
              description: `${topic} bo'yicha asosiy nazariy va amaliy tushunchalarni o'zlashtirish.`,
              category: "Asosiy ko'nikma",
              careerRelevance: "Kasbiy amaliyot uchun poydevor yaratadi.",
              sortOrder: 0,
              aiSuggested: true,
              professorApprovedAt: new Date(),
            },
            {
              courseId,
              title: `${topic} bo'yicha amaliy masalalarni yechish`,
              description: `${topic} doirasida real topshiriqlar va amaliy masalalarni mustaqil hal qilish.`,
              category: "Amaliy ko'nikma",
              careerRelevance: "Kasbiy vazifalarni bajarishda qo'llash.",
              sortOrder: 1,
              aiSuggested: true,
              professorApprovedAt: new Date(),
            },
            {
              courseId,
              title: `${topic} bo'yicha loyiha va tahliliy topshiriqlar`,
              description: `${topic} mavzulari asosida yaxlit loyiha yoki tahliliy topshiriqni yakunlash.`,
              category: "Loyiha va tahlil",
              careerRelevance: "Portfolioga kiritish va kasbiy tayyorgarlik.",
              sortOrder: 2,
              aiSuggested: true,
              professorApprovedAt: new Date(),
            },
          ],
          skipDuplicates: true,
        });
        course.learningOutcomes = await this.prisma.learningOutcome.findMany({
          where: { courseId },
          orderBy: { sortOrder: "asc" },
        });
      }

      const mastery = await this.studentMastery(studentId, courseId);
      const student = await this.prisma.studentProfile.findUnique({
        where: { id: studentId },
        include: { careerProfile: true },
      });
      if (!student) throw new NotFoundException();
      const learningPlanContext = {
          studentProfile: {
            major: student.major ?? "",
            faculty: student.faculty ?? "",
            studyYear: student.studyYear,
            targetRole: student.careerProfile?.targetRole ?? "",
            interests: student.careerProfile?.interests ?? [],
            coreSkills: student.careerProfile?.coreSkills ?? [],
          },
          course: {
            title: course.title,
            subject: course.subject ?? "",
            description: course.fullDescription ?? course.description ?? "",
            prerequisites: course.prerequisites,
            outcomes: course.learningOutcomes.map((outcome) => ({
              title: outcome.title,
              description: outcome.description ?? "",
            })),
            modules: course.modules.map((module) => ({
              title: module.title,
              topics: module.topics.map((topic) => topic.title),
            })),
          },
          mastery: mastery.outcomes.map((outcome) => ({
            outcomeTitle:
              course.learningOutcomes.find((item) => item.id === outcome.outcomeId)?.title ??
              outcome.outcomeId,
            percentage: outcome.percentage,
            evidence: outcome.evidence.length > 0,
          })),
        };
      const fallbackTasks = learningPlanContext.mastery
        .filter((item) => !item.evidence || item.percentage < 80)
        .slice(0, 6);
      const aiPlan = this.aiCareer
        ? await this.aiCareer.generateLearningPlan(learningPlanContext, user.id)
        : {
            rationaleUz: "Reja kurs natijalari va mavjud o'zlashtirish dalillaridagi bo'shliqlarga asoslandi.",
            tasks: (fallbackTasks.length ? fallbackTasks : learningPlanContext.mastery.slice(0, 3)).map((item) => ({
              outcomeTitle: item.outcomeTitle,
              title: `${item.outcomeTitle}: amaliy mashq`,
              reason: item.evidence
                ? `${item.outcomeTitle} bo'yicha natijani mustahkamlash uchun mashq bajaring.`
                : `${item.outcomeTitle} bo'yicha hali dalil yo'q; asosiy tushunchalarni amalda tekshiring.`,
            })),
          };
      const outcomeByTitle = new Map(
        course.learningOutcomes.map((outcome) => [outcome.title.toLowerCase().trim(), outcome]),
      );
      const defaultOutcome = course.learningOutcomes[0];
      const tasksToCreate = aiPlan.tasks.map((task) => {
        const normTitle = (task.outcomeTitle || "").toLowerCase().trim();
        let outcome = outcomeByTitle.get(normTitle);
        if (!outcome) {
          outcome = course.learningOutcomes.find(
            (item) => item.title.toLowerCase().includes(normTitle) || normTitle.includes(item.title.toLowerCase()),
          );
        }
        const matched = outcome ?? defaultOutcome;
        return {
          learningOutcomeId: matched?.id,
          title: task.title,
          description: task.reason,
        };
      }).filter((item): item is { learningOutcomeId: string; title: string; description: string } => Boolean(item.learningOutcomeId));

      plan = await this.prisma.learningPlan.create({
        data: {
          studentId,
          courseId,
          title: "AI asosidagi shaxsiy o‘quv reja",
          rationale: aiPlan.rationaleUz,
          tasks: {
            create: tasksToCreate,
          },
        },
        include: { tasks: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
      });
    }
    if (!plan) throw new NotFoundException();
    return {
      id: plan.id,
      studentId,
      courseId,
      createdAt: plan.createdAt.toISOString(),
      tasks: plan.tasks
        .filter((task) => task.learningOutcomeId)
        .map((task, order) => ({
          id: task.id,
          outcomeId: task.learningOutcomeId!,
          order,
          title: task.title,
          type: "PRACTICE" as const,
          status: task.completedAt
            ? ("COMPLETED" as const)
            : ("NOT_STARTED" as const),
          estimatedMinutes: 20,
          reason: task.description ?? plan.rationale ?? "",
          actionTarget: `/student/mastery/${courseId}`,
        })),
    };
  }
  async insights(user: AuthenticatedUser, courseId: string) {
    const { course, profileId: professorId } = await this.access(
      user,
      courseId,
    );
    const students = await Promise.all(
      course.enrollments.map((enrollment) =>
        this.studentMastery(enrollment.studentId, courseId),
      ),
    );
    const outcomes = course.learningOutcomes.map((outcome) => {
      const entries = students.map((student) => ({
        studentId: student.studentId,
        outcome: student.outcomes.find(
          (item) => item.outcomeId === outcome.id,
        )!,
      }));
      const diagnostic = entries.flatMap((entry) =>
        entry.outcome.diagnosticPercentage === null
          ? []
          : [entry.outcome.diagnosticPercentage],
      );
      const followUp = entries.flatMap((entry) =>
        entry.outcome.followUpPercentage === null
          ? []
          : [entry.outcome.followUpPercentage],
      );
      const paired = entries.filter(
        (entry) =>
          entry.outcome.diagnosticPercentage !== null &&
          entry.outcome.followUpPercentage !== null,
      );
      return {
        outcomeId: outcome.id,
        diagnosticPercentage: diagnostic.length ? average(diagnostic) : null,
        followUpPercentage: followUp.length ? average(followUp) : null,
        improvement: paired.length
          ? Math.round(
              (paired.reduce((sum, entry) => sum + entry.outcome.change, 0) /
                paired.length) *
                100,
            ) / 100
          : null,
        followUpStudentCount: followUp.length,
        supportStudentIds: entries
          .filter(
            (entry) =>
              entry.outcome.evidence.length && entry.outcome.percentage < 50,
          )
          .map((entry) => entry.studentId),
      };
    });
    const answers = await this.prisma.submissionAnswer.findMany({
      where: {
        submission: {
          assessment: { courseId },
          studentId: {
            in: course.enrollments.map((enrollment) => enrollment.studentId),
          },
        },
      },
      include: { question: true },
    });
    const byQuestion = new Map<string, typeof answers>();
    for (const answer of answers)
      byQuestion.set(answer.questionId, [
        ...(byQuestion.get(answer.questionId) ?? []),
        answer,
      ]);
    const improvements = outcomes.flatMap((outcome) =>
      outcome.improvement === null ? [] : [outcome.improvement],
    );
    return {
      courseId,
      professorId,
      studentCount: students.length,
      cohortMasteryPercentage: average(
        students
          .filter((student) =>
            student.outcomes.some((outcome) => outcome.evidence.length),
          )
          .map((student) => student.overallPercentage),
      ),
      recentImprovementPercentage: improvements.length
        ? Math.round(
            (improvements.reduce((sum, value) => sum + value, 0) /
              improvements.length) *
              100,
          ) / 100
        : null,
      outcomes,
      misconceptions: [],
      questionDifficulty: [...byQuestion].map(([questionId, entries]) => {
        const correctCount = entries.filter(
          (answer) => Number(answer.score) >= Number(answer.question.maxScore),
        ).length;
        const correctPercentage = percent(
          (correctCount / entries.length) * 100,
        );
        return {
          questionId,
          assessmentId: entries[0].question.assessmentId,
          correctCount,
          responseCount: entries.length,
          correctPercentage,
          difficultyPercentage: percent(100 - correctPercentage),
        };
      }),
      supportGroups: outcomes
        .filter((outcome) => outcome.supportStudentIds.length)
        .map((outcome) => ({
          id: `support-${outcome.outcomeId}`,
          outcomeId: outcome.outcomeId,
          studentIds: outcome.supportStudentIds,
          reason: "Joriy o‘zlashtirish 50 foizdan past.",
        })),
      evidenceAssessmentIds: [
        ...new Set(answers.map((answer) => answer.question.assessmentId)),
      ],
      explanation:
        "Tahlil joriy topshirilgan javoblar va o‘zlashtirish dalillaridan hisoblandi.",
    };
  }
  async interventions(
    user: AuthenticatedUser,
    courseId: string,
    suggest = false,
  ) {
    const { profileId: professorId } = await this.access(user, courseId);
    const insights = await this.insights(user, courseId);
    if (suggest) {
      for (const outcome of insights.outcomes.filter(
        (item) => item.supportStudentIds.length,
      )) {
        const exists = await this.prisma.intervention.findFirst({
          where: {
            courseId,
            professorId,
            status: "PLANNED",
            targetOutcomeIds: { has: outcome.outcomeId },
          },
        });
        if (!exists)
          await this.prisma.intervention.create({
            data: {
              courseId,
              professorId,
              title: "Qo‘shimcha amaliy mashg‘ulot",
              description:
                "Past o‘zlashtirish dalillariga ko‘ra kichik guruhda mashq qilish tavsiya etiladi.",
              targetOutcomeIds: [outcome.outcomeId],
            },
          });
      }
    }
    const records = await this.prisma.intervention.findMany({
      where: { courseId, professorId },
      orderBy: { createdAt: "asc" },
    });
    return records
      .filter((record) => record.targetOutcomeIds.length)
      .map((record) => ({
        id: record.id,
        courseId,
        professorId,
        outcomeId: record.targetOutcomeIds[0],
        reason: record.description,
        suggestedAction: record.title,
        affectedStudentCount:
          insights.outcomes.find(
            (outcome) => outcome.outcomeId === record.targetOutcomeIds[0],
          )?.supportStudentIds.length ?? 0,
        evidenceAssessmentIds: insights.evidenceAssessmentIds,
        status: interventionStates[record.status],
      }));
  }
  async decideIntervention(
    user: AuthenticatedUser,
    courseId: string,
    id: string,
    input: InterventionDecisionDto,
  ) {
    const { profileId } = await this.access(user, courseId);
    const record = await this.prisma.intervention.findFirst({
      where: { id, courseId, professorId: profileId },
    });
    if (!record) throw new NotFoundException();
    await this.prisma.intervention.update({
      where: { id },
      data: { status: input.status === "APPROVED" ? "ACTIVE" : "REJECTED" },
    });
    return (await this.interventions(user, courseId)).find(
      (item) => item.id === id,
    )!;
  }
  async growthPlan(user: AuthenticatedUser, generate = false) {
    const professorId = await this.profile(user);
    const courses = await this.courses(user);
    if (generate)
      for (const course of courses) {
        const insight = await this.insights(user, course.id);
        await this.prisma.growthGoal.create({
          data: {
            professorId,
            courseId: course.id,
            title: "Baholash dalillarini dars rejasiga qo‘shish",
            description: `${insight.studentCount} talaba dalillarini ko‘rib chiqing; qo‘llab-quvvatlash guruhlari: ${insight.supportGroups.length}.`,
          },
        });
      }
    const goals = await this.prisma.growthGoal.findMany({
      where: {
        professorId,
        courseId: { in: courses.map((course) => course.id) },
      },
      orderBy: { createdAt: "desc" },
      take: courses.length,
    });
    return {
      id: `growth-${professorId}`,
      professorId,
      actions: goals.map((goal) => ({
        title: goal.title,
        reason: goal.description ?? "",
        courseId: goal.courseId!,
      })),
    };
  }
  async material(
    user: AuthenticatedUser,
    courseId: string,
    input: MaterialDto,
  ) {
    await this.access(user, courseId);
    if (!input.title.trim() || !input.content.trim())
      throw new BadRequestException();
    const material = await this.prisma.material.create({
      data: {
        courseId,
        title: input.title.trim(),
        content: input.content.trim(),
        contentType: "text/plain",
      },
    });
    return {
      id: material.id,
      courseId,
      title: material.title,
      content: material.content!,
      uploadedAt: material.createdAt.toISOString(),
    };
  }
}
