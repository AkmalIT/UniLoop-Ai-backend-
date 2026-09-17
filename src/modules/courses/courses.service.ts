import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CourseNotFoundException } from '../../common/exceptions/domain.exception';
import { CreateCourseDto } from './dto/create-course.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCourseDto) {
    return this.prisma.course.create({ data: dto });
  }

  async findOne(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        professor: { include: { user: { select: { id: true, name: true, email: true } } } },
        learningOutcomes: { orderBy: { sortOrder: 'asc' } },
        assessments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!course) {
      throw new CourseNotFoundException(id);
    }
    return course;
  }

  async students(courseId: string) {
    await this.ensureCourse(courseId);
    return this.prisma.enrollment.findMany({
      where: { courseId },
      include: { student: { include: { user: { select: { id: true, name: true, email: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async ensureCourse(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw new CourseNotFoundException(id);
    }
    return course;
  }
}
