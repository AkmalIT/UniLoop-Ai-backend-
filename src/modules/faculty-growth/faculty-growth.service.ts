import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGrowthPlanDto } from './dto/create-growth-plan.dto';

@Injectable()
export class FacultyGrowthService {
  constructor(private readonly prisma: PrismaService) {}

  list(professorId: string) {
    return this.prisma.growthGoal.findMany({
      where: { professorId },
      include: { tasks: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(professorId: string, dto: CreateGrowthPlanDto) {
    return this.prisma.growthGoal.create({
      data: {
        professorId,
        title: dto.title,
        description: dto.description,
        tasks: {
          create: dto.tasks.map((task) => ({
            title: task.title,
            description: task.description,
            status: task.status,
            dueAt: task.dueAt ? new Date(task.dueAt) : undefined,
          })),
        },
      },
      include: { tasks: true },
    });
  }
}
