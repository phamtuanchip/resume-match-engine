import { ContactInfo } from '@core/canonical';

/**
 * One entry in the PII vault (pii-index.json). The parsed profile JSON and the renamed
 * CV file both carry the same index in their filename, so the mapping
 *   <index>-<name>.json  ↔  <index>-<name>.<ext>  ↔  vault record <index>
 * is recoverable from filenames alone, while the profile itself stays PII-free.
 */
export interface PiiRecord {
  index: string; // zero-padded, e.g. "0001"
  fullName: string | null;
  contact: ContactInfo;
  originalCvFile: string; // filename before renaming
  originalCvPath?: string; // absolute path at parse time — used for path-based dedup across dirs
  cvFile: string; // renamed CV filename: "<index>-<original>"
  jsonFile: string; // sanitized profile filename: "<id>.json"
  extractedAt: string; // ISO timestamp
}

export interface PiiIndexFile {
  nextIndex: number;
  records: Record<string, PiiRecord>;
}
