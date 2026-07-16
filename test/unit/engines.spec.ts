import { AppConfig } from '@common/config/app-config';
import { EngineError } from '@common/errors';
import { EngineRegistry } from '@core/matching/engine.registry';
import { HybridEngine } from '@core/matching/engines/hybrid.engine';
import { LlmEngine } from '@core/matching/engines/llm.engine';
import { RuleBasedEngine } from '@core/matching/engines/rule-based.engine';
import { LlmProvider } from '@core/matching/llm-provider.interface';
import { ProviderRegistry } from '@core/matching/provider.registry';
import { ScoringService } from '@core/matching/scoring.service';
import { candidate, jobSpec } from './fixtures';

const scoring = new ScoringService();
const config = new AppConfig();

/** Build a ProviderRegistry backed by a single mock provider. */
const mockRegistry = (impl: () => Promise<string>): ProviderRegistry => {
  const provider: LlmProvider = { name: 'anthropic', complete: jest.fn(impl) };
  return new ProviderRegistry([provider]);
};

describe('RuleBasedEngine', () => {
  const engine = new RuleBasedEngine(scoring);

  it('is always available', async () => {
    await expect(engine.isAvailable({})).resolves.toEqual({ available: true });
  });

  it('produces a deterministic MatchResult', async () => {
    const a = await engine.match(candidate(), jobSpec(), {});
    const b = await engine.match(candidate(), jobSpec(), {});
    expect(a).toEqual(b);
    expect(a.engine).toBe('rule-based');
  });
});

describe('LlmEngine (mocked provider — no live API calls)', () => {
  it('reports unavailable without an API key', async () => {
    const engine = new LlmEngine(
      scoring,
      mockRegistry(async () => ''),
      config,
    );
    const availability = await engine.isAvailable({});
    expect(availability.available).toBe(false);
    expect(availability.reason).toMatch(/API key/);
  });

  it('coerces the LLM response into the MatchResult schema', async () => {
    const engine = new LlmEngine(
      scoring,
      mockRegistry(async () => '{"score": 87, "explanation": "Strong overlap."}'),
      config,
    );
    const result = await engine.match(candidate(), jobSpec(), { apiKey: 'test-key' });
    expect(result.engine).toBe('llm');
    expect(result.score).toBe(87);
    expect(result.breakdown.explanation).toBe('Strong overlap.');
    expect(result.breakdown.requiredSkills.length).toBeGreaterThan(0); // scaffold kept
  });

  it('clamps out-of-range scores into 0..100', async () => {
    const engine = new LlmEngine(
      scoring,
      mockRegistry(async () => '{"score": 250, "explanation": ""}'),
      config,
    );
    const result = await engine.match(candidate(), jobSpec(), { apiKey: 'test-key' });
    expect(result.score).toBe(100);
  });

  it('throws EngineError on an unparseable response', async () => {
    const engine = new LlmEngine(
      scoring,
      mockRegistry(async () => 'sorry, no JSON here'),
      config,
    );
    await expect(engine.match(candidate(), jobSpec(), { apiKey: 'test-key' })).rejects.toThrow(
      EngineError,
    );
  });

  it('resolves the requested provider from context', async () => {
    const openaiProvider: LlmProvider = {
      name: 'openai',
      complete: jest.fn(async () => '{"score": 72, "explanation": "Good fit."}'),
    };
    const registry = new ProviderRegistry([openaiProvider]);
    const engine = new LlmEngine(scoring, registry, config);
    const result = await engine.match(candidate(), jobSpec(), {
      apiKey: 'test-key',
      provider: 'openai',
    });
    expect(result.score).toBe(72);
    expect(openaiProvider.complete).toHaveBeenCalledTimes(1);
  });
});

describe('LLM prompts carry no PII (GDPR guard)', () => {
  // Even if an unsanitized profile reaches an engine, prompts must not include identity fields.
  const piiCandidate = candidate({
    fullName: 'Jane Doe',
    contact: { email: 'jane@example.com', phone: '+1 555 123 4567' },
    rawText: 'Jane Doe, jane@example.com, +1 555 123 4567',
  });

  const captureRegistry = (): { registry: ProviderRegistry; prompts: string[] } => {
    const prompts: string[] = [];
    const provider: LlmProvider = {
      name: 'anthropic',
      complete: jest.fn(async (opts: { prompt: string }) => {
        prompts.push(opts.prompt);
        return '{"score": 50, "explanation": "ok"}';
      }),
    };
    return { registry: new ProviderRegistry([provider]), prompts };
  };

  it.each([
    ['llm', (r: ProviderRegistry) => new LlmEngine(scoring, r, config)],
    ['hybrid', (r: ProviderRegistry) => new HybridEngine(scoring, r, config)],
  ])('%s engine prompt contains no name, email, or phone', async (_name, makeEngine) => {
    const { registry, prompts } = captureRegistry();
    await makeEngine(registry).match(piiCandidate, jobSpec(), { apiKey: 'test-key' });

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).not.toMatch(/jane doe/i);
    expect(prompts[0]).not.toContain('jane@example.com');
    expect(prompts[0]).not.toContain('555 123 4567');
    // The prompt still carries what matching needs.
    expect(prompts[0]).toContain('Node.js');
  });
});

describe('HybridEngine (mocked provider)', () => {
  it('keeps the rule-based score as the anchor and adds the explanation', async () => {
    const engine = new HybridEngine(
      scoring,
      mockRegistry(async () => 'Solid fit.'),
      config,
    );
    const ruleBasedScore = scoring.score(candidate(), jobSpec()).score;
    const result = await engine.match(candidate(), jobSpec(), { apiKey: 'test-key' });
    expect(result.engine).toBe('hybrid');
    expect(result.score).toBe(ruleBasedScore);
    expect(result.breakdown.explanation).toBe('Solid fit.');
  });
});

describe('EngineRegistry — whole-run fallback', () => {
  const registry = new EngineRegistry([
    new RuleBasedEngine(scoring),
    new LlmEngine(
      scoring,
      mockRegistry(async () => ''),
      config,
    ),
    new HybridEngine(
      scoring,
      mockRegistry(async () => ''),
      config,
    ),
  ]);

  it('substitutes rule-based with a warning when llm is unavailable', async () => {
    const { engine, fallbackReason } = await registry.select('llm', {}); // no key
    expect(engine.name).toBe('rule-based');
    expect(fallbackReason).toMatch(/falling back to rule-based/);
  });

  it('keeps the requested engine when it is available', async () => {
    const { engine, fallbackReason } = await registry.select('llm', { apiKey: 'test-key' });
    expect(engine.name).toBe('llm');
    expect(fallbackReason).toBeUndefined();
  });

  it('never falls back for rule-based', async () => {
    const { engine, fallbackReason } = await registry.select('rule-based', {});
    expect(engine.name).toBe('rule-based');
    expect(fallbackReason).toBeUndefined();
  });
});
