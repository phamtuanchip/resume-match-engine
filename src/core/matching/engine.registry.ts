import { Inject, Injectable } from '@nestjs/common';
import { EngineName } from '@core/canonical';
import { EngineContext, MatchingEngine } from './matching-engine.interface';

export const MATCHING_ENGINES = Symbol('MATCHING_ENGINES');

export interface EngineSelection {
  engine: MatchingEngine;
  /** Set when the requested engine was unavailable and rule-based was substituted. */
  fallbackReason?: string;
}

@Injectable()
export class EngineRegistry {
  constructor(@Inject(MATCHING_ENGINES) private readonly engines: MatchingEngine[]) {}

  get(name: EngineName): MatchingEngine {
    const engine = this.engines.find((e) => e.name === name);
    if (!engine) throw new Error(`Unknown matching engine: ${name}`);
    return engine;
  }

  /**
   * Whole-run fallback (PLAN.md §5.3): if the requested engine is unavailable at startup
   * (no API key, unreachable), substitute rule-based with a warning instead of failing.
   */
  async select(name: EngineName, ctx: EngineContext): Promise<EngineSelection> {
    const requested = this.get(name);
    const availability = await requested.isAvailable(ctx);
    if (availability.available) return { engine: requested };
    return {
      engine: this.get('rule-based'),
      fallbackReason: `${name} engine unavailable (${availability.reason ?? 'unknown reason'}); falling back to rule-based.`,
    };
  }
}
