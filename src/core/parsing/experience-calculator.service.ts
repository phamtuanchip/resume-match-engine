import { Injectable } from '@nestjs/common';
import { WorkExperience } from '@core/canonical';
import { monthIndex } from './extractors/dates';

/**
 * Total years of experience = merged, de-duplicated work-history date ranges.
 * Overlapping jobs count once; entries with unparseable dates are excluded with a warning.
 */
@Injectable()
export class ExperienceCalculatorService {
  calculate(workHistory: WorkExperience[]): { years: number; warnings: string[] } {
    const warnings: string[] = [];
    const intervals: [number, number][] = [];
    const nowIndex = monthIndex(new Date().toISOString().slice(0, 7));

    for (const job of workHistory) {
      if (!job.startDate) {
        warnings.push(
          `Work entry "${job.title || job.company || 'unknown'}" has no parseable start date; excluded from experience total.`,
        );
        continue;
      }
      const start = monthIndex(job.startDate);
      const end =
        job.endDate === 'present' || job.endDate === null ? nowIndex : monthIndex(job.endDate);
      if (end < start) {
        warnings.push(
          `Work entry "${job.title || job.company}" ends before it starts; excluded from experience total.`,
        );
        continue;
      }
      intervals.push([start, end]);
    }

    const months = this.mergedMonths(intervals);
    return { years: Math.round((months / 12) * 10) / 10, warnings };
  }

  private mergedMonths(intervals: [number, number][]): number {
    if (intervals.length === 0) return 0;
    const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
    let total = 0;
    let [curStart, curEnd] = sorted[0];
    // End-exclusive convention: the end month index is the first month NOT worked, so a span's
    // length is (end - start). "2020-01 → 2023-01" is exactly 36 months (3 years). This matches
    // how resume date ranges are normalized elsewhere and is asserted by the unit tests.
    for (const [start, end] of sorted.slice(1)) {
      if (start <= curEnd) {
        curEnd = Math.max(curEnd, end);
      } else {
        total += curEnd - curStart;
        [curStart, curEnd] = [start, end];
      }
    }
    total += curEnd - curStart;
    return total;
  }
}
