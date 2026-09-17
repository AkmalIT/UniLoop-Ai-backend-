import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CreateLearningTaskDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  learningOutcomeId?: string;

  @ApiProperty({ example: 'Practice tracing recursive factorial calls' })
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class CreateLearningPlanDto {
  @ApiProperty({ example: 'Call-stack recovery plan' })
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rationale?: string;

  @ApiProperty({ type: [CreateLearningTaskDto], default: [] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLearningTaskDto)
  tasks: CreateLearningTaskDto[] = [];
}
