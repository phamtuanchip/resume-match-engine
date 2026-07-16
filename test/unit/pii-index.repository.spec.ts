import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PiiIndexRepository } from '@core/pii/pii-index.repository';

describe('PiiIndexRepository', () => {
  let piiDir: string;
  let cvDir: string;
  const repo = new PiiIndexRepository();

  const makeCv = (name: string): string => {
    const file = path.join(cvDir, name);
    fs.writeFileSync(file, 'cv content');
    return file;
  };

  beforeEach(() => {
    piiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rme-pii-'));
    cvDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rme-cv-'));
  });

  afterEach(() => {
    fs.rmSync(piiDir, { recursive: true, force: true });
    fs.rmSync(cvDir, { recursive: true, force: true });
  });

  it('copies the CV into the vault as "<index>-<original>" with sequential zero-padded indexes', () => {
    const a = repo.assignIndexedName(piiDir, makeCv('alice.txt'));
    const b = repo.assignIndexedName(piiDir, makeCv('bob.pdf'));

    expect(path.basename(a.path)).toBe('0001-alice.txt');
    expect(path.basename(b.path)).toBe('0002-bob.pdf');
    expect(a.path).toContain(piiDir); // copy lives in the vault
    expect(fs.existsSync(a.path)).toBe(true); // vault copy exists
    expect(fs.existsSync(path.join(cvDir, 'alice.txt'))).toBe(true); // original preserved
  });

  it('is idempotent: an already-indexed file keeps its index and is not re-renamed', () => {
    const first = repo.assignIndexedName(piiDir, makeCv('carol.txt'));
    const again = repo.assignIndexedName(piiDir, first.path);

    expect(again.index).toBe(first.index);
    expect(again.path).toBe(first.path);
    expect(path.basename(again.path)).toBe('0001-carol.txt'); // no "0002-0001-carol.txt"
  });

  it('persists and reloads vault records by index', () => {
    const record = {
      index: '0001',
      fullName: 'Alice A',
      contact: { email: 'a@x.com', phone: null },
      originalCvFile: 'alice.txt',
      cvFile: '0001-alice.txt',
      jsonFile: '0001-alice.json',
      extractedAt: new Date().toISOString(),
    };
    repo.saveRecord(piiDir, record);
    expect(repo.findByIndex(piiDir, '0001')).toEqual(record);
    expect(repo.findByIndex(piiDir, '9999')).toBeNull();
  });

  it('deletes a record (GDPR erasure path)', () => {
    repo.saveRecord(piiDir, {
      index: '0001',
      fullName: 'Alice A',
      contact: { email: null, phone: null },
      originalCvFile: 'a.txt',
      cvFile: '0001-a.txt',
      jsonFile: '0001-a.json',
      extractedAt: '',
    });
    expect(repo.deleteRecord(piiDir, '0001')).toBe(true);
    expect(repo.findByIndex(piiDir, '0001')).toBeNull();
    expect(repo.deleteRecord(piiDir, '0001')).toBe(false);
  });

  it('continues the index sequence after records are saved', () => {
    repo.assignIndexedName(piiDir, makeCv('one.txt')); // 0001
    repo.assignIndexedName(piiDir, makeCv('two.txt')); // 0002
    const third = repo.assignIndexedName(piiDir, makeCv('three.txt'));
    expect(third.index).toBe('0003');
  });
});
