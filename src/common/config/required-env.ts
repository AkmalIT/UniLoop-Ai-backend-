import { ConfigService } from '@nestjs/config';

export function requiredEnv(config: ConfigService, name: string): string {
  const value = config.get<string>(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
