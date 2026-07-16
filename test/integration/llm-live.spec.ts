/**
 * Live integration tests — hit the real Anthropic API.
 * These run only when ANTHROPIC_API_KEY is present; they are skipped in CI
 * unless the key is injected.  Run manually:
 *
 *   $env:ANTHROPIC_API_KEY="sk-ant-..."
 *   npx jest test/integration/llm-live.spec.ts --testTimeout=60000
 *
 * What is tested (no mocks):
 *   LIT-001  AnthropicProvider.complete() returns a non-empty string
 *   LIT-002  LlmEngine.match() produces a valid MatchResult (schema + bounds)
 *   LIT-003  HybridEngine numeric anchor equals the rule-based score for the same pair
 *   LIT-004  LLM response never leaks the candidate name / contact details (PII-free prompt)
 *   LIT-005  Fallback: LlmEngine with wrong key throws EngineError, not a raw HTTP error
 */

/* eslint-disable import/order -- the .env bootstrap below must run between the two import groups */
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually so the key is available when running outside the CLI shell.
// (dotenv is not in devDependencies; we parse the file ourselves.)
const envPath = path.resolve(__dirname, '..', '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const RUN = !!API_KEY;

import { AppConfig } from '@common/config/app-config';
import { EngineError } from '@common/errors';
import { MatchResult } from '@core/canonical';
import { HybridEngine } from '@core/matching/engines/hybrid.engine';
import { LlmEngine } from '@core/matching/engines/llm.engine';
import { ProviderRegistry } from '@core/matching/provider.registry';
import { AnthropicProvider } from '@core/matching/providers/anthropic.provider';
import { ScoringService } from '@core/matching/scoring.service';
import { makeProfile, makeJob } from '../unit/helpers';

// ─── Shared test fixtures ────────────────────────────────────────────────────

const CANDIDATE = makeProfile(); // Senior TypeScript/Node.js/AWS engineer, 11.5y
const JOB = makeJob(); // Senior Node.js role, requires TS/Node/NestJS/PostgreSQL/AWS

const ENGINE_CTX = {
  apiKey: API_KEY,
  provider: 'anthropic' as const,
  model: 'claude-haiku-4-5-20251001', // fastest/cheapest for tests
  timeoutMs: 45_000,
};

function assertMatchResultShape(result: MatchResult) {
  expect(typeof result.score).toBe('number');
  expect(result.score).toBeGreaterThanOrEqual(0);
  expect(result.score).toBeLessThanOrEqual(100);
  expect(Number.isInteger(result.score)).toBe(true);
  expect(result.breakdown).toBeDefined();
  expect(Array.isArray(result.warnings)).toBe(true);
  const cs = result.breakdown.componentScores;
  for (const v of Object.values(cs)) {
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
    expect(Number.isFinite(v)).toBe(true);
  }
}

function makeEngines() {
  const config = new AppConfig();
  const providers = new ProviderRegistry([new AnthropicProvider()]);
  const scoring = new ScoringService();
  const llm = new LlmEngine(scoring, providers, config);
  const hybrid = new HybridEngine(scoring, providers, config);
  return { scoring, llm, hybrid };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

(RUN ? describe : describe.skip)('LIT — Live Anthropic integration (real API calls)', () => {
  jest.setTimeout(60_000);

  const { scoring, llm, hybrid } = makeEngines();

  describe('LIT-001: AnthropicProvider.complete() returns non-empty text', () => {
    it('responds to a minimal prompt', async () => {
      const provider = new AnthropicProvider();
      const text = await provider.complete({
        apiKey: API_KEY,
        model: ENGINE_CTX.model,
        prompt: 'Reply with exactly: {"score":42,"explanation":"test"}',
        timeoutMs: ENGINE_CTX.timeoutMs,
      });
      expect(typeof text).toBe('string');
      expect(text.trim().length).toBeGreaterThan(0);
      console.log('[LIT-001] raw provider response:', text.trim());
    });
  });

  describe('LIT-002: LlmEngine.match() produces a valid MatchResult', () => {
    let result: MatchResult;

    beforeAll(async () => {
      result = await llm.match(CANDIDATE, JOB, ENGINE_CTX);
    });

    it('score is integer 0-100', () => {
      assertMatchResultShape(result);
    });

    it('engine field is "llm"', () => {
      expect(result.engine).toBe('llm');
    });

    it('breakdown.explanation is a non-empty string', () => {
      expect(typeof result.breakdown.explanation).toBe('string');
      expect((result.breakdown.explanation ?? '').length).toBeGreaterThan(10);
    });

    it('all required-skill rows are present in the breakdown', () => {
      const skills = result.breakdown.requiredSkills.map((r) => r.skill);
      expect(skills).toContain('TypeScript');
      expect(skills).toContain('Node.js');
    });

    it('prints the full result for manual review', () => {
      console.log('[LIT-002] LLM MatchResult:');
      console.log('  score:', result.score);
      console.log('  explanation:', result.breakdown.explanation);
      console.log('  componentScores:', result.breakdown.componentScores);
    });
  });

  describe('LIT-003: HybridEngine numeric anchor equals rule-based score', () => {
    it('hybrid score matches rule-based for the same candidate/job pair', async () => {
      const ruleResult = scoring.score(CANDIDATE, JOB);
      const hybridResult = await hybrid.match(CANDIDATE, JOB, ENGINE_CTX);

      assertMatchResultShape(hybridResult);
      expect(hybridResult.engine).toBe('hybrid');
      expect(hybridResult.score).toBe(ruleResult.score); // anchor must be identical
      expect(typeof hybridResult.breakdown.explanation).toBe('string');

      console.log(
        '[LIT-003] rule-based score:',
        ruleResult.score,
        '| hybrid score:',
        hybridResult.score,
      );
      console.log('[LIT-003] hybrid explanation:', hybridResult.breakdown.explanation);
    });
  });

  describe('LIT-004: LLM prompt never includes candidate name or contact details', () => {
    it('AnthropicProvider is called with a PII-free prompt', async () => {
      let capturedPrompt = '';

      // Intercept the fetch to capture the request body without making a real call for this test
      const origFetch = global.fetch;
      global.fetch = jest.fn(async (url, opts: RequestInit) => {
        const body = JSON.parse(opts.body as string);
        capturedPrompt = body.messages?.[0]?.content ?? '';
        // Make a real call to validate the prompt works, then restore
        global.fetch = origFetch;
        return origFetch(url, opts);
      }) as unknown as typeof fetch;

      try {
        await llm.match(CANDIDATE, JOB, ENGINE_CTX);
      } finally {
        global.fetch = origFetch;
      }

      expect(capturedPrompt).toBeTruthy();
      // Profile in the prompt uses only id, skills, years, workHistory titles — never PII
      expect(capturedPrompt).not.toContain('Test Candidate'); // fullName
      expect(capturedPrompt).not.toContain('test@example.com'); // email
      expect(capturedPrompt).toContain('TypeScript'); // skills present
      expect(capturedPrompt).toContain('totalYearsExperience'); // experience present

      console.log('[LIT-004] prompt excerpt (first 400 chars):', capturedPrompt.slice(0, 400));
    });
  });

  describe('LIT-005: wrong API key surfaces typed EngineError, not a raw HTTP error', () => {
    it('EngineError is thrown and does not contain the wrong key', async () => {
      const BAD_KEY = 'sk-ant-WRONG-KEY-FOR-TEST';
      await expect(llm.match(CANDIDATE, JOB, { ...ENGINE_CTX, apiKey: BAD_KEY })).rejects.toThrow(
        EngineError,
      );

      try {
        await llm.match(CANDIDATE, JOB, { ...ENGINE_CTX, apiKey: BAD_KEY });
      } catch (err) {
        expect((err as Error).message).not.toContain(BAD_KEY);
      }
    });
  });
});

(RUN ? describe.skip : describe)('LIT — skipped (no ANTHROPIC_API_KEY in environment)', () => {
  it('set ANTHROPIC_API_KEY and rerun to execute live tests', () => {
    console.warn('Live integration tests skipped — ANTHROPIC_API_KEY not set.');
    expect(true).toBe(true);
  });
});
