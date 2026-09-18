import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class AnswerDto {
  @IsString() @MaxLength(160) questionId: string;
  @IsOptional() @IsString() @MaxLength(160) optionId?: string;
  @IsOptional() @IsString() @MaxLength(10000) answer?: string;
}
export class AnswersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}
export class InterventionDecisionDto {
  @IsIn(["APPROVED", "REJECTED"]) status: "APPROVED" | "REJECTED";
}
export class MaterialDto {
  @IsString() @MaxLength(200) title: string;
  @IsString() @MaxLength(100000) content: string;
}
export class GenerationDto {
  @IsIn(["DIAGNOSTIC", "FOLLOW_UP"]) type: "DIAGNOSTIC" | "FOLLOW_UP";
}
export class ConsentDto {
  @IsBoolean() discoverable: boolean;
  @IsBoolean() peerRecommendations: boolean;
  @IsBoolean() professorEvidenceReview: boolean;
}
export class ProfileDto {
  @IsOptional() @IsString() @MaxLength(200) targetRole?: string;
  @IsOptional() @IsString() @MaxLength(160) targetRoleId?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  interests?: string[];
  @IsOptional() @ValidateNested() @Type(() => ConsentDto) consent?: ConsentDto;
}
export class RecommendationDto {
  @IsIn(["NEW", "SAVED", "ACCEPTED", "DISMISSED"]) status:
    "NEW" | "SAVED" | "ACCEPTED" | "DISMISSED";
}
export class EndorsementDto {
  @IsString() @MaxLength(160) professorId: string;
  @IsOptional() @IsString() @MaxLength(160) opportunityId?: string;
  @IsString() @MaxLength(200) targetRole: string;
  @IsBoolean() consentToReview: boolean;
}
export class EndorsementDecisionDto {
  @IsString() @MaxLength(160) requestId: string;
  @IsIn(["APPROVED", "DECLINED", "NEEDS_DEVELOPMENT"]) status:
    "APPROVED" | "DECLINED" | "NEEDS_DEVELOPMENT";
  @IsOptional() @IsString() @MaxLength(2000) feedback?: string;
}
export class AudienceDto {
  @IsIn(["STUDENT", "PROFESSOR"]) audience: "STUDENT" | "PROFESSOR";
}
