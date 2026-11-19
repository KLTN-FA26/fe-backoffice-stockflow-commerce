/**
 * PDF tối giản cho mock các endpoint in nhãn (chỉ dùng khi USE_MOCK=true): 1 trang A4, font Helvetica dựng sẵn, mỗi dòng
 * một dòng chữ, xref đúng offset — trình xem PDF của trình duyệt mở được để xem trước / in thử.
 */

/** Dòng chữ → PDF; dòng tràn khỏi trang thì bị cắt (mock chỉ cần mở được). */
export function mockTextPdf(lines: readonly string[]): Blob {
  const escape = (value: string) => value.replace(/[\\()]/g, (c) => `\\${c}`);
  const text = lines
    .map((line, i) => `BT /F1 11 Tf 40 ${800 - i * 18} Td (${escape(line)}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = objects.map((object, i) => {
    const offset = body.length;
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([body], { type: "application/pdf" });
}
