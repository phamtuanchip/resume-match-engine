import { Injectable } from '@nestjs/common';
import { OutputRenderer, RenderOptions } from '../output-renderer.interface';
import { Report } from '../report';

/** Spreadsheet-friendly output for the tabular reports. */
@Injectable()
export class CsvRenderer implements OutputRenderer {
  readonly format = 'csv' as const;

  render(report: Report, _opts?: RenderOptions): string {
    switch (report.kind) {
      case 'parse-summary':
        return this.toCsv(
          ['file', 'name', 'years', 'skills', 'warnings'],
          report.rows.map((r) => [
            r.file,
            r.name ?? '',
            String(r.years),
            r.topSkills.join('; '),
            String(r.warningCount),
          ]),
        );
      case 'match-report':
        return this.toCsv(
          ['rank', 'candidate', 'score', 'engine', 'matchedWeight', 'totalWeight', 'years', 'gap'],
          report.results.map((r, i) => [
            String(i + 1),
            r.candidateName ?? r.candidateId,
            String(r.score),
            r.engine,
            String(r.breakdown.skillCoverage.matchedWeight),
            String(r.breakdown.skillCoverage.totalWeight),
            String(r.breakdown.experience.candidateYears),
            String(r.breakdown.experience.gap),
          ]),
        );
      case 'canonical':
        return JSON.stringify(report.value); // canonical objects have no flat CSV shape
    }
  }

  private toCsv(headers: string[], rows: string[][]): string {
    const escape = (cell: string) => {
      // Formula injection guard: Excel/Sheets evaluate cells starting with =, +, -, @
      if (/^[=+\-@]/.test(cell)) cell = "'" + cell;
      return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
    };
    return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
  }
}
