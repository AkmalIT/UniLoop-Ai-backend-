import { Inject, Injectable } from "@nestjs/common";
import { LLM_PROVIDER, LlmProvider } from "../../integrations/llm/llm-provider.interface";

export interface CourseSuggestion {
  shortDescription: string;
  fullDescription: string;
  prerequisites: string[];
  outcomes: Array<{ statement: string; description: string; category: string; careerRelevance: string }>;
  modules: Array<{ title: string; description: string; estimatedMinutes: number; topics: Array<{ title: string; description: string; estimatedMinutes: number }> }>;
  materials: string[];
  assessmentIdeas: string[];
  targetStudents: string[];
  careerRelevance: string;
  learningPlanConnection: string;
}

const strings = (value: unknown, limit: number) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, limit)
  : [];
const text = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";

/** Runtime parser deliberately keeps unsafe provider output out of API and persistence. */
export function parseCourseSuggestion(value: unknown): CourseSuggestion | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const outcomes = Array.isArray(source.outcomes) ? source.outcomes.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>; const statement = text(row.statement, 500);
    return statement ? [{ statement, description: text(row.description, 3000), category: text(row.category, 160), careerRelevance: text(row.careerRelevance, 1000) }] : [];
  }).slice(0, 20) : [];
  const modules = Array.isArray(source.modules) ? source.modules.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>; const title = text(row.title, 300);
    if (!title) return [];
    const topics = Array.isArray(row.topics) ? row.topics.flatMap((topic) => {
      if (!topic || typeof topic !== "object" || Array.isArray(topic)) return [];
      const item = topic as Record<string, unknown>; const name = text(item.title, 300);
      return name ? [{ title: name, description: text(item.description, 3000), estimatedMinutes: positiveInt(item.estimatedMinutes, 60) }] : [];
    }).slice(0, 20) : [];
    return [{ title, description: text(row.description, 3000), estimatedMinutes: positiveInt(row.estimatedMinutes, 120), topics }];
  }).slice(0, 12) : [];
  const suggestion: CourseSuggestion = {
    shortDescription: text(source.shortDescription, 500), fullDescription: text(source.fullDescription, 20000),
    prerequisites: strings(source.prerequisites, 20), outcomes, modules, materials: strings(source.materials, 20),
    assessmentIdeas: strings(source.assessmentIdeas, 20), targetStudents: strings(source.targetStudents, 20),
    careerRelevance: text(source.careerRelevance, 3000), learningPlanConnection: text(source.learningPlanConnection, 3000),
  };
  return suggestion.shortDescription || suggestion.fullDescription || suggestion.outcomes.length || suggestion.modules.length ? suggestion : null;
}
function positiveInt(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 10_000 ? value : fallback;
}

@Injectable()
export class CourseAiService {
  constructor(@Inject(LLM_PROVIDER) private readonly llm: LlmProvider) {}

  fallback(input: { title: string; subject?: string | null; description?: string | null }): CourseSuggestion {
    const topic = input.subject || input.title;
    return {
      shortDescription: `${topic} bo‘yicha amaliy va natijaga yo‘naltirilgan kurs.`, fullDescription: input.description || `${topic} nazariyasi, amaliyoti va baholashlarini qamrab oladigan kurs loyihasi.`,
      prerequisites: [], outcomes: [{ statement: `${topic} bo‘yicha asosiy masalalarni mustaqil yechadi.`, description: "Natija baholash savollari bilan bog‘lanishi kerak.", category: "Asosiy ko‘nikma", careerRelevance: "Kasbiy vazifalarda qo‘llash" }],
      modules: [{ title: "Asoslar", description: `${topic} bo‘yicha kirish va asosiy tushunchalar.`, estimatedMinutes: 120, topics: [{ title: "Asosiy tushunchalar", description: "Atamalar va misollar.", estimatedMinutes: 60 }] }],
      materials: ["Kurs konspekti", "Amaliy mashqlar havolasi"], assessmentIdeas: ["Boshlang‘ich diagnostika", "Natijaga bog‘langan amaliy topshiriq"], targetStudents: [], careerRelevance: "Kasbiy amaliyot uchun poydevor yaratadi.", learningPlanConnection: "Past o‘zlashtirilgan natijalar uchun mashq vazifalari yaratiladi.",
    };
  }

  async suggest(draft: Record<string, unknown>, instruction?: string) {
    const fallback = this.fallback({ title: String(draft.title ?? "Kurs"), subject: typeof draft.subject === "string" ? draft.subject : null, description: typeof draft.fullDescription === "string" ? draft.fullDescription : null });
    const prompt = `You are an advisory course-design assistant for UniLoop. Return JSON only. Never publish, grade, calculate mastery, readiness, permissions, or verified skills. Suggestions are editable and require professor approval. Draft: ${JSON.stringify(draft)}. Professor instruction: ${instruction ?? "Improve the draft"}. Required JSON keys: shortDescription, fullDescription, prerequisites, outcomes[{statement,description,category,careerRelevance}], modules[{title,description,estimatedMinutes,topics[{title,description,estimatedMinutes}]}], materials, assessmentIdeas, targetStudents, careerRelevance, learningPlanConnection.`;
    try {
      const response = await this.llm.generate({ prompt, context: { purpose: "course-authoring-advisory" } });
      const parsed = parseCourseSuggestion(JSON.parse(response.text));
      return { suggestion: parsed ?? fallback, provider: response.provider, fallback: !parsed };
    } catch {
      return { suggestion: fallback, provider: "deterministic-fallback", fallback: true };
    }
  }
}
