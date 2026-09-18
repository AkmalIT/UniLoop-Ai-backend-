import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface MatchInput {
  studentId: string;
  skills: Array<{ skill: string; score: number }>;
  opportunityId: string;
  requiredSkills: string[];
}

export interface MatchResult {
  opportunityId: string;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
}

@Injectable()
export class OpportunityMatchingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pure deterministic match — no LLM involved. */
  computeMatch(input: MatchInput): MatchResult {
    if (input.requiredSkills.length === 0) {
      return {
        opportunityId: input.opportunityId,
        matchScore: 100,
        matchedSkills: [],
        missingSkills: [],
      };
    }

    const skillScoreMap = new Map(input.skills.map((s) => [s.skill.toLowerCase(), s.score]));
    const matched: string[] = [];
    const missing: string[] = [];

    for (const required of input.requiredSkills) {
      if (skillScoreMap.has(required.toLowerCase())) {
        matched.push(required);
      } else {
        missing.push(required);
      }
    }

    const matchScore = Math.round((matched.length / input.requiredSkills.length) * 100);
    return { opportunityId: input.opportunityId, matchScore, matchedSkills: matched, missingSkills: missing };
  }

  /** Compute and persist top-3 recommendations for a student. */
  async refreshRecommendations(
    studentId: string,
    skills: Array<{ skill: string; score: number }>,
  ): Promise<void> {
    const opportunities = await this.prisma.opportunity.findMany();

    const scored = opportunities
      .map((opp) =>
        this.computeMatch({
          studentId,
          skills,
          opportunityId: opp.id,
          requiredSkills: opp.requiredSkills,
        }),
      )
      .filter((r) => r.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);

    for (const result of scored) {
      await this.prisma.matchRecommendation.upsert({
        where: { studentId_opportunityId: { studentId, opportunityId: result.opportunityId } },
        create: {
          studentId,
          opportunityId: result.opportunityId,
          matchScore: new Prisma.Decimal(result.matchScore),
          matchedSkills: result.matchedSkills,
          missingSkills: result.missingSkills,
        },
        update: {
          matchScore: new Prisma.Decimal(result.matchScore),
          matchedSkills: result.matchedSkills,
          missingSkills: result.missingSkills,
        },
      });
    }
  }
}
