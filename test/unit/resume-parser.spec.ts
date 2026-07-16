import { RawResume } from '@core/conversion/input-converter.interface';
import { ExperienceCalculatorService } from '@core/parsing/experience-calculator.service';
import { ResumeParserService } from '@core/parsing/resume-parser.service';
import { SkillNormalizerService } from '@core/parsing/skill-normalizer.service';

const parser = new ResumeParserService(
  new SkillNormalizerService(),
  new ExperienceCalculatorService(),
);

const raw = (text: string): RawResume => ({
  id: 'test',
  source: { fileName: 'test.txt', fileType: 'txt', convertedAt: '', converter: 'test' },
  text,
  warnings: [],
});

const CLEAN_RESUME = `Jane Doe
jane@example.com | +1 555 123 4567

Experience

Senior Engineer | Acme Corp | Jan 2019 - Present
- Built APIs with nodejs and postgres

Developer | StartupX | Jan 2016 - Dec 2018
- Frontend work in reactjs

Education
B.Sc. Computer Science, State University, 2012 - 2016

Skills
JS, TypeScript, node, react
`;

describe('ResumeParserService — clean input', () => {
  const profile = parser.parse(raw(CLEAN_RESUME));

  it('extracts name and contact', () => {
    expect(profile.fullName).toBe('Jane Doe');
    expect(profile.contact.email).toBe('jane@example.com');
    expect(profile.contact.phone).toContain('555');
  });

  it('normalizes listed skills (JS == JavaScript)', () => {
    const canonicals = profile.skills.map((s) => s.canonical);
    expect(canonicals).toEqual(
      expect.arrayContaining(['JavaScript', 'TypeScript', 'Node.js', 'React']),
    );
  });

  it('computes total experience from date ranges, not stated numbers', () => {
    // 2016-01..2018-12 (~3y) + 2019-01..present (7.5y at mid-2026) ≈ 10.5y
    expect(profile.totalYearsExperience).toBeGreaterThan(9);
  });

  it('extracts the work-history timeline', () => {
    expect(profile.workHistory).toHaveLength(2);
    expect(profile.workHistory[0]).toMatchObject({
      title: 'Senior Engineer',
      company: 'Acme Corp',
      startDate: '2019-01',
      endDate: 'present',
    });
    expect(profile.workHistory[0].responsibilities).toHaveLength(1);
  });

  it('extracts education', () => {
    expect(profile.education[0].institution).toMatch(/State University/);
    expect(profile.education[0].endYear).toBe(2016);
  });
});

describe('ResumeParserService — messy input (graceful degradation, F3)', () => {
  it('never throws and records warnings instead', () => {
    const profile = parser.parse(raw('random noise ### 12345\nno structure at all'));
    expect(profile.fullName).toBeNull();
    expect(profile.totalYearsExperience).toBe(0);
    expect(profile.warnings.length).toBeGreaterThan(0);
  });

  it('finds work entries even without a standard section header', () => {
    const profile = parser.parse(
      raw('Minh Tran\nm@x.com\n\nBackend Developer, FinServe 2021 - 2024\n- java services'),
    );
    expect(profile.workHistory).toHaveLength(1);
    expect(profile.totalYearsExperience).toBe(3);
    expect(profile.warnings.some((w) => w.includes('No standard experience section'))).toBe(true);
  });

  it('keeps undated roles in the timeline but excludes them from the total', () => {
    const profile = parser.parse(
      raw('Jo Smith\n\nExperience\nSoftware Developer at CodeHouse\n- built tools'),
    );
    expect(profile.workHistory).toHaveLength(1);
    expect(profile.totalYearsExperience).toBe(0);
    expect(profile.warnings.some((w) => w.includes('no date range'))).toBe(true);
  });
});
