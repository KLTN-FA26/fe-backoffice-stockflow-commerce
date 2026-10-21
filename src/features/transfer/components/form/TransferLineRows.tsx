"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray } from "react-hook-form";

import { TRANSFER_FIELD_MESSAGES, TRANSFER_LIMITS, UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FieldError, MONO, fieldClass } from "../primitives";
import { lineErrorKey } from "./server-line-errors";

import type { UseFormReturn } from "react-hook-form";
import type { TransferFormInput, TransferFormValues } from "@/features/transfer/types";
import type { LineField, ServerLineErrors } from "./server-line-errors";

const EMPTY_LINE = { sku: "", lotNumber: "", quantity: 1 };
const F = UI_LABELS.transfer.field;

/**
 * Dòng hàng (`useFieldArray`): SKU + lô + SL. Tồn khả dụng ở kho nguồn BE kiểm khi lưu
 * (INSUFFICIENT_STOCK, BR-02 docs 10 §6 — chỉ hàng Available).
 */
export function TransferLineRows({
  form,
  serverLineErrors,
  onLineEdited,
  onLineRemoved,
}: {
  form: UseFormReturn<TransferFormInput, unknown, TransferFormValues>;
  /** Lỗi máy chủ theo dòng từ lần lưu trước (thiếu tồn, `@Valid`) — xem server-line-errors.ts. */
  serverLineErrors: ServerLineErrors;
  onLineEdited: (index: number) => void;
  onLineRemoved: (index: number) => void;
}) {
  const lines = useFieldArray({ control: form.control, name: "lines" });
  const errors = form.formState.errors.lines;
  // Lỗi trùng SKU + lô gắn vào dòng sau: sửa dòng kia thì phải kiểm lại cả mảng, nếu không lỗi cũ
  // còn treo tới khi chạm vào đúng ô đó
  const revalidate = (index: number) => ({
    onChange: () => {
      onLineEdited(index);
      if (form.formState.isSubmitted) void form.trigger("lines");
    },
  });

  return (
    <div className="space-y-2">
      <div className="text-ink-secondary grid grid-cols-[1fr_1fr_7rem_2rem] gap-2 text-xs font-medium">
        <span>{F.sku} *</span>
        <span>{F.lot}</span>
        <span className="text-right">{F.quantity} *</span>
        <span className="sr-only">{F.remove}</span>
      </div>
      {lines.fields.map((row, index) => {
        const rowErrors = errors?.[index];
        const server = (field: LineField) => serverLineErrors[lineErrorKey(index, field)];
        const skuError = rowErrors?.sku?.message ?? server("sku");
        const lotError = rowErrors?.lotNumber?.message ?? server("lotNumber");
        const quantityError = rowErrors?.quantity?.message ?? server("quantity");
        const id = (field: string) => `transfer-line-${index}-${field}`;
        return (
          <div key={row.id} className="grid grid-cols-[1fr_1fr_7rem_2rem] items-start gap-2">
            <div>
              <Input
                id={id("sku")}
                aria-label={`${F.sku} ${F.lineSuffix} ${index + 1}`}
                aria-required
                aria-invalid={skuError ? true : undefined}
                aria-describedby={skuError ? `${id("sku")}-error` : undefined}
                className={`${fieldClass(!!skuError)} ${MONO}`}
                maxLength={TRANSFER_LIMITS.codeMax}
                {...form.register(`lines.${index}.sku`, revalidate(index))}
              />
              <FieldError id={`${id("sku")}-error`}>{skuError}</FieldError>
            </div>
            <div>
              <Input
                id={id("lot")}
                aria-label={`${F.lot} ${F.lineSuffix} ${index + 1}`}
                aria-invalid={lotError ? true : undefined}
                aria-describedby={lotError ? `${id("lot")}-error` : undefined}
                className={`${fieldClass(!!lotError)} ${MONO}`}
                maxLength={TRANSFER_LIMITS.codeMax}
                {...form.register(`lines.${index}.lotNumber`, revalidate(index))}
              />
              <FieldError id={`${id("lot")}-error`}>{lotError}</FieldError>
            </div>
            <div>
              <Input
                id={id("qty")}
                type="number"
                inputMode="numeric"
                min={1}
                max={TRANSFER_LIMITS.quantityMax}
                aria-label={`${F.quantity} ${F.lineSuffix} ${index + 1}`}
                aria-required
                aria-invalid={quantityError ? true : undefined}
                aria-describedby={quantityError ? `${id("qty")}-error` : undefined}
                className={`${fieldClass(!!quantityError)} text-right ${MONO}`}
                {...form.register(`lines.${index}.quantity`, {
                  ...revalidate(index),
                  valueAsNumber: true,
                })}
              />
              <FieldError id={`${id("qty")}-error`}>{quantityError}</FieldError>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={lines.fields.length === 1}
              onClick={() => {
                lines.remove(index);
                onLineRemoved(index);
                // Xoá dòng làm lỗi "trùng dòng" dồn sang dòng khác — kiểm lại cả mảng
                if (form.formState.isSubmitted) void form.trigger("lines");
              }}
              aria-label={`${F.remove} ${F.lineSuffix} ${index + 1}`}
              className="text-ink-tertiary hover:text-danger"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        );
      })}
      <FieldError>{errors?.root?.message ?? errors?.message}</FieldError>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={lines.fields.length >= TRANSFER_LIMITS.linesMax}
        onClick={() => lines.append(EMPTY_LINE)}
        className="rounded-[var(--r-sm)]"
      >
        <Plus className="size-3.5" /> {UI_LABELS.transfer.action.addLine}
      </Button>
      {/* Nút khoá thì nói lý do (nút disabled không hiện tooltip) */}
      {lines.fields.length >= TRANSFER_LIMITS.linesMax && (
        <p className="text-ink-tertiary text-xs">{TRANSFER_FIELD_MESSAGES.linesTooMany}</p>
      )}
    </div>
  );
}
