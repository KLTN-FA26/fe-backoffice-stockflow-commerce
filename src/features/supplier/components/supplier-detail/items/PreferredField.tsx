"use client";

import { cn } from "cn";
import { Controller } from "react-hook-form";

import { SUPPLIER_ITEM_UI_LABELS } from "@/constants";
import { Checkbox } from "@/components/ui/checkbox";

import type { UseFormReturn } from "react-hook-form";
import type { SupplierItem, SupplierItemFormValues } from "@/features/supplier/types";

const L = SUPPLIER_ITEM_UI_LABELS;

/**
 * "NCC ưu tiên" = NCC mặc định của SKU (BE #121, docs 01 §3). BE `SupplierItemServiceImpl`: tick → đè
 * NCC mặc định cũ (`assignDefaultSupplier`); bỏ tick trên dòng đang ưu tiên → xoá NCC mặc định
 * (`clearDefaultSupplier`) — báo trước để người dùng không xoá nhầm.
 */
export function PreferredField({
  form,
  item,
}: {
  form: UseFormReturn<SupplierItemFormValues>;
  item: SupplierItem | null;
}) {
  const checked = form.watch("preferred");
  const wasPreferred = item?.preferred ?? false;
  const warning =
    wasPreferred && !checked
      ? L.hint.preferredClears
      : !wasPreferred && checked
        ? L.hint.preferredMoves
        : null;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Controller
          control={form.control}
          name="preferred"
          render={({ field }) => (
            <Checkbox
              id="supplier-item-preferred"
              checked={field.value}
              onCheckedChange={(value) => field.onChange(value === true)}
              onBlur={field.onBlur}
              aria-describedby="supplier-item-preferred-note"
            />
          )}
        />
        <label htmlFor="supplier-item-preferred" className="text-ink-secondary text-xs font-medium">
          {L.field.preferred}
        </label>
      </div>
      <p
        id="supplier-item-preferred-note"
        className={cn("text-xs", warning ? "text-warning" : "text-ink-tertiary")}
      >
        {warning ?? L.hint.preferred}
      </p>
    </div>
  );
}
