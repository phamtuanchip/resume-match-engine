import * as fs from 'fs';
import * as path from 'path';

/** Minimal JSON-per-record file store. Backs the repository layer instead of a database. */
export class JsonFileStore<T> {
  constructor(private readonly dir: string) {}

  save(id: string, value: T): string {
    fs.mkdirSync(this.dir, { recursive: true });
    const filePath = path.join(this.dir, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
    return filePath;
  }

  load(id: string): T | null {
    const filePath = path.join(this.dir, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    } catch {
      console.warn(`[JsonFileStore] Could not parse ${filePath} — file may be corrupt.`);
      return null;
    }
  }

  loadAll(): T[] {
    if (!fs.existsSync(this.dir)) return [];
    const results: T[] = [];
    for (const f of fs
      .readdirSync(this.dir)
      .filter((x) => x.endsWith('.json'))
      .sort()) {
      const filePath = path.join(this.dir, f);
      try {
        results.push(JSON.parse(fs.readFileSync(filePath, 'utf8')) as T);
      } catch {
        console.warn(`[JsonFileStore] Skipped corrupt file: ${f}`);
      }
    }
    return results;
  }

  delete(id: string): void {
    const filePath = path.join(this.dir, `${id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}
