import { Command, CommandRunner, Option } from 'nest-commander';
import { EngineName } from '@core/canonical';
import { OutputFormat } from '@core/conversion';
import { ProviderName } from '@core/matching';
import {
  CliUsageError,
  parseEngine,
  parseFormat,
  parsePositiveInt,
  parseProvider,
} from '@presentation/cli/commands/cli-options';
import { MatchController } from '@presentation/cli/controllers/match.controller';

interface MatchCommandOptions {
  job?: string;
  resumes?: string;
  engine?: EngineName;
  provider?: ProviderName;
  model?: string;
  apiKey?: string;
  top?: number;
  format?: OutputFormat;
  verbose?: boolean;
}

@Command({
  name: 'match',
  description: 'Rank canonical candidate profiles (from parse-resumes) against one job description',
})
export class MatchCommand extends CommandRunner {
  constructor(private readonly controller: MatchController) {
    super();
  }

  async run(_params: string[], options: MatchCommandOptions): Promise<void> {
    if (!options.job) throw new CliUsageError('--job <file> is required');
    await this.controller.match(
      {
        jobPath: options.job,
        resumesDir: options.resumes ?? 'data/parsed',
        engine: options.engine ?? 'rule-based',
        provider: options.provider,
        model: options.model,
        apiKey: options.apiKey,
        top: options.top,
      },
      { format: options.format ?? 'table', verbose: options.verbose ?? false },
    );
  }

  @Option({ flags: '--job <file>', description: 'Job spec file: JSON or free text (required)' })
  parseJob(value: string): string {
    return value;
  }

  @Option({
    flags: '--resumes <dir>',
    description: 'Dir of canonical profiles (default: data/parsed)',
  })
  parseResumes(value: string): string {
    return value;
  }

  @Option({
    flags: '--engine <engine>',
    description: 'rule-based | llm | hybrid (default: rule-based)',
  })
  parseEngineOpt(value: string): EngineName {
    return parseEngine(value);
  }

  @Option({
    flags: '--provider <provider>',
    description: 'anthropic | openai (default: anthropic)',
  })
  parseProviderOpt(value: string): ProviderName {
    return parseProvider(value);
  }

  @Option({
    flags: '--model <id>',
    description: 'LLM model id (llm/hybrid only; default: claude-sonnet-4-6 / gpt-4o)',
  })
  parseModel(value: string): string {
    return value;
  }

  @Option({
    flags: '--api-key <key>',
    description: 'LLM API key (prefer ANTHROPIC_API_KEY / OPENAI_API_KEY env)',
  })
  parseApiKey(value: string): string {
    return value;
  }

  @Option({ flags: '--top <n>', description: 'Show only the top N candidates' })
  parseTop(value: string): number {
    return parsePositiveInt('--top', value);
  }

  @Option({ flags: '--format <format>', description: 'table | json | csv (default: table)' })
  parseFormatOpt(value: string): OutputFormat {
    return parseFormat(value);
  }

  @Option({ flags: '--verbose', description: 'Include per-candidate warnings' })
  parseVerbose(): boolean {
    return true;
  }
}
