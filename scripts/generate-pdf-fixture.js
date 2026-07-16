/**
 * Generates test/fixtures/resumes/valid.pdf using pdf-lib's default save options.
 * Default options use cross-reference streams (PDF 1.5+) which pdf.js v1.10.100 can read.
 * Run once: node scripts/generate-pdf-fixture.js
 */
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function main() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([612, 792]);
  const { height } = page.getSize();

  const draw = (text, x, y, size = 11, bold = false) => {
    page.drawText(text, { x, y, size, font: bold ? boldFont : font, color: rgb(0, 0, 0) });
  };

  let y = height - 60;
  draw('Maria Silva', 50, y, 16, true);      y -= 22;
  draw('maria.silva@example.com | +1 555 987 6543', 50, y);  y -= 28;

  draw('EXPERIENCE', 50, y, 12, true);       y -= 18;
  draw('Senior Engineer | CloudCo | Jan 2019 - Present', 50, y);  y -= 16;
  draw('  Built microservices with Node.js, TypeScript, and AWS.', 50, y);  y -= 28;

  draw('SKILLS', 50, y, 12, true);           y -= 18;
  draw('TypeScript, Node.js, AWS, Docker, PostgreSQL', 50, y);    y -= 28;

  draw('EDUCATION', 50, y, 12, true);        y -= 18;
  draw('B.Sc. Computer Science | State University | 2015', 50, y);

  // Default pdfDoc.save() uses useObjectStreams: true → PDF 1.5+ with cross-ref streams.
  const pdfBytes = await pdfDoc.save();

  const outPath = path.resolve(__dirname, '../test/fixtures/resumes/valid.pdf');
  fs.writeFileSync(outPath, pdfBytes);
  console.log(`Written: ${outPath} (${pdfBytes.length} bytes)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
