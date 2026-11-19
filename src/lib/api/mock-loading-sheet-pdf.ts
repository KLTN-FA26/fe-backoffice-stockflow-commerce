/**
 * Mock PDF phiếu xếp hàng của một xe (BE `LoadingSheetDocument`, docs 09 §4.2 bước 5): một trang A4 tối thiểu hợp lệ —
 * mã kế hoạch, số xe, mã kiện theo thứ tự xếp — đủ để mở được khi chạy mock.
 */

const PAGE_W = 595;
const PAGE_H = 842;

const escape = (text: string) =>
  text.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, "?");

export function mockLoadingSheetPdf(planCode: string, seq: number, labelCodes: readonly string[]) {
  const lines = [`Loading sheet ${planCode} / vehicle ${seq}`, ...labelCodes];
  const text = lines
    .map((line, i) => `BT /F1 10 Tf 40 ${PAGE_H - 50 - i * 14} Td (${escape(line)}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [4 0 R] /Count 1 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>`,
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
