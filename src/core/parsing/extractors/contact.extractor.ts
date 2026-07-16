import { ContactInfo } from '@core/canonical';

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(\+?\d[\d\s().-]{5,}\d)/;
// Year ranges like "2021 - 2024" or "2019–2022" match PHONE_RE but are not phone numbers.
const YEAR_RANGE_RE = /^\d{4}\s*[-–—]\s*\d{4}$/;
const LINK_RE = /https?:\/\/[^\s|,)]+/gi;

export function extractContact(text: string): { contact: ContactInfo; warnings: string[] } {
  const warnings: string[] = [];
  const email = text.match(EMAIL_RE)?.[0] ?? null;
  const raw = text.match(PHONE_RE)?.[0]?.trim() ?? null;
  const phone = raw && !YEAR_RANGE_RE.test(raw) ? raw : null;
  const links = [...text.matchAll(LINK_RE)].map((m) => m[0]);

  if (!email) warnings.push('No email address found.');
  if (!phone) warnings.push('No phone number found.');

  return { contact: { email, phone, links: links.length ? links : undefined }, warnings };
}
