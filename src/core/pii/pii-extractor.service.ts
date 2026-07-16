import { Injectable } from '@nestjs/common';
import {
  CanonicalCandidateProfile,
  ContactInfo,
  EducationEntry,
  NormalizedSkill,
  WorkExperience,
} from '@core/canonical';

/**
 * Splits a parsed profile into (a) a sanitized, PII-free profile safe to persist and to
 * send to an LLM, and (b) the extracted PII destined for the local vault (GDPR
 * pseudonymization, Art. 4(5)). Sanitization covers the structured fields AND redacts
 * every occurrence of the extracted values inside rawText.
 */
@Injectable()
export class PiiExtractorService {
  extract(profile: CanonicalCandidateProfile): {
    sanitized: CanonicalCandidateProfile;
    fullName: string | null;
    contact: ContactInfo;
  } {
    const { fullName, contact } = profile;
    const piiValues = [
      fullName,
      contact.email,
      contact.phone,
      contact.location,
      ...(contact.links ?? []),
    ];

    // Sanitization must cover the structured fields too, not just rawText: a non-standard
    // header can push the candidate's name into workHistory[].title (via the parser's header
    // fallback), and PII can appear in education/responsibility lines. Any surviving PII here
    // is persisted to disk and sent to the LLM engine, so redact every extracted string field.
    const sanitized: CanonicalCandidateProfile = {
      ...profile,
      fullName: null,
      contact: { email: null, phone: null },
      rawText: this.redact(profile.rawText, piiValues),
      workHistory: profile.workHistory.map((w) => this.redactWorkExperience(w, piiValues)),
      education: profile.education.map((e) => this.redactEducation(e, piiValues)),
      skills: profile.skills.map((s) => this.redactSkill(s, piiValues)),
    };
    return { sanitized, fullName, contact };
  }

  private redactWorkExperience(
    entry: WorkExperience,
    values: (string | null | undefined)[],
  ): WorkExperience {
    return {
      ...entry,
      title: this.redact(entry.title, values),
      company: this.redact(entry.company, values),
      responsibilities: entry.responsibilities.map((r) => this.redact(r, values)),
      raw: this.redact(entry.raw, values),
    };
  }

  private redactEducation(
    entry: EducationEntry,
    values: (string | null | undefined)[],
  ): EducationEntry {
    return {
      ...entry,
      institution: this.redact(entry.institution, values),
      degree: entry.degree === undefined ? undefined : this.redact(entry.degree, values),
      field: entry.field === undefined ? undefined : this.redact(entry.field, values),
      raw: this.redact(entry.raw, values),
    };
  }

  private redactSkill(
    skill: NormalizedSkill,
    values: (string | null | undefined)[],
  ): NormalizedSkill {
    return {
      ...skill,
      rawMatches: skill.rawMatches.map((m) => this.redact(m, values)),
    };
  }

  private redact(text: string, values: (string | null | undefined)[]): string {
    let out = text;
    for (const value of values) {
      if (!value) continue;
      const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(escaped, 'gi'), '[REDACTED]');
    }
    return out;
  }
}
