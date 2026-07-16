/**
 * QA supplement suite — executes TEST_CASES.md cases not covered by the shipped specs.
 * Test names carry the TEST_CASES.md IDs for traceability. Read-only against src/.
 *
 * PDF converter tests (CONV-008/009/010) were moved to qa-pdf-converter.spec.ts which uses
 * jest.doMock + resetModules() to reliably intercept the lazy require('./pdf-extractor') inside
 * the converter — jest.mock hoisting with ts-jest did not work for that case.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EngineError } from '@common/errors';
import { WorkExperience, MatchResult } from '@core/canonical';
import { FreeTextJobConverter } from '@core/conversion/converters/freetext-job.converter';
import { PlainTextResumeConverter } from '@core/conversion/converters/plaintext-resume.converter';
import { sourceId } from '@core/conversion/input-converter.interface';
import { AnthropicProvider } from '@core/matching/providers/anthropic.provider';
import { RankingService } from '@core/matching/ranking.service';
import { ScoringService } from '@core/matching/scoring.service';
import { ExperienceCalculatorService } from '@core/parsing/experience-calculator.service';
import { extractContact } from '@core/parsing/extractors/contact.extractor';
import { ResumeParserService } from '@core/parsing/resume-parser.service';
import { SkillNormalizerService } from '@core/parsing/skill-normalizer.service';
import { makeProfile, makeJob, skill } from './helpers';

const FIXTURES = path.resolve(__dirname, '..', 'fixtures');
const scoring = new ScoringService();

const work = (
  startDate: string | null,
  endDate: string | 'present' | null,
  title = 'Engineer',
): WorkExperience => ({
  company: 'X',
  title,
  startDate,
  endDate,
  durationMonths: null,
  responsibilities: [],
  raw: '',
});

describe('SCORE — supplement', () => {
  it('SCORE-001: golden composite — full skills, exp met, seniority exact, 2/3 nice-to-haves = 97', () => {
    const result = scoring.score(makeProfile(), makeJob());
    // 100 * (0.55*1 + 0.25*1 + 0.12*1 + 0.08*(2/3)) = 97.33 -> 97
    expect(result.score).toBe(97);
    expect(result.breakdown.componentScores).toEqual({
      skills: 1,
      experience: 1,
      seniority: 1,
      niceToHave: 0.67,
    });
  });

  it('SCORE-004: experience exactly at minYears gives fit=1, gap=0', () => {
    const r = scoring.score(makeProfile({ totalYearsExperience: 5 }), makeJob());
    expect(r.breakdown.experience.fit).toBe(1);
    expect(r.breakdown.experience.gap).toBe(0);
  });

  it('SCORE-006: minYears=0 gives full experience credit even at 0 years', () => {
    const r = scoring.score(
      makeProfile({ totalYearsExperience: 0, workHistory: [] }),
      makeJob({ minYearsExperience: 0 }),
    );
    expect(r.breakdown.experience.fit).toBe(1);
    expect(Number.isFinite(r.score)).toBe(true);
  });

  it('SCORE-008: seniority ordinal distances 1/2/3 map to 0.6/0.3/0', () => {
    const senior = makeProfile(); // Senior Engineer title, 11.5y -> senior
    expect(
      scoring.score(senior, makeJob({ seniority: 'lead' })).breakdown.seniority.alignment,
    ).toBe(0.6);
    expect(
      scoring.score(senior, makeJob({ seniority: 'junior' })).breakdown.seniority.alignment,
    ).toBe(0.3);
    const junior = makeProfile({
      totalYearsExperience: 1,
      workHistory: [work('2025-06', 'present', 'Junior Developer')],
    });
    expect(
      scoring.score(junior, makeJob({ seniority: 'lead' })).breakdown.seniority.alignment,
    ).toBe(0);
  });

  it('SCORE-009: title keyword takes precedence over years for seniority inference', () => {
    const titledSenior = makeProfile({
      totalYearsExperience: 1,
      workHistory: [work('2025-06', 'present', 'Senior Developer')],
    });
    const r = scoring.score(titledSenior, makeJob());
    expect(r.breakdown.seniority.candidate).toBe('senior');
    expect(r.breakdown.seniority.alignment).toBe(1);
  });

  it('SCORE-010: years thresholds — 1.9 junior, 2 mid, 5 senior, 9 lead (no title keywords)', () => {
    const at = (years: number) =>
      scoring.score(
        makeProfile({
          totalYearsExperience: years,
          workHistory: [work('2015-01', 'present', 'Engineer')],
        }),
        makeJob(),
      ).breakdown.seniority.candidate;
    expect(at(1.9)).toBe('junior');
    expect(at(2)).toBe('mid');
    expect(at(5)).toBe('senior');
    expect(at(9)).toBe('lead');
  });

  it('SCORE-011: nice-to-have fraction produces the documented bonus', () => {
    const r = scoring.score(
      makeProfile({
        skills: ['TypeScript', 'Node.js', 'NestJS', 'PostgreSQL', 'AWS', 'Docker', 'Redis'].map(
          skill,
        ),
      }),
      makeJob({ niceToHaveSkills: ['Docker', 'Redis', 'GraphQL', 'Kafka'] }),
    );
    expect(r.breakdown.niceToHave.matched.sort()).toEqual(['Docker', 'Redis']);
    expect(r.breakdown.niceToHave.bonus).toBe(4); // 100 * 0.08 * 0.5
  });

  it('SCORE-014/016: degenerate candidate stays a valid, bounded result', () => {
    const empty = makeProfile({
      fullName: null,
      skills: [],
      workHistory: [],
      totalYearsExperience: 0,
    });
    const r = scoring.score(empty, makeJob());
    expect(Number.isInteger(r.score)).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    for (const v of Object.values(r.breakdown.componentScores)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('SCORE-017: breakdown recomposes to the reported score (±1 rounding)', () => {
    const r = scoring.score(makeProfile({ totalYearsExperience: 3 }), makeJob());
    const c = r.breakdown.componentScores;
    const recomposed =
      100 * (0.55 * c.skills + 0.25 * c.experience + 0.12 * c.seniority + 0.08 * c.niceToHave);
    expect(Math.abs(recomposed - r.score)).toBeLessThanOrEqual(1);
  });
});

describe('EXP — supplement', () => {
  const calc = new ExperienceCalculatorService();

  it('EXP-009: fully-contained range counts once', () => {
    const { years } = calc.calculate([work('2015-01', '2020-01'), work('2017-01', '2018-01')]);
    expect(years).toBe(5);
  });

  it('EXP-010: same-month start/end yields 0 (documented rounding rule), never negative', () => {
    const { years } = calc.calculate([work('2021-06', '2021-06')]);
    expect(years).toBe(0);
  });

  it('EXP-011: future-dated ongoing job is excluded with a warning, never inflates the total', () => {
    const { years, warnings } = calc.calculate([work('2030-01', null)]);
    expect(years).toBe(0);
    expect(warnings).toHaveLength(1);
  });
});

describe('SKILL — supplement', () => {
  const svc = new SkillNormalizerService();

  it('SKILL-004: whitespace-padded aliases still normalize', () => {
    expect(svc.normalize('  nodejs  ')).toBe('Node.js');
  });

  it('SKILL-005: unknown skills pass through trimmed', () => {
    expect(svc.normalize('  Zig  ')).toBe('Zig');
  });

  it('SKILL-008: empty/punctuation-only tokens do not crash', () => {
    expect(() => svc.normalize('')).not.toThrow();
    expect(() => svc.normalize('·')).not.toThrow();
    expect(() => svc.normalize(',')).not.toThrow();
  });
});

describe('RANK — supplement', () => {
  const ranking = new RankingService();
  const result = (name: string | null, id: string, score: number): MatchResult => ({
    candidateId: id,
    candidateName: name,
    candidateExternalRef: null,
    engine: 'rule-based',
    score,
    warnings: [],
    breakdown: {} as MatchResult['breakdown'],
  });

  it('RANK-004: empty input returns empty output without error', () => {
    expect(ranking.rank([])).toEqual([]);
  });

  it('RANK-005: all-identical scores keep a stable, repeatable order', () => {
    const input = [result('Zed', 'z', 50), result('Amy', 'a', 50), result('Mia', 'm', 50)];
    const first = ranking.rank(input).map((r) => r.candidateName);
    for (let i = 0; i < 5; i++) {
      expect(ranking.rank(input).map((r) => r.candidateName)).toEqual(first);
    }
    expect(first).toEqual(['Amy', 'Mia', 'Zed']);
  });

  it('RANK-002: null candidateName falls back to candidateId for the tie-break', () => {
    const ranked = ranking.rank([result(null, 'zzz', 50), result(null, 'aaa', 50)]);
    expect(ranked.map((r) => r.candidateId)).toEqual(['aaa', 'zzz']);
  });
});

describe('CONV — supplement (empty file + freetext clamp)', () => {
  // CONV-008/009/010 (PDF) → qa-pdf-converter.spec.ts

  it('CONV-016: zero-byte txt file converts with an "empty" warning', async () => {
    const { warnings } = await new PlainTextResumeConverter().convert({
      uri: 'empty.txt',
      origin: 'file',
      ext: '.txt',
      bytes: Buffer.alloc(0),
    });
    expect(warnings[0]).toMatch(/empty/i);
  });

  it('CONV-013b: free-text weights outside 1-5 are clamped with a warning', async () => {
    const jd = ['Role', 'Required skills:', '- Node.js (9)'].join('\n');
    const { value, warnings } = await new FreeTextJobConverter(
      new SkillNormalizerService(),
    ).convert({
      uri: 'jd.txt',
      origin: 'file',
      ext: '.txt',
      text: jd,
    });
    // NOTE: single-digit regex means "(9)" parses as weight 9 -> clamped to 5.
    expect(value.requiredSkills[0].weight).toBeLessThanOrEqual(5);
    expect(value.requiredSkills[0].weight).toBeGreaterThanOrEqual(1);
    expect(warnings.some((w) => /clamped/.test(w))).toBe(true);
  });

  it('PARSE-017: sourceId is a stable slug across repeated calls and path styles', () => {
    expect(sourceId('C:\\resumes\\Tuan Pham.pdf')).toBe(sourceId('/resumes/Tuan Pham.pdf'));
    expect(sourceId('Tuan Pham.pdf')).toBe('tuan-pham');
  });
});

describe('ENG — supplement (provider timeout + key-safety, no live calls)', () => {
  it('ENG-006: AnthropicProvider aborts at timeoutMs and surfaces EngineError', async () => {
    const realFetch = global.fetch;
    global.fetch = jest.fn(
      (_url: unknown, opts: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })),
          );
        }),
    ) as unknown as typeof fetch;
    try {
      const provider = new AnthropicProvider();
      const started = Date.now();
      await expect(
        provider.complete({ apiKey: 'k', model: 'm', prompt: 'p', timeoutMs: 100 }),
      ).rejects.toThrow(EngineError);
      expect(Date.now() - started).toBeLessThan(5000);
    } finally {
      global.fetch = realFetch;
    }
  });

  it('NFR-005 (unit slice): EngineError from a failed LLM call never contains the API key', async () => {
    const realFetch = global.fetch;
    const CANARY = 'sk-test-CANARY-12345';
    global.fetch = jest.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    try {
      const provider = new AnthropicProvider();
      await provider.complete({ apiKey: CANARY, model: 'm', prompt: 'p' });
      throw new Error('expected EngineError');
    } catch (err) {
      expect((err as Error).message).not.toContain(CANARY);
      expect(JSON.stringify((err as EngineError).context ?? {})).not.toContain(CANARY);
    } finally {
      global.fetch = realFetch;
    }
  });
});

describe('PARSE — supplement', () => {
  const parser = new ResumeParserService(
    new SkillNormalizerService(),
    new ExperienceCalculatorService(),
  );
  const raw = (text: string) => ({
    id: 'qa',
    source: { fileName: 'qa.txt', fileType: 'txt' as const, convertedAt: '', converter: 'test' },
    text,
    warnings: [] as string[],
  });

  it('PARSE-010: unicode/diacritic names are preserved', () => {
    const text = fs.readFileSync(path.join(FIXTURES, 'resumes', 'unicode-name.txt'), 'utf8');
    const profile = parser.parse(raw(text));
    expect(profile.fullName).toBe('Nguyễn Văn A');
    expect(profile.contact.email).toBe('nguyen.van.a@example.com');
  });

  it('PARSE-011: with multiple emails, the first is chosen deterministically', () => {
    const profile = parser.parse(
      raw('Ann Lee\nfirst@example.com\nsecond@example.com\n\nSkills\nJava'),
    );
    expect(profile.contact.email).toBe('first@example.com');
  });

  it('PARSE-013: binary-noise and emoji-only inputs never throw', () => {
    for (const text of [' ', '🎉🎉🎉', '<html><body>hi</body></html>', 'x']) {
      expect(() => parser.parse(raw(text))).not.toThrow();
    }
  });

  it('PARSE-014/015/016: warnings accumulate, rawText and provenance retained', () => {
    const input = raw('no name here at all 12345');
    input.warnings.push('conversion-level warning');
    const profile = parser.parse(input);
    expect(profile.warnings[0]).toBe('conversion-level warning');
    expect(profile.warnings.length).toBeGreaterThan(1);
    expect(profile.rawText).toBe('no name here at all 12345');
    expect(profile.source.converter).toBe('test');
  });
});

describe('PHONE — year-range false positives (regression)', () => {
  it('does not capture a YYYY-YYYY date range as a phone number', () => {
    const { contact } = extractContact('Work: 2021 - 2024\nemail@example.com');
    expect(contact.phone).toBeNull();
  });

  it('does not capture an en-dash year range as a phone number', () => {
    const { contact } = extractContact('Employed 2019–2022\nemail@example.com');
    expect(contact.phone).toBeNull();
  });

  it('still captures a valid international phone number', () => {
    const { contact } = extractContact('Jane Doe\njane@example.com\n+1 555 123 4567');
    expect(contact.phone).toBe('+1 555 123 4567');
  });

  it('still captures a valid local phone number', () => {
    const { contact } = extractContact('Contact: (84) 912 345 678\nemail@example.com');
    expect(contact.phone).toContain('912');
  });
});

describe('SCORE — unscorable profiles (P2 regression)', () => {
  it('warns when a profile has no skills and no work history', () => {
    const result = scoring.score(
      makeProfile({ skills: [], workHistory: [], totalYearsExperience: 0 }),
      makeJob(),
    );
    expect(result.warnings.some((w) => /unscorable/i.test(w))).toBe(true);
  });

  it('carries conversion/parse warnings through to the MatchResult', () => {
    const result = scoring.score(
      makeProfile({ warnings: ['PDF could not be parsed; produced empty profile.'] }),
      makeJob(),
    );
    expect(result.warnings).toContain('PDF could not be parsed; produced empty profile.');
  });

  it('a fully-matched candidate still has zero warnings', () => {
    const result = scoring.score(makeProfile(), makeJob());
    expect(result.warnings).toHaveLength(0);
  });
});
