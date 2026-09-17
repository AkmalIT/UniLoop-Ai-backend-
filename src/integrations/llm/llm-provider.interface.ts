export interface LlmProvider {
  generate(input: LlmGenerateInput): Promise<LlmGenerateOutput>;
}

export interface LlmGenerateInput {
  prompt: string;
  context?: Record<string, unknown>;
  model?: string;
}

export interface LlmGenerateOutput {
  text: string;
  provider: string;
  model?: string;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
