"use client";

import { Notice } from "@/components/shared/Notice";

import { SKIP_REASON_LABELS } from "../errors";

import type { TransferResult } from "../types";

/** Kết quả một lô (BR-S09): số khách đã chuyển, khách bị bỏ qua kèm lý do. `names`: tên khách đã biết theo id. */
export function TransferResultView({
  result,
  names,
}: {
  result: TransferResult;
  names?: ReadonlyMap<string, string>;
}) {
  return (
    <div className="space-y-2">
      <Notice tone={result.moved > 0 ? "positive" : "info"} live>
        Đã chuyển {result.moved} khách.
        {result.skipped.length > 0 && ` Bỏ qua ${result.skipped.length} khách.`}
      </Notice>
      {result.skipped.length > 0 && (
        <ul aria-label="Khách bị bỏ qua" className="text-ink-secondary space-y-1 text-[0.8125rem]">
          {result.skipped.map((item) => (
            <li key={item.customerId}>
              <span className="text-ink-primary font-medium">
                {names?.get(item.customerId) ?? item.customerId}
              </span>
              {" — "}
              {item.reason ? (SKIP_REASON_LABELS[item.reason] ?? item.reason) : "Không rõ lý do"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
