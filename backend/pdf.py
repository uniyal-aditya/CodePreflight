"""Minimal dependency-free PDF writer: plain text, Courier, automatic page breaks."""
import textwrap

def _esc(s: str) -> str:
    return s.encode("latin-1", "replace").decode("latin-1").replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

def text_to_pdf(text: str) -> bytes:
    W, H, M, FS, LH = 612, 792, 50, 10, 13
    cols = int((W - 2 * M) / (FS * 0.6))  # Courier glyphs are 0.6em wide
    lines = []
    for raw in text.splitlines():
        lines += textwrap.wrap(raw, cols, replace_whitespace=False, drop_whitespace=False) or [""]
    per = int((H - 2 * M) / LH)
    pages = [lines[i:i + per] for i in range(0, len(lines), per)] or [[]]
    n = len(pages)
    kids = " ".join(f"{4 + 2 * i} 0 R" for i in range(n))
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", f"<< /Type /Pages /Kids [{kids}] /Count {n} >>".encode(), b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"]
    for i, pg in enumerate(pages):
        body = f"BT /F1 {FS} Tf {LH} TL {M} {H - M - FS} Td\n" + "".join(f"({_esc(l)}) Tj T*\n" for l in pg) + "ET"
        s = body.encode("latin-1")
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W} {H}] /Resources << /Font << /F1 3 0 R >> >> /Contents {5 + 2 * i} 0 R >>".encode())
        objs.append(b"<< /Length %d >>\nstream\n" % len(s) + s + b"\nendstream")
    out, offs = bytearray(b"%PDF-1.4\n"), []
    for i, o in enumerate(objs, 1):
        offs.append(len(out)); out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    x = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    for o in offs: out += f"{o:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF".encode()
    return bytes(out)
