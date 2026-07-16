import { Inject, Injectable } from '@nestjs/common';
import { EngineError } from '@common/errors';
import { LlmProvider, ProviderName } from './llm-provider.interface';

export const LLM_PROVIDERS = Symbol('LLM_PROVIDERS');

/**
 * Resolves the active LlmProvider by name.
 * Mirrors EngineRegistry: adding a new vendor = one new provider class + one registration.
 */
@Injectable()
export class ProviderRegistry {
  constructor(@Inject(LLM_PROVIDERS) private readonly providers: LlmProvider[]) {}

  resolve(name: ProviderName): LlmProvider {
    const provider = this.providers.find((p) => p.name === name);
    if (!provider) {
      const known = this.providers.map((p) => p.name).join(', ');
      throw new EngineError(`Unknown LLM provider: "${name}". Available: ${known}`);
    }
    return provider;
  }
}
