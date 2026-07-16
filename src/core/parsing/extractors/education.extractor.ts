import { EducationEntry } from '@core/canonical';

const DEGREE_RE =
  /\b(b\.?sc?\.?|m\.?sc?\.?|ph\.?d\.?|bachelor(?:'s)?|master(?:'s)?|doctorate|diploma|associate)\b/i;
const INSTITUTION_RE = /\b(university|college|institute|academy|school)\b/i;

export function extractEducation(lines: string[]): {
  education: EducationEntry[];
  warnings: string[];
} {
  const education: EducationEntry[] = [];
  for (const line of lines) {
    const raw = line.trim().replace(/^[-•*]\s*/, '');
    if (!raw) continue;
    if (!DEGREE_RE.test(raw) && !INSTITUTION_RE.test(raw)) continue;

    const years = [...raw.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => Number(m[0]));
    const degree = raw.match(DEGREE_RE)?.[0];
    const parts = raw.split(/[,|–—]| - /).map((p) => p.trim());
    const institution = parts.find((p) => INSTITUTION_RE.test(p)) ?? parts[0];

    education.push({
      institution,
      degree,
      startYear: years.length > 1 ? years[0] : undefined,
      endYear: years.length > 1 ? years[years.length - 1] : years[0],
      raw,
    });
  }
  return { education, warnings: [] };
}
