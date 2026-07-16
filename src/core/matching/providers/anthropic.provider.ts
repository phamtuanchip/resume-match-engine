import { Injectable } from '@nestjs/common';
import { EngineError } from '@common/errors';
import { LlmProvider, ProviderName } from '../llm-provider.interface';

/**
 * Anthropic Claude — Messages API (no SDK; raw fetch keeps the bundle small).
 * API key goes in the request header only, never in logs or error messages.
 */
@Injectable()
export class AnthropicProvider implements LlmProvider {
  readonly name: ProviderName = 'anthropic';

  async complete(opts: {
    apiKey: string;
    model: string;
    prompt: string;
    timeoutMs?: number;
  }): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': opts.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: opts.prompt }],
        }),
      });
      if (!response.ok) {
        throw new EngineError(`Anthropic API returned ${response.status}`, {
          status: response.status,
        });
      }
      const data = (await response.json()) as { content?: { type: string; text?: string }[] };
      const text = data.content?.find((b) => b.type === 'text')?.text;
      if (!text) throw new EngineError('Anthropic response contained no text block');
      return text;
    } catch (err) {
      if (err instanceof EngineError) throw err;
      throw new EngineError(`Anthropic call failed: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
