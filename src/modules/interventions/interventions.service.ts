import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';
import { CreateInterventionDto } from './dto/create-intervention.dto';

@Injectable()
export class InterventionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
  ) {}

  async list(courseId: string) {
    await this.coursesService.ensureCourse(courseId);
    return this.prisma.intervention.findMany({
      where: { courseId },
      include: { professor: { include: { user: { select: { id: true, name: true, email: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(courseId: string, dto: CreateInterventionDto) {
    await this.coursesService.ensureCourse(courseId);
    return this.prisma.intervention.create({
      data: {
        courseId,
        professorId: dto.professorId,
        title: dto.title,
        description: dto.description,
        targetOutcomeIds: dto.targetOutcomeIds,
        status: dto.status,
        plannedAt: dto.plannedAt ? new Date(dto.plannedAt) : undefined,
      },
    });
  }
}
