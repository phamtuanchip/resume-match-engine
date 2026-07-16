import { Injectable } from '@nestjs/common';
import { EngineError, FileLoadError } from '@common/errors';
import { FileLoader } from '@common/io';
import {
  CanonicalCandidateProfile,
  CanonicalJobSpec,
  EngineName,
  MatchResult,
} from '@core/canonical';
import { ConverterRegistry, fileSource, MatchReport } from '@core/conversion';
import { EngineRegistry, EngineContext, RankingService, ProviderName } from '@core/matching';
import { ResumeRepository } from './resume.repository';

export interface MatchOptions {
  jobPath: string;
  resumesDir?: string; // dir of canonical profile JSON (from parse-resumes)
  resumePath?: string; // single profile, for the `score` command
  engine: EngineName;
  provider?: ProviderName;
  model?: string;
  apiKey?: string;
  top?: number;
}

/**
 * Orchestrates: load job → select engine (with whole-run fallback) → match every
 * candidate (with per-candidate fallback) → rank. Adapter-agnostic (PLAN.md §2.4).
 */
@Injectable()
export class MatchCandidatesUseCase {
  constructor(
    private readonly fileLoader: FileLoader,
    private readonly converterRegistry: ConverterRegistry,
    private readonly engineRegistry: EngineRegistry,
    private readonly ranking: RankingService,
    private readonly repository: ResumeRepository,
  ) {}

  async execute(options: MatchOptions): Promise<MatchReport> {
    const job = await this.loadJob(options.jobPath);
    const allCandidates = this.loadCandidates(options);
    const ctx: EngineContext = {
      model: options.model,
      apiKey: options.apiKey,
      provider: options.provider,
    };

    // Profiles with no skills AND no work history cannot produce a meaningful score, so they are
    // excluded from BATCH ranking to avoid polluting results with misleading low scores. The
    // `score` command targets one explicitly-chosen profile, though — the operator wants that
    // candidate's score even if it is empty, so the filter is skipped for the single-profile path.
    const candidates = options.resumePath
      ? allCandidates
      : allCandidates.filter((c) => c.skills.length > 0 || c.workHistory.length > 0);
    const unscoredCount = allCandidates.length - candidates.length;

    const { engine, fallbackReason } = await this.engineRegistry.select(options.engine, ctx);
    const ruleBased = this.engineRegistry.get('rule-based');

    const results: MatchResult[] = [];
    for (const candidate of candidates) {
      try {
        results.push(await engine.match(candidate, job, ctx));
      } catch (err) {
        if (!(err instanceof EngineError)) throw err;
        // Per-candidate fallback: one bad LLM call must not sink the batch (PLAN.md §5.3).
        const fallback = await ruleBased.match(candidate, job, ctx);
        fallback.warnings.push(
          `${engine.name} engine failed for this candidate (${err.message}); rule-based result used.`,
        );
        results.push(fallback);
      }
    }

    const ranked = this.ranking.rank(results);
    return {
      kind: 'match-report',
      jobTitle: job.title,
      seniority: job.seniority,
      minYears: job.minYearsExperience,
      engine: fallbackReason ? `${engine.name} (fallback)` : engine.name,
      fallbackReason,
      results: options.top ? ranked.slice(0, options.top) : ranked,
      unscoredCount: unscoredCount > 0 ? unscoredCount : undefined,
    };
  }

  async loadJob(jobPath: string): Promise<CanonicalJobSpec> {
    const source = fileSource(this.fileLoader, jobPath);
    const converter = this.converterRegistry.resolve<CanonicalJobSpec>('job', source);
    const { value } = await converter.convert(source);
    return value;
  }

  private loadCandidates(options: MatchOptions): CanonicalCandidateProfile[] {
    if (options.resumePath) {
      const profile = this.repository.loadOne(options.resumePath);
      if (!profile) {
        throw new FileLoadError(`No canonical profile found at: ${options.resumePath}`);
      }
      return [profile];
    }
    const dir = options.resumesDir ?? 'data/parsed';
    const profiles = this.repository.loadAllFrom(dir);
    if (profiles.length === 0) {
      throw new FileLoadError(`No parsed profiles in "${dir}". Run "parse-resumes <input>" first.`);
    }
    return profiles;
  }
}
