"use client";

import { Loader2 } from "lucide-react";
import { Controller } from "react-hook-form";

import { PICK_LINE_LABELS } from "@/constants";
import { itemOptions } from "@/features/fulfillment/pick-line-selectors";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { CodeField } from "./CodeField";
import { usePickLineConfirm } from "./usePickLineConfirm";

import type { CodeOption } from "@/features/fulfillment/pick-line-selectors";
import type { PickLine } from "@/features/fulfillment/types";
import type { ReactNode } from "react";

const L = PICK_LINE_LABELS;

/** Đưa con trỏ tới ô (không cần chuột): chọn xong ô trước → ô sau; BE báo lỗi ô nào → về ô đó quét lại. */
const focusField = (id: string) => document.getElementById(id)?.focus();
const FIELD_IDS = {
  locationCode: "pick-location",
  scannedCode: "pick-item",
  quantity: "pick-quantity",
} as const;

/**
 * Xác nhận một dòng lấy hàng: vị trí → mã hàng → số lượng (docs 07 bước 6). Trên desktop chọn bằng
 * combobox thay máy quét; chọn xong ô trước thì con trỏ sang ô sau, Enter ở ô số lượng là gửi.
 * Số lượng để trống — người lấy hàng tự đếm; FE không chặn khi khác phân bổ (BE trả 409). Thẻ được dựng lại
 * theo từng dòng (`key`), nên form + key idempotency thuộc riêng dòng đó.
 */
export function PickLineConfirmCard({
  taskId,
  line,
  lines,
  locationOptions,
  locationsUnavailable,
  onConfirmed,
  extraActions,
}: {
  taskId: string;
  line: PickLine;
  lines: readonly PickLine[];
  locationOptions: readonly CodeOption[];
  locationsUnavailable: boolean;
  onConfirmed: (line: PickLine) => void;
  /** Thao tác phụ dưới nút xác nhận (vd báo thiếu hàng). */
  extraActions?: ReactNode;
}) {
  const { form, submit, pending, banner } = usePickLineConfirm({
    taskId,
    line,
    onConfirmed,
    onFieldError: (field) => focusField(FIELD_IDS[field]),
  });
  const { errors } = form.formState;
  const quantity = form.register("quantity");
  return (
    <section className="border-border-default bg-bg-surface space-y-3 rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow)">
      <div>
        <h2 className="text-ink-primary text-sm font-semibold">
          {L.confirmTitle(line.sequenceNo)}
        </h2>
        <p className="text-ink-secondary mt-0.5 text-[0.8125rem]">
          {L.target(line.locationCode, line.allocatedQty, line.sku)}
          {line.lotNumber ? ` · ${L.lot(line.lotNumber)}` : ""}
        </p>
      </div>
      {banner && (
        <Alert tone="danger" title={banner}>
          {null}
        </Alert>
      )}
      {locationsUnavailable && (
        <p className="text-ink-tertiary text-xs">{L.locationsUnavailable}</p>
      )}
      <form onSubmit={(event) => void submit(event)} className="space-y-3" noValidate>
        <Controller
          control={form.control}
          name="locationCode"
          render={({ field }) => (
            <CodeField
              id="pick-location"
              label={L.location}
              placeholder={L.locationPlaceholder}
              options={locationOptions}
              value={field.value}
              error={errors.locationCode?.message}
              autoFocus
              onChange={(value) => {
                field.onChange(value);
                form.clearErrors("locationCode");
                focusField("pick-item");
              }}
            />
          )}
        />
        <Controller
          control={form.control}
          name="scannedCode"
          render={({ field }) => (
            <CodeField
              id="pick-item"
              label={L.item}
              placeholder={L.itemPlaceholder}
              options={itemOptions(lines)}
              value={field.value}
              error={errors.scannedCode?.message}
              onChange={(value) => {
                field.onChange(value);
                form.clearErrors("scannedCode");
                focusField("pick-quantity");
              }}
            />
          )}
        />
        <div className="space-y-1">
          <Label htmlFor="pick-quantity" className="text-ink-primary text-[0.8125rem] font-medium">
            {L.quantity}
          </Label>
          <Input
            id="pick-quantity"
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={errors.quantity ? true : undefined}
            aria-describedby="pick-quantity-hint"
            className="bg-bg-surface h-9 rounded-[var(--r-sm)] text-right tabular-nums"
            {...quantity}
          />
          <p
            id="pick-quantity-hint"
            role={errors.quantity ? "alert" : undefined}
            className={errors.quantity ? "text-danger text-xs" : "text-ink-tertiary text-xs"}
          >
            {errors.quantity?.message ?? L.allocatedHint(line.allocatedQty)}
          </p>
        </div>
        <Button type="submit" size="sm" disabled={pending} className="w-full rounded-[var(--r-sm)]">
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          {L.submit}
        </Button>
      </form>
      {extraActions}
    </section>
  );
}
