import { Inject, Injectable, Logger } from "@nestjs/common";
import { AgentRunStatus, AgentType, Prisma } from "@prisma/client";
import {
  LLM_PROVIDER,
  LlmProvider,
} from "../../../integrations/llm/llm-provider.interface";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  OpportunityExplanationContext,
  OpportunityExplanationOutput,
  ProfessorRecommendationContext,
  ProfessorRecommendationOutput,
  SkillGapContext,
  SkillGapOutput,
  StudentNextStepContext,
  StudentNextStepOutput,
} from "./ai-career.types";
import {
  buildOpportunityExplanationPrompt,
  buildProfessorRecommendationPrompt,
  buildSkillGapPrompt,
  buildStudentNextStepPrompt,
} from "./ai-career.prompts";

class AiOutputValidationError extends Error {}

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
      explanationUz: `"${ctx.targetRole}" yo'nalishi uchun hisoblangan moslik: ${ctx.matchScore}%. Namoyish etilgan ko'nikmalar: ${ctx.matchedSkills.join(", ") || "dalil yo‘q"}.`,
      nextActionUz:
        "Ushbu imkoniyat haqida batafsil ma'lumot olish uchun murojaat qiling.",
    };

    return this.runWithLogging<OpportunityExplanationOutput>(
      AgentType.TEACHING_RECOMMENDATION,
      ctx as unknown as Record<string, unknown>,
      userId,
      async () => {
        const prompt = buildOpportunityExplanationPrompt(ctx);
        const raw = await this.llm.generate({ prompt });
        const parsed = this.parseJson<OpportunityExplanationOutput>(raw.text, [
          "explanationUz",
          "nextActionUz",
        ]);
        if (!parsed) throw new AiOutputValidationError();
        // Return only the defined fields — never pass through extra AI-generated fields
        return {
          explanationUz: parsed.explanationUz,
          nextActionUz: parsed.nextActionUz,
        };
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
      titleUz: "Amaliy loyiha boshlang",
      descriptionUz:
        "Keyingi bosqich sifatida ushbu ko'nikma bo'yicha amaliy loyiha bajarish tavsiya etiladi.",
      reasonUz: "Amaliy tajriba sizning tayorlik darajangizni oshiradi.",
    };

    return this.runWithLogging<StudentNextStepOutput>(
      AgentType.LEARNING_PLAN_GENERATION,
      ctx as unknown as Record<string, unknown>,
      userId,
      async () => {
        const prompt = buildStudentNextStepPrompt(ctx);
        const raw = await this.llm.generate({ prompt });
        const parsed = this.parseJson<StudentNextStepOutput>(raw.text, [
          "titleUz",
          "descriptionUz",
          "reasonUz",
        ]);
        if (!parsed) throw new AiOutputValidationError();
        return {
          titleUz: parsed.titleUz,
          descriptionUz: parsed.descriptionUz,
          reasonUz: parsed.reasonUz,
        };
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
      developmentNoteUz:
        "Qo'shimcha amaliy tajriba va loyiha dalillari tayorlikni mustahkamlaydi.",
    };

    return this.runWithLogging<ProfessorRecommendationOutput>(
      AgentType.TEACHING_RECOMMENDATION,
      ctx as unknown as Record<string, unknown>,
      userId,
      async () => {
        const prompt = buildProfessorRecommendationPrompt(ctx);
        const raw = await this.llm.generate({ prompt });
        const parsed = this.parseJson<ProfessorRecommendationOutput>(raw.text, [
          "summaryUz",
          "developmentNoteUz",
        ]);
        if (!parsed) throw new AiOutputValidationError();
        return {
          summaryUz: parsed.summaryUz,
          developmentNoteUz: parsed.developmentNoteUz,
        };
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
      nextStepUz:
        "Bu ko'nikma bo'yicha amaliy mashqlar va loyihalar bajarish tavsiya etiladi.",
    };

    return this.runWithLogging<SkillGapOutput>(
      AgentType.MISCONCEPTION_ANALYSIS,
      ctx as unknown as Record<string, unknown>,
      userId,
      async () => {
        const prompt = buildSkillGapPrompt(ctx);
        const raw = await this.llm.generate({ prompt });
        const parsed = this.parseJson<SkillGapOutput>(raw.text, [
          "explanationUz",
          "nextStepUz",
        ]);
        if (!parsed) throw new AiOutputValidationError();
        // skill is always taken from context, never from AI output
        return {
          skill: ctx.skill,
          explanationUz: parsed.explanationUz,
          nextStepUz: parsed.nextStepUz,
        };
      },
      fallback,
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private parseJson<T>(text: string, fields: readonly string[]): T | null {
    if (text.length > 50000) return null;
    try {
      // Strip markdown code fences if present
      const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1) return null;
      const value: unknown = JSON.parse(cleaned.slice(start, end + 1));
      if (!value || typeof value !== "object" || Array.isArray(value))
        return null;
      const record = value as Record<string, unknown>;
      if (
        fields.some(
          (field) =>
            typeof record[field] !== "string" ||
            !(record[field] as string).trim() ||
            (record[field] as string).length > 5000,
        )
      )
        return null;
      return Object.fromEntries(
        fields.map((field) => [field, record[field]]),
      ) as T;
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
    let validationResult: Record<string, unknown> = { fallback: false };

    try {
      output = await fn();
    } catch (err) {
      status =
        err instanceof AiOutputValidationError
          ? AgentRunStatus.VALIDATION_FAILED
          : AgentRunStatus.FAILED;
      validationResult = {
        fallback: true,
        reason:
          err instanceof AiOutputValidationError
            ? "INVALID_PROVIDER_OUTPUT"
            : "PROVIDER_UNAVAILABLE",
      };
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
          validationResult: {
            latencyMs,
            ...validationResult,
          } as Prisma.InputJsonValue,
        },
      })
      .catch((logErr: unknown) => {
        void logErr;
        this.logger.error("Failed to persist AgentRun log");
      });

    return output;
  }
}
