import { Prisma } from '@prisma/client';
import { CoursesService } from '../src/modules/courses/courses.service';
import { InsightsService } from '../src/modules/insights/insights.service';

describe('InsightsService', () => {
  it('aggregates cohort mastery, weakest outcome, question difficulty, and threshold support', async () => {
    const prisma = {
      enrollment: {
        findMany: jest.fn().mockResolvedValue([
          { studentId: 's1', student: { user: { name: 'A', email: 'a@test.dev' } } },
          { studentId: 's2', student: { user: { name: 'B', email: 'b@test.dev' } } },
        ]),
      },
      learningOutcome: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'lo-1', title: 'Explain', sortOrder: 1 },
          { id: 'lo-2', title: 'Trace', sortOrder: 2 },
        ]),
      },
      masteryRecord: {
        findMany: jest.fn().mockResolvedValue([
          record('s1', 'lo-1', 90),
          record('s1', 'lo-2', 40),
          record('s2', 'lo-1', 70),
          record('s2', 'lo-2', 30),
        ]),
      },
      question: {
        findMany: jest.fn().mockResolvedValue([
          question('q-1', 'Easy prompt', 1, [1, 0.8]),
          question('q-2', 'Difficult prompt', 1, [0.2, 0.4]),
        ]),
      },
    };
    const coursesService = { ensureCourse: jest.fn().mockResolvedValue({ id: 'course-1' }) };
    const service = new InsightsService(
      prisma as never,
      coursesService as unknown as CoursesService,
    );

    const result = await service.calculateCourseInsights('course-1', 60);

    expect(result.averageMastery).toBe(57.5);
    expect(result.weakestOutcomes[0]).toEqual(
      expect.objectContaining({ id: 'lo-2', averageMastery: 35 }),
    );
    expect(result.strongestOutcomes[0]).toEqual(
      expect.objectContaining({ id: 'lo-1', averageMastery: 80 }),
    );
    expect(result.studentsNeedingSupport).toEqual([
      expect.objectContaining({ studentId: 's2', averageMastery: 50 }),
    ]);
    expect(result.difficultQuestions[0]).toEqual(
      expect.objectContaining({ id: 'q-2', averageScorePercentage: 30 }),
    );
  });
});

function record(studentId: string, learningOutcomeId: string, percentage: number) {
  return {
    studentId,
    learningOutcomeId,
    percentage: new Prisma.Decimal(percentage),
    calculatedAt: new Date(),
  };
}

function question(id: string, prompt: string, maxScore: number, scores: number[]) {
  return {
    id,
    prompt,
    maxScore: new Prisma.Decimal(maxScore),
    answers: scores.map((score) => ({ score: new Prisma.Decimal(score) })),
  };
}
