import * as fs from 'fs';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import { FileLoadError } from '@common/errors';
import { PiiIndexFile, PiiRecord } from './pii.types';

const INDEX_FILE = 'pii-index.json';
const INDEX_PREFIX_RE = /^(\d{4,})-/;

/**
 * The local PII vault: a single pii-index.json holding all extracted PII, keyed by index.
 * Also owns copying each CV into the vault with an index prefix so the vault is self-contained
 * and source directories are never mutated.
 * This file is the ONLY place candidate identity lives after parsing — keep it out of
 * shared storage and delete entries to satisfy erasure requests (GDPR Art. 17).
 */
@Injectable()
export class PiiIndexRepository {
  /**
   * Assigns a zero-padded index to the CV and copies it into the vault directory.
   * The original source file is never touched.
   * Idempotent: if a record already maps this original filename to an index, that index
   * is reused and no second copy is made.
   */
  assignIndexedName(piiDir: string, filePath: string): { path: string; index: string } {
    const base = path.basename(filePath);

    // Fast path: caller passed the vault copy path directly (already prefixed). Gate on the
    // file actually living inside the vault dir — a real source CV named after a year
    // (e.g. "2020-cv-john.pdf") also matches the prefix pattern, and treating it as vaulted
    // would collide indexes and skip the copy, silently overwriting another candidate.
    const inVault = path.resolve(path.dirname(filePath)) === path.resolve(piiDir);
    const existingPrefix = base.match(INDEX_PREFIX_RE);
    if (inVault && existingPrefix) {
      return { path: filePath, index: existingPrefix[1] };
    }

    // Re-run: look up by full path first (cross-dir dedup), then fall back to basename for
    // older records that predate the originalCvPath field.
    const normalizedPath = path.resolve(filePath);
    const data = this.read(piiDir);
    const existingRecord = Object.values(data.records).find(
      (r) => (r.originalCvPath && r.originalCvPath === normalizedPath) || r.originalCvFile === base,
    );
    if (existingRecord) {
      return { path: path.join(piiDir, existingRecord.cvFile), index: existingRecord.index };
    }

    // New file: copy to vault FIRST, then persist the bumped counter. Copying first means a
    // failed copy never burns an index, and the counter is only advanced once the vault
    // actually holds the file.
    const index = String(data.nextIndex).padStart(4, '0');
    const vaultPath = path.join(piiDir, `${index}-${base}`);
    fs.mkdirSync(piiDir, { recursive: true });
    fs.copyFileSync(filePath, vaultPath);
    data.nextIndex += 1;
    this.write(piiDir, data);

    return { path: vaultPath, index };
  }

  saveRecord(piiDir: string, record: PiiRecord): void {
    const data = this.read(piiDir);
    data.records[record.index] = record;
    this.write(piiDir, data);
  }

  findByIndex(piiDir: string, index: string): PiiRecord | null {
    return this.read(piiDir).records[index] ?? null;
  }

  deleteRecord(piiDir: string, index: string): boolean {
    const data = this.read(piiDir);
    if (!(index in data.records)) return false;
    delete data.records[index];
    this.write(piiDir, data);
    return true;
  }

  private read(piiDir: string): PiiIndexFile {
    const file = path.join(piiDir, INDEX_FILE);
    if (!fs.existsSync(file)) return { nextIndex: 1, records: {} };
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')) as PiiIndexFile;
    } catch {
      // Fail loud but typed: silently resetting to an empty index would re-index every CV and
      // overwrite existing vault records, losing identity mappings. Surface it as a domain error.
      throw new FileLoadError(
        `PII vault index is corrupt or unreadable: ${file}. Restore or remove it before re-running.`,
      );
    }
  }

  private write(piiDir: string, data: PiiIndexFile): void {
    fs.mkdirSync(piiDir, { recursive: true });
    fs.writeFileSync(path.join(piiDir, INDEX_FILE), JSON.stringify(data, null, 2), 'utf8');
  }
}
