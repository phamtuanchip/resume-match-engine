import { Injectable } from '@nestjs/common';
import { OutputFormat, RenderOptions, RendererRegistry, Report } from '@core/conversion';
import { StdoutPublisher } from '@presentation/cli/stdout.publisher';

/** View helper: picks the OutputRenderer for --format and publishes to stdout. */
@Injectable()
export class PresenterService {
  constructor(
    private readonly renderers: RendererRegistry,
    private readonly publisher: StdoutPublisher,
  ) {}

  async present(report: Report, format: OutputFormat, opts?: RenderOptions): Promise<void> {
    await this.publisher.publish(this.renderers.get(format).render(report, opts));
  }
}
