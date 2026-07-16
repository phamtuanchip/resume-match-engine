import { Command, CommandRunner, Option } from 'nest-commander';
import { EngineName } from '@core/canonical';
import { OutputFormat } from '@core/conversion';
import { ProviderName } from '@core/matching';
import {
  CliUsageError,
  parseEngine,
  parseFormat,
  parseProvider,
} from '@presentation/cli/commands/cli-options';
import { MatchController } from '@presentation/cli/controllers/match.controller';

interface ScoreCommandOptions {
  job?: string;
  resume?: string;
  engine?: EngineName;
  provider?: ProviderName;
  model?: string;
  apiKey?: string;
  format?: OutputFormat;
}

@Command({
  name: 'score',
  description: 'Score a single parsed candidate against a job (debugging convenience)',
})
export class ScoreCommand extends CommandRunner {
  constructor(private readonly controller: MatchController) {
    super();
  }

  async run(_params: string[], options: ScoreCommandOptions): Promise<void> {
    if (!options.job) throw new CliUsageError('--job <file> is required');
    if (!options.resume) throw new CliUsageError('--resume <file> is required');
    await this.controller.match(
      {
        jobPath: options.job,
        resumePath: options.resume,
        engine: options.engine ?? 'rule-based',
        provider: options.provider,
        model: options.model,
        apiKey: options.apiKey,
      },
      { format: options.format ?? 'json', verbose: true },
    );
  }

  @Option({ flags: '--job <file>', description: 'Job spec file: JSON or free text (required)' })
  parseJob(value: string): string {
    return value;
  }

  @Option({ flags: '--resume <file>', description: 'Canonical profile JSON (required)' })
  parseResume(value: string): string {
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

  @Option({ flags: '--model <id>', description: 'LLM model id (llm/hybrid only)' })
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

  @Option({ flags: '--format <format>', description: 'table | json | csv (default: json)' })
  parseFormatOpt(value: string): OutputFormat {
    return parseFormat(value);
  }
}
