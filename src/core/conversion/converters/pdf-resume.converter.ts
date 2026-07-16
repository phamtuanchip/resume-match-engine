import { Injectable } from '@nestjs/common';
import { extractText } from './pdf-extractor';
import {
  baseName,
  ConversionResult,
  InputConverter,
  RawResume,
  SourceDescriptor,
  sourceId,
} from '../input-converter.interface';

/**
 * PDF → canonical text via pdf-parse. Messy content degrades to warnings:
 * a corrupt or scanned (no text layer) PDF still yields a RawResume, never a crash.
 */
@Injectable()
export class PdfResumeConverter implements InputConverter<RawResume> {
  readonly kind = 'resume' as const;
  readonly name = 'pdf-resume';

  supports(source: SourceDescriptor): boolean {
    return source.ext === '.pdf';
  }

  async convert(source: SourceDescriptor): Promise<ConversionResult<RawResume>> {
    const warnings: string[] = [];
    let text = '';
    try {
      // pdf-extractor defers the heavy pdfjs-dist ESM load until extractText() actually runs,
      // so a plain top-level import here still keeps it off the startup path for non-PDF runs.
      text = await extractText(source.bytes ?? Buffer.alloc(0));
      if (!text.trim()) {
        warnings.push('PDF has no extractable text layer (scanned image?); OCR is out of scope.');
      }
    } catch (err) {
      warnings.push(`PDF could not be parsed (${(err as Error).message}); produced empty profile.`);
    }
    return {
      value: {
        id: sourceId(source.uri),
        source: {
          fileName: baseName(source.uri),
          fileType: 'pdf',
          convertedAt: new Date().toISOString(),
          converter: this.name,
        },
        text,
        warnings,
      },
      warnings,
    };
  }
}
