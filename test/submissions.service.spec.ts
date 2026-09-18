import { Prisma } from '@prisma/client';
import { InvalidSubmissionException } from '../src/common/exceptions/domain.exception';
import { SubmissionsService } from '../src/modules/submissions/submissions.service';

describe('SubmissionsService validation', () => {
  const service = new SubmissionsService({} as never, {} as never, {} as never, {} as never);

  it('rejects missing answers', () => {
    expect(() =>
      validateAnswers([
        { id: 'q-1', maxScore: new Prisma.Decimal(1) },
        { id: 'q-2', maxScore: new Prisma.Decimal(1) },
      ], [{ questionId: 'q-1', score: 1 }]),
    ).toThrow(InvalidSubmissionException);
  });

  it('rejects scores above question max score', () => {
    expect(() =>
      validateAnswers(
        [{ id: 'q-1', maxScore: new Prisma.Decimal(1) }],
        [{ questionId: 'q-1', score: 2 }],
      ),
    ).toThrow(InvalidSubmissionException);
  });

  function validateAnswers(
    questions: Array<{ id: string; maxScore: Prisma.Decimal }>,
    answers: Array<{ questionId: string; score: number }>,
  ) {
    return (
      service as unknown as {
        validateAnswers: (
          questions: Array<{ id: string; maxScore: Prisma.Decimal }>,
          answers: Array<{ questionId: string; score: number }>,
        ) => void;
      }
    ).validateAnswers(questions, answers);
  }
});
