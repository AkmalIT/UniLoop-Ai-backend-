import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./modules/auth/auth.module";
import { MaterialsModule } from "./modules/materials/materials.module";
import { AiModule } from "./modules/ai/ai.module";
import { PrismaModule } from "./prisma/prisma.module";
import { IntegrationModule } from "./modules/integration/integration.module";
import { validateEnvironment } from "./common/config/environment";
import { APP_GUARD } from "@nestjs/core";
import { RateLimitGuard } from "./common/guards/rate-limit.guard";
import { FeedbackModule } from "./modules/feedback/feedback.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    PrismaModule,
    AuthModule,
    MaterialsModule,
    AiModule,
    IntegrationModule,
    FeedbackModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class AppModule {}
