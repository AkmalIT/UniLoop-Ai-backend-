import { Injectable } from '@nestjs/common';
import { MasteryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';
import {
  CalculatedOutcomeMastery,
  MasteryAnswerInput,
  MasteryOutcomeInput,
  MasteryQuestionInput,
} from './mastery.types';

@Injectable()
export class MasteryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
  ) {}

  calculateSubmissionMastery(input: {
    outcomes: MasteryOutcomeInput[];
    questions: MasteryQuestionInput[];
    answers: MasteryAnswerInput[];
  }): CalculatedOutcomeMastery[] {
    const answerByQuestion = new Map(
      input.answers.map((answer) => [answer.questionId, answer]),
    );

    return input.outcomes.map((outcome) => {
      let numerator = 0;
      let denominator = 0;

      for (const question of input.questions) {
        const answer = answerByQuestion.get(question.id);
        if (!answer) {
          continue;
        }

        const link = question.outcomeLinks.find(
          (outcomeLink) => outcomeLink.learningOutcomeId === outcome.id,
        );
        if (!link) {
          continue;
        }

        const scoreRatio =
          question.maxScore > 0
            ? Math.max(0, Math.min(answer.score / question.maxScore, 1))
            : 0;
        const weightedQuestion = question.weight * link.weight;
        numerator += scoreRatio * weightedQuestion;
        denominator += weightedQuestion;
      }

      if (denominator === 0) {
        return {
          learningOutcomeId: outcome.id,
          title: outcome.title,
          percentage: 0,
          status: MasteryStatus.NOT_ASSESSED,
          attemptedWeight: 0,
        };
      }

      const percentage = Math.round((numerator / denominator) * 10000) / 100;
      return {
        learningOutcomeId: outcome.id,
        title: outcome.title,
        percentage,
        status: this.statusForPercentage(percentage),
        attemptedWeight: denominator,
      };
    });
  }

  statusForPercentage(percentage: number): MasteryStatus {
    if (percentage >= 80) {
      return MasteryStatus.MASTERED;
    }
    if (percentage >= 50) {
      return MasteryStatus.DEVELOPING;
    }
    return MasteryStatus.NEEDS_ATTENTION;
  }

  async storeSubmissionMastery(input: {
    studentId: string;
    courseId: string;
    assessmentId: string;
    submissionId: string;
    mastery: CalculatedOutcomeMastery[];
  }) {
    const assessed = input.mastery.filter(
      (record) => record.status !== MasteryStatus.NOT_ASSESSED,
    );

    await this.prisma.masteryRecord.createMany({
      data: assessed.map((record) => ({
        studentId: input.studentId,
        courseId: input.courseId,
        assessmentId: input.assessmentId,
        submissionId: input.submissionId,
        learningOutcomeId: record.learningOutcomeId,
        percentage: new Prisma.Decimal(record.percentage),
        status: record.status,
      })),
      skipDuplicates: true,
    });
  }

  async getStudentMastery(studentId: string, courseId: string) {
    await this.coursesService.ensureCourse(courseId);
    const outcomes = await this.prisma.learningOutcome.findMany({
      where: { courseId },
      orderBy: { sortOrder: 'asc' },
    });

    const records = await this.prisma.masteryRecord.findMany({
      where: { studentId, courseId },
      include: {
        assessment: { select: { id: true, title: true, type: true } },
        learningOutcome: { select: { id: true, title: true } },
      },
      orderBy: { calculatedAt: 'desc' },
    });

    const latestByOutcome = new Map<string, (typeof records)[number]>();
    for (const record of records) {
      if (!latestByOutcome.has(record.learningOutcomeId)) {
        latestByOutcome.set(record.learningOutcomeId, record);
      }
    }

    return {
      studentId,
      courseId,
      learningOutcomes: outcomes.map((outcome) => {
        const latest = latestByOutcome.get(outcome.id);
        return {
          id: outcome.id,
          title: outcome.title,
          masteryPercentage: latest ? Number(latest.percentage) : 0,
          status: latest?.status ?? MasteryStatus.NOT_ASSESSED,
          latestAssessmentId: latest?.assessmentId ?? null,
          calculatedAt: latest?.calculatedAt ?? null,
        };
      }),
      assessmentHistory: records
        .slice()
        .reverse()
        .map((record) => ({
          assessmentId: record.assessmentId,
          assessmentTitle: record.assessment.title,
          assessmentType: record.assessment.type,
          learningOutcomeId: record.learningOutcomeId,
          learningOutcomeTitle: record.learningOutcome.title,
          masteryPercentage: Number(record.percentage),
          status: record.status,
          calculatedAt: record.calculatedAt,
        })),
    };
  }
}
