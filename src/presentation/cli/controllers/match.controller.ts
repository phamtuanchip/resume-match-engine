import { Injectable } from '@nestjs/common';
import { MatchCandidatesUseCase, MatchOptions } from '@core/application';
import { OutputFormat } from '@core/conversion';
import { PresenterService } from '@presentation/cli/presenter.service';

/** Thin controller: maps CLI input onto the match use case and presents the result. */
@Injectable()
export class MatchController {
  constructor(
    private readonly matchCandidates: MatchCandidatesUseCase,
    private readonly presenter: PresenterService,
  ) {}

  async match(
    options: MatchOptions,
    presentation: { format: OutputFormat; verbose: boolean },
  ): Promise<void> {
    const report = await this.matchCandidates.execute(options);
    await this.presenter.present(report, presentation.format, {
      verbose: presentation.verbose,
    });
  }
}
