import { ApiProperty } from '@nestjs/swagger';
import { QuestionType } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class QuestionOutcomeLinkDto {
  @ApiProperty({ example: 'learning-outcome-id' })
  @IsString()
  learningOutcomeId: string;

  @ApiProperty({ default: 1, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;
}

export class CreateQuestionDto {
  @ApiProperty({ example: 'Identify the base case in this recursive function.' })
  @IsString()
  prompt: string;

  @ApiProperty({ enum: QuestionType, default: QuestionType.SHORT_ANSWER })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiProperty({ example: 20, minimum: 0 })
  @IsNumber()
  @Min(0)
  weight: number;

  @ApiProperty({ example: 1, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxScore?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  correctAnswer?: string;

  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({ type: [QuestionOutcomeLinkDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionOutcomeLinkDto)
  outcomes: QuestionOutcomeLinkDto[];
}
