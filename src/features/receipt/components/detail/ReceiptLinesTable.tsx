"use client";

import { RECEIPT_CARTON_LABELS, UI_LABELS } from "@/constants";

import { LineCartonsCell } from "../cartons/LineCartonsCell";
import { NUM } from "../primitives";
import { LineNoteCell } from "./LineNoteCell";

import type { GoodsReceipt, ReceiptLineDto } from "@/features/receipt/types";

const CARTONS = RECEIPT_CARTON_LABELS.column;
const PRODUCTION = "Thùng theo Đơn SX";

/** 4A-5: thùng của dòng so với dòng Đơn sản xuất — phiếu này / đã nhận / còn lại trên số đặt. */
function ProductionProgressCell({ line }: { line: ReceiptLineDto }) {
  const p = line.production;
  if (!p) return <td className="text-ink-tertiary px-3 py-2">—</td>;
  return (
    <td className={`px-3 py-2 ${NUM}`}>
      <div className="text-ink-primary">
        {p.receivedCartons}/{p.orderedCartons}
      </div>
      <div className="text-ink-tertiary text-xs">còn {p.remainingCartons}</div>
    </td>
  );
}

/**
 * Dòng nhận theo dữ liệu BE (`GoodsReceiptResponse.lines`): SKU, SL, thùng LPN, lô, khu nhận; phiếu theo Đơn sản
 * xuất có thêm tiến độ thùng của dòng Đơn sản xuất. Phiếu đã xác nhận thêm SL còn chờ cất.
 */
export function ReceiptLinesTable({
  receipt,
  draft = false,
}: {
  receipt: GoodsReceipt;
  draft?: boolean;
}) {
  const headers = [
    "SKU",
    "SL",
    CARTONS,
    "Lô",
    "Vị trí nhận",
    PRODUCTION,
    "Ghi chú",
    ...(draft ? [] : ["Chờ cất"]),
  ];
  const rightAligned = new Set(["SL", PRODUCTION, "Chờ cất"]);

  return (
    // Bảng nhiều cột trong cột trái (cạnh sidebar 320px) → không ép co cột, cho cuộn ngang
    <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
      <table className="w-full min-w-max text-[0.8125rem]">
        <caption className="sr-only">Dòng nhận của phiếu {receipt.number}</caption>
        <thead className="bg-bg-subtle text-ink-secondary">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                scope="col"
                className={`px-3 py-2 font-medium whitespace-nowrap ${rightAligned.has(h) ? "text-right" : "text-left"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {receipt.lines.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="text-ink-tertiary px-3 py-4 text-center">
                {UI_LABELS.receipt.noCountLines}
              </td>
            </tr>
          )}
          {receipt.lines.map((line) => (
            <tr key={line.id} className="border-border-default border-t align-top">
              <td className="px-3 py-2 font-[family-name:var(--font-mono)]">{line.sku ?? "—"}</td>
              <td className={`text-ink-primary px-3 py-2 font-medium ${NUM}`}>{line.quantity}</td>
              <LineCartonsCell line={line} />
              <td className="px-3 py-2 font-[family-name:var(--font-mono)]">
                {line.lotNumber ?? "—"}
              </td>
              <td className="px-3 py-2 font-[family-name:var(--font-mono)]">
                {line.locationCode ?? "—"}
              </td>
              <ProductionProgressCell line={line} />
              <LineNoteCell note={line.note} />
              {!draft && <td className={`px-3 py-2 ${NUM}`}>{line.quantityForPutaway}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
