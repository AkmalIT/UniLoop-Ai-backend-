import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateLearningOutcomeDto {
  @ApiProperty({ example: 'Trace the recursive call stack' })
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
