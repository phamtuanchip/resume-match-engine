/** Canonical candidate model — the single internal contract every converter produces
 *  and every engine/renderer consumes. Schema documented in PLAN.md §4.1. */

export const SCHEMA_VERSION = '1.0';

/** Identity in an external system (HRM/ATS). Enables score write-back (PLAN.md §2.4). */
export interface ExternalRef {
  system: string;
  id: string;
}

export interface ContactInfo {
  email: string | null;
  phone: string | null;
  location?: string;
  links?: string[];
}

export interface NormalizedSkill {
  canonical: string;
  rawMatches: string[];
  source: 'skills-section' | 'work-history';
}

export interface EducationEntry {
  institution: string;
  degree?: string;
  field?: string;
  startYear?: number;
  endYear?: number;
  raw: string;
}

export interface WorkExperience {
  company: string;
  title: string;
  startDate: string | null; // ISO "YYYY-MM"
  endDate: string | 'present' | null;
  durationMonths: number | null;
  responsibilities: string[];
  raw: string;
}

export interface SourceInfo {
  fileName: string;
  fileType: 'pdf' | 'txt' | 'docx' | 'json';
  convertedAt: string; // ISO timestamp
  converter: string;
}

export interface CanonicalCandidateProfile {
  id: string;
  externalRef: ExternalRef | null;
  /** Index into the local PII vault (pii-index.json). Null until PII extraction runs. */
  piiIndex: string | null;
  source: SourceInfo;
  fullName: string | null;
  contact: ContactInfo;
  /** Computed from merged work-history date ranges — never a stated number. */
  totalYearsExperience: number;
  skills: NormalizedSkill[];
  education: EducationEntry[];
  workHistory: WorkExperience[];
  /** Post-conversion plain text, retained for the LLM engine and debugging. */
  rawText: string;
  /** Graceful-degradation trail, accumulated across conversion + parsing. */
  warnings: string[];
  schemaVersion: string;
}
