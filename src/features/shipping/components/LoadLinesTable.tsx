import { cn } from "cn";

import { UI_LABELS } from "@/constants";
import { formatTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";

import { MONO, NUM } from "./primitives";

import type { LoadLine } from "@/features/shipping/types";

const T = UI_LABELS.shipping.table;

interface LoadLinesTableProps {
  caption: string;
  lines: readonly LoadLine[];
  emptyText: string;
  /** Hiện cột giờ quét (kiện đã lên xe). */
  showLoadedAt?: boolean;
  /** Hiện cột tick đối soát (biên bản bàn giao). */
  showCheck?: boolean;
  highlightMissing?: boolean;
}

/** Bảng kiện của chuyến — dùng cho màn quét (đã lên / chưa lên) và biên bản bàn giao. */
export function LoadLinesTable({
  caption,
  lines,
  emptyText,
  showLoadedAt = false,
  showCheck = false,
  highlightMissing = false,
}: LoadLinesTableProps) {
  // Căn phải theo cờ `numeric` của cột, không so chữ tiêu đề
  const columns = [
    ...(showCheck ? [{ key: "index", label: T.index, numeric: false, fit: true }] : []),
    { key: "code", label: T.packageCode, numeric: false, fit: false },
    { key: "order", label: T.order, numeric: false, fit: false },
    { key: "weight", label: T.weight, numeric: true, fit: false },
    ...(showLoadedAt || showCheck
      ? [{ key: "loadedAt", label: T.loadedAt, numeric: false, fit: false }]
      : []),
  ];
  return (
    <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border print:overflow-visible">
      <table className="w-full text-[0.8125rem]">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-bg-subtle text-ink-secondary">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-3 py-2 font-medium whitespace-nowrap",
                  column.numeric ? "text-right" : "text-left",
                  column.fit && "w-px",
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="text-ink-tertiary px-3 py-4 text-center">
                {emptyText}
              </td>
            </tr>
          )}
          {lines.map((line, index) => {
            const missing = !line.loadedAt;
            return (
              <tr
                key={line.loadLineId}
                className={cn(
                  "border-border-default border-t",
                  // data-table-mode-a: dòng cần chú ý → viền trái 2px tone warning
                  highlightMissing && missing && "border-l-warning border-l-2",
                )}
              >
                {showCheck && (
                  <td className={`text-ink-tertiary w-px px-3 py-2 ${MONO}`}>{index + 1}</td>
                )}
                <td className={`text-ink-primary px-3 py-2 font-medium whitespace-nowrap ${MONO}`}>
                  {line.packageCode}
                </td>
                <td className={`text-ink-secondary px-3 py-2 whitespace-nowrap ${MONO}`}>
                  {line.orderNumber ?? line.orderId}
                </td>
                <td className={`text-ink-primary px-3 py-2 ${NUM}`}>
                  {line.weightKg == null ? "—" : formatNumber(line.weightKg)}
                </td>
                {(showLoadedAt || showCheck) && (
                  <td
                    className={cn(
                      "px-3 py-2 whitespace-nowrap tabular-nums",
                      missing ? "text-warning" : "text-ink-secondary",
                    )}
                  >
                    {line.loadedAt ? formatTime(line.loadedAt) : UI_LABELS.shipping.empty.notLoaded}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
