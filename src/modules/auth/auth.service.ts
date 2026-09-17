import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = this.hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role,
        passwordHash,
        studentProfile:
          dto.role === UserRole.STUDENT
            ? {
                create: {
                  universityId:
                    dto.universityId ?? `S-${randomBytes(4).toString('hex')}`,
                },
              }
            : undefined,
        professorProfile:
          dto.role === UserRole.PROFESSOR
            ? { create: { department: dto.department } }
            : undefined,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    return { user, accessToken: await this.signUser(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user?.passwordHash || !this.verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
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

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const digest = createHash('sha256').update(`${salt}:${password}`).digest('hex');
    return `${salt}:${digest}`;
  }

  private verifyPassword(password: string, storedHash: string) {
    const [salt, expected] = storedHash.split(':');
    if (!salt || !expected) {
      throw new BadRequestException('Stored password hash is invalid.');
    }
    const actual = createHash('sha256').update(`${salt}:${password}`).digest('hex');
    return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
  }
}
