"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/shared/StatusDot";
import { formatVND, type Order, type OrderEvent } from "@/lib/mock-data";

interface OrderDetailPanelProps {
  order: Order | null;
  events: OrderEvent[];
  open: boolean;
  onClose: () => void;
}

export function OrderDetailPanel({ order, events, open, onClose }: OrderDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && order && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[900] bg-black/20 backdrop-blur-xs"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            ref={panelRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="border-border-default bg-bg-surface fixed top-0 right-0 z-[1100] flex h-full w-full max-w-lg flex-col border-l shadow-[var(--sh-lg)]"
          >
            {/* Header */}
            <div className="border-border-default flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-ink-primary font-[family-name:var(--font-mono)] text-sm font-semibold">
                  {order.orderNumber}
                </h2>
                <p className="text-ink-secondary mt-0.5 text-xs">{order.recipientName}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot domain="order" status={order.status} size="sm" withIcon />
                <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Đóng">
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
              {/* Info KV */}
              <section>
                <h3 className="text-ink-tertiary mb-2 text-xs font-semibold tracking-wide uppercase">
                  Thông tin
                </h3>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[0.8125rem]">
                  <dt className="text-ink-secondary">Ngày đặt</dt>
                  <dd className="text-ink-primary tabular-nums">
                    {new Date(order.placedAt).toLocaleDateString("vi-VN")}
                  </dd>
                  <dt className="text-ink-secondary">Thanh toán</dt>
                  <dd className="text-ink-primary">{order.paymentMethodType}</dd>
                  <dt className="text-ink-secondary">Kho xử lý</dt>
                  <dd className="text-ink-primary font-mono">{order.fulfillmentWarehouseId}</dd>
                  <dt className="text-ink-secondary">Địa chỉ giao</dt>
                  <dd className="text-ink-primary">
                    {order.shippingAddress.street}, {order.shippingAddress.ward},{" "}
                    {order.shippingAddress.district}, {order.shippingAddress.province}
                  </dd>
                </dl>
              </section>

              {/* Lines */}
              <section>
                <h3 className="text-ink-tertiary mb-2 text-xs font-semibold tracking-wide uppercase">
                  Dòng hàng ({order.lines.length})
                </h3>
                <div className="space-y-3">
                  {order.lines.map((line) => (
                    <div
                      key={line.lineId}
                      className="border-border-default flex gap-3 rounded-[var(--r-sm)] border p-3"
                    >
                      <div className="bg-bg-subtle text-ink-tertiary flex size-10 shrink-0 items-center justify-center rounded-[var(--r-sm)] text-lg">
                        📦
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-ink-primary truncate text-[0.875rem] font-semibold">
                          {line.productName}
                        </div>
                        <div className="text-ink-tertiary truncate text-xs">
                          {line.variantLabel}
                        </div>
                        <div className="text-ink-secondary mt-1 flex items-center gap-3 text-xs">
                          <span className="tabular-nums">×{line.quantity}</span>
                          <span className="font-mono tabular-nums">
                            {formatVND(line.unitPrice)}
                          </span>
                          <span className="text-ink-primary ml-auto font-mono font-medium tabular-nums">
                            {formatVND(line.lineTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Financials */}
              <section>
                <h3 className="text-ink-tertiary mb-2 text-xs font-semibold tracking-wide uppercase">
                  Tài chính
                </h3>
                <div className="flex flex-col gap-2 text-[0.875rem]">
                  <Row label="Tạm tính" value={formatVND(order.subtotal)} />
                  <Row label="Phí vận chuyển" value={formatVND(order.shippingFee)} />
                  <Row label="Thuế VAT" value={formatVND(order.taxTotal)} />
                  {order.discountTotal > 0 && (
                    <Row
                      label="Giảm giá"
                      value={`−${formatVND(order.discountTotal)}`}
                      valueClass="text-positive"
                    />
                  )}
                  <div className="border-border-default border-t pt-2.5">
                    <Row label="Tổng thanh toán" value={formatVND(order.grandTotal)} bold />
                  </div>
                </div>
              </section>

              {/* Timeline */}
              {events.length > 0 && (
                <section>
                  <h3 className="text-ink-tertiary mb-2 text-xs font-semibold tracking-wide uppercase">
                    Lịch sử sự kiện
                  </h3>
                  <div className="relative pl-6">
                    {/* Vertical line: left 6px, w 2px → center 7px */}
                    <div className="bg-border-default absolute top-1 bottom-1 left-[6px] w-0.5" />
                    {events.map((ev, i) => (
                      <div key={ev.eventId} className={cn("relative pb-4 last:pb-0")}>
                        {/* Dot: 11px, center at 7px → left from child = -(24-1.5) = -22.5px */}
                        <div
                          className={cn(
                            "border-bg-surface absolute top-[4px] -left-[22.5px] size-[11px] rounded-full border-2",
                            i === events.length - 1
                              ? "bg-info shadow-[0_0_0_3px_color-mix(in_srgb,var(--info)_18%,transparent)]"
                              : "bg-border-strong",
                          )}
                        />
                        <div className="text-ink-primary text-[0.875rem] font-semibold">
                          {ev.description}
                        </div>
                        <div className="text-ink-tertiary text-xs tabular-nums">
                          {new Date(ev.createdAt).toLocaleString("vi-VN")} · {ev.actor}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {order.notes && (
                <section className="border-border-default bg-bg-subtle text-ink-secondary rounded-[var(--r-sm)] border p-3 text-xs">
                  <strong className="text-ink-primary">Ghi chú:</strong> {order.notes}
                </section>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                  */
/* -------------------------------------------------------------------------- */

function Row({
  label,
  value,
  bold,
  valueClass,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className={cn(bold && "text-ink-primary font-bold", !bold && "text-ink-secondary")}>
        {label}
      </span>
      <span
        className={cn(
          "font-mono tabular-nums",
          bold &&
            "text-ink-primary font-[family-name:var(--font-display)] text-[1.25rem] font-bold",
          valueClass,
        )}
      >
        {value}
      </span>
    </div>
  );
}
