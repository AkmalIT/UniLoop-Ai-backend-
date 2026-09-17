import { MasteryStatus } from '@prisma/client';
import { MasteryService } from '../src/modules/mastery/mastery.service';

describe('MasteryService', () => {
  const service = new MasteryService({} as never, {} as never);

  it('calculates mastery for multiple learning outcomes', () => {
    const result = service.calculateSubmissionMastery({
      outcomes: [
        { id: 'lo-1', title: 'Explain recursion' },
        { id: 'lo-2', title: 'Trace stack' },
      ],
      questions: [
        {
          id: 'q-1',
          weight: 20,
          maxScore: 1,
          outcomeLinks: [{ learningOutcomeId: 'lo-1', weight: 1 }],
        },
        {
          id: 'q-2',
          weight: 30,
          maxScore: 1,
          outcomeLinks: [{ learningOutcomeId: 'lo-2', weight: 1 }],
        },
      ],
      answers: [
        { questionId: 'q-1', score: 1 },
        { questionId: 'q-2', score: 0.5 },
      ],
    });

    expect(result).toEqual([
      expect.objectContaining({
        learningOutcomeId: 'lo-1',
        percentage: 100,
        status: MasteryStatus.MASTERED,
      }),
      expect.objectContaining({
        learningOutcomeId: 'lo-2',
        percentage: 50,
        status: MasteryStatus.DEVELOPING,
      }),
    ]);
  });

  it('handles weighted questions mapped to the same outcome', () => {
    const [mastery] = service.calculateSubmissionMastery({
      outcomes: [{ id: 'lo-1', title: 'Implement recursion' }],
      questions: [
        {
          id: 'q-1',
          weight: 25,
          maxScore: 1,
          outcomeLinks: [{ learningOutcomeId: 'lo-1', weight: 1 }],
        },
        {
          id: 'q-2',
          weight: 75,
          maxScore: 1,
          outcomeLinks: [{ learningOutcomeId: 'lo-1', weight: 1 }],
        },
      ],
      answers: [
        { questionId: 'q-1', score: 1 },
        { questionId: 'q-2', score: 0 },
      ],
    });

    expect(mastery.percentage).toBe(25);
    expect(mastery.status).toBe(MasteryStatus.NEEDS_ATTENTION);
  });

  it('splits a question across linked learning outcomes', () => {
    const result = service.calculateSubmissionMastery({
      outcomes: [
        { id: 'lo-1', title: 'Base case' },
        { id: 'lo-2', title: 'Implementation' },
      ],
      questions: [
        {
          id: 'q-debug',
          weight: 10,
          maxScore: 1,
          outcomeLinks: [
            { learningOutcomeId: 'lo-1', weight: 0.5 },
            { learningOutcomeId: 'lo-2', weight: 0.5 },
          ],
        },
      ],
      answers: [{ questionId: 'q-debug', score: 0.8 }],
    });

    expect(result.map((item) => item.percentage)).toEqual([80, 80]);
    expect(result.every((item) => item.status === MasteryStatus.MASTERED)).toBe(true);
  });

  it('returns NOT_ASSESSED when an outcome has no linked answered question', () => {
    const [mastery] = service.calculateSubmissionMastery({
      outcomes: [{ id: 'lo-1', title: 'Unassessed outcome' }],
      questions: [],
      answers: [],
    });

    expect(mastery.status).toBe(MasteryStatus.NOT_ASSESSED);
    expect(mastery.percentage).toBe(0);
  });
});
