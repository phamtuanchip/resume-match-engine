import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ExternalRef } from './candidate-profile';

export const SENIORITY_LEVELS = ['junior', 'mid', 'senior', 'lead'] as const;
export type Seniority = (typeof SENIORITY_LEVELS)[number];

export interface WeightedSkill {
  skill: string; // canonical form
  weight: number; // 1..5, from the job author
}

export interface CanonicalJobSpec {
  id: string;
  externalRef: ExternalRef | null;
  title: string;
  seniority: Seniority;
  minYearsExperience: number;
  requiredSkills: WeightedSkill[];
  niceToHaveSkills: string[];
  source: { format: 'json' | 'free-text'; converter: string };
  warnings: string[];
  schemaVersion: string;
}

/** Validation DTO for structured (JSON) job specs — class-validator enforces the contract. */
export class WeightedSkillDto {
  @IsString()
  skill: string;

  @IsInt()
  @Min(1)
  @Max(5)
  weight: number;
}

export class JobSpecDto {
  @IsString()
  title: string;

  @IsIn(SENIORITY_LEVELS)
  seniority: Seniority;

  @IsNumber()
  @Min(0)
  minYearsExperience: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeightedSkillDto)
  requiredSkills: WeightedSkillDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  niceToHaveSkills?: string[];
}
