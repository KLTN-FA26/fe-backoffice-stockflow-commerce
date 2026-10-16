import { cn } from "cn";

import { UI_LABELS } from "@/constants";

import { isTransferDispatched } from "@/features/transfer/lifecycle";
import { shortQuantity } from "@/features/transfer/selectors";

import { MONO, NUM } from "../primitives";

import type { TransferOrder } from "@/features/transfer/types";

/**
 * Dòng hàng của lệnh (`TransferOrderResponse.lines`). Sau khi xuất kho hiện thêm SL đã xuất và phần
 * thiếu — BE cho xuất 0..SL yêu cầu mỗi dòng (TransferOrderServiceImpl#dispatch).
 */
export function TransferLinesTable({ transfer }: { transfer: TransferOrder }) {
  const dispatched = isTransferDispatched(transfer.status);
  // Căn phải theo cờ `numeric` của cột, không so chữ tiêu đề
  const columns = [
    { key: "lineNo", label: "#", numeric: false },
    { key: "sku", label: UI_LABELS.transfer.field.sku, numeric: false },
    { key: "lot", label: UI_LABELS.transfer.field.lot, numeric: false },
    { key: "requested", label: UI_LABELS.transfer.column.requested, numeric: true },
    ...(dispatched
      ? [
          { key: "shipped", label: UI_LABELS.transfer.column.shipped, numeric: true },
          { key: "short", label: UI_LABELS.transfer.column.short, numeric: true },
        ]
      : []),
  ];

  return (
    <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
      <table className="w-full min-w-max text-[0.8125rem]">
        <caption className="sr-only">
          {UI_LABELS.transfer.linesCaption} {transfer.number}
        </caption>
        <thead className="bg-bg-subtle text-ink-secondary">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-3 py-2 font-medium whitespace-nowrap",
                  column.numeric ? "text-right" : "text-left",
                  column.key === "lineNo" && "w-px",
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transfer.lines.map((line) => {
            const short = shortQuantity(line);
            return (
              <tr key={line.lineId} className="border-border-default border-t">
                <td className={`text-ink-tertiary w-px px-3 py-2 ${MONO}`}>{line.lineNo}</td>
                <td className={`text-ink-primary px-3 py-2 ${MONO}`}>{line.sku}</td>
                <td className={`text-ink-secondary px-3 py-2 ${MONO}`}>{line.lotNumber ?? "—"}</td>
                <td className={`text-ink-primary px-3 py-2 font-medium ${NUM}`}>
                  {line.requested}
                </td>
                {dispatched && (
                  <>
                    <td className={`text-ink-primary px-3 py-2 ${NUM}`}>{line.shipped}</td>
                    <td
                      className={cn(
                        "px-3 py-2",
                        NUM,
                        short > 0 ? "text-warning" : "text-ink-tertiary",
                      )}
                    >
                      {short > 0 ? short : "—"}
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
