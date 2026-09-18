import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiCareerService } from "../career/ai/ai-career.service";
import { PrismaService } from "../../prisma/prisma.service";

interface HhVacancy {
  id?: string;
  name?: string;
  alternate_url?: string;
  employer?: { name?: string };
  area?: { name?: string };
  snippet?: { requirement?: string | null; responsibility?: string | null };
}

interface HhVacancySearchResponse { items?: HhVacancy[] }

class HhAccessBlockedError extends Error {
  constructor(readonly requestId: string | null) {
    super("HH rejected this server's request");
  }
}

@Injectable()
export class JobSearchService {
  private readonly logger = new Logger(JobSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ai: AiCareerService,
  ) {}

  /** Fetches public vacancies from HH's official API; it never sends student PII. */
  async refreshForProfile(input: {
    targetRole: string;
    interests: string[];
    coreSkills: string[];
    vacancyQueries: string[];
    userId: string;
  }) {
    if (this.config.get<string>("JOB_SEARCH_ENABLED") === "false") return;

    if (!this.config.get<string>("HH_USER_AGENT")?.trim()) {
      this.logger.warn(
        "HH search skipped: set HH_USER_AGENT to 'UniLoop-AI/1.0 (your-real-contact@example.com)'.",
      );
      return;
    }

    const queries = input.vacancyQueries.length
      ? input.vacancyQueries
      : await this.ai.suggestVacancyQueries({
          targetRole: input.targetRole,
          interests: input.interests,
          fallbackQueries: [input.targetRole],
        }, input.userId);

    // Do not fire several anonymous searches simultaneously: HH can challenge
    // the server IP after the first request. Stop after a 403 instead of
    // producing duplicate warnings and needlessly increasing the block period.
    const items: HhVacancy[] = [];
    for (const query of queries.slice(0, 3)) {
      try {
        items.push(...(await this.searchHh(query)));
      } catch (error) {
        if (error instanceof HhAccessBlockedError) {
          this.logger.warn(
            `HH search blocked (403${error.requestId ? `, request ID ${error.requestId}` : ""}). ` +
              "The API gateway is challenging this server IP; use an approved OAuth token or contact HH support—do not retry in a loop.",
          );
          break;
        }
        this.logger.warn(
          `HH vacancy search failed: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }

    const seen = new Set<string>();
    await Promise.all(
      items.filter((vacancy) => vacancy.id && !seen.has(vacancy.id) && !!seen.add(vacancy.id))
        .slice(0, 30)
        .map((vacancy) => this.persist(vacancy, input)),
    );
  }

  private async searchHh(query: string): Promise<HhVacancy[]> {
    const url = new URL("https://api.hh.ru/vacancies");
    url.searchParams.set("host", this.config.get<string>("HH_HOST") ?? "hh.uz");
    url.searchParams.set("text", query);
    url.searchParams.set("experience", "noExperience");
    url.searchParams.set("per_page", "10");
    url.searchParams.set("order_by", "publication_time");

    const headers: Record<string, string> = {
      // HH documents this alias specifically for HTTP clients such as Node's fetch.
      "HH-User-Agent": this.config.get<string>("HH_USER_AGENT")!.trim(),
      Accept: "application/json",
    };
    const accessToken = this.config.get<string>("HH_ACCESS_TOKEN")?.trim();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 403)
      throw new HhAccessBlockedError(response.headers.get("x-request-id"));
    if (!response.ok) throw new Error(`HH returned ${response.status}`);
    const body = (await response.json()) as HhVacancySearchResponse;
    return Array.isArray(body.items) ? body.items : [];
  }

  private async persist(
    vacancy: HhVacancy,
    profile: { targetRole: string; coreSkills: string[] },
  ) {
    if (!vacancy.id || !vacancy.name || !vacancy.alternate_url) return;
    const details = [vacancy.snippet?.requirement, vacancy.snippet?.responsibility]
      .filter((part): part is string => Boolean(part))
      .map(stripHtml)
      .join(" ");
    const requiredSkills = profile.coreSkills.filter((skill) =>
      details.toLowerCase().includes(skill.toLowerCase()),
    );
    const description = [vacancy.employer?.name, vacancy.area?.name, details]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 5000) || "Vakansiya tavsifi HH.uz manbasida mavjud.";
    await this.prisma.opportunity.upsert({
      where: { externalId: `hh:${vacancy.id}` },
      create: {
        type: "JOB",
        title: vacancy.name.slice(0, 250),
        description,
        requiredSkills,
        targetRoleIds: [careerDirectionId(profile.targetRole)],
        location: vacancy.area?.name?.slice(0, 250),
        source: "HH",
        externalId: `hh:${vacancy.id}`,
        sourceUrl: vacancy.alternate_url,
        externalFetchedAt: new Date(),
      },
      update: {
        title: vacancy.name.slice(0, 250), description, requiredSkills,
        targetRoleIds: [careerDirectionId(profile.targetRole)], location: vacancy.area?.name?.slice(0, 250),
        sourceUrl: vacancy.alternate_url, externalFetchedAt: new Date(),
      },
    });
  }
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function careerDirectionId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "general";
}
