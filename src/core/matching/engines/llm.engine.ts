import { Injectable } from '@nestjs/common';
import { AppConfig } from '@common/config';
import { EngineError } from '@common/errors';
import { CanonicalCandidateProfile, CanonicalJobSpec, MatchResult } from '@core/canonical';
import { EngineAvailability, EngineContext, MatchingEngine } from '../matching-engine.interface';
import { ProviderRegistry } from '../provider.registry';
import { ScoringService } from '../scoring.service';

/**
 * LLM-assisted engine: the LLM judges fit semantically (synonyms, implied seniority) and
 * returns score + explanation. The rule-based breakdown is kept as the transparent scaffold
 * so the result stays auditable. Non-deterministic — see trade-offs in PLAN.md §5.4.
 *
 * Provider is resolved at match-time from EngineContext.provider (default: 'anthropic').
 * Swap to a different vendor by passing --provider openai without touching this class.
 */
@Injectable()
export class LlmEngine implements MatchingEngine {
  readonly name = 'llm' as const;

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
      throw new EngineError(`LLM engine invoked without an API key for provider "${providerName}"`);

    const provider = this.providers.resolve(providerName);
    const raw = await provider.complete({
      apiKey,
      model: ctx.model ?? this.config.defaultModelFor(providerName),
      timeoutMs: ctx.timeoutMs,
      prompt: this.buildPrompt(candidate, job),
    });
    const { score, explanation } = this.parseResponse(raw);

    return {
      ...base,
      engine: 'llm',
      score,
      breakdown: { ...base.breakdown, explanation },
    };
  }

  private buildPrompt(candidate: CanonicalCandidateProfile, job: CanonicalJobSpec): string {
    const profile = {
      // Pseudonymous vault index only — candidate.id is derived from the CV filename and can
      // carry the person's name, so it must never leave the machine (docs/gdpr-compliance-report.md).
      ref: candidate.piiIndex ?? 'candidate',
      skills: candidate.skills.map((s) => s.canonical),
      totalYearsExperience: candidate.totalYearsExperience,
      workHistory: candidate.workHistory.map((w) => ({ title: w.title, company: w.company })),
      education: candidate.education.map((e) => e.raw),
    };
    return [
      'You are scoring how well a candidate fits a job. Respond with ONLY a JSON object:',
      '{"score": <integer 0-100>, "explanation": "<2-3 sentence justification>"}',
      '',
      `JOB: ${JSON.stringify({ title: job.title, seniority: job.seniority, minYears: job.minYearsExperience, requiredSkills: job.requiredSkills, niceToHave: job.niceToHaveSkills })}`,
      `CANDIDATE: ${JSON.stringify(profile)}`,
    ].join('\n');
  }

  private parseResponse(raw: string): { score: number; explanation: string } {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new EngineError('LLM response was not parseable JSON');
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { score?: unknown; explanation?: unknown };
      const score = Math.min(100, Math.max(0, Math.round(Number(parsed.score))));
      if (Number.isNaN(score)) throw new Error('score is not a number');
      return { score, explanation: String(parsed.explanation ?? '') };
    } catch (err) {
      throw new EngineError(`LLM response failed schema coercion: ${(err as Error).message}`);
    }
  }
}
