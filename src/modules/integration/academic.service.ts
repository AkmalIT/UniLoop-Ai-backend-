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
import { mapOutcomeToSkills } from "../career/skill-map.constants";
import {
  AnswersDto,
  InterventionDecisionDto,
  MaterialDto,
} from "./integration.dto";
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
type AssessmentRecord = Prisma.AssessmentGetPayload<{
  include: typeof assessmentInclude;
}>;

export function safeAssessment(record: AssessmentRecord) {
  if (
    record.type === "PRACTICE" ||
    record.questions.some(
      (question) => question.type === "CODE" || !question.outcomeLinks.length,
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
    questions: record.questions.map((question) => ({
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
    record.questions.some((question) => !seen.has(question.id))
  )
    throw new BadRequestException(
      "Provide each assessment question exactly once",
    );
  return record.questions.map((question) => {
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
  ) {}

  async profile(user: AuthenticatedUser) {
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
      })),
      materials: course.materials.map((material) => ({
        id: material.id,
        courseId,
        title: material.title,
        content: material.content ?? "",
        uploadedAt: material.createdAt.toISOString(),
      })),
      assessments: course.assessments
        .filter((assessment) => assessment.type !== "PRACTICE")
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
        data: graded.map((answer) => ({
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
      (sum, question) => sum + Number(question.weight),
      0,
    );
    const scorePercentage = denominator
      ? percent(
          (record.questions.reduce(
            (sum, question) =>
              sum +
              (graded.find((answer) => answer.questionId === question.id)!
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
      feedback: record.questions.map((question) => ({
        questionId: question.id,
        outcomeId: question.outcomeLinks[0].learningOutcomeId,
        correct: graded.find((answer) => answer.questionId === question.id)!
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
    if (!plan && !generate)
      throw new NotFoundException("Generate a current learning plan first");
    if (generate) {
      const mastery = await this.studentMastery(studentId, courseId);
      const priorities = mastery.outcomes.filter(
        (outcome) => !outcome.evidence.length || outcome.percentage < 80,
      );
      plan = await this.prisma.learningPlan.create({
        data: {
          studentId,
          courseId,
          title: "Dalillarga asoslangan o‘quv reja",
          rationale: "Joriy baholash dalillariga asoslangan tavsiya.",
          tasks: {
            create: priorities.map((outcome) => ({
              learningOutcomeId: outcome.outcomeId,
              title: `${course.learningOutcomes.find((item) => item.id === outcome.outcomeId)?.title ?? "Mavzu"}: mashq bajaring`,
              description: outcome.nextAction,
            })),
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
