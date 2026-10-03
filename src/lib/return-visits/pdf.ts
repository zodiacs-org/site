/** A4 PDF assembly in the visitor's browser. JPEG pages embed every script's glyphs. */
export interface PdfImagePage { jpeg: Uint8Array; width: number; height: number }
export function assembleChartPdf(pages: readonly PdfImagePage[], methodology = 'https://zodiacs.org/methodology/'): Blob {
  if (!pages.length || pages.length > 12 || !/^https:\/\/zodiacs\.org\/(?:es\/|pt\/|fr\/|it\/|ru\/)?methodology\/$/.test(methodology)) throw new RangeError('Invalid chart PDF');
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = []; let length = 0; const offsets = [0];
  const add = (value: string | Uint8Array) => { const bytes = typeof value === 'string' ? encoder.encode(value) : value; chunks.push(bytes); length += bytes.length; };
  const object = (id: number, content: string) => { offsets[id] = length; add(`${id} 0 obj\n${content}\nendobj\n`); };
  add('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 4} 0 R`).join(' ')}] >>`);
  for (const [i, page] of pages.entries()) {
    if (page.width < 1 || page.height < 1 || page.jpeg[0] !== 255 || page.jpeg[1] !== 216) throw new RangeError('Invalid PDF image');
    const id = 3 + i * 4;
    object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Image ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R /Annots [${id + 3} 0 R] >>`);
    offsets[id + 1] = length;
    add(`${id + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`);
    add(page.jpeg); add('\nendstream\nendobj\n');
    const commands = 'q 595.28 0 0 841.89 0 0 cm /Image Do Q\n';
    object(id + 2, `<< /Length ${encoder.encode(commands).length} >>\nstream\n${commands}endstream`);
    object(id + 3, `<< /Type /Annot /Subtype /Link /Rect [30 8 565 58] /Border [0 0 0] /A << /S /URI /URI (${methodology}) >> >>`);
  }
  const xref = length;
  add(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let i = 1; i < offsets.length; i++) add(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  add(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const output = new Uint8Array(length); let cursor = 0;
  for (const chunk of chunks) { output.set(chunk, cursor); cursor += chunk.length; }
  return new Blob([output], { type: 'application/pdf' });
}
