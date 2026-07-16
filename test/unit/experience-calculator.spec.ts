import { WorkExperience } from '@core/canonical';
import { ExperienceCalculatorService } from '@core/parsing/experience-calculator.service';

const job = (startDate: string | null, endDate: string | 'present' | null): WorkExperience => ({
  company: 'X',
  title: 'Engineer',
  startDate,
  endDate,
  durationMonths: null,
  responsibilities: [],
  raw: '',
});

describe('ExperienceCalculatorService', () => {
  const calc = new ExperienceCalculatorService();

  it('computes years for a single closed range', () => {
    expect(calc.calculate([job('2020-01', '2023-01')]).years).toBe(3);
  });

  it('does not double-count overlapping ranges', () => {
    const { years } = calc.calculate([job('2020-01', '2022-01'), job('2021-01', '2023-01')]);
    expect(years).toBe(3); // 2020-01..2023-01 merged, not 2+2
  });

  it('keeps gaps between jobs out of the total', () => {
    const { years } = calc.calculate([job('2020-01', '2021-01'), job('2022-01', '2023-01')]);
    expect(years).toBe(2);
  });

  it('treats "present" as ongoing', () => {
    const { years } = calc.calculate([job('2024-01', 'present')]);
    expect(years).toBeGreaterThan(1);
  });

  it('excludes entries without a start date and warns', () => {
    const { years, warnings } = calc.calculate([job(null, 'present')]);
    expect(years).toBe(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/no parseable start date/);
  });

  it('excludes ranges that end before they start and warns', () => {
    const { years, warnings } = calc.calculate([job('2023-01', '2020-01')]);
    expect(years).toBe(0);
    expect(warnings[0]).toMatch(/ends before it starts/);
  });

  it('returns 0 for an empty work history', () => {
    expect(calc.calculate([]).years).toBe(0);
  });
});
