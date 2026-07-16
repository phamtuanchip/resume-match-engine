import { Command, CommandRunner, Option } from 'nest-commander';
import { OutputFormat } from '@core/conversion';
import { parseFormat } from '@presentation/cli/commands/cli-options';
import { ParseController } from '@presentation/cli/controllers/parse.controller';

interface ParseResumesOptions {
  out: string;
  piiDir: string;
  format: OutputFormat;
  verbose: boolean;
}

@Command({
  name: 'parse-resumes',
  arguments: '<input>',
  description: 'Convert and parse a folder (or single file) of resumes into canonical JSON',
})
export class ParseResumesCommand extends CommandRunner {
  constructor(private readonly controller: ParseController) {
    super();
  }

  async run(params: string[], options: ParseResumesOptions): Promise<void> {
    await this.controller.parse(params[0], {
      out: options.out ?? 'data/parsed',
      piiDir: options.piiDir ?? 'data/pii',
      format: options.format ?? 'table',
      verbose: options.verbose ?? false,
    });
  }

  @Option({
    flags: '--out <dir>',
    description: 'Output dir for canonical JSON (default: data/parsed)',
  })
  parseOut(value: string): string {
    return value;
  }

  @Option({
    flags: '--pii-dir <dir>',
    description: 'Dir for the PII vault index (default: data/pii)',
  })
  parsePiiDir(value: string): string {
    return value;
  }

  @Option({ flags: '--format <format>', description: 'table | json | csv (default: table)' })
  parseFormatOpt(value: string): OutputFormat {
    return parseFormat(value);
  }

  @Option({ flags: '--verbose', description: 'Include per-resume warnings' })
  parseVerbose(): boolean {
    return true;
  }
}
