import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { requiredEnv } from "../../../common/config/required-env";
import {
  LlmGenerateInput,
  LlmGenerateOutput,
  LlmProvider,
} from "../llm-provider.interface";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

@Injectable()
export class GeminiLlmProvider implements LlmProvider {
  private readonly apiKey: string;
  private readonly providerName: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = requiredEnv(config, "LLM_API_KEY");
    this.providerName = config.get<string>("LLM_PROVIDER") ?? "gemini";
  }

  async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    const model = input.model ?? this.defaultModel();
    const response = await this.request(model, input.prompt);

    const payload: unknown = await response.json();
    if (
      !payload ||
      typeof payload !== "object" ||
      !("candidates" in payload) ||
      !Array.isArray(payload.candidates)
    )
      throw new Error("Invalid LLM response");
    const validated: GeminiResponse = {
      candidates: payload.candidates.flatMap((candidate: unknown) => {
        if (
          !candidate ||
          typeof candidate !== "object" ||
          !("content" in candidate) ||
          !candidate.content ||
          typeof candidate.content !== "object" ||
          !("parts" in candidate.content) ||
          !Array.isArray(candidate.content.parts)
        )
          return [];
        return [
          {
            content: {
              parts: candidate.content.parts.flatMap((part: unknown) =>
                part &&
                typeof part === "object" &&
                "text" in part &&
                typeof part.text === "string"
                  ? [{ text: part.text }]
                  : [],
              ),
            },
          },
        ];
      }),
    };
    const text =
      validated.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .filter(Boolean)
        .join("\n") ?? "";

    return {
      text,
      provider: this.providerName,
      model,
    };
  }

  private defaultModel() {
    return "gemini-2.5-flash";
  }

  private async request(model: string, prompt: string): Promise<Response> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json",
            },
          }),
        });
        if (response.ok) return response;

        // Provider response bodies can contain sensitive diagnostics. Keep the
        // API boundary deterministic and never surface them to callers.
        lastError = new Error("LLM provider request failed.");
        if (![429, 500, 502, 503, 504].includes(response.status)) break;
      } catch (error) {
        void error;
        lastError = new Error("LLM provider request failed.");
      }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
    throw lastError ?? new Error("Gemini request failed");
  }
}
