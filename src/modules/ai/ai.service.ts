import { Inject, Injectable } from '@nestjs/common';
import { AgentType } from '@prisma/client';
import { LLM_PROVIDER, LlmProvider } from '../../integrations/llm/llm-provider.interface';

export interface AiAgentRequest {
  agentType: AgentType;
  context: Record<string, unknown>;
}

export interface AiAgentResponse {
  supported: false;
  message: string;
}

@Injectable()
export class AiService {
  constructor(
    @Inject(LLM_PROVIDER)
    private readonly llmProvider: LlmProvider,
  ) {}

  describeBoundary(): AiAgentResponse {
    void this.llmProvider;
    return {
      supported: false,
      message:
        'AI integrations are intentionally disabled in this MVP. Deterministic domain services own mastery, insights, validation, and persistence.',
    };
  }
}
