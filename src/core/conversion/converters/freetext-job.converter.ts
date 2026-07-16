import { Injectable } from '@nestjs/common';
import { CanonicalJobSpec, Seniority, WeightedSkill } from '@core/canonical';
import { SkillNormalizerService } from '@core/parsing/skill-normalizer.service';
import { ConversionResult, InputConverter, SourceDescriptor } from '../input-converter.interface';
import { JobSpecBuilder } from '../job-spec.builder';

const DEFAULT_WEIGHT = 3;

/**
 * Heuristic free-text JD converter. Ambiguity produces defaults + warnings (never a guess
 * hidden from the user). Expected loose shape:
 *   first line = title; "Required:" / "Nice to have:" bullet sections;
 *   "- TypeScript (5)" style weights; "N+ years" for minimum experience.
 */
@Injectable()
export class FreeTextJobConverter implements InputConverter<CanonicalJobSpec> {
  readonly kind = 'job' as const;
  readonly name = 'freetext-job';

  constructor(private readonly skillNormalizer: SkillNormalizerService) {}

  supports(source: SourceDescriptor): boolean {
    return source.ext === '.txt' || source.ext === '.md';
  }

  async convert(source: SourceDescriptor): Promise<ConversionResult<CanonicalJobSpec>> {
    const text = source.text ?? source.bytes?.toString('utf8') ?? '';
    const warnings: string[] = [];
    const lines = text.split(/\r?\n/);

    const title = lines.find((l) => l.trim())?.trim() ?? 'Untitled role';

    const seniority = this.detectSeniority(text, warnings);
    const minYears = this.detectMinYears(text, warnings);
    const requiredSkills = this.sectionSkills(lines, /^required(\s+skills)?\b/i, warnings);
    const niceToHave = this.sectionSkills(lines, /^nice[\s-]*to[\s-]*have\b/i, []).map(
      (s) => s.skill,
    );

    if (requiredSkills.length === 0) {
      // Fallback: scan the whole text for known skills at default weight.
      for (const { canonical } of this.skillNormalizer.findInText(text)) {
        requiredSkills.push({ skill: canonical, weight: DEFAULT_WEIGHT });
      }
      warnings.push(
        `No "Required" section found; detected ${requiredSkills.length} known skill(s) from text at default weight ${DEFAULT_WEIGHT}.`,
      );
    }

    const value = JobSpecBuilder.fromSource(source.uri, 'free-text', this.name)
      .title(title)
      .seniority(seniority)
      .minYears(minYears)
      .requiredSkills(requiredSkills)
      .niceToHave(niceToHave)
      .warnings(warnings)
      .build();
    return { value, warnings };
  }

  private detectSeniority(text: string, warnings: string[]): Seniority {
    if (/\b(lead|principal|staff|head of)\b/i.test(text)) return 'lead';
    if (/\bsenior\b/i.test(text)) return 'senior';
    if (/\b(junior|entry[- ]level|graduate)\b/i.test(text)) return 'junior';
    warnings.push('No seniority level detected; assuming "mid".');
    return 'mid';
  }

  private detectMinYears(text: string, warnings: string[]): number {
    const match = text.match(/(\d+)\s*\+?\s*(?:years?|yrs?)/i);
    if (match) return Number(match[1]);
    warnings.push('No minimum years of experience detected; assuming 0.');
    return 0;
  }

  /** Collects "- Skill (weight)" bullets under a section header until the next header/blank gap. */
  private sectionSkills(lines: string[], header: RegExp, warnings: string[]): WeightedSkill[] {
    const skills: WeightedSkill[] = [];
    let inSection = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (header.test(trimmed)) {
        inSection = true;
        continue;
      }
      if (!inSection) continue;
      if (!trimmed || /^[a-z].*:$/i.test(trimmed)) {
        if (skills.length > 0) break; // section ended
        continue;
      }
      const bullet = trimmed.match(/^[-•*]\s*(.+)$/);
      if (!bullet) {
        if (skills.length > 0) break;
        continue;
      }
      const weightMatch = bullet[1].match(/^(.*?)\s*[(:]\s*(\d)\s*\)?$/);
      const rawSkill = (weightMatch ? weightMatch[1] : bullet[1]).trim();
      let weight = weightMatch ? Number(weightMatch[2]) : DEFAULT_WEIGHT;
      if (!weightMatch) {
        warnings.push(`No weight for "${rawSkill}"; defaulting to ${DEFAULT_WEIGHT}.`);
      }
      if (weight < 1 || weight > 5) {
        warnings.push(`Weight ${weight} for "${rawSkill}" outside 1–5; clamped.`);
        weight = Math.min(5, Math.max(1, weight));
      }
      skills.push({ skill: this.skillNormalizer.normalize(rawSkill), weight });
    }
    return skills;
  }
}
