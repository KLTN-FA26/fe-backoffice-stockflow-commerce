"use client";

import { RECEIPT_CARTON_LABELS, UI_LABELS } from "@/constants";
import { ScrollShadowBox } from "@/components/backoffice/ScrollShadowBox";

import { LineCartonsCell } from "../cartons/LineCartonsCell";
import { NUM } from "../primitives";
import { LineNoteCell } from "./LineNoteCell";

import type { GoodsReceipt, ReceiptLineDto } from "@/features/receipt/types";

const CARTONS = RECEIPT_CARTON_LABELS.column;
const PROGRESS = UI_LABELS.receipt.productionProgress;
const PRODUCTION = PROGRESS.header;

/**
 * 4A-5: thùng của dòng so với dòng Đơn sản xuất — đã nhận / đặt, phiếu này, còn lại. Phiếu nháp: `remaining` =
 * đặt − đã nhận − phiếu này, nên phải hiện cả phần của phiếu này thì ba số mới cộng khớp.
 */
function ProductionProgressCell({ line }: { line: ReceiptLineDto }) {
  const p = line.production;
  if (!p) return <td className="text-ink-tertiary px-3 py-2">—</td>;
  return (
    <td className={`px-3 py-2 whitespace-nowrap ${NUM}`}>
      <div className="text-ink-primary">
        {PROGRESS.cartonsOfOrdered(p.receivedCartons, p.orderedCartons)}
      </div>
      <div className="text-ink-tertiary text-xs">{PROGRESS.thisReceipt(p.thisReceiptCartons)}</div>
      <div className="text-ink-tertiary text-xs">{PROGRESS.remaining(p.remainingCartons)}</div>
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
  // Cột Ghi chú chỉ hiện khi có dòng nào có ghi chú — cột trống toàn "—" chỉ làm bảng rộng thêm và bị cắt
  const hasNotes = receipt.lines.some((line) => !!line.note);
  const headers = [
    "SKU",
    "SL",
    CARTONS,
    "Lô",
    "Vị trí nhận",
    PRODUCTION,
    ...(hasNotes ? ["Ghi chú"] : []),
    ...(draft ? [] : ["Chờ cất"]),
  ];
  const rightAligned = new Set(["SL", PRODUCTION, "Chờ cất"]);

  return (
    // Bảng nhiều cột trong cột trái (cạnh sidebar 320px) → không ép co cột, cho cuộn ngang
    <ScrollShadowBox>
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
              <td className="px-3 py-2 font-[family-name:var(--font-mono)] whitespace-nowrap">
                {line.sku ?? "—"}
              </td>
              <td className={`text-ink-primary px-3 py-2 font-medium ${NUM}`}>{line.quantity}</td>
              <LineCartonsCell line={line} />
              <td className="px-3 py-2 font-[family-name:var(--font-mono)] whitespace-nowrap">
                {line.lotNumber ?? "—"}
              </td>
              <td className="px-3 py-2 font-[family-name:var(--font-mono)] whitespace-nowrap">
                {line.locationCode ?? "—"}
              </td>
              <ProductionProgressCell line={line} />
              {hasNotes && <LineNoteCell note={line.note} />}
              {!draft && <td className={`px-3 py-2 ${NUM}`}>{line.quantityForPutaway}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollShadowBox>
  );
}
