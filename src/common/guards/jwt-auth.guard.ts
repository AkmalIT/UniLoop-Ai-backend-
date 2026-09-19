import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = await super.canActivate(context);
    if (!authenticated) return false;

    const request = context.switchToHttp().getRequest<{
      path: string;
      user?: { onboardingCompletedAt?: Date | null; role?: string };
    }>();
    // New users can only inspect their identity and submit the onboarding form.
    if (
      request.user?.role !== 'ADMIN' &&
      !request.user?.onboardingCompletedAt &&
      !/\/auth\/(me|onboarding)$/.test(request.path)
    ) {
      throw new ForbiddenException('Complete onboarding before using the platform.');
    }
    return true;
  }
}
