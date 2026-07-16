/**
 * PDF converter tests in isolation. Uses jest.doMock + jest.resetModules() to intercept
 * the lazy require('./pdf-extractor') inside PdfResumeConverter before the module loads.
 *
 * Covers: CONV-008 (mocked path), CONV-009, CONV-010, CONV-015
 * Real end-to-end parsing with the actual fixture: test/unit/pdf-real.spec.ts
 */

let PdfResumeConverter: typeof import('@core/conversion/converters/pdf-resume.converter').PdfResumeConverter;
let extractTextMock: jest.Mock;

beforeEach(() => {
  jest.resetModules();
  extractTextMock = jest.fn();
  jest.doMock('../../src/core/conversion/converters/pdf-extractor', () => ({
    extractText: extractTextMock,
  }));
  // Dynamic require AFTER doMock so the converter picks up the mock

  PdfResumeConverter =
    require('../../src/core/conversion/converters/pdf-resume.converter').PdfResumeConverter;
});

afterEach(() => {
  jest.restoreAllMocks();
});

const source = (extra: object = {}) => ({
  uri: 'cv.pdf',
  origin: 'file' as const,
  ext: '.pdf',
  bytes: Buffer.alloc(10),
  ...extra,
});

describe('CONV-008: valid PDF text layer is extracted', () => {
  it('extracts name and skills from mocked extractor response', async () => {
    extractTextMock.mockResolvedValue(
      'Maria Silva\nmaria.silva@example.com\nEXPERIENCE\nSenior Engineer | CloudCo | Jan 2019 - Present\nSKILLS\nTypeScript, Node.js, AWS, Docker',
    );
    const converter = new PdfResumeConverter();
    const { value, warnings } = await converter.convert(source());
    expect(value.text).toContain('Maria Silva');
    expect(value.text).toContain('TypeScript');
    expect(warnings).toEqual([]);
  });
});

describe('CONV-009: scanned PDF (no text layer) degrades gracefully', () => {
  it('produces empty text and an OCR warning, never throws', async () => {
    extractTextMock.mockResolvedValue('   \n  '); // whitespace only = no text layer
    const converter = new PdfResumeConverter();
    const { value, warnings } = await converter.convert(source());
    expect(value.text.trim()).toBe('');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatch(/no extractable text|scanned|OCR/i);
  });
});

describe('CONV-010: corrupt PDF degrades to a warning, never throws', () => {
  it('catches parse error and returns empty profile with warning', async () => {
    extractTextMock.mockRejectedValue(new Error('bad XRef entry'));
    const converter = new PdfResumeConverter();
    const { value, warnings } = await converter.convert(source({ uri: 'corrupt.pdf' }));
    expect(value.text).toBe('');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatch(/could not be parsed|bad XRef/i);
  });
});

describe('CONV-015: ConversionResult always has value + warnings array', () => {
  it('result shape is always fully populated', async () => {
    extractTextMock.mockResolvedValue('Some text');
    const converter = new PdfResumeConverter();
    const result = await converter.convert(source());
    expect(result).toHaveProperty('value');
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.value).toHaveProperty('text');
    expect(result.value).toHaveProperty('source');
    expect(result.value).toHaveProperty('warnings');
  });
});
