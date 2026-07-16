/** Date-range parsing shared by the work-history extractor. */

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const MONTH_YEAR = String.raw`(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4})`;
const PRESENT = String.raw`(?:present|current|now)`;

/** Matches "Jan 2020 - Present", "2019 – 2022", "03/2021 to 12/2023", … */
export const DATE_RANGE_RE = new RegExp(
  `(${MONTH_YEAR})\\s*(?:[-–—]|to)\\s*(${MONTH_YEAR}|${PRESENT})`,
  'i',
);

/** "Jan 2020" | "03/2021" | "2020" → "YYYY-MM" (bare years assume January). */
export function toIsoMonth(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  const monthName = s.match(/^([a-z]+)\.?\s+(\d{4})$/);
  if (monthName && MONTHS[monthName[1].slice(0, 4)] !== undefined) {
    return `${monthName[2]}-${String(MONTHS[monthName[1].slice(0, 4)]).padStart(2, '0')}`;
  }
  if (MONTHS[s.slice(0, 3)] !== undefined) {
    const year = s.match(/\d{4}/);
    if (year) return `${year[0]}-${String(MONTHS[s.slice(0, 3)]).padStart(2, '0')}`;
  }
  const numeric = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (numeric) return `${numeric[2]}-${numeric[1].padStart(2, '0')}`;
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return `${yearOnly[1]}-01`;
  return null;
}

export function toEndDate(raw: string): string | 'present' | null {
  if (/^(present|current|now)$/i.test(raw.trim())) return 'present';
  return toIsoMonth(raw);
}

/** "YYYY-MM" → absolute month index (year*12 + zero-based month), for interval arithmetic. */
export function monthIndex(isoMonth: string): number {
  const [y, m] = isoMonth.split('-').map(Number);
  return y * 12 + (m - 1);
}
