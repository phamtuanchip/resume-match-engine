import { Module } from '@nestjs/common';
import { AppConfig } from '@common/config';
import { FileLoader } from '@common/io';
import {
  ConvertInputUseCase,
  MatchCandidatesUseCase,
  ParseResumesUseCase,
  ResumeRepository,
} from '@core/application';
import { ConversionModule } from '@core/conversion/conversion.module';
import { MatchingModule } from '@core/matching/matching.module';
import { ParsingModule } from '@core/parsing/parsing.module';
import { PiiModule } from '@core/pii/pii.module';

/** The framework-agnostic domain core. Depends on nothing under presentation/. */
@Module({
  imports: [ConversionModule, ParsingModule, MatchingModule, PiiModule],
  providers: [
    AppConfig,
    FileLoader,
    ResumeRepository,
    ParseResumesUseCase,
    MatchCandidatesUseCase,
    ConvertInputUseCase,
  ],
  exports: [ConversionModule, ParseResumesUseCase, MatchCandidatesUseCase, ConvertInputUseCase],
})
export class CoreModule {}
