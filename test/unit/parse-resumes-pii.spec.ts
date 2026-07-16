import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileLoader } from '@common/io/file-loader';
import { ParseResumesUseCase } from '@core/application/parse-resumes.usecase';
import { ResumeRepository } from '@core/application/resume.repository';
import { CanonicalCandidateProfile } from '@core/canonical';
import { ConverterRegistry } from '@core/conversion/converter.registry';
import { PlainTextResumeConverter } from '@core/conversion/converters/plaintext-resume.converter';
import { ExperienceCalculatorService } from '@core/parsing/experience-calculator.service';
import { ResumeParserService } from '@core/parsing/resume-parser.service';
import { SkillNormalizerService } from '@core/parsing/skill-normalizer.service';
import { PiiExtractorService } from '@core/pii/pii-extractor.service';
import { PiiIndexRepository } from '@core/pii/pii-index.repository';

const RESUME = `Jane Doe
jane@example.com | +1 555 123 4567

Experience

Senior Engineer | Acme Corp | Jan 2019 - Present
- Built APIs with nodejs

Skills
TypeScript, node
`;

/** Full pipeline over real temp files: rename → parse → PII split → sanitized persist. */
describe('ParseResumesUseCase — PII vault integration', () => {
  let inputDir: string;
  let outDir: string;
  let piiDir: string;
  let useCase: ParseResumesUseCase;
  const piiRepo = new PiiIndexRepository();

  beforeEach(() => {
    inputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rme-in-'));
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rme-out-'));
    piiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rme-vault-'));
    fs.writeFileSync(path.join(inputDir, 'jane-doe.txt'), RESUME);

    useCase = new ParseResumesUseCase(
      new FileLoader(),
      new ConverterRegistry([new PlainTextResumeConverter()]),
      new ResumeParserService(new SkillNormalizerService(), new ExperienceCalculatorService()),
      new PiiExtractorService(),
      piiRepo,
      new ResumeRepository(),
    );
  });

  afterEach(() => {
    for (const dir of [inputDir, outDir, piiDir]) fs.rmSync(dir, { recursive: true, force: true });
  });

  const loadStoredProfile = (): { file: string; profile: CanonicalCandidateProfile } => {
    const file = fs.readdirSync(outDir).find((f) => f.endsWith('.json'))!;
    return {
      file,
      profile: JSON.parse(fs.readFileSync(path.join(outDir, file), 'utf8')),
    };
  };

  it('copies the CV to the vault and names the profile JSON with the same index (filename mapping)', async () => {
    await useCase.execute(inputDir, outDir, piiDir);

    expect(fs.readdirSync(inputDir)).toEqual(['jane-doe.txt']); // original untouched
    expect(fs.existsSync(path.join(piiDir, '0001-jane-doe.txt'))).toBe(true); // vault copy
    const { file } = loadStoredProfile();
    expect(file).toBe('0001-jane-doe.json'); // same index on both sides of the mapping
  });

  it('persists a sanitized profile: no PII anywhere in the stored JSON', async () => {
    await useCase.execute(inputDir, outDir, piiDir);

    const { profile } = loadStoredProfile();
    const serialized = JSON.stringify(profile);
    expect(profile.fullName).toBeNull();
    expect(profile.contact).toEqual({ email: null, phone: null });
    expect(profile.piiIndex).toBe('0001');
    expect(serialized).not.toMatch(/jane doe/i);
    expect(serialized).not.toContain('jane@example.com');
    expect(serialized).not.toContain('555 123 4567');
    // Matching-relevant data survives.
    expect(profile.skills.map((s) => s.canonical)).toEqual(
      expect.arrayContaining(['TypeScript', 'Node.js']),
    );
    expect(profile.workHistory[0].company).toBe('Acme Corp');
  });

  it('stores the extracted PII in the vault, linked back to both files', async () => {
    await useCase.execute(inputDir, outDir, piiDir);

    const record = piiRepo.findByIndex(piiDir, '0001')!;
    expect(record.fullName).toBe('Jane Doe');
    expect(record.contact.email).toBe('jane@example.com');
    expect(record.originalCvFile).toBe('jane-doe.txt');
    expect(record.cvFile).toBe('0001-jane-doe.txt');
    expect(record.jsonFile).toBe('0001-jane-doe.json');
  });

  it('re-running is idempotent: same index, no second copy, vault refreshed not duplicated', async () => {
    await useCase.execute(inputDir, outDir, piiDir);
    await useCase.execute(inputDir, outDir, piiDir); // second run over the same original files

    expect(fs.readdirSync(inputDir)).toEqual(['jane-doe.txt']); // original still untouched
    expect(fs.readdirSync(outDir).filter((f) => f.endsWith('.json'))).toEqual([
      '0001-jane-doe.json',
    ]);
    expect(piiRepo.findByIndex(piiDir, '0002')).toBeNull();
  });

  it('still shows the real name on the operator console summary (not persisted)', async () => {
    const report = await useCase.execute(inputDir, outDir, piiDir);
    expect(report.rows[0].name).toBe('Jane Doe');
    expect(report.rows[0].file).toBe('0001-jane-doe.txt');
  });
});
