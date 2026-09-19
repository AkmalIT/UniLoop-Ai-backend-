import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import { randomBytes } from "crypto";
import { hashPassword, verifyPassword } from "../../common/security/password";
import { PrismaService } from "../../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { JobSearchService } from '../integration/job-search.service';
import { AiCareerService } from '../career/ai/ai-career.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly jobSearch?: JobSearchService,
    private readonly aiCareer?: AiCareerService,
  ) {}

  async register(dto: RegisterDto) {
    if (dto.role !== UserRole.STUDENT && dto.role !== UserRole.PROFESSOR)
      throw new BadRequestException();
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } }))
      throw new ConflictException();
    const passwordHash = hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        role: dto.role,
        passwordHash,
        studentProfile:
          dto.role === UserRole.STUDENT
            ? {
                create: {
                  universityId:
                    `S-${randomBytes(4).toString("hex")}`,
                },
              }
            : undefined,
        professorProfile:
            dto.role === UserRole.PROFESSOR
            ? { create: {} }
            : undefined,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    return {
      user: await this.me(user.id),
      accessToken: await this.signUser(user),
    };
  }

  async login(dto: LoginDto) {
    const adminEmail = process.env.ADMIN_LOGIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.ADMIN_LOGIN_PASSWORD;
    if (adminEmail && adminPassword && dto.email.trim().toLowerCase() === adminEmail && dto.password === adminPassword) {
      const admin = await this.prisma.user.upsert({
        where: { email: adminEmail },
        create: {
          email: adminEmail,
          name: 'UniLoop administratori',
          role: UserRole.ADMIN,
          passwordHash: hashPassword(adminPassword),
          onboardingCompletedAt: new Date(),
        },
        update: { role: UserRole.ADMIN, passwordHash: hashPassword(adminPassword), onboardingCompletedAt: new Date() },
        select: { id: true, email: true, role: true },
      });
      return { user: await this.me(admin.id), accessToken: await this.signUser(admin) };
    }
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (
      !user?.passwordHash ||
      !verifyPassword(dto.password, user.passwordHash)
    ) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return {
      user: await this.me(user.id),
      accessToken: await this.signUser(user),
    };
  }

  async completeOnboarding(user: AuthenticatedUser, dto: CompleteOnboardingDto) {
    if (user.role === UserRole.STUDENT) {
      if (!dto.university || !dto.faculty || !dto.major || !dto.targetRole)
        throw new BadRequestException('University, faculty, major and career direction are required.');

      const analysis = await this.aiCareer!.analyzeCareerProfile({
        statedDirection: dto.targetRole,
        major: dto.major,
        interests: dto.interests ?? [],
        skills: dto.skills ?? [],
      }, user.id);

      await this.prisma.$transaction(async (tx) => {
        const student = await tx.studentProfile.findUnique({ where: { userId: user.id } });
        if (!student) throw new UnauthorizedException();
        await tx.studentProfile.update({
          where: { userId: user.id },
          data: {
            university: dto.university!.trim(), faculty: dto.faculty!.trim(),
            major: dto.major!.trim(), studyYear: dto.studyYear, bio: dto.bio?.trim(),
          },
        });
        await tx.careerProfile.upsert({
          where: { studentId: student.id },
          create: { studentId: student.id, targetRole: analysis.targetRole, coreSkills: analysis.coreSkills, vacancyQueries: analysis.vacancyQueries, interests: dto.interests ?? [], availability: dto.availability?.trim() },
          update: { targetRole: analysis.targetRole, coreSkills: analysis.coreSkills, vacancyQueries: analysis.vacancyQueries, interests: dto.interests ?? [], availability: dto.availability?.trim() },
        });
        await tx.consent.upsert({
          where: { studentId: student.id },
          create: { studentId: student.id, networkingVisible: dto.discoverable ?? false, peerRecommendations: dto.peerRecommendations ?? false, professorReferralAllowed: dto.professorEvidenceReview ?? false },
          update: { networkingVisible: dto.discoverable ?? false, peerRecommendations: dto.peerRecommendations ?? false, professorReferralAllowed: dto.professorEvidenceReview ?? false },
        });
        await tx.skillEvidence.deleteMany({ where: { studentId: student.id, sourceType: 'ASSIGNMENT', sourceId: 'onboarding-self-assessment' } });
        if (dto.skills?.length) await tx.skillEvidence.createMany({
          data: [...new Set(dto.skills.map((skill) => skill.trim()).filter(Boolean))].map((skill) => ({
            studentId: student.id, skill, sourceType: 'ASSIGNMENT', sourceId: 'onboarding-self-assessment', score: 60,
          })),
        });
        await tx.user.update({ where: { id: user.id }, data: { onboardingCompletedAt: new Date() } });
      });
      // Only role and interests are sent to the job provider; never student PII or grades.
      await this.jobSearch?.refreshForProfile({ targetRole: analysis.targetRole, interests: dto.interests ?? [], coreSkills: analysis.coreSkills, vacancyQueries: analysis.vacancyQueries, userId: user.id });
    } else if (user.role === UserRole.PROFESSOR) {
      if (!dto.university || !dto.department || !dto.title)
        throw new BadRequestException('University, department and title are required.');
      await this.prisma.$transaction([
        this.prisma.professorProfile.update({
          where: { userId: user.id },
          data: { university: dto.university.trim(), department: dto.department.trim(), title: dto.title.trim(), expertise: dto.expertise ?? [], bio: dto.bio?.trim() },
        }),
        this.prisma.user.update({ where: { id: user.id }, data: { onboardingCompletedAt: new Date() } }),
      ]);
    } else {
      throw new BadRequestException('Unsupported user role.');
    }
    return { user: await this.me(user.id), onboardingCompleted: true };
  }

  private async signUser(user: { id: string; email: string; role: UserRole }) {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true, professorProfile: true },
    });
    if (!user) throw new UnauthorizedException();
    const profileId = user.studentProfile?.id ?? user.professorProfile?.id ?? user.id;
    if (!profileId) throw new UnauthorizedException();
    return {
      id: user.id,
      profileId,
      fullName: user.name,
      role: user.role,
      onboardingCompleted: user.role === "ADMIN" || Boolean(user.onboardingCompletedAt),
      university: user.studentProfile?.university ?? user.professorProfile?.university ?? "",
      faculty: user.studentProfile?.faculty ?? user.professorProfile?.department ?? "",
      avatarLabel: user.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join(""),
    };
  }
}
