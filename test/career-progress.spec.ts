import { CareerApiService } from '../src/modules/integration/career-api.service';

describe('CareerApiService.progress', () => {
  it('uses only persisted evidence, keeps the score bounded, and does not call AI', async () => {
    const ai = { suggestNextStep: jest.fn() };
    const prisma = {
      masteryRecord: { findMany: jest.fn().mockResolvedValue([{ courseId: 'course-1', percentage: 80, calculatedAt: new Date(), course: { id: 'course-1', title: 'Web dasturlash', code: 'WEB201' }, learningOutcome: { id: 'outcome-1', title: 'React komponentlari' }, assessment: { id: 'assessment-1', title: 'Follow-up', type: 'FOLLOW_UP' } }]) },
      skillEvidence: { findMany: jest.fn().mockResolvedValue([{ skill: 'React', score: 80, professorVerified: true, sourceType: 'PROJECT' }]) },
      careerProfile: { findUnique: jest.fn().mockResolvedValue({ targetRole: 'Frontend developer', interests: ['React'], coreSkills: ['React'] }) },
      learningPlan: { findMany: jest.fn().mockResolvedValue([{ tasks: [{ completedAt: new Date() }, { completedAt: null }] }]) },
      consent: { findUnique: jest.fn().mockResolvedValue({ professorReferralAllowed: true }) },
    };
    const service = new CareerApiService(
      prisma as never,
      { profile: jest.fn().mockResolvedValue('student-1') } as never,
      {} as never,
      ai as never,
    );

    const result = await service.progress({ id: 'user-1', role: 'STUDENT' } as never);

    expect(result.readiness.score).toBe(73);
    expect(result.readiness.stage).toBe('INTERNSHIP_READY');
    expect(result.readiness.factors).toHaveLength(7);
    expect(result.readiness.score).toBeGreaterThanOrEqual(0);
    expect(result.readiness.score).toBeLessThanOrEqual(100);
    expect(ai.suggestNextStep).not.toHaveBeenCalled();
  });
});
