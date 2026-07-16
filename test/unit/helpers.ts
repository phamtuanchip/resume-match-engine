import {
  CanonicalCandidateProfile,
  CanonicalJobSpec,
  MatchResult,
  NormalizedSkill,
} from '@core/canonical';

export function skill(canonical: string): NormalizedSkill {
  return { canonical, rawMatches: [canonical], source: 'skills-section' };
}

export function makeProfile(
  overrides: Partial<CanonicalCandidateProfile> = {},
): CanonicalCandidateProfile {
  return {
    id: 'test-candidate',
    externalRef: null,
    piiIndex: null,
    source: {
      fileName: 'test.txt',
      fileType: 'txt',
      convertedAt: '2026-07-16T00:00:00.000Z',
      converter: 'plaintext-resume',
    },
    fullName: 'Test Candidate',
    contact: { email: 'test@example.com', phone: null },
    totalYearsExperience: 11.5,
    skills: ['TypeScript', 'Node.js', 'NestJS', 'PostgreSQL', 'AWS', 'Docker', 'Redis'].map(skill),
    education: [],
    workHistory: [
      {
        company: 'TechCorp',
        title: 'Senior Engineer',
        startDate: '2015-01',
        endDate: 'present',
        durationMonths: 138,
        responsibilities: [],
        raw: 'Senior Engineer | TechCorp | Jan 2015 - Present',
      },
    ],
    rawText: 'raw',
    warnings: [],
    schemaVersion: '1.0',
    ...overrides,
  };
}

export function makeJob(overrides: Partial<CanonicalJobSpec> = {}): CanonicalJobSpec {
  return {
    id: 'test-job',
    externalRef: null,
    title: 'Senior Node.js Engineer',
    seniority: 'senior',
    minYearsExperience: 5,
    requiredSkills: [
      { skill: 'TypeScript', weight: 5 },
      { skill: 'Node.js', weight: 5 },
      { skill: 'NestJS', weight: 4 },
      { skill: 'PostgreSQL', weight: 3 },
      { skill: 'AWS', weight: 3 },
    ],
    niceToHaveSkills: ['Docker', 'Redis', 'GraphQL'],
    source: { format: 'json', converter: 'structured-job' },
    warnings: [],
    schemaVersion: '1.0',
    ...overrides,
  };
}

export function makeResult(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    candidateId: 'cand-a',
    candidateName: 'Cand A',
    candidateExternalRef: null,
    engine: 'rule-based',
    score: 90,
    warnings: [],
    breakdown: {
      requiredSkills: [{ skill: 'TypeScript', weight: 5, matched: true, contribution: 27.5 }],
      skillCoverage: { matchedWeight: 5, totalWeight: 5, ratio: 1 },
      experience: { candidateYears: 10, requiredYears: 5, fit: 1, gap: 0 },
      niceToHave: { matched: ['Docker'], bonus: 4 },
      seniority: { candidate: 'senior', required: 'senior', alignment: 1 },
      componentScores: { skills: 1, experience: 1, seniority: 1, niceToHave: 0.33 },
    },
    ...overrides,
  };
}
