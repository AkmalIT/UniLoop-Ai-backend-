import { Inject, Injectable } from "@nestjs/common";
import { AgentType } from "@prisma/client";
import {
  LLM_PROVIDER,
  LlmProvider,
} from "../../integrations/llm/llm-provider.interface";

export interface AiAgentRequest {
  agentType: AgentType;
  context: Record<string, unknown>;
}

export interface AiAgentResponse {
  supported: true;
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
      supported: true,
      message:
        "Grounded AI explanations are optional and advisory, with deterministic fallback. Domain services own grades, mastery, readiness, matching, consent, decisions and persistence.",
    };
  }
}
