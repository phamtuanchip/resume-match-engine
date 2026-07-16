import { Injectable } from '@nestjs/common';
import { EngineError } from '@common/errors';
import { LlmProvider, ProviderName } from '../llm-provider.interface';

/**
 * OpenAI — Chat Completions API (no SDK; raw fetch keeps the bundle small).
 * Drop-in replacement for AnthropicProvider: same LlmProvider contract, different wire format.
 *
 * Default model: gpt-4o (override with --model or RME_LLM_MODEL env var).
 */
@Injectable()
export class OpenAiProvider implements LlmProvider {
  readonly name: ProviderName = 'openai';

  async complete(opts: {
    apiKey: string;
    model: string;
    prompt: string;
    timeoutMs?: number;
  }): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: opts.prompt }],
        }),
      });
      if (!response.ok) {
        throw new EngineError(`OpenAI API returned ${response.status}`, {
          status: response.status,
        });
      }
      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new EngineError('OpenAI response contained no content');
      return text;
    } catch (err) {
      if (err instanceof EngineError) throw err;
      throw new EngineError(`OpenAI call failed: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
