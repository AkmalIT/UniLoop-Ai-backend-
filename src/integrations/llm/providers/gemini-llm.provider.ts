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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model,
      )}:generateContent`,
      {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: input.prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error("LLM provider request failed.");
    }

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
}
