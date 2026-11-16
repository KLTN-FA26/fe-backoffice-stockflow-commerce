"use client";

import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { Checkbox } from "@/components/ui/checkbox";

import { MONO } from "../primitives";

import type { WaybillImportLine } from "@/features/shipping/types";

const I = UI_LABELS.shipping.waybill.import;
const TH = "px-3 py-2 text-left font-medium whitespace-nowrap";

/** Lý do một dòng không áp dụng được; mã vận đơn trùng thì nêu chuyến đang giữ mã (BR-23). */
function problemText(line: WaybillImportLine): string | null {
  if (!line.problem) return null;
  const text = I.problem[line.problem];
  return line.problem === "DUPLICATE_IN_CARRIER" && line.holderCode
    ? `${text} (${I.heldBy} ${line.holderCode})`
    : text;
}

/**
 * Bảng từng dòng của file nhập mã vận đơn (docs 09 §4.4 bước 2–3): dòng hợp lệ (mới / không đổi / sẽ ghi đè mã cũ) và dòng
 * lỗi kèm lý do. `onToggleOverwrite` có thì dòng "sẽ ghi đè" hiện ô tick xác nhận ghi đè (BR-25) — chỉ dòng được tick mới áp.
 */
export function WaybillImportTable({
  lines,
  overwrite,
  onToggleOverwrite,
}: {
  lines: readonly WaybillImportLine[];
  overwrite?: ReadonlySet<number>;
  onToggleOverwrite?: (line: number) => void;
}) {
  const selectable = !!onToggleOverwrite;
  return (
    <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
      <table className="w-full text-[0.8125rem]">
        <caption className="sr-only">{I.previewTitle}</caption>
        <thead className="bg-bg-subtle text-ink-secondary">
          <tr>
            <th scope="col" className={TH}>
              {I.line}
            </th>
            <th scope="col" className={TH}>
              {I.loadCode}
            </th>
            <th scope="col" className={TH}>
              {I.waybillNo}
            </th>
            <th scope="col" className={TH}>
              {I.plate}
            </th>
            <th scope="col" className={TH}>
              {I.driver}
            </th>
            <th scope="col" className={TH}>
              {I.outcomeHeader}
            </th>
            {selectable && (
              <th scope="col" className={TH}>
                {I.overwriteHeader}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const problem = problemText(line);
            const isError = line.outcome === "ERROR";
            return (
              <tr key={line.line} className="border-border-default border-t align-top">
                <td className={`text-ink-secondary px-3 py-2 ${MONO}`}>{line.line}</td>
                <td className={`text-ink-primary px-3 py-2 ${MONO}`}>
                  {line.loadId ? (
                    <Link
                      href={ADMIN_ROUTES.loads.detail(line.loadId)}
                      className="text-accent hover:underline"
                    >
                      {line.loadCode ?? line.loadId}
                    </Link>
                  ) : (
                    (line.loadCode ?? "—")
                  )}
                </td>
                <td className={`text-ink-primary px-3 py-2 ${MONO}`}>{line.waybillNo ?? "—"}</td>
                <td className={`text-ink-secondary px-3 py-2 ${MONO}`}>
                  {line.vehiclePlate ?? "—"}
                </td>
                <td className="text-ink-secondary px-3 py-2">
                  {[line.driverName, line.driverPhone].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      isError
                        ? "text-danger font-medium"
                        : line.outcome === "OVERWRITE"
                          ? "text-warning font-medium"
                          : "text-positive font-medium"
                    }
                  >
                    {I.outcome[line.outcome]}
                  </span>
                  {problem && <div className="text-danger mt-0.5 text-xs">{problem}</div>}
                </td>
                {selectable && (
                  <td className="px-3 py-2">
                    {line.outcome === "OVERWRITE" && (
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={overwrite?.has(line.line) ?? false}
                          onCheckedChange={() => onToggleOverwrite(line.line)}
                          aria-label={`${I.overwriteConfirm} ${I.line.toLowerCase()} ${line.line}`}
                        />
                        <span className="text-ink-secondary text-xs">{I.overwriteConfirm}</span>
                      </label>
                    )}
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
