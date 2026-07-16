import { Command, CommandRunner, Option } from 'nest-commander';
import { OutputFormat } from '@core/conversion';
import { CliUsageError, parseFormat } from '@presentation/cli/commands/cli-options';
import { ParseController } from '@presentation/cli/controllers/parse.controller';

interface ConvertCommandOptions {
  kind?: 'resume' | 'job';
  format?: OutputFormat;
}

@Command({
  name: 'convert',
  arguments: '<input>',
  description: 'Convert any supported input to canonical JSON without scoring',
})
export class ConvertCommand extends CommandRunner {
  constructor(private readonly controller: ParseController) {
    super();
  }

  async run(params: string[], options: ConvertCommandOptions): Promise<void> {
    if (!options.kind) throw new CliUsageError('--kind <resume|job> is required');
    await this.controller.convert(options.kind, params[0], {
      format: options.format ?? 'json',
    });
  }

  @Option({ flags: '--kind <kind>', description: 'resume | job (required)' })
  parseKind(value: string): 'resume' | 'job' {
    if (value !== 'resume' && value !== 'job') {
      throw new CliUsageError(`--kind must be "resume" or "job" (got "${value}")`);
    }
    return value;
  }

  @Option({ flags: '--format <format>', description: 'table | json | csv (default: json)' })
  parseFormatOpt(value: string): OutputFormat {
    return parseFormat(value);
  }
}
