import { MatchResult } from '@core/canonical';

/** Renderable result shapes produced by the use cases and consumed by OutputRenderers. */

export interface ParseSummaryRow {
  file: string;
  name: string;
  years: number;
  topSkills: string[];
  warningCount: number;
  warnings: string[];
}

export interface ParseSummaryReport {
  kind: 'parse-summary';
  rows: ParseSummaryRow[];
  outDir: string;
}

export interface MatchReport {
  kind: 'match-report';
  jobTitle: string;
  seniority: string;
  minYears: number;
  engine: string;
  /** Set when an llm/hybrid run fell back to rule-based at startup. */
  fallbackReason?: string;
  results: MatchResult[];
  /** Number of profiles excluded because they had no extractable skills or work history. */
  unscoredCount?: number;
}

export interface CanonicalReport {
  kind: 'canonical';
  value: unknown;
}

export type Report = ParseSummaryReport | MatchReport | CanonicalReport;
