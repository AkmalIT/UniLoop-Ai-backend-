import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLM_PROVIDER, LlmProvider } from './llm-provider.interface';
import { GeminiLlmProvider } from './providers/gemini-llm.provider';
import { UnconfiguredLlmProvider } from './providers/unconfigured-llm.provider';

@Module({
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): LlmProvider => {
        const providerName = config.get<string>('LLM_PROVIDER')?.toLowerCase() ?? '';
        if (providerName.includes('gemini')) {
          return new GeminiLlmProvider(config);
        }
        return new UnconfiguredLlmProvider();
      },
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
