import { MasteryStatus } from '@prisma/client';

export interface MasteryQuestionInput {
  id: string;
  weight: number;
  maxScore: number;
  outcomeLinks: Array<{
    learningOutcomeId: string;
    weight: number;
  }>;
}

export interface MasteryAnswerInput {
  questionId: string;
  score: number;
}

export interface MasteryOutcomeInput {
  id: string;
  title: string;
}

export interface CalculatedOutcomeMastery {
  learningOutcomeId: string;
  title: string;
  percentage: number;
  status: MasteryStatus;
  attemptedWeight: number;
}
