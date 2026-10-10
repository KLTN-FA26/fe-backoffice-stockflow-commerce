"use client";

import { UI_LABELS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { formatDate } from "@/lib/format/date";
import { allowedLineActions } from "@/features/receipt/lifecycle";
import { Button } from "@/components/ui/button";

import { NUM } from "../primitives";
import { LineLocationCell } from "./LineLocationCell";
import { LineNoteCell } from "./LineNoteCell";
import { LineQualityCell } from "./LineQualityCell";

import type { ReceiptLineActionCode } from "@/features/receipt/lifecycle";
import type { GoodsReceipt, ReceiptLineDto } from "@/features/receipt/types";

const FLOW = UI_LABELS.receipt.flow;

/**
 * Dòng nhận theo dữ liệu BE (`GoodsReceiptResponse.lines`).
 * - Phiếu nháp: kết quả kiểm đếm đã lưu — vị trí nhận + luồng 2/3 bước BE chốt theo cờ SKU.
 * - Đã xác nhận: thêm chất lượng, SL chờ cất và thao tác QC theo `allowedLineActions`.
 */
export function ReceiptLinesTable({
  receipt,
  draft = false,
  onLineAction,
}: {
  receipt: GoodsReceipt;
  draft?: boolean;
  onLineAction?: (code: ReceiptLineActionCode, line: ReceiptLineDto) => void;
}) {
  const can = usePermissionChecker();
  const headers = draft
    ? ["Dòng PO", "SKU", "SL", "Lô / Hạn dùng", "Vị trí nhận", "Luồng", "Ghi chú"]
    : [
        "Dòng PO",
        "SKU",
        "SL",
        "Lô / Hạn dùng",
        "Vị trí",
        "Luồng",
        "Ghi chú",
        "Chất lượng",
        "Chờ cất",
        "",
      ];
  const rightAligned = new Set(["SL", "Chờ cất"]);
  // Cột "Dòng PO" chỉ là số thứ tự → co vừa nội dung (w-px), phần dư dồn cho các cột khác
  const fit = (h: string) => (h === "Dòng PO" ? "w-px" : "");

  return (
    // Bảng nhiều cột trong cột trái (cạnh sidebar 320px) → không ép co cột, cho cuộn ngang
    <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
      <table className="w-full min-w-max text-[0.8125rem]">
        <caption className="sr-only">Dòng nhận của phiếu {receipt.number}</caption>
        <thead className="bg-bg-subtle text-ink-secondary">
          <tr>
            {headers.map((h, i) => (
              <th
                key={h || i}
                scope="col"
                className={`px-3 py-2 font-medium whitespace-nowrap ${fit(h)} ${rightAligned.has(h) ? "text-right" : "text-left"}`}
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
          {receipt.lines.map((line) => {
            const actions = draft ? [] : allowedLineActions(receipt.status, line, can);
            return (
              <tr key={line.id} className="border-border-default border-t align-top">
                <td className="text-ink-tertiary w-px px-3 py-2 font-[family-name:var(--font-mono)] tabular-nums">
                  {line.purchaseOrderLineNo ?? "—"}
                </td>
                <td className="px-3 py-2 font-[family-name:var(--font-mono)]">{line.sku ?? "—"}</td>
                <td className={`text-ink-primary px-3 py-2 font-medium ${NUM}`}>{line.quantity}</td>
                <td className="px-3 py-2">
                  <div className="font-[family-name:var(--font-mono)]">{line.lotNumber ?? "—"}</div>
                  <div className="text-ink-tertiary text-xs tabular-nums">
                    {line.expiryDate ? formatDate(line.expiryDate) : ""}
                  </div>
                </td>
                <LineLocationCell line={line} draft={draft} />
                <td className="text-ink-secondary px-3 py-2 whitespace-nowrap">
                  {line.qcRequired ? FLOW.threeStep : FLOW.twoStep}
                </td>
                <LineNoteCell note={line.note} />
                {!draft && (
                  <>
                    <td className="px-3 py-2">
                      <LineQualityCell line={line} />
                    </td>
                    <td className={`px-3 py-2 ${NUM}`}>{line.quantityForPutaway}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {actions.map((action) => (
                        <Button
                          key={action.code}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onLineAction?.(action.code, line)}
                          className="rounded-[var(--r-sm)]"
                        >
                          {action.label}
                        </Button>
                      ))}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
