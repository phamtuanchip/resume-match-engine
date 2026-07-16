import { Injectable } from '@nestjs/common';
import { CanonicalReport } from '@core/conversion';
import { MatchCandidatesUseCase } from './match-candidates.usecase';
import { ParseResumesUseCase } from './parse-resumes.usecase';

/**
 * Utility use case behind the `convert` command: converts any supported input to its
 * canonical form without scoring — makes the anti-corruption layer directly visible.
 */
@Injectable()
export class ConvertInputUseCase {
  constructor(
    private readonly parseResumes: ParseResumesUseCase,
    private readonly matchCandidates: MatchCandidatesUseCase,
  ) {}

  async execute(kind: 'resume' | 'job', inputPath: string): Promise<CanonicalReport> {
    const value =
      kind === 'resume'
        ? await this.parseResumes.parseOne(inputPath)
        : await this.matchCandidates.loadJob(inputPath);
    return { kind: 'canonical', value };
  }
}
