"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";

import { RECEIPT_LIMITS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { receiptErrorMessage, receiptLineFieldErrors } from "@/features/receipt/errors";
import { buildBlindLinesSchema } from "@/features/receipt/input-schemas";
import { useSaveBlindReceiptLines } from "@/features/receipt/mutations";
import {
  initialBlindLines,
  receiptReceivedOn,
  totalReceivedQuantity,
} from "@/features/receipt/selectors";
import { Alert } from "@/components/shared/Alert";
import { DatePicker } from "@/components/shared/DatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FieldError, Section } from "../primitives";
import { ReceiptLinesTable } from "./ReceiptLinesTable";

import type { FieldPath } from "react-hook-form";
import type { BlindLinesFormInput, BlindLinesValues, GoodsReceipt } from "@/features/receipt/types";

const L = UI_LABELS.receipt;
const B = L.blind;
const CELL = "border-border-default bg-bg-surface h-8 rounded-[var(--r-sm)] text-[0.8125rem]";
const HEADERS = ["SKU", "SL nhận", "Số lô", "Hạn dùng", "Vị trí nhận", "Ghi chú", ""];

/**
 * Kiểm đếm phiếu không có PO (BR-RCP-002, SCRUM-478): không có dòng PO nên mỗi dòng là một SKU (× một lô), gọi hàng
 * bằng SKU. Lô / hạn dùng / khu nhận kiểm như phiếu thường (BE trả lỗi từng ô qua `fieldErrors`). Lưu = PUT thay toàn
 * bộ; sau khi lưu hiện kết quả BE trả về, "Sửa kiểm đếm" mở lại form. Xác nhận KHÔNG ghi nhận: phiếu luôn chờ Quản lý
 * kho duyệt.
 */
export function BlindCountPanel({
  receipt,
  canCount,
  onDirtyChange,
}: {
  receipt: GoodsReceipt;
  /** Có `procurement-goods-receipts:UPDATE` — đếm phiếu không có PO không cần đọc PO. */
  canCount: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const hasSaved = receipt.lines.length > 0;
  const [editing, setEditing] = useState(!hasSaved);
  const close = () => {
    onDirtyChange(false);
    setEditing(false);
  };

  if (canCount && (editing || !hasSaved)) {
    return (
      <BlindCountForm
        receipt={receipt}
        onDirtyChange={onDirtyChange}
        onSaved={close}
        onCancel={hasSaved ? close : undefined}
      />
    );
  }

  return (
    <Section
      title={L.countSaved}
      description={L.countSavedDescription}
      actions={
        canCount ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" /> {L.editCount}
          </Button>
        ) : undefined
      }
    >
      {hasSaved ? (
        <>
          <ReceiptLinesTable receipt={receipt} draft />
          <Alert tone="info" className="mt-3">
            {B.confirmNote}
          </Alert>
          <p className="text-ink-secondary mt-3 text-[0.8125rem]" aria-live="polite">
            Tổng{" "}
            <span className="text-ink-primary font-semibold tabular-nums">
              {totalReceivedQuantity(receipt)}
            </span>{" "}
            đơn vị trên {receipt.lines.length} dòng.
          </p>
        </>
      ) : (
        <p className="text-ink-tertiary text-[0.8125rem]">{L.noCountLines}</p>
      )}
    </Section>
  );
}

function BlindCountForm({
  receipt,
  onDirtyChange,
  onSaved,
  onCancel,
}: {
  receipt: GoodsReceipt;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
  onCancel: (() => void) | undefined;
}) {
  const schema = useMemo(
    () => buildBlindLinesSchema({ receivedOn: receiptReceivedOn(receipt) }),
    [receipt],
  );
  const form = useForm<BlindLinesFormInput, unknown, BlindLinesValues>({
    resolver: zodResolver(schema),
    defaultValues: { lines: initialBlindLines(receipt) },
    mode: "onChange",
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const save = useSaveBlindReceiptLines();
  const [serverError, setServerError] = useState<string | null>(null);
  const isDirty = form.formState.isDirty || receipt.lines.length === 0;
  const watched = useWatch({ control: form.control, name: "lines" });
  const errors = form.formState.errors.lines;
  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  const submit = form.handleSubmit((values) => {
    setServerError(null);
    save.mutate(
      { receiptId: receipt.id, lines: values.lines },
      {
        onSuccess: (saved) => {
          form.reset({ lines: initialBlindLines(saved) });
          onSaved();
        },
        onError: (error) => {
          // BE trả lỗi từng ô (`lines[i].sku`, `.locationCode`, `.lotNumber`…) trong fieldErrors
          const fieldErrors = error instanceof ApiError ? receiptLineFieldErrors(error) : [];
          for (const fe of fieldErrors) {
            form.setError(`lines.${fe.index}.${fe.field}` as FieldPath<BlindLinesFormInput>, {
              message: fe.message,
            });
          }
          setServerError(receiptErrorMessage(error));
        },
      },
    );
  });

  return (
    <Section
      title={B.countTitle}
      description={B.countDescription}
      actions={
        <>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={save.isPending}
            >
              {L.cancelEdit}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => void submit()}
            disabled={save.isPending || (receipt.lines.length > 0 && !isDirty)}
            className="rounded-[var(--r-sm)]"
          >
            {save.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            {L.action.saveLines}
          </Button>
        </>
      }
    >
      {serverError && (
        <div className="mb-3" role="alert">
          <Alert tone="danger">{serverError}</Alert>
        </div>
      )}
      {errors?.root?.message && (
        <p role="alert" className="text-danger mb-2 text-xs">
          {errors.root.message}
        </p>
      )}
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        onChange={() => setServerError(null)}
      >
        <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
          <table className="w-full text-[0.8125rem]">
            <caption className="sr-only">Dòng kiểm đếm của phiếu {receipt.number}</caption>
            <thead className="bg-bg-subtle text-ink-secondary">
              <tr>
                {HEADERS.map((h, i) => (
                  <th
                    key={h || i}
                    scope="col"
                    className={`px-2 py-2 font-medium ${i === 1 ? "text-right" : "text-left"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const e = errors?.[index];
                const id = (name: string) => `blind-${index}-${name}`;
                return (
                  <tr key={field.id} className="border-border-default border-t align-top">
                    <td className="w-44 px-2 py-2">
                      <Input
                        id={id("sku")}
                        autoFocus={index === 0}
                        aria-label={`SKU dòng ${index + 1}`}
                        placeholder={B.skuPlaceholder}
                        maxLength={RECEIPT_LIMITS.skuMax}
                        aria-invalid={e?.sku ? true : undefined}
                        aria-describedby={e?.sku ? `${id("sku")}-error` : undefined}
                        className={`${CELL} font-[family-name:var(--font-mono)] uppercase`}
                        {...form.register(`lines.${index}.sku`)}
                      />
                      <FieldError id={`${id("sku")}-error`}>{e?.sku?.message}</FieldError>
                    </td>
                    <td className="w-28 px-2 py-2">
                      <Input
                        id={id("quantity")}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        aria-label={`SL nhận dòng ${index + 1}`}
                        aria-invalid={e?.quantity ? true : undefined}
                        aria-describedby={e?.quantity ? `${id("quantity")}-error` : undefined}
                        className={`${CELL} text-right tabular-nums`}
                        {...form.register(`lines.${index}.quantity`, { valueAsNumber: true })}
                      />
                      <FieldError id={`${id("quantity")}-error`}>{e?.quantity?.message}</FieldError>
                    </td>
                    <td className="w-36 px-2 py-2">
                      <Input
                        aria-label={`Số lô dòng ${index + 1}`}
                        maxLength={RECEIPT_LIMITS.codeMax}
                        aria-invalid={e?.lotNumber ? true : undefined}
                        aria-describedby={e?.lotNumber ? `${id("lot")}-error` : undefined}
                        className={`${CELL} font-[family-name:var(--font-mono)]`}
                        {...form.register(`lines.${index}.lotNumber`)}
                      />
                      <FieldError id={`${id("lot")}-error`}>{e?.lotNumber?.message}</FieldError>
                    </td>
                    <td className="w-40 px-2 py-2">
                      <Controller
                        control={form.control}
                        name={`lines.${index}.expiryDate`}
                        render={({ field: expiry }) => (
                          <DatePicker
                            value={expiry.value ?? ""}
                            onChange={(value) => {
                              expiry.onChange(value);
                              setServerError(null);
                            }}
                            onBlur={expiry.onBlur}
                            ref={expiry.ref}
                            clearable
                            aria-label={`Hạn dùng dòng ${index + 1}`}
                            aria-invalid={e?.expiryDate ? true : undefined}
                            className={CELL}
                          />
                        )}
                      />
                      <FieldError id={`${id("expiry")}-error`}>{e?.expiryDate?.message}</FieldError>
                    </td>
                    <td className="w-40 px-2 py-2">
                      <Input
                        aria-label={`Mã vị trí nhận dòng ${index + 1}`}
                        placeholder="Quét / nhập mã khu"
                        maxLength={RECEIPT_LIMITS.codeMax}
                        aria-invalid={e?.locationCode ? true : undefined}
                        aria-describedby={e?.locationCode ? `${id("location")}-error` : undefined}
                        className={`${CELL} font-[family-name:var(--font-mono)] uppercase`}
                        {...form.register(`lines.${index}.locationCode`)}
                      />
                      <FieldError id={`${id("location")}-error`}>
                        {e?.locationCode?.message}
                      </FieldError>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        aria-label={`Ghi chú dòng ${index + 1}`}
                        maxLength={RECEIPT_LIMITS.lineNoteMax}
                        className={CELL}
                        {...form.register(`lines.${index}.note`)}
                      />
                    </td>
                    <td className="w-12 px-2 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => remove(index)}
                        disabled={watched.length <= 1}
                        aria-label={`${B.removeLine} ${index + 1}`}
                      >
                        <Trash2 className="text-danger size-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
      <div className="mt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({
              sku: "",
              quantity: 1,
              lotNumber: "",
              expiryDate: "",
              locationCode: watched[0]?.locationCode ?? "",
              note: "",
            })
          }
        >
          <Plus className="size-3.5" /> {B.addLine}
        </Button>
      </div>
    </Section>
  );
}
