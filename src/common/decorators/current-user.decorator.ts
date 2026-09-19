import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { UserRole } from "@prisma/client";
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  onboardingCompletedAt?: Date | null;
  profileId?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: unknown }>();
    return request.user;
  },
);
