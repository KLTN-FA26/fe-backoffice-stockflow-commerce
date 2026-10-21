import { Box, Package } from "lucide-react";

import { formatMoney } from "@/lib/format";

import type { Order, OrderLine } from "../types";

type Currency = Order["currency"];

interface OrderLinesProps {
  lines: readonly OrderLine[];
  currency: Currency;
  /** Đơn đã có lô giao (BE `shipments` không rỗng). */
  hasShipments: boolean;
}

/**
 * Tiến độ giao từng dòng (BE PR #133). BE luôn gửi ba số (0 khi chưa có lô) nên chỉ hiện khi đơn đã có lô
 * giao hoặc đã đóng bớt đơn vị. `shippedQuantity` = mọi đơn vị đã bàn giao và chưa trả về (gồm cả đã giao),
 * nên "Đang giao" = đã bàn giao − đã giao.
 */
function LineProgress({ line, hasShipments }: { line: OrderLine; hasShipments: boolean }) {
  const closed = line.cancelledQuantity ?? 0;
  if (!hasShipments && closed === 0) return null;
  const handedOver = line.shippedQuantity ?? 0;
  const delivered = line.deliveredQuantity ?? 0;
  const parts = [
    hasShipments && { label: "Đã bàn giao", value: handedOver },
    hasShipments && { label: "Đã giao", value: delivered },
    closed > 0 && { label: "Không giao (đã đóng)", value: closed },
  ].filter((part): part is { label: string; value: number } => part !== false);
  return (
    <div className="text-ink-secondary mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
      {parts.map((part) => (
        <span key={part.label}>
          {part.label}: <span className="text-ink-primary tabular-nums">{part.value}</span>
        </span>
      ))}
    </div>
  );
}

export function OrderLines({ lines, currency, hasShipments }: OrderLinesProps) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Package className="text-accent size-4" />
        Dòng hàng ({lines.length})
      </h2>
      <div className="space-y-3">
        {lines.map((line) => (
          <div
            key={line.lineId}
            className="border-border-default flex gap-3 rounded-[var(--r-sm)] border p-3"
          >
            {/* BE OrderResponse.Line không có ảnh sản phẩm — icon giữ chỗ, chỉ trang trí */}
            <div className="bg-bg-subtle text-ink-tertiary flex size-10 shrink-0 items-center justify-center rounded-[var(--r-sm)]">
              <Box className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-ink-primary truncate font-[family-name:var(--font-mono)] text-[0.875rem] font-semibold">
                {line.sku}
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
              <LineProgress line={line} hasShipments={hasShipments} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
