import { Inject, Injectable, Logger } from '@nestjs/common';
import { AgentRunStatus, AgentType, Prisma } from '@prisma/client';
import { LLM_PROVIDER, LlmProvider } from '../../../integrations/llm/llm-provider.interface';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  OpportunityExplanationContext,
  OpportunityExplanationOutput,
  ProfessorRecommendationContext,
  ProfessorRecommendationOutput,
  SkillGapContext,
  SkillGapOutput,
  StudentNextStepContext,
  StudentNextStepOutput,
} from './ai-career.types';
import {
  buildOpportunityExplanationPrompt,
  buildProfessorRecommendationPrompt,
  buildSkillGapPrompt,
  buildStudentNextStepPrompt,
} from './ai-career.prompts';

@Injectable()
export class AiCareerService {
  private readonly logger = new Logger(AiCareerService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly prisma: PrismaService,
  ) {}

  // ── 1. Opportunity Explanation ───────────────────────────────────────────

  async explainOpportunity(
    ctx: OpportunityExplanationContext,
    userId?: string,
  ): Promise<OpportunityExplanationOutput> {
    const fallback: OpportunityExplanationOutput = {
      explanationUz: `Bu imkoniyat sizning "${ctx.targetRole}" yo'nalishingiz va mavjud ko'nikmalaringizga mos keladi.`,
      nextActionUz: 'Ushbu imkoniyat haqida batafsil ma\'lumot olish uchun murojaat qiling.',
    };

    return this.runWithLogging<OpportunityExplanationOutput>(
      AgentType.TEACHING_RECOMMENDATION,
      ctx as unknown as Record<string, unknown>,
      userId,
      async () => {
        const prompt = buildOpportunityExplanationPrompt(ctx);
        const raw = await this.llm.generate({ prompt });
        const parsed = this.parseJson<OpportunityExplanationOutput>(raw.text);
        if (!parsed?.explanationUz || !parsed?.nextActionUz) return fallback;
        // Return only the defined fields — never pass through extra AI-generated fields
        return { explanationUz: parsed.explanationUz, nextActionUz: parsed.nextActionUz };
      },
      fallback,
    );
  }

  // ── 2. Student Next Step ─────────────────────────────────────────────────

  async suggestNextStep(
    ctx: StudentNextStepContext,
    userId?: string,
  ): Promise<StudentNextStepOutput> {
    const fallback: StudentNextStepOutput = {
      titleUz: 'Amaliy loyiha boshlang',
      descriptionUz: 'Keyingi bosqich sifatida ushbu ko\'nikma bo\'yicha amaliy loyiha bajarish tavsiya etiladi.',
      reasonUz: 'Amaliy tajriba sizning tayorlik darajangizni oshiradi.',
    };

    return this.runWithLogging<StudentNextStepOutput>(
      AgentType.LEARNING_PLAN_GENERATION,
      ctx as unknown as Record<string, unknown>,
      userId,
      async () => {
        const prompt = buildStudentNextStepPrompt(ctx);
        const raw = await this.llm.generate({ prompt });
        const parsed = this.parseJson<StudentNextStepOutput>(raw.text);
        if (!parsed?.titleUz || !parsed?.descriptionUz || !parsed?.reasonUz) return fallback;
        return { titleUz: parsed.titleUz, descriptionUz: parsed.descriptionUz, reasonUz: parsed.reasonUz };
      },
      fallback,
    );
  }

  // ── 3. Professor Recommendation Draft ───────────────────────────────────

  async draftProfessorRecommendation(
    ctx: ProfessorRecommendationContext,
    userId?: string,
  ): Promise<ProfessorRecommendationOutput> {
    const fallback: ProfessorRecommendationOutput = {
      summaryUz: `Talaba ${ctx.targetRole} yo'nalishida ${ctx.coreSkillsCovered}/${ctx.coreSkillsTotal} asosiy ko'nikmani namoyish etgan.`,
      developmentNoteUz: 'Qo\'shimcha amaliy tajriba va loyiha dalillari tayorlikni mustahkamlaydi.',
    };

    return this.runWithLogging<ProfessorRecommendationOutput>(
      AgentType.TEACHING_RECOMMENDATION,
      ctx as unknown as Record<string, unknown>,
      userId,
      async () => {
        const prompt = buildProfessorRecommendationPrompt(ctx);
        const raw = await this.llm.generate({ prompt });
        const parsed = this.parseJson<ProfessorRecommendationOutput>(raw.text);
        if (!parsed?.summaryUz || !parsed?.developmentNoteUz) return fallback;
        return { summaryUz: parsed.summaryUz, developmentNoteUz: parsed.developmentNoteUz };
      },
      fallback,
    );
  }

  // ── 4. Skill Gap Explanation ─────────────────────────────────────────────

  async explainSkillGap(
    ctx: SkillGapContext,
    userId?: string,
  ): Promise<SkillGapOutput> {
    const fallback: SkillGapOutput = {
      skill: ctx.skill,
      explanationUz: `"${ctx.skill}" ko'nikmasi bo'yicha qo'shimcha amaliy tajriba foydali bo'ladi.`,
      nextStepUz: 'Bu ko\'nikma bo\'yicha amaliy mashqlar va loyihalar bajarish tavsiya etiladi.',
    };

    return this.runWithLogging<SkillGapOutput>(
      AgentType.MISCONCEPTION_ANALYSIS,
      ctx as unknown as Record<string, unknown>,
      userId,
      async () => {
        const prompt = buildSkillGapPrompt(ctx);
        const raw = await this.llm.generate({ prompt });
        const parsed = this.parseJson<SkillGapOutput>(raw.text);
        if (!parsed?.explanationUz || !parsed?.nextStepUz) return fallback;
        // skill is always taken from context, never from AI output
        return { skill: ctx.skill, explanationUz: parsed.explanationUz, nextStepUz: parsed.nextStepUz };
      },
      fallback,
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private parseJson<T>(text: string): T | null {
    try {
      // Strip markdown code fences if present
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start === -1 || end === -1) return null;
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }

  private async runWithLogging<T>(
    agentType: AgentType,
    input: unknown,
    userId: string | undefined,
    fn: () => Promise<T>,
    fallback: T,
  ): Promise<T> {
    const startedAt = Date.now();
    let status: AgentRunStatus = AgentRunStatus.SUCCEEDED;
    let output: T = fallback;
    let validationResult: Record<string, unknown> = {};

    try {
      output = await fn();
    } catch (err) {
      status = AgentRunStatus.FAILED;
      validationResult = { error: err instanceof Error ? err.message : 'unknown' };
      this.logger.warn(`AI capability ${agentType} failed, using fallback.`);
    }

    const latencyMs = Date.now() - startedAt;

    await this.prisma.agentRun
      .create({
        data: {
          userId: userId ?? null,
          agentType,
          input: input as Prisma.InputJsonValue,
          output: output as Prisma.InputJsonValue,
          status,
          validationResult: { latencyMs, ...validationResult } as Prisma.InputJsonValue,
        },
      })
      .catch((logErr: unknown) => {
        this.logger.error('Failed to persist AgentRun log', logErr);
      });

    return output;
  }
}
