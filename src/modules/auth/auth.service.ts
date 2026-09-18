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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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
    const profileId = user.studentProfile?.id ?? user.professorProfile?.id;
    if (!profileId || user.role === "ADMIN") throw new UnauthorizedException();
    return {
      id: user.id,
      profileId,
      fullName: user.name,
      role: user.role,
      university: "",
      faculty: user.professorProfile?.department ?? "",
      avatarLabel: user.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join(""),
    };
  }
}
