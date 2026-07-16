import * as path from 'path';
import { Injectable } from '@nestjs/common';
import { JsonFileRepository } from '@common/database';
import { JsonFileStore } from '@common/io';
import { CanonicalCandidateProfile } from '@core/canonical';

/** Persists canonical candidate profiles as JSON files (repository seam over JsonFileStore). */
@Injectable()
export class ResumeRepository {
  saveTo(dir: string, profile: CanonicalCandidateProfile): void {
    this.repo(dir).save(profile);
  }

  loadAllFrom(dir: string): CanonicalCandidateProfile[] {
    return this.repo(dir).findAll();
  }

  loadOne(filePath: string): CanonicalCandidateProfile | null {
    // path.dirname yields "." for a bare filename (no directory), which resolves to the current
    // directory — the previous regex left the whole filename as the "dir" and looked in a
    // nonexistent nested path.
    const dir = path.dirname(filePath);
    const id = path.basename(filePath).replace(/\.json$/, '');
    return this.repo(dir).findById(id);
  }

  private repo(dir: string): JsonFileRepository<CanonicalCandidateProfile> {
    return new JsonFileRepository<CanonicalCandidateProfile>(new JsonFileStore(dir));
  }
}
