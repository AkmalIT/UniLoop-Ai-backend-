import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength, MaxLength } from "class-validator";
import { Transform } from "class-transformer";

export class LoginDto {
  @ApiProperty({ example: "professor@uniloop.local" })
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
}
