import { Module } from '@nestjs/common';
import { AppConfig } from '@common/config';
import { EngineRegistry, MATCHING_ENGINES } from './engine.registry';
import { HybridEngine } from './engines/hybrid.engine';
import { LlmEngine } from './engines/llm.engine';
import { RuleBasedEngine } from './engines/rule-based.engine';
import { LLM_PROVIDERS, ProviderRegistry } from './provider.registry';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { RankingService } from './ranking.service';
import { ScoringService } from './scoring.service';

@Module({
  providers: [
    AppConfig,
    ScoringService,
    RankingService,
    // LLM providers — add a new vendor here and it becomes available via --provider
    AnthropicProvider,
    OpenAiProvider,
    {
      provide: LLM_PROVIDERS,
      useFactory: (...providers: unknown[]) => providers,
      inject: [AnthropicProvider, OpenAiProvider],
    },
    ProviderRegistry,
    // Matching engines
    RuleBasedEngine,
    LlmEngine,
    HybridEngine,
    {
      provide: MATCHING_ENGINES,
      useFactory: (...engines: unknown[]) => engines,
      inject: [RuleBasedEngine, LlmEngine, HybridEngine],
    },
    EngineRegistry,
  ],
  exports: [ScoringService, RankingService, EngineRegistry],
})
export class MatchingModule {}
