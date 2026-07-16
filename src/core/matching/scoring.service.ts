import { Injectable } from '@nestjs/common';
import {
  CanonicalCandidateProfile,
  CanonicalJobSpec,
  MatchBreakdown,
  MatchResult,
  Seniority,
  SkillMatchDetail,
  WorkExperience,
} from '@core/canonical';

/**
 * The transparent, deterministic scoring formula (PLAN.md §12, justified in docs/scoring.md):
 *
 *   score = 100 * (w_skills*S_skills + w_exp*S_exp + w_sen*S_sen + w_nice*S_nice)
 *
 * Every component is 0..1 with partial credit — no arbitrary hard cutoffs. When the job
 * defines no nice-to-have skills, that weight is redistributed proportionally so candidates
 * are not capped below 100 for a field the job author left empty.
 */
const WEIGHTS = { skills: 0.55, experience: 0.25, seniority: 0.12, niceToHave: 0.08 };

const SENIORITY_ORDER: Seniority[] = ['junior', 'mid', 'senior', 'lead'];
const SENIORITY_ALIGNMENT = [1, 0.6, 0.3, 0]; // by ordinal distance

@Injectable()
export class ScoringService {
  score(candidate: CanonicalCandidateProfile, job: CanonicalJobSpec): MatchResult {
    const weights = this.effectiveWeights(job);

    const candidateSkills = new Set(candidate.skills.map((s) => s.canonical.toLowerCase()));

    // S_skills: weighted coverage of required skills.
    const totalWeight = job.requiredSkills.reduce((sum, s) => sum + s.weight, 0);
    const requiredSkills: SkillMatchDetail[] = job.requiredSkills.map((rs) => {
      const matched = candidateSkills.has(rs.skill.toLowerCase());
      const share = totalWeight > 0 ? rs.weight / totalWeight : 0;
      return {
        skill: rs.skill,
        weight: rs.weight,
        matched,
        contribution: matched ? this.round(100 * weights.skills * share) : 0,
      };
    });
    const matchedWeight = requiredSkills.filter((s) => s.matched).reduce((s, x) => s + x.weight, 0);
    const sSkills = totalWeight > 0 ? matchedWeight / totalWeight : 1;

    // S_exp: linear partial credit below the bar, full credit at/above it.
    const years = candidate.totalYearsExperience;
    const minYears = job.minYearsExperience;
    const sExp = minYears <= 0 ? 1 : Math.min(years / minYears, 1);
    const gap = this.round(Math.max(0, minYears - years));

    // S_sen: ordinal distance between inferred and required seniority.
    const candidateSeniority = this.inferSeniority(candidate);
    const distance = Math.abs(
      SENIORITY_ORDER.indexOf(candidateSeniority) - SENIORITY_ORDER.indexOf(job.seniority),
    );
    const sSeniority = SENIORITY_ALIGNMENT[Math.min(distance, SENIORITY_ALIGNMENT.length - 1)];

    // S_nice: fraction of nice-to-have skills matched.
    const matchedNice = job.niceToHaveSkills.filter((s) => candidateSkills.has(s.toLowerCase()));
    const sNice =
      job.niceToHaveSkills.length > 0 ? matchedNice.length / job.niceToHaveSkills.length : 0;

    const score = Math.round(
      100 *
        (weights.skills * sSkills +
          weights.experience * sExp +
          weights.seniority * sSeniority +
          weights.niceToHave * sNice),
    );

    const breakdown: MatchBreakdown = {
      requiredSkills,
      skillCoverage: { matchedWeight, totalWeight, ratio: this.round(sSkills) },
      experience: {
        candidateYears: years,
        requiredYears: minYears,
        fit: this.round(sExp),
        gap,
      },
      niceToHave: { matched: matchedNice, bonus: this.round(100 * weights.niceToHave * sNice) },
      seniority: { candidate: candidateSeniority, required: job.seniority, alignment: sSeniority },
      componentScores: {
        skills: this.round(sSkills),
        experience: this.round(sExp),
        seniority: this.round(sSeniority),
        niceToHave: this.round(sNice),
      },
    };

    const warnings = [...candidate.warnings];
    if (candidate.skills.length === 0 && candidate.workHistory.length === 0) {
      warnings.push('unscorable: no extractable skills or work history — exclude from ranking');
    }

    return {
      candidateId: candidate.id,
      candidateName: candidate.fullName,
      candidateExternalRef: candidate.externalRef,
      engine: 'rule-based',
      score,
      warnings,
      breakdown,
    };
  }

  /** Redistributes the nice-to-have weight when the job defines none. */
  private effectiveWeights(job: CanonicalJobSpec): typeof WEIGHTS {
    if (job.niceToHaveSkills.length > 0) return WEIGHTS;
    const base = WEIGHTS.skills + WEIGHTS.experience + WEIGHTS.seniority;
    return {
      skills: WEIGHTS.skills / base,
      experience: WEIGHTS.experience / base,
      seniority: WEIGHTS.seniority / base,
      niceToHave: 0,
    };
  }

  /** Title keywords take precedence; otherwise inferred from computed years. */
  private inferSeniority(candidate: CanonicalCandidateProfile): Seniority {
    const latestTitle = this.latestRole(candidate)?.title ?? '';
    if (/\b(lead|principal|staff|head)\b/i.test(latestTitle)) return 'lead';
    if (/\bsenior\b/i.test(latestTitle)) return 'senior';
    if (/\b(junior|intern|graduate)\b/i.test(latestTitle)) return 'junior';
    const years = candidate.totalYearsExperience;
    if (years < 2) return 'junior';
    if (years < 5) return 'mid';
    if (years < 9) return 'senior';
    return 'lead';
  }

  /**
   * The most recent role, by date — NOT workHistory[0], since the extractor preserves document
   * order and resumes may list jobs oldest-first. An ongoing ("present") role always wins;
   * otherwise the latest end date, falling back to the latest start date.
   */
  private latestRole(candidate: CanonicalCandidateProfile): WorkExperience | undefined {
    const recency = (w: WorkExperience): number => {
      if (w.endDate === 'present') return Number.POSITIVE_INFINITY;
      const iso = w.endDate ?? w.startDate;
      if (!iso) return Number.NEGATIVE_INFINITY;
      const [y, m] = iso.split('-').map(Number);
      return y * 12 + (m - 1);
    };
    let latest: WorkExperience | undefined;
    let best = Number.NEGATIVE_INFINITY;
    for (const w of candidate.workHistory) {
      const r = recency(w);
      // Strict `>` keeps the first entry on ties, preserving prior behavior when no dates exist.
      if (latest === undefined || r > best) {
        best = r;
        latest = w;
      }
    }
    return latest;
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
