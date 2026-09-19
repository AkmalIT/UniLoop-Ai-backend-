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
  VacancyQueryContext,
  CareerProfileAnalysisContext,
  CareerProfileAnalysisOutput,
  LearningPlanContext,
  LearningPlanOutput,
} from "./ai-career.types";
import {
  buildOpportunityExplanationPrompt,
  buildProfessorRecommendationPrompt,
  buildSkillGapPrompt,
  buildStudentNextStepPrompt,
  buildVacancyQueryPrompt,
  buildCareerProfileAnalysisPrompt,
  buildLearningPlanPrompt,
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

  async generateLearningPlan(
    ctx: LearningPlanContext,
    userId?: string,
  ): Promise<LearningPlanOutput> {
    const fallbackTasks = ctx.mastery
      .filter((item) => !item.evidence || item.percentage < 80)
      .slice(0, 6);
    const outcomeList = fallbackTasks.length
      ? fallbackTasks
      : ctx.course.outcomes.map((outcome) => ({
          outcomeTitle: outcome.title,
          percentage: 0,
          evidence: false,
        }));
    const tasks = (outcomeList.length ? outcomeList : ctx.mastery.slice(0, 3)).slice(0, 6).map((item) => ({
      outcomeTitle: item.outcomeTitle,
      title: `${item.outcomeTitle}: amaliy mashq`,
      reason: item.evidence
        ? `${item.outcomeTitle} bo'yicha natijani mustahkamlash uchun mashq bajaring.`
        : `${item.outcomeTitle} bo'yicha hali dalil yo'q; asosiy tushunchalarni amalda tekshiring.`,
    }));
    const fallback: LearningPlanOutput = {
      rationaleUz: "Reja kurs natijalari va mavjud o'zlashtirish dalillaridagi bo'shliqlarga asoslandi.",
      tasks,
    };

    return this.runWithLogging<LearningPlanOutput>(
      AgentType.LEARNING_PLAN_GENERATION,
      ctx as unknown as Record<string, unknown>,
      userId,
      async () => {
        const raw = await this.llm.generate({ prompt: buildLearningPlanPrompt(ctx) });
        const parsed = this.parseLearningPlan(raw.text, ctx.course.outcomes.map((outcome) => outcome.title));
        if (!parsed) throw new AiOutputValidationError();
        return parsed;
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

  async suggestVacancyQueries(ctx: VacancyQueryContext, userId?: string): Promise<string[]> {
    const fallback = ctx.fallbackQueries;
    return this.runWithLogging<string[]>(
      AgentType.TEACHING_RECOMMENDATION,
      ctx as unknown as Record<string, unknown>, userId,
      async () => {
        const raw = await this.llm.generate({ prompt: buildVacancyQueryPrompt(ctx) });
        const parsed = this.parseStringArray(raw.text, "queries");
        if (!parsed) throw new AiOutputValidationError();
        return parsed;
      }, fallback,
    );
  }

  async analyzeCareerProfile(
    ctx: CareerProfileAnalysisContext,
    userId?: string,
  ): Promise<CareerProfileAnalysisOutput> {
    const fallback: CareerProfileAnalysisOutput = {
      targetRole: ctx.statedDirection.trim(),
      coreSkills: [...new Set(ctx.skills.map((skill) => skill.trim()).filter(Boolean))].slice(0, 6),
      vacancyQueries: [ctx.statedDirection.trim()].filter(Boolean),
    };
    return this.runWithLogging(
      AgentType.TEACHING_RECOMMENDATION,
      ctx as unknown as Record<string, unknown>,
      userId,
      async () => {
        const raw = await this.llm.generate({ prompt: buildCareerProfileAnalysisPrompt(ctx) });
        const parsed = this.parseCareerAnalysis(raw.text);
        if (!parsed) throw new AiOutputValidationError();
        return parsed;
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

  private parseStringArray(text: string, field: string): string[] | null {
    if (text.length > 10000) return null;
    try {
      const value: unknown = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim());
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const items = (value as Record<string, unknown>)[field];
      if (!Array.isArray(items) || items.length < 1 || items.length > 3 || !items.every((item) => typeof item === "string" && /^[a-z0-9 .+#-]{2,80}$/i.test(item))) return null;
      return [...new Set(items.map((item) => item.trim()))];
    } catch { return null; }
  }

  private parseCareerAnalysis(text: string): CareerProfileAnalysisOutput | null {
    if (text.length > 10000) return null;
    try {
      const value: unknown = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim());
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const record = value as Record<string, unknown>;
      const targetRole = typeof record.targetRole === "string" ? record.targetRole.trim() : "";
      const stringList = (field: string, min: number, max: number) => {
        const entries = record[field];
        if (!Array.isArray(entries) || entries.length < min || entries.length > max) return null;
        const clean = [...new Set(entries.map((entry) => typeof entry === "string" ? entry.trim() : "").filter((entry) => entry.length >= 2 && entry.length <= 100))];
        return clean.length >= min ? clean : null;
      };
      const coreSkills = stringList("coreSkills", 3, 6);
      const vacancyQueries = stringList("vacancyQueries", 1, 3);
      return targetRole.length >= 2 && targetRole.length <= 120 && coreSkills && vacancyQueries
        ? { targetRole, coreSkills, vacancyQueries }
        : null;
    } catch { return null; }
  }

  private parseLearningPlan(text: string, outcomeTitles: string[]): LearningPlanOutput | null {
    if (text.length > 30000) return null;
    try {
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start < 0 || end < start) return null;
      const value: unknown = JSON.parse(cleaned.slice(start, end + 1));
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const record = value as Record<string, unknown>;
      const rationaleValue = record.rationaleUz ?? record.rationale ?? record.explanationUz ?? record.description ?? record.summary;
      const rationaleUz = typeof rationaleValue === "string" && rationaleValue.trim()
        ? rationaleValue.trim()
        : "Kurs natijalari va o'zlashtirish darajasi asosida tuzilgan o'quv reja.";
      const rawTasks = record.tasks ?? record.steps ?? record.items ?? record.plan ?? record.learningPlan;
      if (!rationaleUz || rationaleUz.length > 5000 || !Array.isArray(rawTasks) || rawTasks.length < 1 || !outcomeTitles.length) return null;
      const normalizedOutcomes = new Map(
        outcomeTitles.map((title) => [this.normalizePlanLabel(title), title]),
      );
      const defaultOutcome = outcomeTitles[0];
      const tasks = rawTasks.slice(0, 8).flatMap((task) => {
        if (!task || typeof task !== "object" || Array.isArray(task)) return [];
        const item = task as Record<string, unknown>;
        const rawOutcomeTitle = typeof item.outcomeTitle === "string" ? item.outcomeTitle.trim() : "";
        const normalizedLabel = this.normalizePlanLabel(rawOutcomeTitle);
        const exactOutcome = normalizedOutcomes.get(normalizedLabel);
        const matchingOutcome = exactOutcome ?? outcomeTitles.find((title) => {
          const normalizedTitle = this.normalizePlanLabel(title);
          return normalizedLabel.includes(normalizedTitle) || normalizedTitle.includes(normalizedLabel);
        }) ?? defaultOutcome;
        const outcomeTitle = matchingOutcome || defaultOutcome;
        const titleValue = item.title ?? item.taskTitle ?? item.name ?? item.task;
        const reasonValue = item.reason ?? item.description ?? item.instruction ?? item.details;
        const title = typeof titleValue === "string" ? titleValue.trim() : "";
        const reason = typeof reasonValue === "string" ? reasonValue.trim() : "";
        return outcomeTitle && title.length >= 2 && title.length <= 300
          ? [{ outcomeTitle, title, reason: reason || `${outcomeTitle} bo'yicha amaliy mashg'ulot` }]
          : [];
      });
      return tasks.length > 0 ? { rationaleUz, tasks: tasks.slice(0, 6) } : null;
    } catch {
      return null;
    }
  }

  private normalizePlanLabel(value: string): string {
    return value
      .toLocaleLowerCase()
      .replace(/^\s*(?:outcome|natija|maqsad)\s*\d*\s*[:.-]?\s*/i, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
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
        error:
          err instanceof AiOutputValidationError
            ? undefined
            : err instanceof Error
              ? err.message.slice(0, 500)
              : "Unknown provider error",
      };
      this.logger.warn(
        `AI capability ${agentType} failed, using fallback: ${
          err instanceof Error ? err.message.slice(0, 500) : "unknown error"
        }`,
      );
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
