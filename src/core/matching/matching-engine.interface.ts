import {
  CanonicalCandidateProfile,
  CanonicalJobSpec,
  EngineName,
  MatchResult,
} from '@core/canonical';
import { ProviderName } from './llm-provider.interface';

export interface EngineContext {
  model?: string;
  apiKey?: string;
  /** Which LLM vendor to use. Defaults to AppConfig.defaultLlmProvider ('anthropic'). */
  provider?: ProviderName;
  timeoutMs?: number;
}

export interface EngineAvailability {
  available: boolean;
  reason?: string; // human-readable, surfaced in the fallback warning
}

/**
 * Matching strategy. All engines consume the canonical model and produce the same
 * MatchResult shape, so ranking and presentation are engine-agnostic.
 * Engines throw EngineError on failure; fallback policy lives in the use case, not here.
 */
export interface MatchingEngine {
  readonly name: EngineName;
  isAvailable(ctx: EngineContext): Promise<EngineAvailability>;
  match(
    candidate: CanonicalCandidateProfile,
    job: CanonicalJobSpec,
    ctx: EngineContext,
  ): Promise<MatchResult>;
}
