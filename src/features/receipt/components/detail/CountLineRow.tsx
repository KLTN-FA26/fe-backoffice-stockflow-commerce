"use client";

import { Copy, Trash2 } from "lucide-react";

import { RECEIPT_LIMITS } from "@/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FieldError } from "../primitives";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { ReceiptLinesFormInput, ReceivablePoLine } from "@/features/receipt/types";

const CELL = "border-border-default bg-bg-surface h-8 rounded-[var(--r-sm)] text-[0.8125rem]";

/** Một dòng kiểm đếm: một dòng PO × một lô (BE uk_goods_receipt_lines_lot). */
export function CountLineRow({
  index,
  poLine,
  register,
  errors,
  overOpen,
  autoFocus,
  onSplit,
  onRemove,
}: {
  index: number;
  poLine: ReceivablePoLine | undefined;
  register: UseFormRegister<ReceiptLinesFormInput>;
  errors: FieldErrors<ReceiptLinesFormInput>["lines"];
  /** Tổng SL đang đếm của dòng PO vượt SL còn mở → cảnh báo, vẫn cho lưu. */
  overOpen: boolean;
  autoFocus: boolean;
  onSplit: () => void;
  onRemove: () => void;
}) {
  const e = errors?.[index];
  const id = (field: string) => `count-${index}-${field}`;
  const describedBy = (field: string, hasError: boolean) =>
    hasError ? `${id(field)}-error` : undefined;

  return (
    <tr className="border-border-default border-t align-top">
      <td className="px-2 py-2">
        <div className="font-[family-name:var(--font-mono)] text-[0.8125rem]">
          {poLine?.sku ?? "—"}
        </div>
        <div className="text-ink-tertiary text-xs tabular-nums">
          Còn mở {poLine?.openQuantity ?? "—"} / đặt {poLine?.quantityOrdered ?? "—"}
        </div>
      </td>
      <td className="w-28 px-2 py-2">
        <Input
          id={id("quantity")}
          type="number"
          inputMode="numeric"
          min={1}
          aria-label={`SL nhận dòng ${index + 1}`}
          aria-invalid={e?.quantity ? true : undefined}
          aria-describedby={describedBy("quantity", !!e?.quantity)}
          className={`${CELL} text-right tabular-nums`}
          {...register(`lines.${index}.quantity`, { valueAsNumber: true })}
        />
        <FieldError id={`${id("quantity")}-error`}>{e?.quantity?.message}</FieldError>
        {overOpen && !e?.quantity && (
          <p className="text-warning mt-1 text-xs">
            Vượt SL còn mở — chỉ hợp lệ trong dung sai NCC
          </p>
        )}
      </td>
      {/* BE gap: API PO chưa trả lotTracked / expiryTracked → luôn hiện ô lô + hạn dùng, BE kiểm khi lưu */}
      <td className="w-36 px-2 py-2">
        <Input
          id={id("lot")}
          aria-label={`Số lô dòng ${index + 1}`}
          maxLength={RECEIPT_LIMITS.codeMax}
          aria-invalid={e?.lotNumber ? true : undefined}
          aria-describedby={describedBy("lot", !!e?.lotNumber)}
          className={`${CELL} font-[family-name:var(--font-mono)]`}
          {...register(`lines.${index}.lotNumber`)}
        />
        <FieldError id={`${id("lot")}-error`}>{e?.lotNumber?.message}</FieldError>
      </td>
      <td className="w-40 px-2 py-2">
        <Input
          id={id("expiry")}
          type="date"
          aria-label={`Hạn dùng dòng ${index + 1}`}
          aria-invalid={e?.expiryDate ? true : undefined}
          aria-describedby={describedBy("expiry", !!e?.expiryDate)}
          className={`${CELL} tabular-nums`}
          {...register(`lines.${index}.expiryDate`)}
        />
        <FieldError id={`${id("expiry")}-error`}>{e?.expiryDate?.message}</FieldError>
      </td>
      <td className="w-40 px-2 py-2">
        <Input
          id={id("location")}
          autoFocus={autoFocus}
          aria-label={`Mã vị trí nhận dòng ${index + 1}`}
          placeholder="Quét / nhập mã khu"
          maxLength={RECEIPT_LIMITS.codeMax}
          aria-invalid={e?.locationCode ? true : undefined}
          aria-describedby={describedBy("location", !!e?.locationCode)}
          className={`${CELL} font-[family-name:var(--font-mono)] uppercase`}
          {...register(`lines.${index}.locationCode`)}
        />
        <FieldError id={`${id("location")}-error`}>{e?.locationCode?.message}</FieldError>
      </td>
      <td className="px-2 py-2">
        <Input
          aria-label={`Ghi chú dòng ${index + 1}`}
          maxLength={RECEIPT_LIMITS.lineNoteMax}
          className={CELL}
          {...register(`lines.${index}.note`)}
        />
      </td>
      <td className="w-20 px-2 py-2">
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onSplit}
            aria-label={`Tách lô dòng ${index + 1}`}
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label={`Xoá dòng ${index + 1}`}
          >
            <Trash2 className="text-danger size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
