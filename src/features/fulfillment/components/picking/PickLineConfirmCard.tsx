"use client";

import { Loader2 } from "lucide-react";
import { Controller } from "react-hook-form";

import { PICK_LINE_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FieldError, MONO } from "../primitives";
import { CodeField } from "./CodeField";
import { usePickLineConfirm } from "./usePickLineConfirm";

import type { CodeOption } from "@/features/fulfillment/pick-line-selectors";
import type { PickLine } from "@/features/fulfillment/types";
import type { ReactNode } from "react";

const L = PICK_LINE_LABELS;

/** Đưa con trỏ tới ô (không cần chuột): chọn xong vị trí → ô LPN; BE báo lỗi ô nào → về ô đó quét lại. */
const focusField = (id: string) => document.getElementById(id)?.focus();
const FIELD_IDS = { locationCode: "pick-location", lpn: "pick-lpn" } as const;

/**
 * Xác nhận một dòng lấy hàng: quét vị trí → quét LPN của thùng (docs 07 §4.2 bước 5). Đầu thẻ nói rõ người lấy hàng
 * phải đến bin nào và lấy thùng nào (LPN); không có số lượng vì mỗi dòng là một thùng (BR-04). Trên desktop vị trí
 * chọn bằng combobox thay máy quét; LPN là ô nhập/quét tự do — SKU, mã vạch hay LPN của thùng khác (kể cả đơn
 * khác) đều bị BE từ chối (BR-10) và lỗi nêu đúng LPN của dòng. Chọn xong vị trí thì con trỏ sang ô LPN; Enter ở ô LPN
 * là gửi. Thẻ được dựng lại theo từng dòng (`key`), nên form + key idempotency thuộc riêng dòng đó.
 */
export function PickLineConfirmCard({
  taskId,
  line,
  locationOptions,
  locationsUnavailable,
  onConfirmed,
  extraActions,
}: {
  taskId: string;
  line: PickLine;
  locationOptions: readonly CodeOption[];
  locationsUnavailable: boolean;
  onConfirmed: (line: PickLine) => void;
  /** Thao tác phụ dưới nút xác nhận (vd báo thiếu thùng). */
  extraActions?: ReactNode;
}) {
  const { form, submit, pending, banner } = usePickLineConfirm({
    taskId,
    line,
    onConfirmed,
    onFieldError: (field) => focusField(FIELD_IDS[field]),
  });
  const { errors } = form.formState;
  const lpn = form.register("lpn", { onChange: () => form.clearErrors("lpn") });
  return (
    <section className="border-border-default bg-bg-surface space-y-3 rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow)">
      <div>
        <h2 className="text-ink-primary text-sm font-semibold">
          {L.confirmTitle(line.sequenceNo)}
        </h2>
        <dl className="mt-1.5 space-y-1 text-[0.8125rem]">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-secondary">{L.targetLocation}</dt>
            <dd className={`text-ink-primary font-medium ${MONO}`}>{line.locationCode}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-secondary">{L.targetLpn}</dt>
            <dd className={`text-ink-primary font-medium ${MONO}`}>{line.lpn ?? "—"}</dd>
          </div>
        </dl>
        <p className="text-ink-secondary mt-1 text-xs">
          {line.allocatedQty} × {line.sku}
          {line.lotNumber ? ` · ${L.lot(line.lotNumber)}` : ""}
        </p>
      </div>
      {!line.lpn && (
        <Alert tone="warning" title={L.noLpn}>
          {null}
        </Alert>
      )}
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
              id={FIELD_IDS.locationCode}
              label={L.location}
              placeholder={L.locationPlaceholder}
              options={locationOptions}
              value={field.value}
              error={errors.locationCode?.message}
              autoFocus
              onChange={(value) => {
                field.onChange(value);
                form.clearErrors("locationCode");
                focusField(FIELD_IDS.lpn);
              }}
            />
          )}
        />
        <div className="space-y-1">
          <Label htmlFor={FIELD_IDS.lpn} className="text-ink-primary text-[0.8125rem] font-medium">
            {L.lpn}
          </Label>
          <Input
            id={FIELD_IDS.lpn}
            autoComplete="off"
            spellCheck={false}
            placeholder={L.lpnPlaceholder}
            aria-invalid={errors.lpn ? true : undefined}
            aria-describedby={errors.lpn ? "pick-lpn-error" : "pick-lpn-hint"}
            className={`bg-bg-surface h-9 rounded-[var(--r-sm)] ${MONO}`}
            {...lpn}
          />
          {errors.lpn ? (
            <FieldError id="pick-lpn-error">{errors.lpn.message}</FieldError>
          ) : (
            <p id="pick-lpn-hint" className="text-ink-tertiary text-xs">
              {L.lpnHint}
            </p>
          )}
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
