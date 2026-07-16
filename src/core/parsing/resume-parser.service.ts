import { Injectable } from '@nestjs/common';
import { CanonicalCandidateProfile, NormalizedSkill, SCHEMA_VERSION } from '@core/canonical';
import { RawResume } from '@core/conversion/input-converter.interface';
import { ExperienceCalculatorService } from './experience-calculator.service';
import { extractContact } from './extractors/contact.extractor';
import { extractEducation } from './extractors/education.extractor';
import { extractName } from './extractors/name.extractor';
import { splitSections } from './extractors/section-splitter';
import { extractWorkHistory } from './extractors/work-history.extractor';
import { SkillNormalizerService } from './skill-normalizer.service';

/**
 * Enriches canonical resume text into a full CanonicalCandidateProfile.
 * Never throws on messy content — missing fields become null/estimates plus a warning (F3).
 */
@Injectable()
export class ResumeParserService {
  constructor(
    private readonly skillNormalizer: SkillNormalizerService,
    private readonly experienceCalculator: ExperienceCalculatorService,
  ) {}

  parse(raw: RawResume): CanonicalCandidateProfile {
    const warnings = [...raw.warnings];
    const sections = splitSections(raw.text);

    const { name, warnings: nameWarnings } = extractName(sections.header);
    const { contact, warnings: contactWarnings } = extractContact(raw.text);
    const educationLines = sections.education.length ? sections.education : sections.header;
    const { education } = extractEducation(educationLines);

    // Fallback: resumes with non-standard headers keep their content in the header
    // section — scan it for work entries rather than silently reporting zero experience.
    let { workHistory, warnings: workWarnings } = extractWorkHistory(sections.experience);
    if (workHistory.length === 0) {
      ({ workHistory, warnings: workWarnings } = extractWorkHistory(sections.header));
      if (workHistory.length > 0) {
        workWarnings.push(
          'No standard experience section header found; work entries were detected by scanning the whole document.',
        );
      } else {
        workWarnings.push('No work-history entries recognized; experience total is 0.');
      }
    }
    const { years, warnings: expWarnings } = this.experienceCalculator.calculate(workHistory);

    warnings.push(...nameWarnings, ...contactWarnings, ...workWarnings, ...expWarnings);

    return {
      id: raw.id,
      externalRef: null,
      piiIndex: null,
      source: raw.source,
      fullName: name,
      contact,
      totalYearsExperience: years,
      skills: this.collectSkills(sections.skills, sections.experience, raw.text, warnings),
      education,
      workHistory,
      rawText: raw.text,
      warnings,
      schemaVersion: SCHEMA_VERSION,
    };
  }

  /** Skills-section entries are authoritative; work-history mentions supplement them.
   *  With no recognizable skills section, the whole document is scanned (with a warning). */
  private collectSkills(
    skillLines: string[],
    experienceLines: string[],
    fullText: string,
    warnings: string[],
  ): NormalizedSkill[] {
    const byCanonical = new Map<string, NormalizedSkill>();

    const listed = skillLines
      .join('\n')
      .split(/[,;|•\n]/)
      .map((s) => s.replace(/^[-*]\s*/, '').trim())
      .filter((s) => s && s.length < 40);
    for (const rawSkill of listed) {
      const canonical = this.skillNormalizer.normalize(rawSkill);
      const existing = byCanonical.get(canonical);
      if (existing) {
        if (!existing.rawMatches.includes(rawSkill)) existing.rawMatches.push(rawSkill);
      } else {
        byCanonical.set(canonical, { canonical, rawMatches: [rawSkill], source: 'skills-section' });
      }
    }

    const scanText = byCanonical.size > 0 ? experienceLines.join('\n') : fullText;
    if (byCanonical.size === 0) {
      warnings.push(
        'No recognizable skills section; skills were detected by scanning the whole document.',
      );
    }
    for (const { canonical, raw } of this.skillNormalizer.findInText(scanText)) {
      if (!byCanonical.has(canonical)) {
        byCanonical.set(canonical, { canonical, rawMatches: [raw], source: 'work-history' });
      }
    }

    return [...byCanonical.values()];
  }
}
