import { CareerReadinessLevel } from '@prisma/client';

export interface OpportunityExplanationContext {
  targetRole: string;
  opportunityType: string;
  opportunityTitle: string;
  opportunityDescription: string;
  requiredSkills: string[];
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  verifiedSkills: string[];
}

export interface StudentNextStepContext {
  targetRole: string;
  readinessLevel: CareerReadinessLevel;
  coreSkillsCovered: number;
  coreSkillsTotal: number;
  strongestSkills: Array<{ skill: string; score: number }>;
  skillGaps: string[];
  hasProjectEvidence: boolean;
  verifiedEvidenceCount: number;
  recentMasteryTitles: string[];
}

export interface ProfessorRecommendationContext {
  studentName: string;
  targetRole: string;
  readinessLevel: CareerReadinessLevel;
  masteryOutcomes: Array<{ title: string; percentage: number; status: string }>;
  verifiedSkills: Array<{ skill: string; score: number }>;
  projectEvidence: boolean;
  skillGaps: string[];
  coreSkillsCovered: number;
  coreSkillsTotal: number;
}

export interface SkillGapContext {
  skill: string;
  targetRole: string;
  currentScore: number | null;
  relatedMasteryTitles: string[];
}

export interface OpportunityExplanationOutput {
  explanationUz: string;
  nextActionUz: string;
}

export interface StudentNextStepOutput {
  titleUz: string;
  descriptionUz: string;
  reasonUz: string;
}

export interface ProfessorRecommendationOutput {
  summaryUz: string;
  developmentNoteUz: string;
}

export interface SkillGapOutput {
  skill: string;
  explanationUz: string;
  nextStepUz: string;
}

export interface VacancyQueryContext {
  targetRole: string;
  interests: string[];
  fallbackQueries: string[];
}

export interface CareerProfileAnalysisContext {
  statedDirection: string;
  major: string;
  interests: string[];
  skills: string[];
}

export interface CareerProfileAnalysisOutput {
  targetRole: string;
  coreSkills: string[];
  vacancyQueries: string[];
}
