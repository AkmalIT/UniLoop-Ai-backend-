import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { requiredEnv } from "../../common/config/required-env";
import { PrismaService } from "../../prisma/prisma.service";

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

interface CachedUser {
  id: string;
  email: string;
  name: string;
  role: any;
  onboardingCompletedAt: Date | null;
  profileId?: string;
  cachedAt: number;
}

const USER_CACHE_TTL_MS = 30_000;
const userCache = new Map<string, CachedUser>();

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requiredEnv(config, "JWT_SECRET"),
    });
  }

  async validate(payload: JwtPayload) {
    const cached = userCache.get(payload.sub);
    if (cached && Date.now() - cached.cachedAt < USER_CACHE_TTL_MS) {
      return {
        id: cached.id,
        email: cached.email,
        name: cached.name,
        role: cached.role,
        onboardingCompletedAt: cached.onboardingCompletedAt,
        profileId: cached.profileId,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        onboardingCompletedAt: true,
        studentProfile: { select: { id: true } },
        professorProfile: { select: { id: true } },
      },
    });
    if (!user) throw new UnauthorizedException();

    const profileId = user.studentProfile?.id ?? user.professorProfile?.id ?? undefined;
    const validated = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      onboardingCompletedAt: user.onboardingCompletedAt,
      profileId,
    };

    userCache.set(payload.sub, {
      ...validated,
      cachedAt: Date.now(),
    });

    return validated;
  }
}
