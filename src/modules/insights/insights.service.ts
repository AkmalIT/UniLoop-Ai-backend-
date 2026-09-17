import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';

@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
  ) {}

  async calculateAndStoreCourseInsights(courseId: string, threshold = 60) {
    const insight = await this.calculateCourseInsights(courseId, threshold);
    await this.prisma.cohortInsight.create({
      data: {
        courseId,
        totalStudents: insight.totalStudents,
        averageMastery: new Prisma.Decimal(insight.averageMastery),
        weakestOutcomes: insight.weakestOutcomes,
        strongestOutcomes: insight.strongestOutcomes,
        studentsNeedingSupport: insight.studentsNeedingSupport,
        masteryDistribution: insight.masteryDistribution,
        difficultQuestions: insight.difficultQuestions,
      },
    });
    return insight;
  }

  async getProfessorInsights(courseId: string) {
    return this.calculateCourseInsights(courseId);
  }

  async calculateCourseInsights(courseId: string, threshold = 60) {
    await this.coursesService.ensureCourse(courseId);

    const [enrollments, outcomes, records, questions] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { courseId },
        include: { student: { include: { user: { select: { id: true, name: true, email: true } } } } },
      }),
      this.prisma.learningOutcome.findMany({
        where: { courseId },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.masteryRecord.findMany({
        where: { courseId },
        include: {
          student: { include: { user: { select: { id: true, name: true, email: true } } } },
          learningOutcome: { select: { id: true, title: true } },
        },
        orderBy: { calculatedAt: 'desc' },
      }),
      this.prisma.question.findMany({
        where: { assessment: { courseId } },
        include: { answers: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    const latestByStudentOutcome = new Map<string, (typeof records)[number]>();
    for (const record of records) {
      const key = `${record.studentId}:${record.learningOutcomeId}`;
      if (!latestByStudentOutcome.has(key)) {
        latestByStudentOutcome.set(key, record);
      }
    }

    const outcomeSummaries = outcomes.map((outcome) => {
      const values = enrollments
        .map((enrollment) =>
          latestByStudentOutcome.get(`${enrollment.studentId}:${outcome.id}`),
        )
        .filter((record): record is NonNullable<typeof record> => Boolean(record))
        .map((record) => Number(record.percentage));

      return {
        id: outcome.id,
        title: outcome.title,
        averageMastery: this.average(values),
        assessedStudents: values.length,
        studentsBelowThreshold: values.filter((value) => value < threshold).length,
      };
    });

    const studentSummaries = enrollments.map((enrollment) => {
      const values = outcomes
        .map((outcome) =>
          latestByStudentOutcome.get(`${enrollment.studentId}:${outcome.id}`),
        )
        .filter((record): record is NonNullable<typeof record> => Boolean(record))
        .map((record) => Number(record.percentage));

      return {
        studentId: enrollment.studentId,
        name: enrollment.student.user.name,
        email: enrollment.student.user.email,
        averageMastery: this.average(values),
        assessedOutcomes: values.length,
      };
    });

    const assessedOutcomeSummaries = outcomeSummaries.filter(
      (summary) => summary.assessedStudents > 0,
    );
    const sortedByMastery = assessedOutcomeSummaries
      .slice()
      .sort((a, b) => a.averageMastery - b.averageMastery);
    const allLatestValues = Array.from(latestByStudentOutcome.values()).map((record) =>
      Number(record.percentage),
    );

    return {
      courseId,
      totalStudents: enrollments.length,
      averageMastery: this.average(allLatestValues),
      averageMasteryByOutcome: outcomeSummaries,
      weakestOutcomes: sortedByMastery.slice(0, 2),
      strongestOutcomes: sortedByMastery.slice(-2).reverse(),
      studentsNeedingSupport: studentSummaries.filter(
        (student) =>
          student.assessedOutcomes > 0 && student.averageMastery < threshold,
      ),
      masteryDistribution: this.distribution(allLatestValues),
      difficultQuestions: questions
        .map((question) => {
          const ratios = question.answers.map((answer) =>
            Number(question.maxScore) > 0
              ? Math.min(Number(answer.score) / Number(question.maxScore), 1) * 100
              : 0,
          );
          return {
            id: question.id,
            prompt: question.prompt,
            averageScorePercentage: this.average(ratios),
            attempts: question.answers.length,
          };
        })
        .filter((question) => question.attempts > 0)
        .sort((a, b) => a.averageScorePercentage - b.averageScorePercentage),
    };
  }

  private average(values: number[]) {
    if (!values.length) {
      return 0;
    }
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
  }

  private distribution(values: number[]) {
    return {
      notAssessed: values.length === 0 ? 1 : 0,
      needsAttention: values.filter((value) => value < 50).length,
      developing: values.filter((value) => value >= 50 && value < 80).length,
      mastered: values.filter((value) => value >= 80).length,
    };
  }
}
