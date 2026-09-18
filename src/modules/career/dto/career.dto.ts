import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import {
  EvidenceSourceType,
  OpportunityType,
  RecommendationStatus,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetCareerGoalDto {
  @ApiProperty()
  @IsString()
  targetRole!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  availability?: string;
}

export class CreateSkillEvidenceDto {
  @ApiProperty()
  @IsString()
  skill!: string;

  @ApiProperty({ enum: EvidenceSourceType })
  @IsEnum(EvidenceSourceType)
  sourceType!: EvidenceSourceType;

  @ApiProperty()
  @IsString()
  sourceId!: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  score!: number;
}

export class UpdateRecommendationStatusDto {
  @ApiProperty({ enum: ['VIEWED', 'INTERESTED', 'DISMISSED'] })
  @IsIn(['VIEWED', 'INTERESTED', 'DISMISSED'])
  status!: RecommendationStatus;
}

export class RequestEndorsementDto {
  @ApiProperty()
  @IsString()
  professorId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  evidenceIds!: string[];
}

export class ReviewEndorsementDto {
  @ApiProperty()
  @IsString()
  endorsementId!: string;

  @ApiProperty({ enum: ['ENDORSED', 'NEEDS_DEVELOPMENT'] })
  @IsIn(['ENDORSED', 'NEEDS_DEVELOPMENT'])
  status!: 'ENDORSED' | 'NEEDS_DEVELOPMENT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

export class UpdateConsentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  networkingVisible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  professorReferralAllowed?: boolean;
}

export class CreateOpportunityDto {
  @ApiProperty({ enum: OpportunityType })
  @IsEnum(OpportunityType)
  type!: OpportunityType;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  requiredSkills!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;
}
