"use client";

import {
  formatMoney,
  totalOpenQuantity,
  totalOrderedQuantity,
  totalReceivedQuantity,
} from "@/features/purchase-order";
import { cn } from "cn";
import type { PurchaseOrder } from "@/features/purchase-order";

export function PoOverview({ po }: { po: PurchaseOrder }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">Tổng quan</h2>
      <div className="space-y-2">
        <div className="flex justify-between text-[0.8125rem]">
          <span className="text-ink-secondary">Dòng hàng</span>
          <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium">
            {po.lines.length}
          </span>
        </div>
        <div className="flex justify-between text-[0.8125rem]">
          <span className="text-ink-secondary">Tổng SL đặt</span>
          <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium">
            {totalOrderedQuantity(po).toLocaleString("vi-VN")}
          </span>
        </div>
        <div className="flex justify-between text-[0.8125rem]">
          <span className="text-ink-secondary">Tổng SL đã nhận</span>
          <span className="text-positive font-[family-name:var(--font-mono)] font-medium">
            {totalReceivedQuantity(po).toLocaleString("vi-VN")}
          </span>
        </div>
        <div className="flex justify-between text-[0.8125rem]">
          <span className="text-ink-secondary">SL còn lại</span>
          <span
            className={cn(
              "font-[family-name:var(--font-mono)] font-medium",
              totalOpenQuantity(po) > 0 ? "text-warning" : "text-ink-primary",
            )}
          >
            {totalOpenQuantity(po).toLocaleString("vi-VN")}
          </span>
        </div>
        <div className="border-border-default border-t pt-2">
          <div className="flex justify-between text-[0.8125rem]">
            <span className="text-ink-secondary">Tiền tệ</span>
            <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium">
              {po.currency}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-[0.8125rem]">
            <span className="text-ink-primary font-medium">Tổng giá trị</span>
            <span className="text-ink-primary font-[family-name:var(--font-mono)] font-bold">
              {formatMoney(po.grandTotal, po.currency)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
