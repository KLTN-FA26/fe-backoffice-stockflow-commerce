"use client";

import { X } from "lucide-react";

import { PRODUCTION_ORDER_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { DatePicker } from "@/components/shared/DatePicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { ProductionOrderCombobox } from "../create/ProductionOrderCombobox";

import type { ReceiptListState } from "./useReceiptListState";

const DATE_INPUT =
  "border-border-default bg-bg-surface h-8 w-[9.5rem] rounded-[var(--r-sm)] text-[0.8125rem] tabular-nums";

/**
 * Lọc theo ngày nhận và Đơn sản xuất — BE `GET /goods-receipts?receivedFrom&receivedTo&productionOrderId`.
 * ListToolbar không có ô ngày nên đặt thành một hàng compact ngay dưới.
 */
export function ReceiptListFilters({ s }: { s: ReceiptListState }) {
  // Ô chọn Đơn sản xuất (cùng ô với hộp Lập phiếu, S12-1) — cần xem được Đơn sản xuất. UI-only, BE re-check.
  const canPickOrder = useCan(PRODUCTION_ORDER_PERMISSIONS.read);
  return (
    <div className="border-border-default bg-bg-subtle mb-3 flex flex-wrap items-center gap-3 rounded-[var(--r-sm)] border px-3 py-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="receipt-from" className="text-ink-secondary text-[0.8125rem]">
          Ngày nhận từ
        </Label>
        <DatePicker
          quickKind="past"
          id="receipt-from"
          value={s.receivedFrom}
          max={s.receivedTo || undefined}
          clearable
          onChange={s.setFrom}
          className={DATE_INPUT}
        />
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="receipt-to" className="text-ink-secondary text-[0.8125rem]">
          đến
        </Label>
        <DatePicker
          quickKind="past"
          id="receipt-to"
          value={s.receivedTo}
          min={s.receivedFrom || undefined}
          clearable
          onChange={s.setTo}
          className={DATE_INPUT}
        />
      </div>
      {s.receivedFrom && s.receivedTo && s.receivedFrom > s.receivedTo && (
        <p role="alert" className="text-warning text-xs">
          {UI_LABELS.receipt.dateRangeInvalid}
        </p>
      )}
      {canPickOrder && (
        <div className="flex items-center gap-2">
          <Label htmlFor="receipt-production-order" className="text-ink-secondary text-[0.8125rem]">
            {UI_LABELS.receipt.field.productionOrder}
          </Label>
          <div className="w-60">
            <ProductionOrderCombobox
              id="receipt-production-order"
              value={s.productionOrder}
              onChange={s.setProductionOrder}
              autoFocus={false}
            />
          </div>
        </div>
      )}
      {s.productionOrder && (
        <Badge variant="outline" className="gap-1 rounded-[var(--r-sm)] font-normal">
          {UI_LABELS.receipt.field.productionOrder}:{" "}
          <span className="font-[family-name:var(--font-mono)]" title={s.productionOrder}>
            {s.productionOrderLabel}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => s.setProductionOrder("")}
            aria-label="Bỏ lọc Đơn sản xuất"
          >
            <X className="size-3" />
          </Button>
        </Badge>
      )}
    </div>
  );
}
