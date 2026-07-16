import { Inject, Injectable } from '@nestjs/common';
import { FileLoadError } from '@common/errors';
import { OutputFormat, OutputRenderer } from './output-renderer.interface';

export const OUTPUT_RENDERERS = Symbol('OUTPUT_RENDERERS');

@Injectable()
export class RendererRegistry {
  constructor(@Inject(OUTPUT_RENDERERS) private readonly renderers: OutputRenderer[]) {}

  get(format: OutputFormat): OutputRenderer {
    const renderer = this.renderers.find((r) => r.format === format);
    if (!renderer) {
      throw new FileLoadError(`No renderer registered for format: ${format}`, { format });
    }
    return renderer;
  }
}
