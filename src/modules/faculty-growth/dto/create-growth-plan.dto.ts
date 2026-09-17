import { ApiProperty } from '@nestjs/swagger';
import { GrowthTaskStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CreateGrowthTaskDto {
  @ApiProperty({ example: 'Compare diagnostic and follow-up mastery distribution' })
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: GrowthTaskStatus, required: false })
  @IsOptional()
  @IsEnum(GrowthTaskStatus)
  status?: GrowthTaskStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class CreateGrowthPlanDto {
  @ApiProperty({ example: 'Improve recursion remediation strategy' })
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [CreateGrowthTaskDto], default: [] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGrowthTaskDto)
  tasks: CreateGrowthTaskDto[] = [];
}
