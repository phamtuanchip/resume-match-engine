import { Injectable } from '@nestjs/common';
import {
  baseName,
  ConversionResult,
  InputConverter,
  RawResume,
  SourceDescriptor,
  sourceId,
} from '../input-converter.interface';

@Injectable()
export class PlainTextResumeConverter implements InputConverter<RawResume> {
  readonly kind = 'resume' as const;
  readonly name = 'plaintext-resume';

  supports(source: SourceDescriptor): boolean {
    return source.ext === '.txt' || source.ext === '.md';
  }

  async convert(source: SourceDescriptor): Promise<ConversionResult<RawResume>> {
    const text = source.text ?? source.bytes?.toString('utf8') ?? '';
    const warnings = text.trim() ? [] : ['File is empty; nothing to parse.'];
    return {
      value: {
        id: sourceId(source.uri),
        source: {
          fileName: baseName(source.uri),
          fileType: 'txt',
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
