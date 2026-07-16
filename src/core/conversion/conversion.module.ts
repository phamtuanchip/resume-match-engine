import { Module } from '@nestjs/common';
import { ParsingModule } from '@core/parsing/parsing.module';
import { ConverterRegistry, INPUT_CONVERTERS } from './converter.registry';
import { FreeTextJobConverter } from './converters/freetext-job.converter';
import { PdfResumeConverter } from './converters/pdf-resume.converter';
import { PlainTextResumeConverter } from './converters/plaintext-resume.converter';
import { StructuredJobConverter } from './converters/structured-job.converter';
import { OUTPUT_RENDERERS, RendererRegistry } from './renderer.registry';
import { CsvRenderer } from './renderers/csv.renderer';
import { JsonRenderer } from './renderers/json.renderer';
import { TableRenderer } from './renderers/table.renderer';

/**
 * Registers all conversion strategies. Adding a format (e.g. DocxResumeConverter or an
 * HrmCandidateConverter mapping an ATS payload) = one class + one entry in these arrays.
 */
@Module({
  imports: [ParsingModule],
  providers: [
    PdfResumeConverter,
    PlainTextResumeConverter,
    StructuredJobConverter,
    FreeTextJobConverter,
    TableRenderer,
    JsonRenderer,
    CsvRenderer,
    {
      provide: INPUT_CONVERTERS,
      useFactory: (...converters: unknown[]) => converters,
      inject: [
        PdfResumeConverter,
        PlainTextResumeConverter,
        StructuredJobConverter,
        FreeTextJobConverter,
      ],
    },
    {
      provide: OUTPUT_RENDERERS,
      useFactory: (...renderers: unknown[]) => renderers,
      inject: [TableRenderer, JsonRenderer, CsvRenderer],
    },
    ConverterRegistry,
    RendererRegistry,
  ],
  exports: [ConverterRegistry, RendererRegistry],
})
export class ConversionModule {}
