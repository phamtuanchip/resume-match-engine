import { MatchResult } from '@core/canonical';
import { RankingService } from '@core/matching/ranking.service';

const result = (name: string, score: number): MatchResult => ({
  candidateId: name.toLowerCase(),
  candidateName: name,
  candidateExternalRef: null,
  engine: 'rule-based',
  score,
  warnings: [],
  breakdown: {} as MatchResult['breakdown'],
});

describe('RankingService', () => {
  const ranking = new RankingService();

  it('sorts descending by score', () => {
    const ranked = ranking.rank([result('Low', 20), result('High', 90), result('Mid', 50)]);
    expect(ranked.map((r) => r.candidateName)).toEqual(['High', 'Mid', 'Low']);
  });

  it('breaks ties alphabetically for reproducible output', () => {
    const ranked = ranking.rank([result('Zed', 50), result('Amy', 50)]);
    expect(ranked.map((r) => r.candidateName)).toEqual(['Amy', 'Zed']);
  });

  it('does not mutate the input array', () => {
    const input = [result('A', 10), result('B', 90)];
    ranking.rank(input);
    expect(input[0].candidateName).toBe('A');
  });
});
