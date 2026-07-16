import { EngineError } from '@common/errors';
import { FileLoader } from '@common/io/file-loader';
import { MatchCandidatesUseCase } from '@core/application/match-candidates.usecase';
import { ResumeRepository } from '@core/application/resume.repository';
import { ConverterRegistry } from '@core/conversion/converter.registry';
import { StructuredJobConverter } from '@core/conversion/converters/structured-job.converter';
import { EngineRegistry } from '@core/matching/engine.registry';
import { RuleBasedEngine } from '@core/matching/engines/rule-based.engine';
import { MatchingEngine } from '@core/matching/matching-engine.interface';
import { RankingService } from '@core/matching/ranking.service';
import { ScoringService } from '@core/matching/scoring.service';
import { SkillNormalizerService } from '@core/parsing/skill-normalizer.service';
import { candidate } from './fixtures';

const JOB_JSON = JSON.stringify({
  title: 'Senior Node.js Engineer',
  seniority: 'senior',
  minYearsExperience: 5,
  requiredSkills: [{ skill: 'Node.js', weight: 5 }],
  niceToHaveSkills: [],
});

/** An "available" engine that fails for one specific candidate — exercises per-candidate fallback. */
const flakyLlmEngine = (ruleBased: RuleBasedEngine): MatchingEngine => ({
  name: 'llm',
  isAvailable: async () => ({ available: true }),
  match: async (c, job, ctx) => {
    if (c.id === 'bad') throw new EngineError('simulated timeout');
    return { ...(await ruleBased.match(c, job, ctx)), engine: 'llm' };
  },
});

describe('MatchCandidatesUseCase — orchestration and fallback', () => {
  const scoring = new ScoringService();
  const ruleBased = new RuleBasedEngine(scoring);
  const goodCandidate = candidate({ id: 'good', fullName: 'Good Candidate' });
  const badCandidate = candidate({ id: 'bad', fullName: 'Bad Candidate' });

  const useCase = new MatchCandidatesUseCase(
    { readBytes: () => Buffer.from(JOB_JSON) } as unknown as FileLoader,
    new ConverterRegistry([new StructuredJobConverter(new SkillNormalizerService())]),
    new EngineRegistry([ruleBased, flakyLlmEngine(ruleBased)]),
    new RankingService(),
    { loadAllFrom: () => [goodCandidate, badCandidate] } as unknown as ResumeRepository,
  );

  it('falls back per candidate: one bad LLM call does not sink the batch', async () => {
    const report = await useCase.execute({ jobPath: 'job.json', engine: 'llm' });

    expect(report.results).toHaveLength(2);
    const good = report.results.find((r) => r.candidateId === 'good')!;
    const bad = report.results.find((r) => r.candidateId === 'bad')!;

    expect(good.engine).toBe('llm');
    expect(good.warnings).toHaveLength(0);
    expect(bad.engine).toBe('rule-based');
    expect(bad.warnings[0]).toMatch(/llm engine failed .* rule-based result used/i);
  });

  it('ranks results and applies --top', async () => {
    const report = await useCase.execute({ jobPath: 'job.json', engine: 'rule-based', top: 1 });
    expect(report.results).toHaveLength(1);
    expect(report.engine).toBe('rule-based');
  });
});
