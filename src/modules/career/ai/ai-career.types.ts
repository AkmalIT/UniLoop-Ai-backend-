import { CareerReadinessLevel, TargetRole } from '@prisma/client';

export interface OpportunityExplanationContext {
  targetRole: TargetRole;
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
  targetRole: TargetRole;
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
  targetRole: TargetRole;
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
  targetRole: TargetRole;
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
