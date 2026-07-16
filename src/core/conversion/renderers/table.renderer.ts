import { Injectable } from '@nestjs/common';
import { OutputRenderer, RenderOptions } from '../output-renderer.interface';
import { MatchReport, ParseSummaryReport, Report } from '../report';

/** Human-readable table output (default CLI format). No external table library needed. */
@Injectable()
export class TableRenderer implements OutputRenderer {
  readonly format = 'table' as const;

  render(report: Report, opts?: RenderOptions): string {
    switch (report.kind) {
      case 'parse-summary':
        return this.renderParseSummary(report, opts);
      case 'match-report':
        return this.renderMatchReport(report, opts);
      case 'canonical':
        return JSON.stringify(report.value, null, 2); // canonical objects have no tabular shape
    }
  }

  private renderParseSummary(report: ParseSummaryReport, opts?: RenderOptions): string {
    const rows = report.rows.map((r) => [
      r.file,
      r.name || '(unknown)',
      String(r.years),
      r.topSkills.slice(0, 4).join(', '),
      String(r.warningCount),
    ]);
    const lines = [
      `Parsed ${report.rows.length} resume(s):`,
      this.table(['File', 'Name', 'Years', 'Top Skills', 'Warnings'], rows),
      `Wrote ${report.rows.length} file(s) to ${report.outDir}.`,
    ];
    if (opts?.verbose) {
      for (const r of report.rows.filter((x) => x.warnings.length)) {
        lines.push(`\n${r.file}:`);
        for (const w of r.warnings) lines.push(`  ! ${w}`);
      }
    }
    return lines.join('\n');
  }

  private renderMatchReport(report: MatchReport, opts?: RenderOptions): string {
    const lines: string[] = [];
    if (report.fallbackReason) {
      lines.push(`WARN: ${report.fallbackReason}`);
    }
    lines.push(
      `Job: ${report.jobTitle}  (min ${report.minYears} yrs, seniority: ${report.seniority})   Engine: ${report.engine}`,
      `Ranked ${report.results.length} candidate(s):`,
    );
    const rows = report.results.map((r, i) => [
      String(i + 1),
      r.candidateName || r.candidateId,
      String(r.score),
      `${r.breakdown.skillCoverage.matchedWeight}/${r.breakdown.skillCoverage.totalWeight} wt`,
      `${r.breakdown.experience.candidateYears}y${r.breakdown.experience.gap > 0 ? ` (gap ${r.breakdown.experience.gap})` : ' ✓'}`,
      r.breakdown.seniority.alignment >= 1
        ? '✓'
        : r.breakdown.seniority.alignment > 0
          ? 'partial'
          : '✗',
      `+${r.breakdown.niceToHave.matched.length}`,
    ]);
    lines.push(
      this.table(
        ['Rank', 'Candidate', 'Score', 'Skills', 'Experience', 'Seniority', 'Nice-to-have'],
        rows,
      ),
      'Use --format json for full per-skill weight contributions.',
    );
    if (report.unscoredCount) {
      lines.push(
        `NOTE: ${report.unscoredCount} profile(s) excluded — no extractable skills or work history.`,
      );
    }
    if (opts?.verbose) {
      for (const r of report.results.filter((x) => x.warnings.length)) {
        lines.push(`\n${r.candidateName || r.candidateId}:`);
        for (const w of r.warnings) lines.push(`  ! ${w}`);
      }
    }
    return lines.join('\n');
  }

  private table(headers: string[], rows: string[][]): string {
    const widths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
    );
    const line = (cells: string[]) =>
      '| ' + cells.map((c, i) => (c ?? '').padEnd(widths[i])).join(' | ') + ' |';
    const divider = '|' + widths.map((w) => '-'.repeat(w + 2)).join('|') + '|';
    return [line(headers), divider, ...rows.map(line)].join('\n');
  }
}
