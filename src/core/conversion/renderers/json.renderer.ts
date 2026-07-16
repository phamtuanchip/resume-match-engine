import { Injectable } from '@nestjs/common';
import { OutputRenderer, RenderOptions } from '../output-renderer.interface';
import { Report } from '../report';

@Injectable()
export class JsonRenderer implements OutputRenderer {
  readonly format = 'json' as const;

  render(report: Report, _opts?: RenderOptions): string {
    const value = report.kind === 'canonical' ? report.value : report;
    return JSON.stringify(value, null, 2);
  }
}
