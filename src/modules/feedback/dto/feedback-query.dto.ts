import { FeedbackCategory, FeedbackStatus, UserRole } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class FeedbackQueryDto {
  @IsOptional() @IsEnum(FeedbackCategory) category?: FeedbackCategory;
  @IsOptional() @IsEnum(FeedbackStatus) status?: FeedbackStatus;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) rating?: number;
}
