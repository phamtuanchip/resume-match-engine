import { Module } from '@nestjs/common';
import { CoreModule } from '@core/core.module';
import { ConvertCommand } from '@presentation/cli/commands/convert.command';
import { MatchCommand } from '@presentation/cli/commands/match.command';
import { ParseResumesCommand } from '@presentation/cli/commands/parse-resumes.command';
import { ScoreCommand } from '@presentation/cli/commands/score.command';
import { MatchController } from '@presentation/cli/controllers/match.controller';
import { ParseController } from '@presentation/cli/controllers/parse.controller';
import { PresenterService } from '@presentation/cli/presenter.service';
import { StdoutPublisher } from '@presentation/cli/stdout.publisher';

/** The CLI presentation adapter. Thin and swappable — depends on core, never vice versa. */
@Module({
  imports: [CoreModule],
  providers: [
    StdoutPublisher,
    PresenterService,
    ParseController,
    MatchController,
    ParseResumesCommand,
    MatchCommand,
    ScoreCommand,
    ConvertCommand,
  ],
})
export class CliModule {}
