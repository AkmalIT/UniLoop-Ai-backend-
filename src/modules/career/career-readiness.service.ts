import { Injectable } from '@nestjs/common';
import { CareerReadinessLevel, TargetRole } from '@prisma/client';
import { ROLE_CORE_SKILLS } from './skill-map.constants';

export interface ReadinessInput {
  targetRole: TargetRole;
  skills: Array<{ skill: string; score: number; professorVerified: boolean }>;
  hasProjectEvidence: boolean;
}

export interface ReadinessResult {
  level: CareerReadinessLevel;
  reasons: string[];
  coreSkillsCovered: number;
  coreSkillsTotal: number;
  verifiedEvidenceCount: number;
}

/** Thresholds — all configurable here without touching logic. */
const THRESHOLDS = {
  /** Minimum score (0-100) to count a skill as "demonstrated". */
  demonstratedScore: 60,
  /** Fraction of core skills needed for PROJECT_READY. */
  projectReadyCoverage: 0.5,
  /** Fraction of core skills needed for INTERNSHIP_READY. */
  internshipReadyCoverage: 0.75,
  /** Fraction of core skills needed for JUNIOR_READY. */
  juniorReadyCoverage: 0.9,
  /** Verified evidence items needed for JUNIOR_READY. */
  juniorVerifiedCount: 2,
};

@Injectable()
export class CareerReadinessService {
  calculate(input: ReadinessInput): ReadinessResult {
    const coreSkills = ROLE_CORE_SKILLS[input.targetRole] ?? [];
    const skillMap = new Map(input.skills.map((s) => [s.skill, s]));

    const demonstratedCore = coreSkills.filter((skill) => {
      const evidence = skillMap.get(skill);
      return evidence && evidence.score >= THRESHOLDS.demonstratedScore;
    });

    const coverage = coreSkills.length > 0 ? demonstratedCore.length / coreSkills.length : 0;
    const verifiedCount = input.skills.filter((s) => s.professorVerified).length;

    const reasons: string[] = [];
    let level: CareerReadinessLevel;

    if (coverage >= THRESHOLDS.juniorReadyCoverage && input.hasProjectEvidence && verifiedCount >= THRESHOLDS.juniorVerifiedCount) {
      level = CareerReadinessLevel.JUNIOR_READY;
      reasons.push(`${demonstratedCore.length}/${coreSkills.length} core skills demonstrated`);
      reasons.push(`${verifiedCount} professor-verified evidence items`);
      reasons.push('Project evidence present');
    } else if (coverage >= THRESHOLDS.internshipReadyCoverage && input.hasProjectEvidence) {
      level = CareerReadinessLevel.INTERNSHIP_READY;
      reasons.push(`${demonstratedCore.length}/${coreSkills.length} core skills demonstrated`);
      reasons.push('Project evidence present');
      if (verifiedCount < THRESHOLDS.juniorVerifiedCount) {
        reasons.push(`Need ${THRESHOLDS.juniorVerifiedCount - verifiedCount} more professor-verified evidence for JUNIOR_READY`);
      }
    } else if (coverage >= THRESHOLDS.projectReadyCoverage) {
      level = CareerReadinessLevel.PROJECT_READY;
      reasons.push(`${demonstratedCore.length}/${coreSkills.length} core skills demonstrated`);
      if (!input.hasProjectEvidence) {
        reasons.push('Add project evidence to reach INTERNSHIP_READY');
      }
    } else {
      level = CareerReadinessLevel.LEARNING_FOUNDATIONS;
      reasons.push(`Only ${demonstratedCore.length}/${coreSkills.length} core skills demonstrated`);
      const missing = coreSkills.filter((s) => !demonstratedCore.includes(s));
      if (missing.length > 0) {
        reasons.push(`Missing core skills: ${missing.slice(0, 3).join(', ')}`);
      }
    }

    return {
      level,
      reasons,
      coreSkillsCovered: demonstratedCore.length,
      coreSkillsTotal: coreSkills.length,
      verifiedEvidenceCount: verifiedCount,
    };
  }
}
