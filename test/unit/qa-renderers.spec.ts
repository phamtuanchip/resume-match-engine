/**
 * QA renderer suite — REND-001..009 from TEST_CASES.md (no renderer specs shipped with the repo).
 */
import { FileLoadError } from '@common/errors';
import { OutputFormat } from '@core/conversion/output-renderer.interface';
import { RendererRegistry } from '@core/conversion/renderer.registry';
import { CsvRenderer } from '@core/conversion/renderers/csv.renderer';
import { JsonRenderer } from '@core/conversion/renderers/json.renderer';
import { TableRenderer } from '@core/conversion/renderers/table.renderer';
import { MatchReport, ParseSummaryReport } from '@core/conversion/report';
import { makeResult } from './helpers';

const table = new TableRenderer();
const json = new JsonRenderer();
const csv = new CsvRenderer();

const matchReport = (overrides: Partial<MatchReport> = {}): MatchReport => ({
  kind: 'match-report',
  jobTitle: 'Senior Node.js Engineer',
  seniority: 'senior',
  minYears: 5,
  engine: 'rule-based',
  results: [
    makeResult({ candidateName: 'Tuan Pham', candidateId: 'tuan-pham', score: 92 }),
    makeResult({ candidateName: 'An Nguyen', candidateId: 'an-nguyen', score: 38 }),
  ],
  ...overrides,
});

const parseReport = (overrides: Partial<ParseSummaryReport> = {}): ParseSummaryReport => ({
  kind: 'parse-summary',
  rows: [
    {
      file: 'a.txt',
      name: 'Tuan Pham',
      years: 11.5,
      topSkills: ['TypeScript', 'NestJS'],
      warningCount: 0,
      warnings: [],
    },
  ],
  outDir: 'data/parsed',
  ...overrides,
});

/** Minimal RFC-4180 CSV parser for round-trip assertions. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

describe('TableRenderer', () => {
  it('REND-001: renders the documented match columns and values', () => {
    const out = table.render(matchReport());
    expect(out).toContain('Job: Senior Node.js Engineer');
    expect(out).toContain('Ranked 2 candidate(s)');
    for (const col of [
      'Rank',
      'Candidate',
      'Score',
      'Skills',
      'Experience',
      'Seniority',
      'Nice-to-have',
    ]) {
      expect(out).toContain(col);
    }
    expect(out.indexOf('Tuan Pham')).toBeLessThan(out.indexOf('An Nguyen'));
  });

  it('REND-006: empty name renders the (unknown) placeholder in the parse summary', () => {
    const out = table.render(parseReport({ rows: [{ ...parseReport().rows[0], name: '' }] }));
    expect(out).toContain('(unknown)');
  });

  it('REND-007: verbose includes warning texts; non-verbose hides them', () => {
    const report = matchReport({
      results: [makeResult({ warnings: ['fell back to rule-based'] })],
    });
    expect(table.render(report, { verbose: true })).toContain('fell back to rule-based');
    expect(table.render(report, { verbose: false })).not.toContain('fell back to rule-based');
  });

  it('REND-009: empty result set renders gracefully', () => {
    const out = table.render(matchReport({ results: [] }));
    expect(out).toContain('Ranked 0 candidate(s)');
  });
});

describe('JsonRenderer', () => {
  it('REND-002: emits valid JSON with the full breakdown', () => {
    const out = json.render(matchReport());
    const parsed = JSON.parse(out);
    expect(parsed.results[0].breakdown.requiredSkills[0]).toHaveProperty('contribution');
    expect(parsed.results[0].breakdown).toHaveProperty('componentScores');
  });

  it('REND-009 (json): empty results parse to an empty array', () => {
    expect(JSON.parse(json.render(matchReport({ results: [] }))).results).toEqual([]);
  });
});

describe('CsvRenderer', () => {
  it('REND-003: emits a parseable header + one row per candidate', () => {
    const rows = parseCsv(csv.render(matchReport()));
    expect(rows[0]).toEqual([
      'rank',
      'candidate',
      'score',
      'engine',
      'matchedWeight',
      'totalWeight',
      'years',
      'gap',
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[1][1]).toBe('Tuan Pham');
  });

  it('REND-004: commas, quotes and newlines in fields are RFC-4180 escaped and round-trip', () => {
    const nasty = 'Smith, "Bob"\nJr';
    const out = csv.render(matchReport({ results: [makeResult({ candidateName: nasty })] }));
    const rows = parseCsv(out);
    expect(rows[1][1]).toBe(nasty);
    expect(rows[1]).toHaveLength(8); // row structure intact
  });

  it('REND-005: formula-injection prefixes (=, +, @) are neutralized', () => {
    // "=1+2" contains no comma/quote/newline, so the RFC-4180 escaper leaves it untouched;
    // quoting alone would NOT stop Excel/Sheets from evaluating it anyway.
    const out = csv.render(matchReport({ results: [makeResult({ candidateName: '=1+2' })] }));
    const parsedName = parseCsv(out)[1][1];
    // A safe CSV must prefix dangerous leading chars (=, +, -, @), e.g. with an apostrophe.
    expect(parsedName.startsWith('=')).toBe(false);
  });

  it('REND-009 (csv): empty results emit header only', () => {
    const rows = parseCsv(csv.render(matchReport({ results: [] })));
    expect(rows).toHaveLength(1);
  });
});

describe('RendererRegistry', () => {
  const registry = new RendererRegistry([table, json, csv]);

  it('REND-008: resolves each documented format and rejects unknown ones', () => {
    expect(registry.get('table').format).toBe('table');
    expect(registry.get('json').format).toBe('json');
    expect(registry.get('csv').format).toBe('csv');
    expect(() => registry.get('xml' as OutputFormat)).toThrow(FileLoadError);
  });
});
