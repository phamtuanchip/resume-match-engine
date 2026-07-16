/**
 * Format-variant tests using the new CV fixtures (.md, .docx, .html / Google Docs export).
 * Covers: CONV-MD-001, CONV-MD-002, CONV-DOCX-001, CONV-HTML-001, PARSE-MD-001
 *
 * Key fact from the implementation:
 *   PlainTextResumeConverter.supports() accepts .txt AND .md
 *   No converters for .docx or .html are registered → FileLoadError
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileLoadError } from '@common/errors';
import { ConverterRegistry } from '@core/conversion/converter.registry';
import { FreeTextJobConverter } from '@core/conversion/converters/freetext-job.converter';
import { PlainTextResumeConverter } from '@core/conversion/converters/plaintext-resume.converter';
import { StructuredJobConverter } from '@core/conversion/converters/structured-job.converter';
import { RawResume, SourceDescriptor } from '@core/conversion/input-converter.interface';
import { ExperienceCalculatorService } from '@core/parsing/experience-calculator.service';
import { ResumeParserService } from '@core/parsing/resume-parser.service';
import { SkillNormalizerService } from '@core/parsing/skill-normalizer.service';

const FIXTURES = path.resolve(__dirname, '..', 'fixtures', 'resumes');

const normalizer = new SkillNormalizerService();

const registry = new ConverterRegistry([
  new PlainTextResumeConverter(),
  new StructuredJobConverter(normalizer),
  new FreeTextJobConverter(normalizer),
]);

const fileSource = (filePath: string, text?: string): SourceDescriptor => {
  const ext = '.' + filePath.split('.').pop()!;
  const bytes = text ? Buffer.from(text, 'utf8') : fs.readFileSync(filePath);
  return { uri: filePath, origin: 'file', ext, bytes, text: text ?? bytes.toString('utf8') };
};

const rawResume = (text: string, fileName = 'cv.md'): RawResume => ({
  id: 'test',
  source: {
    fileName,
    fileType: 'txt',
    convertedAt: new Date().toISOString(),
    converter: 'plaintext-resume',
  },
  text,
  warnings: [],
});

// ─── CONV-MD-001: .md extension routes to PlainTextResumeConverter ───────────

describe('CONV-MD-001: Markdown (.md) is routed to PlainTextResumeConverter', () => {
  it('resolves the correct converter by extension', () => {
    const src: SourceDescriptor = { uri: 'cv.md', origin: 'file', ext: '.md', text: '# Test' };
    expect(registry.resolve('resume', src).name).toBe('plaintext-resume');
  });
});

// ─── CONV-MD-002: Markdown content is preserved as plain text ────────────────

describe('CONV-MD-002: Markdown CV fixture converts to plain text', () => {
  const mdPath = path.join(FIXTURES, 'cv-markdown.md');

  it('fixture file exists', () => {
    expect(fs.existsSync(mdPath)).toBe(true);
  });

  it('converts without warnings and preserves key content', async () => {
    const src = fileSource(mdPath);
    const converter = new PlainTextResumeConverter();
    const { value, warnings } = await converter.convert(src);
    expect(warnings).toEqual([]);
    expect(value.text).toContain('Priya Sharma');
    expect(value.text).toContain('TypeScript');
    expect(value.text).toContain('NestJS');
    expect(value.source.fileType).toBe('txt'); // PlainTextConverter reports 'txt'
  });

  it('markdown headers and bullets are preserved in raw text', async () => {
    const src = fileSource(mdPath);
    const { value } = await new PlainTextResumeConverter().convert(src);
    // Markdown syntax is kept as-is (no stripping) — parser sees raw markdown
    expect(value.text).toContain('#');
  });
});

// ─── PARSE-MD-001: Full parse of Markdown CV produces a valid profile ────────

describe('PARSE-MD-001: ResumeParserService parses a Markdown CV fixture', () => {
  const mdContent = fs.readFileSync(path.join(FIXTURES, 'cv-markdown.md'), 'utf8');
  const calc = new ExperienceCalculatorService();
  const parser = new ResumeParserService(normalizer, calc);

  it('extracts candidate name (markdown heading prefix stripped or included per parser behaviour)', async () => {
    const profile = parser.parse(rawResume(mdContent, 'cv-markdown.md'));
    // The plain-text converter retains markdown syntax; the name extractor picks up
    // the first line verbatim. We check it contains "Priya Sharma" regardless of the '#'.
    expect(profile.fullName).toContain('Priya Sharma');
  });

  it('extracts contact email', () => {
    const profile = parser.parse(rawResume(mdContent, 'cv-markdown.md'));
    expect(profile.contact.email).toContain('priya.sharma@example.com');
  });

  it('extracts multiple work experience entries', () => {
    const profile = parser.parse(rawResume(mdContent, 'cv-markdown.md'));
    expect(profile.workHistory.length).toBeGreaterThanOrEqual(2);
  });

  it('normalizes "JS" alias from skills section', () => {
    const text = '# Dev\ndev@example.com\nSKILLS\nJS, React';
    const profile = parser.parse(rawResume(text, 'inline.md'));
    const canonicals = profile.skills.map((s) => s.canonical);
    expect(canonicals).toContain('JavaScript');
    expect(canonicals).toContain('React');
  });

  it('never throws on raw markdown content (F3)', () => {
    expect(() => parser.parse(rawResume(mdContent, 'cv-markdown.md'))).not.toThrow();
  });
});

// ─── CONV-DOCX-001: .docx is not supported → FileLoadError ──────────────────

describe('CONV-DOCX-001: DOCX format raises FileLoadError (no converter registered)', () => {
  const docxPath = path.join(FIXTURES, 'cv-docx.docx');

  it('fixture file exists and is a valid ZIP/DOCX', () => {
    expect(fs.existsSync(docxPath)).toBe(true);
    const buf = fs.readFileSync(docxPath);
    // DOCX is a ZIP; magic bytes are PK (0x50 0x4B)
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it('ConverterRegistry throws FileLoadError for .docx (DOCX converter is interface-ready but not registered)', () => {
    const src: SourceDescriptor = {
      uri: docxPath,
      origin: 'file',
      ext: '.docx',
      bytes: fs.readFileSync(docxPath),
    };
    expect(() => registry.resolve('resume', src)).toThrow(FileLoadError);
  });

  it('FileLoadError message names the unsupported format', () => {
    const src: SourceDescriptor = { uri: 'cv.docx', origin: 'file', ext: '.docx', text: '' };
    try {
      registry.resolve('resume', src);
      fail('Expected FileLoadError');
    } catch (err) {
      expect(err).toBeInstanceOf(FileLoadError);
      expect((err as FileLoadError).message).toMatch(/docx|cv\.docx|No resume converter/i);
    }
  });
});

// ─── CONV-HTML-001: .html (Google Docs export) is not supported → FileLoadError

describe('CONV-HTML-001: HTML (Google Docs export) raises FileLoadError (no converter registered)', () => {
  const htmlPath = path.join(FIXTURES, 'cv-google-docs.html');

  it('fixture file exists and looks like a Google Docs HTML export', () => {
    expect(fs.existsSync(htmlPath)).toBe(true);
    const text = fs.readFileSync(htmlPath, 'utf8');
    expect(text).toContain('Carlos Mendez');
    expect(text).toContain('<html');
  });

  it('ConverterRegistry throws FileLoadError for .html', () => {
    const src: SourceDescriptor = {
      uri: htmlPath,
      origin: 'file',
      ext: '.html',
      bytes: fs.readFileSync(htmlPath),
    };
    expect(() => registry.resolve('resume', src)).toThrow(FileLoadError);
  });

  it('FileLoadError message names the unsupported format', () => {
    const src: SourceDescriptor = { uri: 'cv.html', origin: 'file', ext: '.html', text: '' };
    try {
      registry.resolve('resume', src);
      fail('Expected FileLoadError');
    } catch (err) {
      expect(err).toBeInstanceOf(FileLoadError);
      expect((err as FileLoadError).message).toMatch(/html|cv\.html|No resume converter/i);
    }
  });
});

// ─── CONV-005: Unsupported extension error shape ──────────────────────────────

describe('CONV-005: FileLoadError is a typed, assertable error class', () => {
  it('.xlsx also raises FileLoadError (not a generic Error)', () => {
    const src: SourceDescriptor = { uri: 'cv.xlsx', origin: 'file', ext: '.xlsx', text: '' };
    expect(() => registry.resolve('resume', src)).toThrow(FileLoadError);
  });
});
