import { Injectable } from '@nestjs/common';
import { EvidenceSourceType, MasteryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { mapOutcomeToSkills } from './skill-map.constants';

export interface MasteryEvidenceInput {
  studentId: string;
  learningOutcomeId: string;
  learningOutcomeTitle: string;
  percentage: number;
  status: MasteryStatus;
  sourceId: string; // submissionId
}

@Injectable()
export class SkillEvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Called after mastery is stored. Maps outcomes → skills and upserts evidence. */
  async createFromMastery(inputs: MasteryEvidenceInput[]): Promise<void> {
    const assessed = inputs.filter((i) => i.status !== MasteryStatus.NOT_ASSESSED);
    for (const input of assessed) {
      const skills = mapOutcomeToSkills(input.learningOutcomeTitle);
      for (const skill of skills) {
        await this.prisma.skillEvidence.upsert({
          where: {
            studentId_skill_sourceType_sourceId: {
              studentId: input.studentId,
              skill,
              sourceType: EvidenceSourceType.ASSESSMENT_MASTERY,
              sourceId: input.sourceId,
            },
          },
          create: {
            studentId: input.studentId,
            skill,
            sourceType: EvidenceSourceType.ASSESSMENT_MASTERY,
            sourceId: input.sourceId,
            score: new Prisma.Decimal(input.percentage),
          },
          update: {
            score: new Prisma.Decimal(input.percentage),
          },
        });
      }
    }
  }

  async createManual(input: {
    studentId: string;
    skill: string;
    sourceType: EvidenceSourceType;
    sourceId: string;
    score: number;
  }) {
    return this.prisma.skillEvidence.upsert({
      where: {
        studentId_skill_sourceType_sourceId: {
          studentId: input.studentId,
          skill: input.skill,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
      },
      create: {
        studentId: input.studentId,
        skill: input.skill,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        score: new Prisma.Decimal(input.score),
      },
      update: { score: new Prisma.Decimal(input.score) },
    });
  }

  async getStudentEvidence(studentId: string) {
    return this.prisma.skillEvidence.findMany({
      where: { studentId },
      orderBy: [{ skill: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /** Aggregate: best score per skill across all evidence. */
  async aggregateStudentSkills(
    studentId: string,
  ): Promise<Array<{ skill: string; score: number; professorVerified: boolean }>> {
    const evidence = await this.getStudentEvidence(studentId);
    const bySkill = new Map<string, { score: number; professorVerified: boolean }>();
    for (const item of evidence) {
      const score = Number(item.score);
      const existing = bySkill.get(item.skill);
      if (!existing || score > existing.score) {
        bySkill.set(item.skill, {
          score,
          professorVerified: item.professorVerified || (existing?.professorVerified ?? false),
        });
      }
    }
    return Array.from(bySkill.entries()).map(([skill, data]) => ({ skill, ...data }));
  }
}
