import {
  ORDER_DELIVERY_FAILURE_LABELS,
  ORDER_DELIVERY_FAILURE_REASONS,
  UI_LABELS,
} from "@/constants";
import { formatDateTime } from "@/lib/format/date";

import { Section } from "../primitives";

import type { Shipment } from "@/features/shipping/types";

const C = UI_LABELS.shipping.afterHandover.reasonCorrection;

/** Mã BE lạ → hiện nguyên mã, không đoán thành một lý do cụ thể. */
function reasonLabel(code: string): string {
  const known = ORDER_DELIVERY_FAILURE_REASONS.find((value) => value === code);
  return known ? ORDER_DELIVERY_FAILURE_LABELS[known] : code;
}

function withNote(code: string, note: string | null | undefined): string {
  return note ? `${reasonLabel(code)} — ${note}` : reasonLabel(code);
}

/**
 * Các lần quản lý kho sửa lý do giao thất bại (docs 09 edge "hoàn hàng khi còn Handed Over"): trước → sau, lý do sửa,
 * người sửa, lúc nào. Chưa sửa lần nào thì không hiện.
 */
export function FailureReasonCorrections({
  corrections,
}: {
  corrections: Shipment["reasonCorrections"];
}) {
  if (corrections.length === 0) return null;
  return (
    <Section title={C.historyTitle}>
      <ol className="space-y-2 text-[0.8125rem]">
        {corrections.map((c) => (
          <li key={`${c.correctedAt}-${c.toReason}`} className="space-y-0.5">
            <p className="text-ink-primary">
              {C.from}: {withNote(c.fromReason, c.fromNote)} → {C.to}:{" "}
              {withNote(c.toReason, c.toNote)}
            </p>
            <p className="text-ink-secondary">
              {C.why}: {c.reason}
            </p>
            <p className="text-ink-tertiary tabular-nums">
              {formatDateTime(c.correctedAt)}
              {c.correctedByName ? ` · ${C.by}: ${c.correctedByName}` : ""}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
