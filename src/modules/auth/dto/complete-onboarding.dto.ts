import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** A role-aware payload. Required fields are verified by AuthService for the user's role. */
export class CompleteOnboardingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) university?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) faculty?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) department?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) major?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) studyYear?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) bio?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) targetRole?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(100, { each: true }) interests?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(100, { each: true }) skills?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) availability?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() discoverable?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() peerRecommendations?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() professorEvidenceReview?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) title?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(100, { each: true }) expertise?: string[];
}
