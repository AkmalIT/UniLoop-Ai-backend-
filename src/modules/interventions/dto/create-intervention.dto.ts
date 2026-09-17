import { ApiProperty } from '@nestjs/swagger';
import { InterventionStatus } from '@prisma/client';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateInterventionDto {
  @ApiProperty({ example: 'Call stack tracing mini-workshop' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Professor will run a guided trace session before follow-up.' })
  @IsString()
  description: string;

  @ApiProperty({ example: 'professor-profile-id' })
  @IsString()
  professorId: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  targetOutcomeIds: string[];

  @ApiProperty({ enum: InterventionStatus, required: false })
  @IsOptional()
  @IsEnum(InterventionStatus)
  status?: InterventionStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  plannedAt?: string;
}
