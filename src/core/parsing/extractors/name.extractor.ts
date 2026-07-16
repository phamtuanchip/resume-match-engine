/** Extracts the candidate's full name — typically the first meaningful header line. */

const DISQUALIFIED = /@|https?:|\d{4,}|resume|curriculum|summary/i;

export function extractName(headerLines: string[]): { name: string | null; warnings: string[] } {
  for (const line of headerLines.slice(0, 5)) {
    // Take the part before decorations like "-- resume (updated)" or "| Senior Engineer".
    const candidate = line
      .trim()
      .split(/\s*(?:--+|\||—)\s*/)[0]
      .trim();
    if (!candidate || candidate.endsWith(':') || DISQUALIFIED.test(candidate)) continue;
    const words = candidate.split(/\s+/);
    const capitalized = words.filter((w) => /^[A-ZÀ-Ỹ]/.test(w));
    if (
      words.length >= 2 &&
      words.length <= 5 &&
      candidate.length <= 60 &&
      capitalized.length >= 2
    ) {
      return { name: candidate, warnings: [] };
    }
  }
  return { name: null, warnings: ['Could not identify a full name; field left null.'] };
}
