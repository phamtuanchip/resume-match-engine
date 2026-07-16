import * as path from 'path';
import { Injectable } from '@nestjs/common';
import { FileLoadError } from '@common/errors';
import { FileLoader } from '@common/io';
import { CanonicalCandidateProfile } from '@core/canonical';
import { ConverterRegistry, fileSource, RawResume, ParseSummaryReport } from '@core/conversion';
import { ResumeParserService } from '@core/parsing';
import { PiiExtractorService, PiiIndexRepository } from '@core/pii';
import { ResumeRepository } from './resume.repository';

const RESUME_EXTENSIONS = ['.pdf', '.txt', '.md'];

/**
 * Orchestrates: list files → assign PII index (rename CV to "<index>-<name>") → convert →
 * parse → extract PII into the local vault → persist the SANITIZED profile → summarize.
 * The stored profile carries the same index in its filename as the renamed CV, so the
 * json ↔ cv ↔ vault mapping is recoverable from names alone, and anything read from the
 * parsed dir (including LLM prompts) is PII-free by construction.
 * Adapter-agnostic: the CLI, a REST endpoint, or an HRM webhook all call this same method.
 */
@Injectable()
export class ParseResumesUseCase {
  constructor(
    private readonly fileLoader: FileLoader,
    private readonly converterRegistry: ConverterRegistry,
    private readonly parser: ResumeParserService,
    private readonly piiExtractor: PiiExtractorService,
    private readonly piiIndex: PiiIndexRepository,
    private readonly repository: ResumeRepository,
  ) {}

  async execute(input: string, outDir: string, piiDir = 'data/pii'): Promise<ParseSummaryReport> {
    const files = this.fileLoader.listFiles(input, RESUME_EXTENSIONS);
    if (files.length === 0) {
      throw new FileLoadError(
        `No resume files (${RESUME_EXTENSIONS.join(', ')}) found in: ${input}`,
      );
    }

    const report: ParseSummaryReport = { kind: 'parse-summary', rows: [], outDir };
    for (const file of files) {
      // Idempotent: an already-prefixed CV keeps its index across re-runs.
      const { path: indexedFile, index } = this.piiIndex.assignIndexedName(piiDir, file);
      const profile = await this.parseOne(indexedFile);

      const { sanitized, fullName, contact } = this.piiExtractor.extract(profile);
      sanitized.piiIndex = index;
      this.repository.saveTo(outDir, sanitized);

      this.piiIndex.saveRecord(piiDir, {
        index,
        fullName,
        contact,
        originalCvFile: path.basename(file),
        originalCvPath: path.resolve(file),
        cvFile: path.basename(indexedFile),
        jsonFile: `${sanitized.id}.json`,
        extractedAt: new Date().toISOString(),
      });

      report.rows.push({
        file: path.basename(indexedFile),
        // Real name is shown only on the operator's console; it is never persisted here.
        name: fullName ?? '',
        years: sanitized.totalYearsExperience,
        topSkills: sanitized.skills.map((s) => s.canonical),
        warningCount: sanitized.warnings.length,
        warnings: sanitized.warnings,
      });
    }
    return report;
  }

  async parseOne(file: string): Promise<CanonicalCandidateProfile> {
    const source = fileSource(this.fileLoader, file);
    const converter = this.converterRegistry.resolve<RawResume>('resume', source);
    const { value: raw } = await converter.convert(source);
    return this.parser.parse(raw);
  }
}
