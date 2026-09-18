import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AssessmentNotFoundException,
  DuplicateSubmissionException,
  InvalidSubmissionException,
  StudentNotEnrolledException,
} from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { InsightsService } from '../insights/insights.service';
import { MasteryService } from '../mastery/mastery.service';
import { SkillEvidenceService } from '../career/skill-evidence.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly masteryService: MasteryService,
    private readonly insightsService: InsightsService,
    private readonly skillEvidenceService: SkillEvidenceService,
  ) {}

  async submit(assessmentId: string, dto: CreateSubmissionDto) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        course: { include: { learningOutcomes: { orderBy: { sortOrder: 'asc' } } } },
        questions: {
          include: { outcomeLinks: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!assessment) {
      throw new AssessmentNotFoundException(assessmentId);
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        courseId_studentId: {
          courseId: assessment.courseId,
          studentId: dto.studentId,
        },
      },
    });
    if (!enrollment) {
      throw new StudentNotEnrolledException(dto.studentId, assessment.courseId);
    }

    const existingSubmission = await this.prisma.submission.findUnique({
      where: {
        assessmentId_studentId: {
          assessmentId,
          studentId: dto.studentId,
        },
      },
    });
    if (existingSubmission) {
      throw new DuplicateSubmissionException();
    }

    this.validateAnswers(assessment.questions, dto.answers);

    const submission = await this.prisma.submission.create({
      data: {
        assessmentId,
        studentId: dto.studentId,
        answers: {
          create: dto.answers.map((answer) => ({
            questionId: answer.questionId,
            answer: answer.answer,
            score: new Prisma.Decimal(answer.score),
          })),
        },
      },
      include: { answers: true },
    });

    const mastery = this.masteryService.calculateSubmissionMastery({
      outcomes: assessment.course.learningOutcomes.map((outcome) => ({
        id: outcome.id,
        title: outcome.title,
      })),
      questions: assessment.questions.map((question) => ({
        id: question.id,
        weight: Number(question.weight),
        maxScore: Number(question.maxScore),
        outcomeLinks: question.outcomeLinks.map((link) => ({
          learningOutcomeId: link.learningOutcomeId,
          weight: Number(link.weight),
        })),
      })),
      answers: submission.answers.map((answer) => ({
        questionId: answer.questionId,
        score: Number(answer.score),
      })),
    });

    await this.masteryService.storeSubmissionMastery({
      studentId: dto.studentId,
      courseId: assessment.courseId,
      assessmentId,
      submissionId: submission.id,
      mastery,
    });

    // Integrate with Career Readiness layer: map mastery → skill evidence
    await this.skillEvidenceService.createFromMastery(
      mastery.map((m) => ({
        studentId: dto.studentId,
        learningOutcomeId: m.learningOutcomeId,
        learningOutcomeTitle: m.title,
        percentage: m.percentage,
        status: m.status,
        sourceId: submission.id,
      })),
    );

    const insights = await this.insightsService.calculateAndStoreCourseInsights(
      assessment.courseId,
    );

    return {
      submissionId: submission.id,
      status: submission.status,
      mastery,
      insightsSummary: {
        averageMastery: insights.averageMastery,
        weakestOutcomes: insights.weakestOutcomes,
      },
    };
  }

  async findOne(id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        assessment: { select: { id: true, title: true, courseId: true } },
        student: { include: { user: { select: { id: true, name: true, email: true } } } },
        answers: { include: { question: true } },
        masteryRecords: { include: { learningOutcome: true } },
      },
    });
    if (!submission) {
      throw new InvalidSubmissionException(`Submission ${id} was not found.`);
    }
    return submission;
  }

  private validateAnswers(
    questions: Array<{ id: string; maxScore: Prisma.Decimal }>,
    answers: Array<{ questionId: string; score: number }>,
  ) {
    const questionIds = new Set(questions.map((question) => question.id));
    const answerIds = new Set(answers.map((answer) => answer.questionId));

    if (answerIds.size !== answers.length) {
      throw new InvalidSubmissionException('Each question can only be answered once.');
    }

    for (const question of questions) {
      if (!answerIds.has(question.id)) {
        throw new InvalidSubmissionException('Submission must include every assessment question.');
      }
    }

    for (const answer of answers) {
      const question = questions.find((item) => item.id === answer.questionId);
      if (!questionIds.has(answer.questionId) || !question) {
        throw new InvalidSubmissionException(
          `Question ${answer.questionId} does not belong to this assessment.`,
        );
      }
      if (answer.score > Number(question.maxScore)) {
        throw new InvalidSubmissionException(
          `Score for question ${answer.questionId} exceeds the question max score.`,
        );
      }
    }
  }
}
