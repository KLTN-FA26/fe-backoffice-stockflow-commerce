/**
 * Kiểm đếm theo thùng (docs 03 §4.1 bước 2–3, SCRUM-566) — selectors THUẦN: dựng dòng form từ phiếu + Đơn sản xuất,
 * dựng body `PUT /goods-receipts/{id}/lines`, map lỗi từng trường của BE về đúng dòng form.
 */

import { RECEIPT_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { countRowTotal, isCountedRow } from "./count-schemas";

import type { ProductionLineRef } from "@/lib/references/production-orders";
import type { CountRow, GoodsReceipt, ReceiptLinesInput } from "./types";

/** Thùng còn sống (`RECEIVING`) của một dòng phiếu nháp — nguồn chung cho dòng form và chữ ký bản đếm. */
function receivingCartons(line: GoodsReceipt["lines"][number]) {
  return line.packages.filter((carton) => carton.status === "RECEIVING");
}

/**
 * Một dòng form cho mỗi dòng Đơn sản xuất. Dòng đã có trên phiếu: giữ thùng `RECEIVING` của nó, giới hạn =
 * còn lại + phiếu này (BE `remaining` của phiếu nháp đã trừ phần phiếu này). Dòng chưa đếm: giới hạn = đặt − đã nhận.
 */
export function buildCountRows(
  receipt: Pick<GoodsReceipt, "lines">,
  orderLines: readonly ProductionLineRef[],
  defaultLocation: string,
): CountRow[] {
  return orderLines.map((orderLine) => {
    const line = receipt.lines.find((l) => l.productionOrderLineId === orderLine.id);
    const progress = line?.production;
    const base = {
      productionOrderLineId: orderLine.id,
      sku: orderLine.sku,
      unitsPerCarton: progress?.unitsPerCarton ?? orderLine.unitsPerCarton,
      orderedCartons: progress?.orderedCartons ?? orderLine.cartons,
      newCartons: 0,
    };
    if (!line) {
      return {
        ...base,
        receivedCartons: orderLine.receivedCartons,
        maxCartons: Math.max(0, orderLine.cartons - orderLine.receivedCartons),
        onReceipt: false,
        locationCode: defaultLocation,
        existing: [],
      };
    }
    const existing = receivingCartons(line).map((carton) => ({ lpn: carton.lpn, keep: true }));
    return {
      ...base,
      receivedCartons: progress?.receivedCartons ?? orderLine.receivedCartons,
      maxCartons: progress
        ? Math.max(0, progress.remainingCartons + progress.thisReceiptCartons)
        : Math.max(0, orderLine.cartons - orderLine.receivedCartons),
      onReceipt: true,
      locationCode: line.locationCode ?? defaultLocation,
      existing,
    };
  });
}

export type CountResult = "full" | "short" | "over" | "none";

/** Docs 03 §4.1 bước 3: đủ / thiếu / thừa theo số thùng nhận luỹ kế so với số thùng đặt. */
export function countResult(
  row: Pick<CountRow, "existing" | "newCartons" | "receivedCartons" | "orderedCartons">,
): CountResult {
  const total = countRowTotal(row);
  if (total === 0) return "none";
  const cumulative = row.receivedCartons + total;
  if (cumulative > row.orderedCartons) return "over";
  return cumulative === row.orderedCartons ? "full" : "short";
}

/**
 * Body `PUT /lines` — thay toàn bộ bản đếm. Thùng giữ lại gửi `lpn` (đếm lại), thùng mới gửi `{}` (BE cấp LPN), thùng
 * bỏ ra không gửi (BE → Void). Không gửi `lotNumber` (BR-03: lô = mã Đơn sản xuất), `quantity` (BR-13: mọi thùng đúng
 * số chuẩn), `sku`, `unitOfMeasure`. `rowOf[i]` = dòng form của `lines[i]` — để map `fieldErrors` về đúng dòng.
 */
export function toLinesRequest(rows: readonly CountRow[]): {
  body: ReceiptLinesInput;
  rowOf: number[];
} {
  const rowOf: number[] = [];
  const lines = rows.flatMap((row, index) => {
    if (!isCountedRow(row)) return [];
    rowOf.push(index);
    return [
      {
        productionOrderLineId: row.productionOrderLineId,
        locationCode: row.locationCode.trim(),
        packages: [
          ...row.existing.filter((carton) => carton.keep).map((carton) => ({ lpn: carton.lpn })),
          ...Array.from({ length: Math.max(0, row.newCartons) }, () => ({})),
        ],
      },
    ];
  });
  return { body: { lines }, rowOf };
}

export type CountField = "locationCode" | "newCartons";

export interface CountFieldError {
  row: number;
  field: CountField;
  message: string;
}

const LINE_FIELD = /^lines\[(\d+)\]\.?([A-Za-z]*)/;

type ReceiptErrorCode = keyof typeof RECEIPT_ERROR_MESSAGES;

function isReceiptErrorCode(code: string): code is ReceiptErrorCode {
  return code in RECEIPT_ERROR_MESSAGES;
}

/** Câu tiếng Việt theo mã của trường (BE message tiếng Anh không hiện thô). */
function messageOf(code: string | undefined): string {
  return code && isReceiptErrorCode(code)
    ? RECEIPT_ERROR_MESSAGES[code]
    : RECEIPT_ERROR_MESSAGES.VALIDATION_FAILED;
}

/**
 * `fieldErrors` của BE (`lines[i].locationCode`, `lines[i].packages[j].lpn`, `lines[i].productionOrderLineId`…) → lỗi
 * trên dòng form `rowOf[i]`. Khu nhận → ô khu; mọi lỗi khác của dòng → ô số thùng. Trường không thuộc dòng nào bị
 * bỏ qua — lỗi chung của form hiện câu theo `errorCode`.
 */
export function countFieldErrors(error: unknown, rowOf: readonly number[]): CountFieldError[] {
  if (!(error instanceof ApiError) || !error.fieldErrors) return [];
  const found: CountFieldError[] = [];
  for (const path of Object.keys(error.fieldErrors)) {
    const match = LINE_FIELD.exec(path);
    const row = match ? rowOf[Number(match[1])] : undefined;
    if (match === null || row === undefined) continue;
    const field: CountField = match[2] === "locationCode" ? "locationCode" : "newCartons";
    if (found.some((e) => e.row === row && e.field === field)) continue;
    found.push({ row, field, message: messageOf(error.fieldCodes?.[path] ?? error.code) });
  }
  return found;
}

/**
 * Chữ ký bản đếm đã lưu của phiếu (dòng, khu, thùng còn sống) — đổi khi phiếu được lưu / đổi ở nơi khác, để form
 * kiểm đếm dựng lại từ dữ liệu mới thay vì giữ dòng cũ (thùng mới chưa có LPN sẽ bị tạo trùng).
 */
export function countSignature(receipt: Pick<GoodsReceipt, "lines">): string {
  return receipt.lines
    .map((line) => {
      const cartons = receivingCartons(line)
        .map((carton) => carton.lpn)
        .join(",");
      return `${line.id}@${line.locationCode ?? ""}:${cartons}`;
    })
    .join("|");
}
