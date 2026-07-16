/** Public API barrel for the core/matching module. */
export * from './engine.registry';
export * from './engines/hybrid.engine';
export * from './engines/llm.engine';
export * from './engines/rule-based.engine';
export * from './llm-provider.interface';
export * from './matching-engine.interface';
export * from './provider.registry';
export * from './providers/anthropic.provider';
export * from './providers/openai.provider';
export * from './ranking.service';
export * from './scoring.service';
