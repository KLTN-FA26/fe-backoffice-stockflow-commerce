/**
 * Mock PDF nhãn giao hàng (BE `ShippingLabelSheet`, docs 08 §4.3 bước 6): một trang 100 × 150 mm mỗi thùng — mã đơn, LPN,
 * SKU, số cái, khối lượng, người nhận. File tối thiểu hợp lệ để xem trước / in thử trong trình duyệt.
 */

import type { Order } from "@/lib/mock-data";
import type { MockCarton } from "./mock-carton-check-session";

/** 100 × 150 mm tính bằng điểm PDF (1 mm = 72 / 25,4 pt). */
const PAGE_W = 283;
const PAGE_H = 425;

const escape = (text: string) =>
  text.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, "?");

function pageText(order: Order, carton: MockCarton): string {
  const lines = [
    order.orderNumber,
    `LPN ${carton.lpn}`,
    `${carton.sku} x ${carton.quantity}`,
    `Label v${carton.labelVersion}`,
    carton.weightKg == null ? "" : `${carton.weightKg} kg / ${carton.dimWeightKg ?? 0} kg dim`,
    carton.rotatable ? "" : "DO NOT ROTATE",
  ].filter(Boolean);
  return lines
    .map((line, i) => `BT /F1 14 Tf 20 ${PAGE_H - 40 - i * 24} Td (${escape(line)}) Tj ET`)
    .join("\n");
}

export function mockShippingLabelsPdf(order: Order, cartons: readonly MockCarton[]): Blob {
  const pages = cartons.length;
  // Đối tượng: 1 catalog, 2 pages, 3 font, rồi mỗi trang một cặp (page, content)
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${cartons.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${pages} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  cartons.forEach((carton, i) => {
    const text = pageText(order, carton);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`,
      `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    );
  });
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
