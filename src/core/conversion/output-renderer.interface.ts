import { Report } from './report';

export type OutputFormat = 'table' | 'json' | 'csv';

export interface RenderOptions {
  verbose?: boolean;
}

/** Strategy: one implementation per output format, all rendering from canonical reports. */
export interface OutputRenderer {
  readonly format: OutputFormat;
  render(report: Report, opts?: RenderOptions): string;
}
