import { Injectable } from '@nestjs/common';
import { CanonicalCandidateProfile, CanonicalJobSpec, MatchResult } from '@core/canonical';
import { EngineAvailability, EngineContext, MatchingEngine } from '../matching-engine.interface';
import { ScoringService } from '../scoring.service';

/** Default engine: deterministic weighted formula, zero external dependencies. */
@Injectable()
export class RuleBasedEngine implements MatchingEngine {
  readonly name = 'rule-based' as const;

  constructor(private readonly scoring: ScoringService) {}

  async isAvailable(_ctx: EngineContext): Promise<EngineAvailability> {
    return { available: true };
  }

  async match(
    candidate: CanonicalCandidateProfile,
    job: CanonicalJobSpec,
    _ctx: EngineContext,
  ): Promise<MatchResult> {
    return this.scoring.score(candidate, job);
  }
}
