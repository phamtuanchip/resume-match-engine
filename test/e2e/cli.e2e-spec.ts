import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * End-to-end tests against the built CLI (dist/main.js — `npm run build` runs as pretest).
 * Exercises the real binary: exit codes, PII vault, fallback warnings, and output formats.
 * Source CVs are NOT renamed (parse-resumes copies them to the vault instead).
 */
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

interface CliRun {
  stdout: string;
  exitCode: number;
}

function cli(args: string[], env: Record<string, string | undefined> = {}): CliRun {
  try {
    const stdout = execFileSync('node', ['dist/main.js', ...args], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ANTHROPIC_API_KEY: undefined, ...env },
    });
    return { stdout, exitCode: 0 };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { stdout: `${e.stdout ?? ''}${e.stderr ?? ''}`, exitCode: e.status ?? 1 };
  }
}

describe('CLI end-to-end', () => {
  const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rme-input-'));
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rme-parsed-'));
  const piiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rme-pii-'));

  beforeAll(() => {
    const sampleDir = path.join(PROJECT_ROOT, 'data', 'resumes');
    for (const file of fs.readdirSync(sampleDir)) {
      // Strip any index prefix a local demo run may have left on the samples.
      fs.copyFileSync(
        path.join(sampleDir, file),
        path.join(inputDir, file.replace(/^\d{4,}-/, '')),
      );
    }
  });

  afterAll(() => {
    for (const dir of [inputDir, outDir, piiDir]) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('parse-resumes copies CVs to vault, writes index-matched sanitized JSON, and exits 0', () => {
    const { stdout, exitCode } = cli([
      'parse-resumes',
      inputDir,
      '--out',
      outDir,
      '--pii-dir',
      piiDir,
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Parsed 4 resume(s)');

    // Source CV files are untouched — originals have no index prefix.
    const inputFiles = fs.readdirSync(inputDir).sort();
    expect(inputFiles.every((f) => !/^\d{4}-/.test(f))).toBe(true);

    // Vault contains indexed copies of each CV.
    const vaultCvs = fs
      .readdirSync(piiDir)
      .filter((f) => !f.endsWith('.json'))
      .sort();
    expect(vaultCvs).toHaveLength(4);
    expect(vaultCvs.every((f) => /^\d{4}-/.test(f))).toBe(true);

    // Profile JSON carries the same index as the vault CV (filename mapping).
    const jsonFiles = fs
      .readdirSync(outDir)
      .filter((f) => f.endsWith('.json'))
      .sort();
    expect(jsonFiles).toHaveLength(4);
    expect(jsonFiles.map((f) => f.slice(0, 4)).sort()).toEqual(
      vaultCvs.map((f) => f.slice(0, 4)).sort(),
    );
  });

  it('stored profiles are sanitized; the PII vault holds the identities', () => {
    const jsonFiles = fs.readdirSync(outDir).filter((f) => f.endsWith('.json'));
    for (const file of jsonFiles) {
      const raw = fs.readFileSync(path.join(outDir, file), 'utf8');
      const profile = JSON.parse(raw);
      expect(profile.fullName).toBeNull();
      expect(profile.contact).toEqual({ email: null, phone: null });
      expect(profile.piiIndex).toBe(file.slice(0, 4));
      expect(raw).not.toMatch(
        /phamtuanchip@gmail\.com|annguyen\.dev@example\.com|minh\.t@example\.com/,
      );
    }

    const vault = JSON.parse(fs.readFileSync(path.join(piiDir, 'pii-index.json'), 'utf8'));
    const names = Object.values(vault.records).map((r: any) => r.fullName);
    expect(names).toEqual(expect.arrayContaining(['Tuan Pham', 'An Nguyen', 'MINH TRAN']));
    expect(names).toHaveLength(4);
    for (const record of Object.values<any>(vault.records)) {
      expect(record.cvFile).toBe(`${record.index}-${record.originalCvFile}`);
      expect(record.jsonFile.startsWith(record.index)).toBe(true);
    }
  });

  it('match ranks candidates deterministically with rule-based engine', () => {
    const { stdout, exitCode } = cli([
      'match',
      '--job',
      './data/jobs/senior-node.json',
      '--resumes',
      outDir,
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Engine: rule-based');
    expect(stdout).toMatch(/Ranked 4 candidate/);
    // Output is pseudonymous (indexed ids, no real names) and correctly ordered.
    expect(stdout).not.toContain('Tuan Pham');
    expect(stdout.indexOf('tuan-pham')).toBeLessThan(stdout.indexOf('jr-frontend'));
  });

  it('match --engine llm without a key warns and falls back, still exits 0', () => {
    const { stdout, exitCode } = cli([
      'match',
      '--job',
      './data/jobs/senior-node.json',
      '--resumes',
      outDir,
      '--engine',
      'llm',
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/WARN: llm engine unavailable/);
    expect(stdout).toContain('rule-based (fallback)');
  });

  it('match accepts a free-text job description', () => {
    const { stdout, exitCode } = cli([
      'match',
      '--job',
      './data/jobs/free-text-jd.txt',
      '--resumes',
      outDir,
      '--format',
      'json',
    ]);
    expect(exitCode).toBe(0);
    const report = JSON.parse(stdout);
    expect(report.jobTitle).toBe('Senior Backend Engineer (Payments)');
    expect(report.results.length).toBeGreaterThan(0);
  });

  it('convert exposes the canonical form of a job spec', () => {
    const { stdout, exitCode } = cli(['convert', './data/jobs/free-text-jd.txt', '--kind', 'job']);
    expect(exitCode).toBe(0);
    const canonical = JSON.parse(stdout);
    expect(canonical.requiredSkills).toEqual(
      expect.arrayContaining([{ skill: 'Node.js', weight: 5 }]),
    );
  });

  it('rejects an invalid job spec with a validation error and non-zero exit', () => {
    const badJob = path.join(os.tmpdir(), `rme-bad-job-${Date.now()}.json`);
    fs.writeFileSync(
      badJob,
      JSON.stringify({ title: 'X', seniority: 'guru', minYearsExperience: -1, requiredSkills: [] }),
    );
    const { stdout, exitCode } = cli(['match', '--job', badJob, '--resumes', outDir]);
    fs.rmSync(badJob, { force: true });
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain('INVALID_JOB_SPEC');
  });

  it('fails gracefully on a missing input folder', () => {
    const { stdout, exitCode } = cli(['parse-resumes', './no-such-folder']);
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain('FILE_LOAD_ERROR');
  });
});
