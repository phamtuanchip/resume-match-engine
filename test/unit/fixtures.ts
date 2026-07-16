import {
  CanonicalCandidateProfile,
  CanonicalJobSpec,
  NormalizedSkill,
  SCHEMA_VERSION,
} from '@core/canonical';

export function candidate(
  overrides: Partial<CanonicalCandidateProfile> = {},
): CanonicalCandidateProfile {
  return {
    id: 'test-candidate',
    externalRef: null,
    piiIndex: null,
    source: { fileName: 't.txt', fileType: 'txt', convertedAt: '', converter: 'test' },
    fullName: 'Test Candidate',
    contact: { email: null, phone: null },
    totalYearsExperience: 6,
    skills: skillList('Node.js', 'TypeScript', 'NestJS', 'PostgreSQL', 'Docker'),
    education: [],
    workHistory: [
      {
        company: 'X',
        title: 'Senior Engineer',
        startDate: '2019-01',
        endDate: 'present',
        durationMonths: 80,
        responsibilities: [],
        raw: '',
      },
    ],
    rawText: '',
    warnings: [],
    schemaVersion: SCHEMA_VERSION,
    ...overrides,
  };
}

export function jobSpec(overrides: Partial<CanonicalJobSpec> = {}): CanonicalJobSpec {
  return {
    id: 'test-job',
    externalRef: null,
    title: 'Senior Node.js Engineer',
    seniority: 'senior',
    minYearsExperience: 5,
    requiredSkills: [
      { skill: 'Node.js', weight: 5 },
      { skill: 'TypeScript', weight: 4 },
      { skill: 'PostgreSQL', weight: 3 },
    ],
    niceToHaveSkills: ['Kubernetes'],
    source: { format: 'json', converter: 'test' },
    warnings: [],
    schemaVersion: SCHEMA_VERSION,
    ...overrides,
  };
}

export function skillList(...names: string[]): NormalizedSkill[] {
  return names.map((canonical) => ({
    canonical,
    rawMatches: [canonical],
    source: 'skills-section' as const,
  }));
}
