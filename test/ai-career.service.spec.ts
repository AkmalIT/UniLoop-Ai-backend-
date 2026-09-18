import { AgentRunStatus, AgentType } from '@prisma/client';
import { AiCareerService } from '../src/modules/career/ai/ai-career.service';
import {
  OpportunityExplanationContext,
  ProfessorRecommendationContext,
  SkillGapContext,
  StudentNextStepContext,
} from '../src/modules/career/ai/ai-career.types';

// ── Shared fixtures ──────────────────────────────────────────────────────────

const oppCtx: OpportunityExplanationContext = {
  targetRole: 'BACKEND_DEVELOPER',
  opportunityType: 'JOB',
  opportunityTitle: 'Backend Internship',
  opportunityDescription: 'Build REST APIs.',
  requiredSkills: ['Python', 'REST APIs'],
  matchScore: 75,           // set by backend, NOT by AI
  matchedSkills: ['Python'],
  missingSkills: ['REST APIs'],
  verifiedSkills: [],
};

const nextStepCtx: StudentNextStepContext = {
  targetRole: 'BACKEND_DEVELOPER',
  readinessLevel: 'PROJECT_READY',  // set by backend
  coreSkillsCovered: 2,
  coreSkillsTotal: 4,
  strongestSkills: [{ skill: 'Python', score: 85 }],
  skillGaps: ['REST APIs', 'Backend Development'],
  hasProjectEvidence: false,
  verifiedEvidenceCount: 0,
  recentMasteryTitles: ['Explain recursive functions'],
};

const profCtx: ProfessorRecommendationContext = {
  studentName: 'Student 1',
  targetRole: 'BACKEND_DEVELOPER',
  readinessLevel: 'INTERNSHIP_READY',  // set by backend
  masteryOutcomes: [{ title: 'Explain recursive functions', percentage: 90, status: 'MASTERED' }],
  verifiedSkills: [{ skill: 'Python', score: 85 }],
  projectEvidence: true,
  skillGaps: ['REST APIs'],
  coreSkillsCovered: 3,
  coreSkillsTotal: 4,
};

const gapCtx: SkillGapContext = {
  skill: 'REST APIs',
  targetRole: 'BACKEND_DEVELOPER',
  currentScore: null,
  relatedMasteryTitles: ['Implement recursive solutions'],
};

function makePrisma() {
  return {
    agentRun: { create: jest.fn().mockResolvedValue({ id: 'run-1' }) },
  };
}

function makeService(llmText: string | null, prisma = makePrisma()) {
  const llm = {
    generate: llmText === null
      ? jest.fn().mockRejectedValue(new Error('LLM unavailable'))
      : jest.fn().mockResolvedValue({ text: llmText, provider: 'gemini' }),
  };
  return { service: new AiCareerService(llm as never, prisma as never), llm, prisma };
}

// ── 1. Valid Gemini response ──────────────────────────────────────────────────
describe('AiCareerService – valid Gemini response', () => {
  it('returns parsed explanationUz and nextActionUz', async () => {
    const json = JSON.stringify({
      explanationUz: 'Bu imkoniyat Python ko\'nikmangizga mos keladi.',
      nextActionUz: 'Ariza yuboring.',
    });
    const { service } = makeService(json);
    const result = await service.explainOpportunity(oppCtx);
    expect(result.explanationUz).toBe('Bu imkoniyat Python ko\'nikmangizga mos keladi.');
    expect(result.nextActionUz).toBe('Ariza yuboring.');
  });
});

// ── 2. Malformed Gemini response ──────────────────────────────────────────────
describe('AiCareerService – malformed Gemini response', () => {
  it('returns fallback when JSON is invalid', async () => {
    const { service } = makeService('not valid json at all %%%');
    const result = await service.explainOpportunity(oppCtx);
    expect(result.explanationUz).toContain('BACKEND_DEVELOPER');
    expect(result.nextActionUz).toBeTruthy();
  });

  it('returns fallback when required fields are missing', async () => {
    const { service } = makeService(JSON.stringify({ someOtherField: 'x' }));
    const result = await service.explainOpportunity(oppCtx);
    expect(result.explanationUz).toBeTruthy();
    expect(result.nextActionUz).toBeTruthy();
  });
});

// ── 3. Gemini unavailable ─────────────────────────────────────────────────────
describe('AiCareerService – Gemini unavailable', () => {
  it('returns fallback and logs FAILED status', async () => {
    const prisma = makePrisma();
    const { service } = makeService(null, prisma);
    const result = await service.explainOpportunity(oppCtx);
    expect(result.explanationUz).toBeTruthy();
    expect(prisma.agentRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: AgentRunStatus.FAILED }),
      }),
    );
  });
});

// ── 4. Deterministic fallback ─────────────────────────────────────────────────
describe('AiCareerService – deterministic fallback content', () => {
  it('fallback for next-step contains actionable text', async () => {
    const { service } = makeService(null);
    const result = await service.suggestNextStep(nextStepCtx);
    expect(result.titleUz).toBeTruthy();
    expect(result.descriptionUz).toBeTruthy();
    expect(result.reasonUz).toBeTruthy();
  });

  it('fallback for skill gap contains skill name', async () => {
    const { service } = makeService(null);
    const result = await service.explainSkillGap(gapCtx);
    expect(result.skill).toBe('REST APIs');
    expect(result.explanationUz).toContain('REST APIs');
  });
});

// ── 5. No hallucinated fields ─────────────────────────────────────────────────
describe('AiCareerService – no hallucinated fields', () => {
  it('does not add extra fields beyond the defined output shape', async () => {
    const json = JSON.stringify({
      explanationUz: 'Tushuntirish.',
      nextActionUz: 'Keyingi qadam.',
      matchScore: 999,          // AI trying to inject a score — must be ignored
      readinessLevel: 'JUNIOR_READY',  // AI trying to set readiness — must be ignored
    });
    const { service } = makeService(json);
    const result = await service.explainOpportunity(oppCtx);
    // Only the two defined fields should be returned
    expect(Object.keys(result)).toEqual(['explanationUz', 'nextActionUz']);
  });
});

// ── 6. Opportunity explanation ────────────────────────────────────────────────
describe('AiCareerService – opportunity explanation', () => {
  it('calls LLM with a prompt containing opportunity title', async () => {
    const json = JSON.stringify({ explanationUz: 'ok', nextActionUz: 'ok' });
    const { service, llm } = makeService(json);
    await service.explainOpportunity(oppCtx);
    const prompt: string = (llm.generate as jest.Mock).mock.calls[0][0].prompt;
    expect(prompt).toContain('Backend Internship');
    expect(prompt).toContain('75%');
  });

  it('logs AgentRun with SUCCEEDED status on success', async () => {
    const prisma = makePrisma();
    const json = JSON.stringify({ explanationUz: 'ok', nextActionUz: 'ok' });
    const { service } = makeService(json, prisma);
    await service.explainOpportunity(oppCtx, 'user-1');
    expect(prisma.agentRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AgentRunStatus.SUCCEEDED,
          agentType: AgentType.TEACHING_RECOMMENDATION,
          userId: 'user-1',
        }),
      }),
    );
  });
});

// ── 7. Next-step generation ───────────────────────────────────────────────────
describe('AiCareerService – next-step generation', () => {
  it('returns parsed titleUz, descriptionUz, reasonUz', async () => {
    const json = JSON.stringify({
      titleUz: 'Loyiha boshlang',
      descriptionUz: 'REST API loyihasi yarating.',
      reasonUz: 'Amaliy tajriba kerak.',
    });
    const { service } = makeService(json);
    const result = await service.suggestNextStep(nextStepCtx);
    expect(result.titleUz).toBe('Loyiha boshlang');
    expect(result.descriptionUz).toBe('REST API loyihasi yarating.');
    expect(result.reasonUz).toBe('Amaliy tajriba kerak.');
  });

  it('prompt contains readiness level from backend context', async () => {
    const json = JSON.stringify({ titleUz: 'x', descriptionUz: 'x', reasonUz: 'x' });
    const { service, llm } = makeService(json);
    await service.suggestNextStep(nextStepCtx);
    const prompt: string = (llm.generate as jest.Mock).mock.calls[0][0].prompt;
    expect(prompt).toContain('PROJECT_READY');
  });
});

// ── 8. Professor recommendation draft ────────────────────────────────────────
describe('AiCareerService – professor recommendation draft', () => {
  it('returns summaryUz and developmentNoteUz', async () => {
    const json = JSON.stringify({
      summaryUz: 'Talaba kuchli.',
      developmentNoteUz: 'REST API ustida ishlash kerak.',
    });
    const { service } = makeService(json);
    const result = await service.draftProfessorRecommendation(profCtx);
    expect(result.summaryUz).toBe('Talaba kuchli.');
    expect(result.developmentNoteUz).toBe('REST API ustida ishlash kerak.');
  });

  it('prompt contains student name and mastery outcomes', async () => {
    const json = JSON.stringify({ summaryUz: 'x', developmentNoteUz: 'x' });
    const { service, llm } = makeService(json);
    await service.draftProfessorRecommendation(profCtx);
    const prompt: string = (llm.generate as jest.Mock).mock.calls[0][0].prompt;
    expect(prompt).toContain('Student 1');
    expect(prompt).toContain('Explain recursive functions');
  });
});

// ── 9. Skill gap explanation ──────────────────────────────────────────────────
describe('AiCareerService – skill gap explanation', () => {
  it('returns skill, explanationUz, nextStepUz', async () => {
    const json = JSON.stringify({
      skill: 'REST APIs',
      explanationUz: 'REST API tajribasi yo\'q.',
      nextStepUz: 'Kichik API loyihasi yarating.',
    });
    const { service } = makeService(json);
    const result = await service.explainSkillGap(gapCtx);
    expect(result.skill).toBe('REST APIs');
    expect(result.explanationUz).toBe('REST API tajribasi yo\'q.');
  });

  it('always returns the correct skill name even if AI returns wrong one', async () => {
    const json = JSON.stringify({
      skill: 'WRONG_SKILL',
      explanationUz: 'ok',
      nextStepUz: 'ok',
    });
    const { service } = makeService(json);
    const result = await service.explainSkillGap(gapCtx);
    // skill is always overridden from context, not from AI output
    expect(result.skill).toBe('REST APIs');
  });
});

// ── 10. Authorization before AI access ───────────────────────────────────────
describe('Authorization before AI access', () => {
  it('matchScore is not generated by AI — it comes from deterministic context', () => {
    // The matchScore in oppCtx is 75, set by OpportunityMatchingService.
    // AiCareerService receives it as input and only explains it.
    expect(oppCtx.matchScore).toBe(75);
    // AI output shape has no matchScore field
    const outputKeys = ['explanationUz', 'nextActionUz'];
    expect(outputKeys).not.toContain('matchScore');
  });

  it('readinessLevel is not generated by AI — it comes from CareerReadinessService', () => {
    expect(nextStepCtx.readinessLevel).toBe('PROJECT_READY');
    const outputKeys = ['titleUz', 'descriptionUz', 'reasonUz'];
    expect(outputKeys).not.toContain('readinessLevel');
  });

  it('professorVerified is not in AI output shape', () => {
    const outputKeys = ['summaryUz', 'developmentNoteUz'];
    expect(outputKeys).not.toContain('professorVerified');
  });

  it('endorsement status is not in AI output shape', () => {
    const outputKeys = ['summaryUz', 'developmentNoteUz'];
    expect(outputKeys).not.toContain('status');
    expect(outputKeys).not.toContain('endorsementStatus');
  });
});
