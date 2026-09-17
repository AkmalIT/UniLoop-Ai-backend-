import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Student One' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'student.one@uniloop.local' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({ required: false, example: 'S-1001' })
  @IsOptional()
  @IsString()
  universityId?: string;

  @ApiProperty({ required: false, example: 'Computer Science' })
  @IsOptional()
  @IsString()
  department?: string;
}
