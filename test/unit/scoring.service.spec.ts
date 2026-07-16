import { ScoringService } from '@core/matching/scoring.service';
import { candidate, jobSpec, skillList } from './fixtures';

describe('ScoringService', () => {
  const scoring = new ScoringService();

  it('gives a full-match senior candidate a high score (golden number)', () => {
    const result = scoring.score(
      candidate({ skills: skillList('Node.js', 'TypeScript', 'PostgreSQL', 'Kubernetes') }),
      jobSpec(),
    );
    // S_skills=1, S_exp=1 (6y >= 5y), S_sen=1 (senior/senior), S_nice=1
    expect(result.score).toBe(100);
  });

  it('is deterministic across runs', () => {
    const a = scoring.score(candidate(), jobSpec());
    const b = scoring.score(candidate(), jobSpec());
    expect(a).toEqual(b);
  });

  it('weights skill coverage by the job-author weights', () => {
    const result = scoring.score(candidate({ skills: skillList('Node.js') }), jobSpec());
    expect(result.breakdown.skillCoverage).toEqual({
      matchedWeight: 5,
      totalWeight: 12,
      ratio: Math.round((5 / 12) * 100) / 100,
    });
    const nodeDetail = result.breakdown.requiredSkills.find((s) => s.skill === 'Node.js');
    expect(nodeDetail?.matched).toBe(true);
    expect(nodeDetail?.contribution).toBeGreaterThan(0);
    const tsDetail = result.breakdown.requiredSkills.find((s) => s.skill === 'TypeScript');
    expect(tsDetail?.matched).toBe(false);
    expect(tsDetail?.contribution).toBe(0);
  });

  it('applies graded (not zero) credit below the experience bar', () => {
    const below = scoring.score(candidate({ totalYearsExperience: 2.5 }), jobSpec());
    expect(below.breakdown.experience.fit).toBe(0.5); // 2.5 / 5
    expect(below.breakdown.experience.gap).toBe(2.5);
    expect(below.score).toBeGreaterThan(0);
  });

  it('matches skills case-insensitively (canonical vocabulary)', () => {
    const result = scoring.score(candidate({ skills: skillList('node.js') }), jobSpec());
    expect(result.breakdown.requiredSkills.find((s) => s.skill === 'Node.js')?.matched).toBe(true);
  });

  it('handles an empty required-skills list without dividing by zero', () => {
    const result = scoring.score(candidate(), jobSpec({ requiredSkills: [] }));
    expect(result.breakdown.componentScores.skills).toBe(1);
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it('redistributes the nice-to-have weight when the job defines none', () => {
    const result = scoring.score(
      candidate({ skills: skillList('Node.js', 'TypeScript', 'PostgreSQL') }),
      jobSpec({ niceToHaveSkills: [] }),
    );
    expect(result.score).toBe(100); // not capped at 92 by an empty field
  });

  it('penalizes seniority distance softly', () => {
    const junior = candidate({
      totalYearsExperience: 1,
      workHistory: [
        {
          company: 'X',
          title: 'Junior Developer',
          startDate: '2025-01',
          endDate: 'present',
          durationMonths: 12,
          responsibilities: [],
          raw: '',
        },
      ],
    });
    const result = scoring.score(junior, jobSpec());
    expect(result.breakdown.seniority.candidate).toBe('junior');
    expect(result.breakdown.seniority.alignment).toBe(0.3); // distance 2
  });

  it('echoes externalRef for HRM write-back', () => {
    const withRef = candidate({ externalRef: { system: 'greenhouse', id: 'cand-42' } });
    const result = scoring.score(withRef, jobSpec());
    expect(result.candidateExternalRef).toEqual({ system: 'greenhouse', id: 'cand-42' });
  });
});
