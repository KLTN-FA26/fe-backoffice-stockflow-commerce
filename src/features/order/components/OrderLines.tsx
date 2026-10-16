import { Box, Package, Palette } from "lucide-react";

import { formatMoney } from "@/lib/format";

import type { ReactNode } from "react";
import type { Order, OrderLine } from "../types";

type Currency = Order["currency"];

interface OrderLinesProps {
  lines: readonly OrderLine[];
  currency: Currency;
  /** Vùng hiển thị thêm dưới dòng in (lệnh sản xuất — B4). */
  renderCustomLineExtra?: (line: OrderLine) => ReactNode;
}

const BADGE =
  "inline-flex items-center gap-1 rounded-[var(--r-sm)] border px-1.5 py-0.5 text-[0.6875rem] font-medium";
// Dòng in = sản xuất → tone special (design-tokens: special = sản xuất/in)
const CUSTOM_BADGE = `${BADGE} text-special border-[color-mix(in_srgb,var(--special)_26%,transparent)] bg-[color-mix(in_srgb,var(--special)_10%,transparent)]`;
const STANDARD_BADGE = `${BADGE} text-ink-secondary border-border-default bg-bg-subtle`;

/** "Hàng in theo thiết kế" vs "Hàng sẵn" — docs 14 BR-02 (dòng in mang design snapshot). */
function LineKindBadge({ line }: { line: OrderLine }) {
  return line.isCustom ? (
    <span className={CUSTOM_BADGE}>
      <Palette className="size-3" aria-hidden="true" /> Hàng in theo thiết kế
    </span>
  ) : (
    <span className={STANDARD_BADGE}>Hàng sẵn</span>
  );
}

/** Phiếu giữ hàng — BE chỉ trả mã (`reservationIds`), chưa có API xem chi tiết reservation. */
function Reservations({ ids }: { ids: readonly string[] }) {
  if (ids.length === 0) {
    return <span className="text-ink-tertiary">Chưa giữ hàng</span>;
  }
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      <span className="text-ink-secondary">Giữ hàng ({ids.length}):</span>
      {ids.map((id) => (
        <span
          key={id}
          title={id}
          className="text-ink-secondary bg-bg-subtle max-w-40 truncate rounded-[var(--r-sm)] px-1 font-[family-name:var(--font-mono)]"
        >
          {id}
        </span>
      ))}
    </span>
  );
}

export function OrderLines({ lines, currency, renderCustomLineExtra }: OrderLinesProps) {
  const customCount = lines.filter((line) => line.isCustom).length;
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Package className="text-accent size-4" />
        Dòng hàng ({lines.length})
        {customCount > 0 && (
          <span className="text-ink-tertiary text-xs font-normal">
            · {customCount} dòng in, {lines.length - customCount} dòng hàng sẵn
          </span>
        )}
      </h2>
      <ul className="space-y-3">
        {lines.map((line) => (
          <li
            key={line.lineId}
            aria-label={`Dòng ${line.sku}`}
            className="border-border-default rounded-[var(--r-sm)] border p-3"
          >
            <div className="flex gap-3">
              {/* BE OrderResponse.Line không có ảnh sản phẩm — icon giữ chỗ, chỉ trang trí */}
              <div className="bg-bg-subtle text-ink-tertiary flex size-10 shrink-0 items-center justify-center rounded-[var(--r-sm)]">
                <Box className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ink-primary truncate font-[family-name:var(--font-mono)] text-[0.875rem] font-semibold">
                    {line.sku}
                  </span>
                  <LineKindBadge line={line} />
                </div>
                <div className="text-ink-secondary mt-1 flex items-center gap-3 text-xs">
                  <span className="tabular-nums">×{line.quantity}</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(line.unitPrice, currency)}
                  </span>
                  <span className="text-ink-primary ml-auto font-mono font-medium tabular-nums">
                    {formatMoney(line.lineTotal, currency)}
                  </span>
                </div>
                <div className="mt-1.5 text-xs">
                  <Reservations ids={line.reservationIds} />
                </div>
              </div>
            </div>
            {line.isCustom && renderCustomLineExtra?.(line)}
          </li>
        ))}
      </ul>
    </section>
  );
}
