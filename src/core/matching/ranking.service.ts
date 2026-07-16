import { Injectable } from '@nestjs/common';
import { MatchResult } from '@core/canonical';

@Injectable()
export class RankingService {
  /** Highest score first; ties broken alphabetically for a stable, reproducible order. */
  rank(results: MatchResult[]): MatchResult[] {
    return [...results].sort(
      (a, b) =>
        b.score - a.score ||
        (a.candidateName ?? a.candidateId).localeCompare(b.candidateName ?? b.candidateId),
    );
  }
}
