import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsInt,
  IsString,
  MaxLength,
  Min,
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
export class EnrollmentRequestDecisionDto {
  @IsIn(["APPROVED", "REJECTED"]) status: "APPROVED" | "REJECTED";
  @IsOptional() @IsString() @MaxLength(1000) feedback?: string;
}
export class MaterialDto {
  @IsString() @MaxLength(200) title: string;
  @IsString() @MaxLength(100000) content: string;
}
export class GenerationDto {
  @IsIn(["DIAGNOSTIC", "FOLLOW_UP"]) type: "DIAGNOSTIC" | "FOLLOW_UP";
}
export class CreateManagedCourseDto {
  @IsString() @MaxLength(200) title: string;
  @IsString() @MaxLength(40) code: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() @MaxLength(500) shortDescription?: string;
  @IsOptional() @IsString() @MaxLength(20000) fullDescription?: string;
  @IsOptional() @IsIn(["OFFICIAL", "SUPPLEMENTARY", "RECOMMENDED"]) type?: "OFFICIAL" | "SUPPLEMENTARY" | "RECOMMENDED";
  @IsOptional() @IsString() @MaxLength(160) subject?: string;
  @IsOptional() @IsString() @MaxLength(80) difficulty?: string;
  @IsOptional() @IsString() @MaxLength(20) language?: string;
  @IsOptional() @IsInt() @Min(1) estimatedDurationMinutes?: number;
  @IsOptional() @IsInt() @Min(1) weeklyWorkloadHours?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsInt({ each: true }) @Min(1, { each: true }) targetStudyYears?: number[];
  @IsOptional() @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @MaxLength(160, { each: true }) targetPrograms?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @MaxLength(500, { each: true }) prerequisites?: string[];
  @IsOptional() @IsString() @MaxLength(3000) careerRelevance?: string;
  @IsOptional() @IsString() @MaxLength(2000) coverImageUrl?: string;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
  @IsOptional() @IsIn(["OPEN", "APPROVAL_REQUIRED"]) enrollmentMode?: "OPEN" | "APPROVAL_REQUIRED";
  @IsOptional() @IsInt() @Min(1) maximumEnrollment?: number;
}

export class CourseOutcomeDto {
  @IsString() @MaxLength(500) statement: string;
  @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @IsOptional() @IsString() @MaxLength(160) category?: string;
  @IsOptional() @IsString() @MaxLength(1000) careerRelevance?: string;
}
export class CourseTopicDto {
  @IsString() @MaxLength(300) title: string;
  @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @IsOptional() @IsInt() @Min(1) estimatedMinutes?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(60) @IsString({ each: true }) outcomeIds?: string[];
}
export class CourseModuleDto {
  @IsString() @MaxLength(300) title: string;
  @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @IsOptional() @IsInt() @Min(1) estimatedMinutes?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => CourseTopicDto) topics?: CourseTopicDto[];
}
export class UpdateManagedCourseDto extends CreateManagedCourseDto {
  @IsOptional() @IsArray() @ArrayMaxSize(80) @ValidateNested({ each: true }) @Type(() => CourseOutcomeDto) outcomes?: CourseOutcomeDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => CourseModuleDto) modules?: CourseModuleDto[];
}
export class AiSuggestionRequestDto {
  @IsOptional() @IsString() @MaxLength(2000) instruction?: string;
}
export class AiSuggestionApprovalDto {
  @IsBoolean() approved: boolean;
  @IsOptional() @ValidateNested() @Type(() => UpdateManagedCourseDto) approvedDraft?: UpdateManagedCourseDto;
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
export class ClubDto {
  @IsString() @MaxLength(160) title: string;
  @IsString() @MaxLength(4000) description: string;
  @IsString() @MaxLength(200) topic: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  skills?: string[];
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
