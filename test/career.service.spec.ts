import { EvidenceSourceType, Prisma, RecommendationStatus } from '@prisma/client';
import { CareerReadinessService } from '../src/modules/career/career-readiness.service';
import { OpportunityMatchingService } from '../src/modules/career/opportunity-matching.service';
import { SkillEvidenceService } from '../src/modules/career/skill-evidence.service';

// ── 1. Career goal creation ──────────────────────────────────────────────────
describe('Career goal creation', () => {
  it('upserts a career profile via CareerService.setCareerGoal', async () => {
    const prisma = {
      careerProfile: {
        upsert: jest.fn().mockResolvedValue({
          id: 'cp-1',
          studentId: 's-1',
          targetRole: 'BACKEND_DEVELOPER',
          interests: ['algorithms'],
          availability: 'Part-time',
        }),
      },
    };
    const { CareerService } = await import('../src/modules/career/career.service');
    const service = new CareerService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const result = await service.setCareerGoal('s-1', {
      targetRole: 'BACKEND_DEVELOPER' as never,
      interests: ['algorithms'],
      availability: 'Part-time',
    });
    expect(prisma.careerProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: 's-1' } }),
    );
    expect(result.targetRole).toBe('BACKEND_DEVELOPER');
  });
});

// ── 2. Skill evidence creation ───────────────────────────────────────────────
describe('SkillEvidenceService.createManual', () => {
  it('upserts evidence with correct fields', async () => {
    const prisma = {
      skillEvidence: {
        upsert: jest.fn().mockResolvedValue({
          id: 'se-1',
          skill: 'Python',
          score: new Prisma.Decimal(85),
        }),
      },
    };
    const service = new SkillEvidenceService(prisma as never);
    const result = await service.createManual({
      studentId: 's-1',
      skill: 'Python',
      sourceType: EvidenceSourceType.PROJECT,
      sourceId: 'proj-1',
      score: 85,
    });
    expect(prisma.skillEvidence.upsert).toHaveBeenCalled();
    expect(result.skill).toBe('Python');
  });
});

// ── 3. Skill evidence aggregation ────────────────────────────────────────────
describe('SkillEvidenceService.aggregateStudentSkills', () => {
  it('returns best score per skill and merges professorVerified', async () => {
    const prisma = {
      skillEvidence: {
        findMany: jest.fn().mockResolvedValue([
          { skill: 'Python', score: new Prisma.Decimal(70), professorVerified: false },
          { skill: 'Python', score: new Prisma.Decimal(90), professorVerified: true },
          { skill: 'SQL', score: new Prisma.Decimal(60), professorVerified: false },
        ]),
      },
    };
    const service = new SkillEvidenceService(prisma as never);
    const result = await service.aggregateStudentSkills('s-1');
    const python = result.find((s) => s.skill === 'Python')!;
    expect(python.score).toBe(90);
    expect(python.professorVerified).toBe(true);
    expect(result).toHaveLength(2);
  });
});

// ── 4. Opportunity matching ───────────────────────────────────────────────────
describe('OpportunityMatchingService.computeMatch', () => {
  const service = new OpportunityMatchingService({} as never);

  it('calculates correct match score', () => {
    const result = service.computeMatch({
      studentId: 's-1',
      skills: [
        { skill: 'Python', score: 90 },
        { skill: 'SQL', score: 80 },
      ],
      opportunityId: 'opp-1',
      requiredSkills: ['Python', 'SQL', 'REST APIs'],
    });
    expect(result.matchScore).toBe(67); // 2/3 rounded
    expect(result.matchedSkills).toEqual(expect.arrayContaining(['Python', 'SQL']));
    expect(result.missingSkills).toEqual(['REST APIs']);
  });

  it('returns 100 when no required skills', () => {
    const result = service.computeMatch({
      studentId: 's-1',
      skills: [],
      opportunityId: 'opp-2',
      requiredSkills: [],
    });
    expect(result.matchScore).toBe(100);
  });
});

// ── 5. Missing skill detection ────────────────────────────────────────────────
describe('Missing skill detection', () => {
  const service = new OpportunityMatchingService({} as never);

  it('identifies all missing skills when student has none', () => {
    const result = service.computeMatch({
      studentId: 's-1',
      skills: [],
      opportunityId: 'opp-1',
      requiredSkills: ['Python', 'SQL'],
    });
    expect(result.matchScore).toBe(0);
    expect(result.missingSkills).toEqual(['Python', 'SQL']);
    expect(result.matchedSkills).toHaveLength(0);
  });
});

// ── 6. Career readiness calculation ──────────────────────────────────────────
describe('CareerReadinessService', () => {
  const service = new CareerReadinessService();

  it('returns LEARNING_FOUNDATIONS when few core skills demonstrated', () => {
    const result = service.calculate({
      targetRole: 'BACKEND_DEVELOPER' as never,
      skills: [{ skill: 'Python', score: 65, professorVerified: false }],
      hasProjectEvidence: false,
    });
    expect(result.level).toBe('LEARNING_FOUNDATIONS');
  });

  it('returns PROJECT_READY when ≥50% core skills demonstrated', () => {
    const result = service.calculate({
      targetRole: 'BACKEND_DEVELOPER' as never,
      skills: [
        { skill: 'Python', score: 75, professorVerified: false },
        { skill: 'Algorithms', score: 70, professorVerified: false },
      ],
      hasProjectEvidence: false,
    });
    expect(result.level).toBe('PROJECT_READY');
  });

  it('returns INTERNSHIP_READY when ≥75% core skills + project evidence', () => {
    const result = service.calculate({
      targetRole: 'BACKEND_DEVELOPER' as never,
      skills: [
        { skill: 'Python', score: 80, professorVerified: false },
        { skill: 'Algorithms', score: 75, professorVerified: false },
        { skill: 'REST APIs', score: 70, professorVerified: false },
      ],
      hasProjectEvidence: true,
    });
    expect(result.level).toBe('INTERNSHIP_READY');
  });

  it('returns JUNIOR_READY when ≥90% core skills + project + 2 verified', () => {
    const result = service.calculate({
      targetRole: 'BACKEND_DEVELOPER' as never,
      skills: [
        { skill: 'Python', score: 90, professorVerified: true },
        { skill: 'Algorithms', score: 85, professorVerified: true },
        { skill: 'REST APIs', score: 80, professorVerified: false },
        { skill: 'Backend Development', score: 75, professorVerified: false },
      ],
      hasProjectEvidence: true,
    });
    expect(result.level).toBe('JUNIOR_READY');
  });

  it('includes reasons in result', () => {
    const result = service.calculate({
      targetRole: 'BACKEND_DEVELOPER' as never,
      skills: [],
      hasProjectEvidence: false,
    });
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.coreSkillsTotal).toBeGreaterThan(0);
  });
});

// ── 7. Recommendation status updates ─────────────────────────────────────────
describe('Recommendation status update', () => {
  it('updates status when student owns the recommendation', async () => {
    const prisma = {
      matchRecommendation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'rec-1', studentId: 's-1' }),
        update: jest.fn().mockResolvedValue({ id: 'rec-1', status: RecommendationStatus.INTERESTED }),
      },
    };
    const { CareerService } = await import('../src/modules/career/career.service');
    const service = new CareerService(prisma as never, {} as never, {} as never, {} as never);
    const result = await service.updateRecommendationStatus('rec-1', 's-1', RecommendationStatus.INTERESTED);
    expect(prisma.matchRecommendation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: RecommendationStatus.INTERESTED } }),
    );
    expect(result.status).toBe(RecommendationStatus.INTERESTED);
  });

  it('throws ForbiddenException when student does not own recommendation', async () => {
    const prisma = {
      matchRecommendation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'rec-1', studentId: 's-other' }),
      },
    };
    const { CareerService } = await import('../src/modules/career/career.service');
    const service = new CareerService(prisma as never, {} as never, {} as never, {} as never);
    await expect(
      service.updateRecommendationStatus('rec-1', 's-1', RecommendationStatus.DISMISSED),
    ).rejects.toThrow();
  });
});

// ── 8. Consent enforcement ────────────────────────────────────────────────────
describe('Consent enforcement', () => {
  it('blocks professor from viewing evidence when referral not allowed', async () => {
    const prisma = {
      consent: {
        findUnique: jest.fn().mockResolvedValue({ professorReferralAllowed: false }),
      },
    };
    const { CareerService } = await import('../src/modules/career/career.service');
    const service = new CareerService(prisma as never, {} as never, {} as never, {} as never);
    await expect(
      service.getStudentEvidenceForProfessor('prof-1', 's-1'),
    ).rejects.toThrow();
  });

  it('allows professor to view evidence when referral is allowed', async () => {
    const prisma = {
      consent: {
        findUnique: jest.fn().mockResolvedValue({ professorReferralAllowed: true }),
      },
      skillEvidence: {
        findMany: jest.fn().mockResolvedValue([{ skill: 'Python', score: new Prisma.Decimal(80), professorVerified: false }]),
      },
    };
    const skillEvidenceService = new SkillEvidenceService(prisma as never);
    const { CareerService } = await import('../src/modules/career/career.service');
    const service = new CareerService(prisma as never, skillEvidenceService, {} as never, {} as never);
    const result = await service.getStudentEvidenceForProfessor('prof-1', 's-1');
    expect(result).toHaveLength(1);
  });
});

// ── 9. Professor endorsement permissions ─────────────────────────────────────
describe('Professor endorsement permissions', () => {
  it('rejects endorsement review by wrong professor', async () => {
    const prisma = {
      professorEndorsement: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'end-1',
          professorId: 'prof-correct',
          items: [],
        }),
      },
    };
    const { CareerService } = await import('../src/modules/career/career.service');
    const service = new CareerService(prisma as never, {} as never, {} as never, {} as never);
    await expect(
      service.reviewEndorsement('prof-wrong', {
        endorsementId: 'end-1',
        status: 'ENDORSED',
      }),
    ).rejects.toThrow();
  });

  it('marks evidence as professorVerified on ENDORSED', async () => {
    const prisma = {
      professorEndorsement: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'end-1',
          professorId: 'prof-1',
          items: [{ evidenceId: 'ev-1' }],
        }),
        update: jest.fn().mockResolvedValue({ id: 'end-1', status: 'ENDORSED' }),
      },
      skillEvidence: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const { CareerService } = await import('../src/modules/career/career.service');
    const service = new CareerService(prisma as never, {} as never, {} as never, {} as never);
    await service.reviewEndorsement('prof-1', { endorsementId: 'end-1', status: 'ENDORSED' });
    expect(prisma.skillEvidence.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { professorVerified: true } }),
    );
  });
});

// ── 10. AI cannot affect deterministic match/readiness values ─────────────────
describe('AI boundary', () => {
  it('CareerReadinessService.calculate is pure and deterministic (no async, no LLM)', () => {
    const service = new CareerReadinessService();
    const input = {
      targetRole: 'BACKEND_DEVELOPER' as never,
      skills: [{ skill: 'Python', score: 80, professorVerified: false }],
      hasProjectEvidence: false,
    };
    const r1 = service.calculate(input);
    const r2 = service.calculate(input);
    expect(r1.level).toBe(r2.level);
    expect(r1.coreSkillsCovered).toBe(r2.coreSkillsCovered);
  });

  it('OpportunityMatchingService.computeMatch is pure and deterministic (no async, no LLM)', () => {
    const service = new OpportunityMatchingService({} as never);
    const input = {
      studentId: 's-1',
      skills: [{ skill: 'Python', score: 80 }],
      opportunityId: 'opp-1',
      requiredSkills: ['Python', 'SQL'],
    };
    const r1 = service.computeMatch(input);
    const r2 = service.computeMatch(input);
    expect(r1.matchScore).toBe(r2.matchScore);
    expect(r1.matchScore).toBe(50);
  });
});
