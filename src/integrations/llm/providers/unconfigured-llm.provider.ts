import { Injectable } from '@nestjs/common';
import { LlmGenerateInput, LlmGenerateOutput, LlmProvider } from '../llm-provider.interface';

@Injectable()
export class UnconfiguredLlmProvider implements LlmProvider {
  async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    void input;
    throw new Error('LLM provider is not configured.');
  }
}
