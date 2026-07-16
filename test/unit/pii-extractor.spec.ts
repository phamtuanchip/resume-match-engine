import { PiiExtractorService } from '@core/pii/pii-extractor.service';
import { candidate } from './fixtures';

describe('PiiExtractorService', () => {
  const extractor = new PiiExtractorService();

  const profile = candidate({
    fullName: 'Jane Doe',
    contact: {
      email: 'jane@example.com',
      phone: '+1 555 123 4567',
      location: 'Berlin',
      links: ['https://github.com/janedoe'],
    },
    rawText: [
      'Jane Doe',
      'Berlin | jane@example.com | +1 555 123 4567',
      'https://github.com/janedoe',
      'Senior Engineer with Node.js experience. JANE DOE led the team.',
    ].join('\n'),
  });

  it('returns the extracted PII for the vault', () => {
    const { fullName, contact } = extractor.extract(profile);
    expect(fullName).toBe('Jane Doe');
    expect(contact.email).toBe('jane@example.com');
    expect(contact.phone).toBe('+1 555 123 4567');
  });

  it('strips structured PII fields from the sanitized profile', () => {
    const { sanitized } = extractor.extract(profile);
    expect(sanitized.fullName).toBeNull();
    expect(sanitized.contact).toEqual({ email: null, phone: null });
    expect(JSON.stringify(sanitized)).not.toContain('jane@example.com');
    expect(JSON.stringify(sanitized)).not.toContain('555 123 4567');
    expect(JSON.stringify(sanitized)).not.toContain('github.com/janedoe');
  });

  it('redacts every rawText occurrence of PII, case-insensitively', () => {
    const { sanitized } = extractor.extract(profile);
    expect(sanitized.rawText).not.toMatch(/jane doe/i);
    expect(sanitized.rawText).not.toContain('jane@example.com');
    expect(sanitized.rawText).toContain('[REDACTED]');
    // Non-PII content survives redaction.
    expect(sanitized.rawText).toContain('Senior Engineer with Node.js experience.');
  });

  it('preserves the matching-relevant fields untouched', () => {
    const { sanitized } = extractor.extract(profile);
    expect(sanitized.skills).toEqual(profile.skills);
    expect(sanitized.workHistory).toEqual(profile.workHistory);
    expect(sanitized.education).toEqual(profile.education);
    expect(sanitized.totalYearsExperience).toBe(profile.totalYearsExperience);
    expect(sanitized.id).toBe(profile.id);
  });

  it('handles profiles with no recoverable PII (nothing to redact)', () => {
    const empty = candidate({
      fullName: null,
      contact: { email: null, phone: null },
      rawText: 'anonymous resume text',
    });
    const { sanitized, fullName } = extractor.extract(empty);
    expect(fullName).toBeNull();
    expect(sanitized.rawText).toBe('anonymous resume text');
  });

  it('escapes regex metacharacters in PII values before redacting', () => {
    const tricky = candidate({
      fullName: 'J. (Doe)',
      contact: { email: 'j+tag@example.com', phone: null },
      rawText: 'Contact J. (Doe) at j+tag@example.com today',
    });
    const { sanitized } = extractor.extract(tricky);
    expect(sanitized.rawText).toBe('Contact [REDACTED] at [REDACTED] today');
  });
});
