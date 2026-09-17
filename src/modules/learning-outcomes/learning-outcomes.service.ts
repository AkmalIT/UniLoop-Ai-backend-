import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';
import { CreateLearningOutcomeDto } from './dto/create-learning-outcome.dto';

@Injectable()
export class LearningOutcomesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
  ) {}

  async create(courseId: string, dto: CreateLearningOutcomeDto) {
    await this.coursesService.ensureCourse(courseId);
    return this.prisma.learningOutcome.create({
      data: {
        courseId,
        title: dto.title,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async list(courseId: string) {
    await this.coursesService.ensureCourse(courseId);
    return this.prisma.learningOutcome.findMany({
      where: { courseId },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
