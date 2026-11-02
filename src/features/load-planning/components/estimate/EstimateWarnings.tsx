import { LOAD_ESTIMATE_LABELS } from "@/constants";

import { warningText } from "../../lib/estimate-view";

import type { EstimateWarning, KitWarning } from "../../estimate-types";

/**
 * Cảnh báo của lần ước tính: đơn vị đóng gói thiếu dữ liệu đã bị bỏ qua (từng dòng đơn) và các bộ không giữ nguyên
 * được. BE gửi câu tiếng Anh nên màn dịch theo MÃ; mã lạ hiện chính mã.
 */
export function EstimateWarnings({
  warnings,
  kitWarnings,
}: {
  warnings: readonly EstimateWarning[];
  kitWarnings: readonly KitWarning[];
}) {
  const L = LOAD_ESTIMATE_LABELS.warnings;
  if (warnings.length === 0 && kitWarnings.length === 0) return null;
  return (
    <section aria-label={L.title} className="border-border-default rounded border p-3">
      <h3 className="text-ink-primary text-sm font-medium">{L.title}</h3>
      <ul className="text-ink-secondary mt-2 list-disc space-y-1 pl-5 text-[0.8125rem]">
        {warnings.map((warning, index) => (
          <li key={`w-${warning.orderLineId ?? ""}-${warning.code}-${index}`}>
            {warning.sku && (
              <span className="text-ink-primary mr-1 font-[family-name:var(--font-mono)] text-xs">
                {warning.sku}
              </span>
            )}
            {warningText(warning)}
          </li>
        ))}
        {kitWarnings.map((warning, index) => (
          <li key={`k-${warning.kitName ?? ""}-${warning.type}-${index}`}>
            {warning.kitName && (
              <span className="text-ink-primary mr-1 text-xs">{warning.kitName}:</span>
            )}
            {warningText(warning)}
          </li>
        ))}
      </ul>
    </section>
  );
}
