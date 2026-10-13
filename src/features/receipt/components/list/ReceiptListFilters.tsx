"use client";

import { X } from "lucide-react";

import { UI_LABELS } from "@/constants";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { ReceiptListState } from "./useReceiptListState";

const DATE_INPUT =
  "border-border-default bg-bg-surface h-8 w-[9.5rem] rounded-[var(--r-sm)] text-[0.8125rem] tabular-nums";

/**
 * Lọc theo ngày nhận và PO — BE `GET /goods-receipts?receivedFrom&receivedTo&purchaseOrderId`.
 * ListToolbar không có ô ngày nên đặt thành một hàng compact ngay dưới.
 */
export function ReceiptListFilters({
  s,
  poNumber,
}: {
  s: ReceiptListState;
  poNumber: string | undefined;
}) {
  return (
    <div className="border-border-default bg-bg-subtle mb-3 flex flex-wrap items-center gap-3 rounded-[var(--r-sm)] border px-3 py-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="receipt-from" className="text-ink-secondary text-[0.8125rem]">
          Ngày nhận từ
        </Label>
        <Input
          id="receipt-from"
          type="date"
          value={s.receivedFrom}
          max={s.receivedTo || undefined}
          onChange={(event) => s.setFrom(event.target.value)}
          className={DATE_INPUT}
        />
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="receipt-to" className="text-ink-secondary text-[0.8125rem]">
          đến
        </Label>
        <Input
          id="receipt-to"
          type="date"
          value={s.receivedTo}
          min={s.receivedFrom || undefined}
          onChange={(event) => s.setTo(event.target.value)}
          className={DATE_INPUT}
        />
      </div>
      {s.receivedFrom && s.receivedTo && s.receivedFrom > s.receivedTo && (
        <p role="alert" className="text-warning text-xs">
          {UI_LABELS.receipt.dateRangeInvalid}
        </p>
      )}
      {s.po && (
        <Badge variant="outline" className="gap-1 rounded-[var(--r-sm)] font-normal">
          Đơn đặt hàng:{" "}
          <span className="font-[family-name:var(--font-mono)]">{poNumber ?? s.po}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => s.setPo("")}
            aria-label="Bỏ lọc đơn đặt hàng"
          >
            <X className="size-3" />
          </Button>
        </Badge>
      )}
    </div>
  );
}
