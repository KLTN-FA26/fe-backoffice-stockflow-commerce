"use client";

import { useState } from "react";

import { PO_INPUT_CURRENCIES } from "@/features/purchase-order";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ISO_CURRENCY_PATTERN } from "./useSupplierSpendFilters";

const OTHER = "__other__";
const FIELD_CLASS = "bg-bg-surface h-8 rounded-[var(--r-sm)] text-[0.8125rem]";

/**
 * Chọn MỘT tiền tệ cho báo cáo chi tiêu (BE #40: một dòng / cặp NCC + tiền tệ). Ngoài 3 tiền tệ
 * tạo PO được trên FE còn cho nhập mã ISO khác — PO cũ / tạo qua API có thể là EUR, JPY…
 */
export function SpendCurrencyPicker({
  currency,
  onChange,
}: {
  currency: string;
  onChange: (currency: string) => void;
}) {
  const known = (PO_INPUT_CURRENCIES as readonly string[]).includes(currency);
  const [otherOpen, setOtherOpen] = useState(!known);
  const [draft, setDraft] = useState(known ? "" : currency);
  const draftValid = ISO_CURRENCY_PATTERN.test(draft);
  const apply = () => draftValid && onChange(draft);
  // Đang mở ô "Mã khác" nhưng chưa áp mã mới → bảng vẫn là tiền tệ cũ; nói rõ để không hiểu nhầm.
  const pendingOther = otherOpen && draft !== currency;

  return (
    <>
      <div className="grid gap-1">
        <Label htmlFor="spend-currency" className="text-ink-secondary text-xs">
          Tiền tệ
        </Label>
        <Select
          value={otherOpen ? OTHER : currency}
          onValueChange={(v) => {
            if (v === OTHER) return setOtherOpen(true);
            setOtherOpen(false);
            onChange(v);
          }}
        >
          <SelectTrigger id="spend-currency" className={`w-[120px] ${FIELD_CLASS}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PO_INPUT_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
              <SelectItem value={OTHER}>Mã khác…</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      {otherOpen && (
        <div className="grid gap-1">
          <Label htmlFor="spend-currency-other" className="text-ink-secondary text-xs">
            Mã ISO (3 chữ)
          </Label>
          <Input
            id="spend-currency-other"
            value={draft}
            maxLength={3}
            placeholder="EUR"
            aria-invalid={draft !== "" && !draftValid}
            onChange={(e) => setDraft(e.target.value.trim().toUpperCase())}
            onBlur={apply}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            aria-describedby={pendingOther ? "spend-currency-current" : undefined}
            className={`w-[88px] uppercase ${FIELD_CLASS}`}
          />
          {pendingOther && (
            <p id="spend-currency-current" className="text-ink-tertiary text-[11px]">
              Đang xem {currency} — nhập mã rồi Enter
            </p>
          )}
        </div>
      )}
    </>
  );
}
