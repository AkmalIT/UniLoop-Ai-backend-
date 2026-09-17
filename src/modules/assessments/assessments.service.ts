import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AssessmentNotFoundException } from '../../common/exceptions/domain.exception';
import { CoursesService } from '../courses/courses.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { CreateQuestionDto } from './dto/create-question.dto';

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
  ) {}

  async list(courseId: string) {
    await this.coursesService.ensureCourse(courseId);
    return this.prisma.assessment.findMany({
      where: { courseId },
      include: { questions: { include: { outcomeLinks: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(courseId: string, dto: CreateAssessmentDto) {
    await this.coursesService.ensureCourse(courseId);
    return this.prisma.assessment.create({
      data: {
        courseId,
        title: dto.title,
        type: dto.type,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      },
    });
  }

  async findOne(id: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        course: true,
        questions: {
          include: {
            outcomeLinks: { include: { learningOutcome: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!assessment) {
      throw new AssessmentNotFoundException(id);
    }
    return assessment;
  }

  async addQuestion(assessmentId: string, dto: CreateQuestionDto) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) {
      throw new AssessmentNotFoundException(assessmentId);
    }

    const outcomeIds = dto.outcomes.map((outcome) => outcome.learningOutcomeId);
    const matchingOutcomes = await this.prisma.learningOutcome.findMany({
      where: { id: { in: outcomeIds }, courseId: assessment.courseId },
    });
    if (matchingOutcomes.length !== outcomeIds.length) {
      throw new BadRequestException('All question outcomes must belong to the assessment course.');
    }

    return this.prisma.question.create({
      data: {
        assessmentId,
        prompt: dto.prompt,
        type: dto.type,
        weight: new Prisma.Decimal(dto.weight),
        maxScore: new Prisma.Decimal(dto.maxScore ?? 1),
        correctAnswer: dto.correctAnswer,
        sortOrder: dto.sortOrder ?? 0,
        outcomeLinks: {
          create: dto.outcomes.map((outcome) => ({
            learningOutcomeId: outcome.learningOutcomeId,
            weight: new Prisma.Decimal(outcome.weight ?? 1),
          })),
        },
      },
      include: { outcomeLinks: true },
    });
  }

  async ensureAssessment(id: string) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment) {
      throw new NotFoundException(`Assessment ${id} was not found.`);
    }
    return assessment;
  }
}
