/* Minimal dependency-free PDF writer: plain text, Courier, automatic page breaks. */
export function textToPdf(text: string): Blob {
  const W = 612, H = 792, M = 50, FS = 10, LH = 13, cols = Math.floor((W - 2 * M) / (FS * 0.6));
  const esc = (s: string) => s.replace(/[^\x00-\xff]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const lines: string[] = [];
  for (const raw of text.split("\n")) { if (!raw) { lines.push(""); continue; } for (let i = 0; i < raw.length; i += cols) lines.push(raw.slice(i, i + cols)); }
  const per = Math.floor((H - 2 * M) / LH), pages: string[][] = [];
  for (let i = 0; i < lines.length; i += per) pages.push(lines.slice(i, i + per));
  if (!pages.length) pages.push([]);
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + 2 * i} 0 R`).join(" ")}] /Count ${pages.length} >>`, "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"];
  pages.forEach((pg, i) => {
    const s = `BT /F1 ${FS} Tf ${LH} TL ${M} ${H - M - FS} Td\n` + pg.map((l) => `(${esc(l)}) Tj T*\n`).join("") + "ET";
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + 2 * i} 0 R >>`, `<< /Length ${s.length} >>\nstream\n${s}\nendstream`);
  });
  let out = "%PDF-1.4\n"; const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("") + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  const b = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) b[i] = out.charCodeAt(i) & 255;
  return new Blob([b], { type: "application/pdf" });
}
