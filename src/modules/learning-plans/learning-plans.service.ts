import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';
import { CreateLearningPlanDto } from './dto/create-learning-plan.dto';

@Injectable()
export class LearningPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
  ) {}

  async list(studentId: string, courseId: string) {
    await this.coursesService.ensureCourse(courseId);
    return this.prisma.learningPlan.findMany({
      where: { studentId, courseId },
      include: { tasks: { include: { learningOutcome: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(studentId: string, courseId: string, dto: CreateLearningPlanDto) {
    await this.coursesService.ensureCourse(courseId);
    return this.prisma.learningPlan.create({
      data: {
        studentId,
        courseId,
        title: dto.title,
        rationale: dto.rationale,
        tasks: {
          create: dto.tasks.map((task) => ({
            learningOutcomeId: task.learningOutcomeId,
            title: task.title,
            description: task.description,
            dueAt: task.dueAt ? new Date(task.dueAt) : undefined,
          })),
        },
      },
      include: { tasks: true },
    });
  }
}
