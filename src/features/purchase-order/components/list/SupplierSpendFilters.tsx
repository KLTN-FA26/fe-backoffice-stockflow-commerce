"use client";

import { useState } from "react";

import { Card } from "@/components/shared/Card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { SpendCurrencyPicker } from "./SpendCurrencyPicker";

const FIELD_CLASS = "bg-bg-surface h-8 rounded-[var(--r-sm)] text-[0.8125rem]";

export interface SpendRange {
  from: string;
  to: string;
}

/** Bộ lọc tab Chi tiêu NCC: một tiền tệ (BE #40) + khoảng ngày giao dự kiến. */
export function SupplierSpendFilters({
  currency,
  range,
  onCurrencyChange,
  onApplyRange,
}: {
  currency: string;
  /** Khoảng đang áp dụng (từ URL) — nháp trong ô nhập chỉ áp khi bấm "Lọc". */
  range: SpendRange;
  onCurrencyChange: (currency: string) => void;
  onApplyRange: (range: SpendRange) => void;
}) {
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  // "Từ" sau "Đến" → BE trả rỗng, không báo gì; chặn ở FE cho người dùng thấy lý do.
  const rangeInvalid = from !== "" && to !== "" && from > to;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-ink-primary text-sm font-semibold">Chi tiêu theo nhà cung cấp</h3>
          <p className="text-ink-secondary mt-1 text-xs">
            Tổng tiền đơn đã duyệt trở đi (bỏ Nháp / Đã huỷ), xếp giảm dần — theo từng tiền tệ.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <SpendCurrencyPicker currency={currency} onChange={onCurrencyChange} />
          <div className="grid gap-1">
            <Label htmlFor="spend-from" className="text-ink-secondary text-xs">
              Giao dự kiến từ
            </Label>
            <Input
              id="spend-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={`w-[160px] ${FIELD_CLASS}`}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="spend-to" className="text-ink-secondary text-xs">
              Đến
            </Label>
            <Input
              id="spend-to"
              type="date"
              value={to}
              min={from || undefined}
              aria-invalid={rangeInvalid || undefined}
              aria-describedby={rangeInvalid ? "spend-range-error" : undefined}
              onChange={(e) => setTo(e.target.value)}
              className={`w-[160px] ${FIELD_CLASS}`}
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={rangeInvalid}
            onClick={() => onApplyRange({ from, to })}
          >
            Lọc
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setFrom("");
              setTo("");
              onApplyRange({ from: "", to: "" });
            }}
          >
            Xoá lọc
          </Button>
        </div>
      </div>
      {rangeInvalid && (
        <p id="spend-range-error" role="alert" className="text-danger mt-2 text-right text-xs">
          Ngày “Đến” phải từ ngày “Giao dự kiến từ” trở đi.
        </p>
      )}
    </Card>
  );
}
