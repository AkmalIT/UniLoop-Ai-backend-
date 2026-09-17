import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
  ) {}

  async create(courseId: string, dto: CreateEnrollmentDto) {
    await this.coursesService.ensureCourse(courseId);
    return this.prisma.enrollment.create({
      data: { courseId, studentId: dto.studentId },
    });
  }
}
