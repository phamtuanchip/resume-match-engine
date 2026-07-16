import { Injectable } from '@nestjs/common';
import { ConvertInputUseCase, ParseResumesUseCase } from '@core/application';
import { OutputFormat } from '@core/conversion';
import { PresenterService } from '@presentation/cli/presenter.service';

/** Thin controller: maps CLI input onto core use cases and presents the result. */
@Injectable()
export class ParseController {
  constructor(
    private readonly parseResumes: ParseResumesUseCase,
    private readonly convertInput: ConvertInputUseCase,
    private readonly presenter: PresenterService,
  ) {}

  async parse(
    input: string,
    opts: { out: string; piiDir: string; format: OutputFormat; verbose: boolean },
  ): Promise<void> {
    const report = await this.parseResumes.execute(input, opts.out, opts.piiDir);
    await this.presenter.present(report, opts.format, { verbose: opts.verbose });
  }

  async convert(
    kind: 'resume' | 'job',
    input: string,
    opts: { format: OutputFormat },
  ): Promise<void> {
    const report = await this.convertInput.execute(kind, input);
    await this.presenter.present(report, opts.format);
  }
}
