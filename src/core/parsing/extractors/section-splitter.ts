/** Splits raw resume text into named sections by common header lines. */

export interface ResumeSections {
  /** Lines before the first recognized section header (name, contact, summary). */
  header: string[];
  experience: string[];
  education: string[];
  skills: string[];
}

const SECTION_PATTERNS: { key: keyof Omit<ResumeSections, 'header'>; re: RegExp }[] = [
  {
    key: 'experience',
    re: /^(work\s+)?(experience|employment( history)?|professional experience)\b/i,
  },
  { key: 'education', re: /^education\b/i },
  { key: 'skills', re: /^(technical\s+)?skills\b/i },
];

export function splitSections(text: string): ResumeSections {
  const sections: ResumeSections = { header: [], experience: [], education: [], skills: [] };
  let current: keyof ResumeSections = 'header';

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line
      .trim()
      .replace(/[:=-]+$/, '')
      .trim();
    const match = SECTION_PATTERNS.find((p) => p.re.test(trimmed));
    if (match && trimmed.length < 40) {
      current = match.key;
      continue;
    }
    sections[current].push(line);
  }
  return sections;
}
