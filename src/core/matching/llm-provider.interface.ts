export type ProviderName = 'anthropic' | 'openai';

/**
 * Contract for any LLM backend. Implement this interface to add a new AI vendor
 * without touching the matching engines.
 *
 * Providers are stateless: all per-call config (key, model, prompt) is passed in opts.
 * `complete()` returns the raw text response, so the calling engine can parse/coerce it.
 */
export interface LlmProvider {
  readonly name: ProviderName;
  complete(opts: {
    apiKey: string;
    model: string;
    prompt: string;
    timeoutMs?: number;
  }): Promise<string>;
}
