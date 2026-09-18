import { ApiProperty } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import {
  IsEmail,
  IsIn,
  IsString,
  MinLength,
  MaxLength,
} from "class-validator";
import { Transform } from "class-transformer";

export class RegisterDto {
  @ApiProperty({ example: "Student One" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: "student.one@uniloop.local" })
  @IsEmail()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  email: string;

  @ApiProperty({ example: "password123" })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password: string;

  @ApiProperty({ enum: UserRole })
  @IsIn([UserRole.STUDENT, UserRole.PROFESSOR])
  role: UserRole;

}
