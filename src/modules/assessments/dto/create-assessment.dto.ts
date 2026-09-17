import { ApiProperty } from '@nestjs/swagger';
import { AssessmentType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateAssessmentDto {
  @ApiProperty({ example: 'Recursive Functions Diagnostic' })
  @IsString()
  title: string;

  @ApiProperty({ enum: AssessmentType, default: AssessmentType.DIAGNOSTIC })
  @IsOptional()
  @IsEnum(AssessmentType)
  type?: AssessmentType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
