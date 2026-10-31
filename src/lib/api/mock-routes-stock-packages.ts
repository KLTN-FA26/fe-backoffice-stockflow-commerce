/**
 * Mock `POST /inventory/stock-packages/labels` (BE StockPackageController, SCRUM-473), chỉ dùng khi USE_MOCK=true.
 *
 * Tìm thùng trên các phiếu nhận mock; trả một PDF tối giản (mỗi nhãn một dòng chữ LPN + SKU) đủ để xem trước / in thử.
 * Lỗi trả JSON envelope như BE.
 */

import { registerMockRoute } from "./mock-adapter";
import { getReceiptStore } from "./mock-routes-goods-receipts-store";
import { beError, isRecord, parseJsonBody, readString } from "./mock-routes-purchase-orders-store";

import type { MockReceiptPackage } from "./mock-receipt-cartons";

const LABELS_MAX = 500;
const CLOSED: readonly string[] = ["VOID", "CONSUMED", "LOST"];

interface LabelRow {
  carton: MockReceiptPackage;
  sku: string;
  unit: string;
}

/** PDF 1 trang, font Helvetica dựng sẵn, xref đúng offset — trình xem PDF của trình duyệt mở được. */
export function mockLabelsPdf(rows: readonly LabelRow[], format: string): Blob {
  const escape = (text: string) => text.replace(/[\\()]/g, (c) => `\\${c}`);
  const lines = [
    `Carton labels (${format}) - mock`,
    ...rows.map(
      ({ carton, sku, unit }) =>
        `${carton.lpn}   ${sku}   ${carton.receivedQty} / ${carton.nominalQty} ${unit}`,
    ),
  ];
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

async function cartonsByLpn(): Promise<Map<string, LabelRow & { lineId: string }>> {
  const map = new Map<string, LabelRow & { lineId: string }>();
  for (const receipt of (await getReceiptStore()).values()) {
    for (const line of receipt.lines) {
      for (const carton of line.packages ?? []) {
        map.set(carton.lpn, {
          carton,
          sku: line.sku ?? "",
          unit: line.unitOfMeasure ?? "",
          lineId: line.id,
        });
      }
    }
  }
  return map;
}

async function printLabels(body: Record<string, unknown>) {
  const format = readString(body.format);
  if (format !== "A4_SHEET" && format !== "THERMAL_ROLL")
    return beError(400, "VALIDATION_FAILED", "Invalid request data", [
      { field: "format", message: "must not be null", code: "NotNull" },
    ]);
  const lineId = readString(body.receiptLineId);
  const lpns = Array.isArray(body.lpns) ? body.lpns.map((l) => readString(l).toUpperCase()) : [];
  if (lineId && lpns.length > 0)
    return beError(400, "VALIDATION_FAILED", "Send receiptLineId or lpns, not both");
  const all = await cartonsByLpn();
  let rows: LabelRow[];
  if (lineId) {
    rows = [...all.values()].filter(
      (r) => r.lineId === lineId && !CLOSED.includes(r.carton.status),
    );
  } else {
    rows = [];
    for (const lpn of lpns) {
      const row = all.get(lpn);
      if (!row || row.carton.status === "VOID")
        return beError(404, "STOCK_PACKAGE_NOT_FOUND", `No carton ${lpn}`);
      if (CLOSED.includes(row.carton.status))
        return beError(409, "INVALID_STOCK_PACKAGE_TRANSITION", `${lpn} is ${row.carton.status}`);
      rows.push(row);
    }
  }
  if (rows.length === 0)
    return beError(422, "STOCK_PACKAGE_LABELS_EMPTY", "No carton to print a label for");
  if (rows.length > LABELS_MAX)
    return beError(422, "STOCK_PACKAGE_LABELS_TOO_MANY", `At most ${LABELS_MAX} labels per print`);
  return {
    status: 200,
    data: mockLabelsPdf(rows, format),
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="carton-labels-mock.pdf"',
    },
  };
}

export function registerStockPackageMockRoutes(): void {
  registerMockRoute("POST", "/inventory/stock-packages/labels", async (config) => {
    const body = parseJsonBody(config.data);
    return printLabels(isRecord(body) ? body : {});
  });
}
