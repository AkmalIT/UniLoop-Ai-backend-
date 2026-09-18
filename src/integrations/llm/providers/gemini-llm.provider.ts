import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requiredEnv } from '../../../common/config/required-env';
import { LlmGenerateInput, LlmGenerateOutput, LlmProvider } from '../llm-provider.interface';

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
    this.apiKey = requiredEnv(config, 'LLM_API_KEY');
    this.providerName = config.get<string>('LLM_PROVIDER') ?? 'gemini';
  }

  async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    const model = input.model ?? this.defaultModel();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model,
      )}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
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
      throw new Error('LLM provider request failed.');
    }

    const payload = (await response.json()) as GeminiResponse;
    const text =
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .filter(Boolean)
        .join('\n') ?? '';

    return {
      text,
      provider: this.providerName,
      model,
    };
  }

  private defaultModel() {
    return 'gemini-2.5-flash';
  }
}
