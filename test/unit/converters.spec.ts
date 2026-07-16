import { FileLoadError, InvalidJobSpecError } from '@common/errors';
import { ConverterRegistry } from '@core/conversion/converter.registry';
import { FreeTextJobConverter } from '@core/conversion/converters/freetext-job.converter';
import { PlainTextResumeConverter } from '@core/conversion/converters/plaintext-resume.converter';
import { StructuredJobConverter } from '@core/conversion/converters/structured-job.converter';
import { SourceDescriptor } from '@core/conversion/input-converter.interface';
import { SkillNormalizerService } from '@core/parsing/skill-normalizer.service';

const normalizer = new SkillNormalizerService();

const fileSource = (uri: string, text: string): SourceDescriptor => ({
  uri,
  origin: 'file',
  ext: '.' + uri.split('.').pop(),
  text,
});

describe('ConverterRegistry', () => {
  const registry = new ConverterRegistry([
    new PlainTextResumeConverter(),
    new StructuredJobConverter(normalizer),
    new FreeTextJobConverter(normalizer),
  ]);

  it('resolves a resume converter by extension', () => {
    expect(registry.resolve('resume', fileSource('cv.txt', '')).name).toBe('plaintext-resume');
  });

  it('resolves job converters by format: json vs free text', () => {
    expect(registry.resolve('job', fileSource('jd.json', '{}')).name).toBe('structured-job');
    expect(registry.resolve('job', fileSource('jd.txt', '')).name).toBe('freetext-job');
  });

  it('throws FileLoadError for unsupported formats', () => {
    expect(() => registry.resolve('resume', fileSource('cv.xlsx', ''))).toThrow(FileLoadError);
  });
});

describe('StructuredJobConverter', () => {
  const converter = new StructuredJobConverter(normalizer);

  const validJob = {
    title: 'Backend Engineer',
    seniority: 'senior',
    minYearsExperience: 5,
    requiredSkills: [{ skill: 'js', weight: 5 }],
    niceToHaveSkills: ['k8s'],
  };

  it('converts a valid spec and canonicalizes skills (JS == JavaScript)', async () => {
    const { value } = await converter.convert(fileSource('job.json', JSON.stringify(validJob)));
    expect(value.requiredSkills[0].skill).toBe('JavaScript');
    expect(value.niceToHaveSkills[0]).toBe('Kubernetes');
    expect(value.externalRef).toBeNull();
  });

  it('rejects weights outside 1..5', async () => {
    const bad = { ...validJob, requiredSkills: [{ skill: 'js', weight: 9 }] };
    await expect(converter.convert(fileSource('job.json', JSON.stringify(bad)))).rejects.toThrow(
      InvalidJobSpecError,
    );
  });

  it('rejects invalid JSON with a clear error', async () => {
    await expect(converter.convert(fileSource('job.json', 'not json'))).rejects.toThrow(
      InvalidJobSpecError,
    );
  });

  it('accepts an already-structured payload (HRM/API path)', async () => {
    const { value } = await converter.convert({
      uri: 'hrm://jobs/7',
      origin: 'hrm',
      payload: validJob,
    });
    expect(value.title).toBe('Backend Engineer');
  });
});

describe('FreeTextJobConverter', () => {
  const converter = new FreeTextJobConverter(normalizer);

  it('extracts title, seniority, min years, and weighted skills', async () => {
    const jd = [
      'Senior Backend Engineer',
      'We need 5+ years of experience.',
      'Required skills:',
      '- Node.js (5)',
      '- TypeScript (4)',
      'Nice to have:',
      '- Kafka',
    ].join('\n');
    const { value } = await converter.convert(fileSource('jd.txt', jd));
    expect(value.title).toBe('Senior Backend Engineer');
    expect(value.seniority).toBe('senior');
    expect(value.minYearsExperience).toBe(5);
    expect(value.requiredSkills).toEqual([
      { skill: 'Node.js', weight: 5 },
      { skill: 'TypeScript', weight: 4 },
    ]);
    expect(value.niceToHaveSkills).toEqual(['Kafka']);
  });

  it('applies defaults with warnings on ambiguous text (NF5)', async () => {
    const { value, warnings } = await converter.convert(
      fileSource('jd.txt', 'Backend role.\nWork with nodejs and docker.'),
    );
    expect(value.seniority).toBe('mid');
    expect(value.minYearsExperience).toBe(0);
    expect(value.requiredSkills.length).toBeGreaterThan(0); // skill scan fallback
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });
});

describe('PlainTextResumeConverter', () => {
  it('warns on empty files instead of failing', async () => {
    const { value, warnings } = await new PlainTextResumeConverter().convert(
      fileSource('empty.txt', '  '),
    );
    expect(value.text).toBe('  ');
    expect(warnings[0]).toMatch(/empty/i);
  });
});
