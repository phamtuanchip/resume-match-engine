import { EngineName } from '@core/canonical';
import { OutputFormat } from '@core/conversion';
import { ProviderName } from '@core/matching';

/** Raised for bad CLI flags; caught in main.ts and printed with usage-style messaging. */
export class CliUsageError extends Error {}

const FORMATS: OutputFormat[] = ['table', 'json', 'csv'];
const ENGINES: EngineName[] = ['rule-based', 'llm', 'hybrid'];
const PROVIDERS: ProviderName[] = ['anthropic', 'openai'];

export function parseFormat(value: string): OutputFormat {
  if (!FORMATS.includes(value as OutputFormat)) {
    throw new CliUsageError(`--format must be one of: ${FORMATS.join(', ')} (got "${value}")`);
  }
  return value as OutputFormat;
}

export function parseEngine(value: string): EngineName {
  if (!ENGINES.includes(value as EngineName)) {
    throw new CliUsageError(`--engine must be one of: ${ENGINES.join(', ')} (got "${value}")`);
  }
  return value as EngineName;
}

export function parseProvider(value: string): ProviderName {
  if (!PROVIDERS.includes(value as ProviderName)) {
    throw new CliUsageError(`--provider must be one of: ${PROVIDERS.join(', ')} (got "${value}")`);
  }
  return value as ProviderName;
}

export function parsePositiveInt(flag: string, value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new CliUsageError(`${flag} must be a positive integer (got "${value}")`);
  }
  return n;
}
