import { Inject, Injectable } from '@nestjs/common';
import { FileLoadError } from '@common/errors';
import { InputConverter, SourceDescriptor } from './input-converter.interface';

export const INPUT_CONVERTERS = Symbol('INPUT_CONVERTERS');

/**
 * Factory-by-capability: returns the first registered converter of the requested kind
 * whose supports() accepts the source. New formats register here — core logic never changes.
 */
@Injectable()
export class ConverterRegistry {
  constructor(@Inject(INPUT_CONVERTERS) private readonly converters: InputConverter<unknown>[]) {}

  resolve<T>(kind: 'resume' | 'job', source: SourceDescriptor): InputConverter<T> {
    const converter = this.converters.find((c) => c.kind === kind && c.supports(source));
    if (!converter) {
      throw new FileLoadError(`No ${kind} converter supports: ${source.uri}`, {
        uri: source.uri,
        ext: source.ext,
      });
    }
    return converter as InputConverter<T>;
  }
}
