/**
 * Thin wrapper around pdfjs-dist so the converter and tests can swap this single require.
 * pdfjs-dist v4+ ships ESM-only. new Function('return import(...)') is used to perform a
 * true dynamic ESM import that TypeScript does not compile to require() — this is necessary
 * to load .mjs files correctly in both Node.js CJS runtime and Jest's test environment.
 */

// MUST stay type-only: pdfjs-dist is ESM-only, so a value import would compile to a top-level
// require() and crash under the CJS runtime. The actual module is loaded dynamically below.
import type * as Pdfjs from 'pdfjs-dist';

type PdfjsModule = typeof Pdfjs;
interface TextItem {
  str: string;
}

export async function extractText(buf: Buffer): Promise<string> {
  // Dynamic import via new Function to prevent TypeScript from rewriting to require().

  const pdfjs = await (new Function(
    'return import("pdfjs-dist/legacy/build/pdf.mjs")',
  )() as Promise<PdfjsModule>);
  const task = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const doc = await task.promise;

  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ('str' in item ? (item as TextItem).str : ''))
      .join(' ');
    text += line + '\n';
  }
  return text;
}
