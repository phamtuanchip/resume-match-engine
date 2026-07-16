import { ExternalRef } from './candidate-profile';
import { Seniority } from './job-spec';

export type EngineName = 'rule-based' | 'llm' | 'hybrid';

export interface SkillMatchDetail {
  skill: string;
  weight: number;
  matched: boolean;
  /** Points this skill contributed to the skills component (0 when unmatched). */
  contribution: number;
}

export interface MatchBreakdown {
  requiredSkills: SkillMatchDetail[];
  skillCoverage: { matchedWeight: number; totalWeight: number; ratio: number };
  experience: { candidateYears: number; requiredYears: number; fit: number; gap: number };
  niceToHave: { matched: string[]; bonus: number };
  seniority: { candidate: Seniority; required: Seniority; alignment: number };
  /** Each component in 0..1, before its weight is applied. */
  componentScores: { skills: number; experience: number; seniority: number; niceToHave: number };
  /** Natural-language justification — populated by llm/hybrid engines. */
  explanation?: string;
}

export interface MatchResult {
  candidateId: string;
  candidateName: string | null;
  /** Echoed from the profile so scores can be written back to the owning HRM record. */
  candidateExternalRef: ExternalRef | null;
  engine: EngineName;
  score: number; // 0–100
  warnings: string[];
  breakdown: MatchBreakdown;
}
