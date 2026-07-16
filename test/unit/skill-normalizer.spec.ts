import { SkillNormalizerService } from '@core/parsing/skill-normalizer.service';

describe('SkillNormalizerService', () => {
  const normalizer = new SkillNormalizerService();

  it.each([
    ['JS', 'JavaScript'],
    ['js', 'JavaScript'],
    ['JavaScript', 'JavaScript'],
    ['reactjs', 'React'],
    ['React.js', 'React'],
    ['nodejs', 'Node.js'],
    ['k8s', 'Kubernetes'],
    ['TS', 'TypeScript'],
  ])('normalizes "%s" to "%s"', (raw, expected) => {
    expect(normalizer.normalize(raw)).toBe(expected);
  });

  it('trims whitespace and trailing punctuation', () => {
    expect(normalizer.normalize('  postgres, ')).toBe('PostgreSQL');
  });

  it('passes unknown skills through trimmed', () => {
    expect(normalizer.normalize(' Haskell ')).toBe('Haskell');
  });

  it('finds known skills in free text with word boundaries', () => {
    const found = normalizer.findInText('built services with nodejs and docker on aws');
    const canonicals = found.map((f) => f.canonical);
    expect(canonicals).toEqual(expect.arrayContaining(['Node.js', 'Docker', 'AWS']));
  });

  it('does not match "java" inside "javascript"', () => {
    const found = normalizer.findInText('wrote javascript components');
    const canonicals = found.map((f) => f.canonical);
    expect(canonicals).toContain('JavaScript');
    expect(canonicals).not.toContain('Java');
  });
});
