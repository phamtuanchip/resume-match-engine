import { WorkExperience } from '@core/canonical';
import { DATE_RANGE_RE, monthIndex, toEndDate, toIsoMonth } from './dates';

/** Job-title keywords, shared by heading detection and title/company disambiguation. */
const ROLE_RE =
  /\b(engineer|developer|lead|manager|architect|consultant|intern|designer|analyst)\b/i;

/**
 * Extracts work-history entries from the experience section.
 * An entry starts at a line containing a date range; bullet lines below it are responsibilities.
 * Supported heading shapes (documented assumption):
 *   "Senior Engineer | TechCorp | Jan 2020 - Present"
 *   "Frontend Developer, Webify (Jun 2023 - Aug 2024)"
 *   "TechCorp — Senior Engineer, 2019 – 2022"
 * Lines that look like a role but carry no parseable dates still produce an entry (with warning),
 * so messy input degrades instead of disappearing.
 */
export function extractWorkHistory(lines: string[]): {
  workHistory: WorkExperience[];
  warnings: string[];
} {
  const workHistory: WorkExperience[] = [];
  const warnings: string[] = [];
  let current: WorkExperience | null = null;

  for (const line of lines) {
    const raw = line.trim();
    if (!raw) continue;

    const isBullet = /^[-•*]\s+/.test(raw);
    const rangeMatch = raw.match(DATE_RANGE_RE);

    if (rangeMatch && !isBullet) {
      const startDate = toIsoMonth(rangeMatch[1]);
      const endDate = toEndDate(rangeMatch[2]);
      const { title, company } = splitTitleCompany(raw.replace(DATE_RANGE_RE, '').trim());
      if (!startDate) {
        warnings.push(`Unparseable date range in: "${raw}"`);
      }
      current = {
        company,
        title,
        startDate,
        endDate,
        durationMonths: startDate && endDate ? durationMonths(startDate, endDate) : null,
        responsibilities: [],
        raw,
      };
      workHistory.push(current);
    } else if (isBullet && current) {
      current.responsibilities.push(raw.replace(/^[-•*]\s+/, ''));
    } else if (!isBullet && looksLikeRoleHeading(raw)) {
      // Role heading with no dates — keep it, flag it.
      const { title, company } = splitTitleCompany(raw);
      current = {
        company,
        title,
        startDate: null,
        endDate: null,
        durationMonths: null,
        responsibilities: [],
        raw,
      };
      workHistory.push(current);
      warnings.push(`Work entry "${raw}" has no date range; it will not count toward experience.`);
    }
  }
  return { workHistory, warnings };
}

function splitTitleCompany(text: string): { title: string; company: string } {
  const cleaned = text
    .replace(/[|,()–—]+\s*$/g, '')
    .replace(/^\s*[|,()–—]+/g, '')
    .trim();
  const parts = cleaned
    .split(/\s*(?:\||,|—|–| - | at )\s*/)
    .map((p) => p.replace(/[()]/g, '').trim())
    .filter(Boolean);
  if (parts.length < 2) return { title: parts[0] ?? '', company: '' };

  // Both "Title | Company" and "Company — Title" shapes are documented, so field order is not
  // fixed. The part carrying a role keyword is the title; if neither or both do, fall back to
  // the leading part as the title (the most common shape).
  const [first, second] = parts;
  const firstIsRole = ROLE_RE.test(first);
  const secondIsRole = ROLE_RE.test(second);
  if (secondIsRole && !firstIsRole) return { title: second, company: first };
  return { title: first, company: second };
}

function looksLikeRoleHeading(line: string): boolean {
  return line.length < 90 && ROLE_RE.test(line);
}

function durationMonths(startIso: string, endIso: string | 'present'): number {
  const end =
    endIso === 'present' ? monthIndex(new Date().toISOString().slice(0, 7)) : monthIndex(endIso);
  // End-exclusive, consistent with ExperienceCalculatorService.
  return Math.max(0, end - monthIndex(startIso));
}
