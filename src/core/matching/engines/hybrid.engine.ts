import { Injectable } from '@nestjs/common';
import { AppConfig } from '@common/config';
import { EngineError } from '@common/errors';
import { CanonicalCandidateProfile, CanonicalJobSpec, MatchResult } from '@core/canonical';
import { EngineAvailability, EngineContext, MatchingEngine } from '../matching-engine.interface';
import { ProviderRegistry } from '../provider.registry';
import { ScoringService } from '../scoring.service';

/**
 * Hybrid engine: the rule-based score is kept as the deterministic, auditable anchor;
 * the LLM only enriches the breakdown with a natural-language explanation.
 * Bounds LLM influence and cost while keeping the numbers reproducible.
 *
 * Provider is resolved at match-time from EngineContext.provider (default: 'anthropic').
 */
@Injectable()
export class HybridEngine implements MatchingEngine {
  readonly name = 'hybrid' as const;

  constructor(
    private readonly scoring: ScoringService,
    private readonly providers: ProviderRegistry,
    private readonly config: AppConfig,
  ) {}

  async isAvailable(ctx: EngineContext): Promise<EngineAvailability> {
    const providerName = ctx.provider ?? this.config.defaultLlmProvider;
    const apiKey = ctx.apiKey ?? this.config.apiKeyFor(providerName);
    return apiKey
      ? { available: true }
      : {
          available: false,
          reason: `no API key for provider "${providerName}" (set ANTHROPIC_API_KEY / OPENAI_API_KEY or pass --api-key)`,
        };
  }

  async match(
    candidate: CanonicalCandidateProfile,
    job: CanonicalJobSpec,
    ctx: EngineContext,
  ): Promise<MatchResult> {
    const base = this.scoring.score(candidate, job);
    const providerName = ctx.provider ?? this.config.defaultLlmProvider;
    const apiKey = ctx.apiKey ?? this.config.apiKeyFor(providerName);
    if (!apiKey)
      throw new EngineError(
        `Hybrid engine invoked without an API key for provider "${providerName}"`,
      );

    const provider = this.providers.resolve(providerName);
    const raw = await provider.complete({
      apiKey,
      model: ctx.model ?? this.config.defaultModelFor(providerName),
      timeoutMs: ctx.timeoutMs,
      prompt: [
        'Explain in 2-3 sentences why this candidate scored as they did for this job.',
        'Respond with ONLY the explanation text.',
        '',
        `JOB: ${JSON.stringify({ title: job.title, seniority: job.seniority, minYears: job.minYearsExperience, requiredSkills: job.requiredSkills })}`,
        // Pseudonymous vault index only — candidate.id is derived from the CV filename and can
        // carry the person's name, so it must never leave the machine (docs/gdpr-compliance-report.md).
        `CANDIDATE: ${JSON.stringify({ ref: candidate.piiIndex ?? 'candidate', skills: candidate.skills.map((s) => s.canonical), years: candidate.totalYearsExperience })}`,
        `RULE-BASED SCORE: ${base.score}/100, component scores: ${JSON.stringify(base.breakdown.componentScores)}`,
      ].join('\n'),
    });

    return {
      ...base,
      engine: 'hybrid',
      breakdown: { ...base.breakdown, explanation: raw.trim() },
    };
  }
}
