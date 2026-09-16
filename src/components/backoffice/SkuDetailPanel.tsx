"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Barcode, Weight, Package, RotateCcw, Layers } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/shared/StatusDot";
import { formatVND, type Sku, type SkuStatus } from "@/lib/mock-data";

/* -------------------------------------------------------------------------- */
/*  SKU status actions                                                        */
/* -------------------------------------------------------------------------- */

const SKU_STATUS_ACTIONS: Record<string, { label: string; next: SkuStatus; tone: string }[]> = {
  Active: [
    { label: "Khoá SKU", next: "Blocked", tone: "warning" },
    { label: "Ngừng sử dụng", next: "Obsolete", tone: "danger" },
  ],
  Blocked: [
    { label: "Mở khoá", next: "Active", tone: "positive" },
    { label: "Ngừng sử dụng", next: "Obsolete", tone: "danger" },
  ],
  Obsolete: [],
};

const ACTION_TONE_CLASSES: Record<string, string> = {
  positive: "bg-positive text-white hover:bg-positive/90",
  warning: "bg-warning text-white hover:bg-warning/90",
  danger: "border-danger text-danger hover:bg-danger/10 bg-transparent",
};

/* -------------------------------------------------------------------------- */
/*  Info row                                                                  */
/* -------------------------------------------------------------------------- */

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-ink-tertiary text-xs font-medium">{label}</span>
      <span className="text-ink-primary text-right text-[0.8125rem]">{children}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Props                                                                     */
/* -------------------------------------------------------------------------- */

interface SkuDetailPanelProps {
  sku: Sku | null;
  open: boolean;
  onClose: () => void;
  onStatusChange?: (skuId: string, newStatus: SkuStatus) => void;
}

/* -------------------------------------------------------------------------- */
/*  Panel                                                                     */
/* -------------------------------------------------------------------------- */

export function SkuDetailPanel({ sku, open, onClose, onStatusChange }: SkuDetailPanelProps) {
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

  const actions = sku ? (SKU_STATUS_ACTIONS[sku.status] ?? []) : [];

  return (
    <AnimatePresence>
      {open && sku && (
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
            className="border-border-default bg-bg-surface fixed top-0 right-0 z-[1100] flex h-full w-full max-w-md flex-col border-l shadow-[var(--sh-lg)]"
          >
            {/* Header */}
            <div className="border-border-default flex items-center justify-between border-b px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-accent font-[family-name:var(--font-mono)] text-sm font-semibold">
                  {sku.skuId}
                </h2>
                <p className="text-ink-secondary mt-0.5 truncate text-xs">{sku.variantLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot domain="sku" status={sku.status} size="sm" withIcon />
                <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Đóng">
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {/* Actions */}
              {actions.length > 0 && (
                <div className="border-border-default bg-bg-subtle flex flex-wrap gap-2 rounded-[var(--r-sm)] border p-3">
                  <span className="text-ink-tertiary self-center text-xs font-medium">
                    Hành động:
                  </span>
                  {actions.map((act) => (
                    <Button
                      key={act.next}
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => onStatusChange?.(sku.skuId, act.next)}
                      className={cn(
                        "rounded-[var(--r-sm)] text-xs font-medium",
                        ACTION_TONE_CLASSES[act.tone] ??
                          "border-border-default text-ink-secondary hover:bg-bg-muted",
                      )}
                    >
                      {act.label}
                    </Button>
                  ))}
                </div>
              )}

              {/* Biến thể */}
              <section>
                <h3 className="text-ink-secondary mb-2 text-xs font-semibold tracking-wide uppercase">
                  Tổ hợp biến thể
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(sku.attributes).map(([key, val]) => (
                    <span
                      key={key}
                      className="border-border-default bg-bg-subtle text-ink-secondary inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                    >
                      <span className="text-ink-tertiary">{key}:</span> {val}
                    </span>
                  ))}
                </div>
              </section>

              {/* Định danh */}
              <section>
                <h3 className="text-ink-secondary mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
                  <Barcode className="text-accent size-3.5" />
                  Định danh
                </h3>
                <div className="divide-border-default border-border-default bg-bg-subtle divide-y rounded-[var(--r-sm)] border px-3">
                  <InfoRow label="Mã SKU">
                    <span className="text-accent font-[family-name:var(--font-mono)] font-medium">
                      {sku.skuId}
                    </span>
                  </InfoRow>
                  <InfoRow label="Barcode">
                    <span className="font-[family-name:var(--font-mono)] tabular-nums">
                      {sku.barcode}
                    </span>
                  </InfoRow>
                  <InfoRow label="Đơn vị tính">{sku.uom}</InfoRow>
                </div>
              </section>

              {/* Giá */}
              <section>
                <h3 className="text-ink-secondary mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
                  <Layers className="text-accent size-3.5" />
                  Giá
                </h3>
                <div className="divide-border-default border-border-default bg-bg-subtle divide-y rounded-[var(--r-sm)] border px-3">
                  <InfoRow label="Giá vốn">
                    <span className="font-[family-name:var(--font-mono)] font-medium">
                      {formatVND(sku.cost)}
                    </span>
                  </InfoRow>
                </div>
              </section>

              {/* Thông số vật lý */}
              <section>
                <h3 className="text-ink-secondary mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
                  <Weight className="text-accent size-3.5" />
                  Thông số vật lý
                </h3>
                <div className="divide-border-default border-border-default bg-bg-subtle divide-y rounded-[var(--r-sm)] border px-3">
                  <InfoRow label="Trọng lượng">
                    <span className="font-[family-name:var(--font-mono)] tabular-nums">
                      {sku.weightKg} kg
                    </span>
                  </InfoRow>
                </div>
              </section>

              {/* Tồn kho */}
              <section>
                <h3 className="text-ink-secondary mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
                  <Package className="text-accent size-3.5" />
                  Tồn kho
                </h3>
                <div className="divide-border-default border-border-default bg-bg-subtle divide-y rounded-[var(--r-sm)] border px-3">
                  <InfoRow label="Tồn kho (on-hand)">
                    <span className="font-[family-name:var(--font-mono)] font-medium tabular-nums">
                      {sku.stockOnHand.toLocaleString("vi-VN")}
                    </span>
                  </InfoRow>
                  <InfoRow label="Đã đặt (reserved)">
                    <span className="text-warning font-[family-name:var(--font-mono)] tabular-nums">
                      {sku.stockReserved.toLocaleString("vi-VN")}
                    </span>
                  </InfoRow>
                  <InfoRow label="Khả dụng (available)">
                    <span
                      className={cn(
                        "font-[family-name:var(--font-mono)] font-medium tabular-nums",
                        sku.stockAvailable <= sku.reorderPoint ? "text-danger" : "text-positive",
                      )}
                    >
                      {sku.stockAvailable.toLocaleString("vi-VN")}
                    </span>
                  </InfoRow>
                  <InfoRow label="Điểm đặt lại (reorder)">
                    <span className="font-[family-name:var(--font-mono)] tabular-nums">
                      {sku.reorderPoint.toLocaleString("vi-VN")}
                    </span>
                  </InfoRow>
                  {sku.stockAvailable <= sku.reorderPoint && sku.reorderPoint > 0 && (
                    <div className="py-2">
                      <div className="bg-danger/10 text-danger rounded-[var(--r-sm)] px-2.5 py-1.5 text-xs font-medium">
                        Tồn kho dưới ngưỡng đặt lại — cần bổ sung
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Kiểm soát tồn kho */}
              <section>
                <h3 className="text-ink-secondary mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
                  <RotateCcw className="text-accent size-3.5" />
                  Kiểm soát tồn kho
                </h3>
                <div className="divide-border-default border-border-default bg-bg-subtle divide-y rounded-[var(--r-sm)] border px-3">
                  <InfoRow label="Theo dõi lô (Lot)">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        sku.lotTracking ? "text-positive" : "text-ink-tertiary",
                      )}
                    >
                      {sku.lotTracking ? "Có" : "Không"}
                    </span>
                  </InfoRow>
                  <InfoRow label="Theo dõi serial">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        sku.serialTracking ? "text-positive" : "text-ink-tertiary",
                      )}
                    >
                      {sku.serialTracking ? "Có" : "Không"}
                    </span>
                  </InfoRow>
                  <InfoRow label="Theo dõi hạn dùng">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        sku.expiryTracking ? "text-positive" : "text-ink-tertiary",
                      )}
                    >
                      {sku.expiryTracking ? "Có" : "Không"}
                    </span>
                  </InfoRow>
                </div>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
