import { Injectable } from '@nestjs/common';
// File-level (not the @core/matching barrel): AppConfig is a dependency of the matching engines,
// so importing the whole matching barrel here would form a config ↔ matching import cycle.
import { ProviderName } from '@core/matching/llm-provider.interface';

/** Environment-driven configuration. API keys are read here and never logged. */
@Injectable()
export class AppConfig {
  // ── LLM provider selection ───────────────────────────────────────────────

  get defaultLlmProvider(): ProviderName {
    const val = process.env.RME_LLM_PROVIDER ?? 'anthropic';
    return val === 'openai' ? 'openai' : 'anthropic';
  }

  /** Resolve the API key for a given provider from env, falling back to undefined. */
  apiKeyFor(provider: ProviderName): string | undefined {
    if (provider === 'openai') return process.env.OPENAI_API_KEY || undefined;
    return process.env.ANTHROPIC_API_KEY || undefined;
  }

  /** Kept for backward-compat (ANTHROPIC_API_KEY check in tests/isAvailable). */
  get anthropicApiKey(): string | undefined {
    return process.env.ANTHROPIC_API_KEY || undefined;
  }

  /**
   * Default model for a given provider.
   * RME_LLM_MODEL overrides everything; otherwise a sensible default is chosen per vendor.
   */
  defaultModelFor(provider: ProviderName): string {
    if (process.env.RME_LLM_MODEL) return process.env.RME_LLM_MODEL;
    return provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-6';
  }

  // ── Storage ──────────────────────────────────────────────────────────────

  get defaultParsedDir(): string {
    return process.env.RME_PARSED_DIR || 'data/parsed';
  }
}
