import { Module } from '@nestjs/common';
import { CoreModule } from '@core/core.module';
import { CliModule } from '@presentation/cli/cli.module';

@Module({
  imports: [CoreModule, CliModule],
})
export class AppModule {}
