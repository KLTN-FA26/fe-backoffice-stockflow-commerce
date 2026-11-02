"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";

import {
  INVENTORY_ITEM_PERMISSIONS,
  RECEIPT_CARTON_LABELS,
  RECEIPT_LIMITS,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";
import { createIdempotencyAttempt } from "@/lib/api/idempotency";
import { usePermissionChecker } from "@/lib/auth";
import { getGoodsReceipt } from "@/features/receipt/api";
import { countLineCartonContexts } from "@/features/receipt/carton-selectors";
import { EMPTY_BLIND_LINE, initialBlindLines } from "@/features/receipt/count-selectors";
import {
  isStaleCartonError,
  receiptErrorMessage,
  receiptLineFieldErrors,
} from "@/features/receipt/errors";
import { buildBlindLinesSchema } from "@/features/receipt/input-schemas";
import { useSaveBlindReceiptLines } from "@/features/receipt/mutations";
import { receiptKeys } from "@/features/receipt/queries";
import { receiptReceivedOn, totalReceivedQuantity } from "@/features/receipt/selectors";
import { Alert } from "@/components/shared/Alert";
import { DatePicker } from "@/components/shared/DatePicker";
import { InventoryItemCombobox } from "@/components/backoffice/InventoryItemCombobox";
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
 * bằng SKU — chọn từ MỌI hồ sơ hàng tồn (SCRUM-492, quyết định owner; không lọc theo danh mục NCC). Tài khoản không có
 * `inventory-inventory-items:READ` thì gõ tay SKU, BE kiểm khi lưu. Lô / hạn dùng / khu nhận kiểm như phiếu thường (BE trả lỗi từng ô qua `fieldErrors`). Lưu = PUT thay toàn
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
  const queryClient = useQueryClient();
  // SCRUM-473: cùng nội dung gửi lại dùng lại Idempotency-Key — BE không cấp LPN hai lần
  const [attempt] = useState(() => createIdempotencyAttempt());
  const can = usePermissionChecker();
  // UI-only — Backend phải re-check (@RequiresPermission inventory-inventory-items:READ)
  const pickSku = can(INVENTORY_ITEM_PERMISSIONS.read);
  const [serverError, setServerError] = useState<string | null>(null);
  const isDirty = form.formState.isDirty || receipt.lines.length === 0;
  const watched = useWatch({ control: form.control, name: "lines" });
  const errors = form.formState.errors.lines;
  // SCRUM-473: dòng đã lưu có thùng giữ SKU + lô và không bỏ khỏi phiếu (BE RECEIPT_LINE_HAS_PACKAGES)
  const locked = countLineCartonContexts(
    receipt.lines,
    watched.map((l) => ({ lotNumber: l.lotNumber ?? "", sku: l.sku, packages: l.packages })),
  ).map((context) => context.locked);
  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  const submit = form.handleSubmit((values) => {
    setServerError(null);
    const idempotencyKey = attempt.keyFor({ receiptId: receipt.id, lines: values.lines });
    save.mutate(
      { receiptId: receipt.id, lines: values.lines, idempotencyKey },
      {
        onSuccess: (saved) => {
          attempt.reset();
          queryClient.setQueryData(receiptKeys.detail(saved.id), saved);
          form.reset({ lines: initialBlindLines(saved) });
          onSaved();
        },
        onError: (error) => {
          if (error instanceof ApiError) attempt.settle(error);
          else attempt.reset();
          // Thùng đã đổi ở nơi khác: nạp lại phiếu và đặt lại form, nếu không mỗi lần lưu lại gửi lại LPN cũ
          if (isStaleCartonError(error)) {
            void queryClient
              .fetchQuery({
                queryKey: receiptKeys.detail(receipt.id),
                queryFn: ({ signal }) => getGoodsReceipt(receipt.id, signal),
                staleTime: 0,
              })
              .then((fresh) => form.reset({ lines: initialBlindLines(fresh) }));
          }
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
                    <td className="w-52 px-2 py-2">
                      {pickSku && !locked[index] ? (
                        <Controller
                          control={form.control}
                          name={`lines.${index}.sku`}
                          render={({ field: sku }) => (
                            <InventoryItemCombobox
                              id={id("sku")}
                              value={sku.value}
                              ariaLabel={`SKU dòng ${index + 1}`}
                              onSelect={(value) => {
                                sku.onChange(value);
                                setServerError(null);
                              }}
                              onBlur={sku.onBlur}
                              hasError={!!e?.sku}
                              describedBy={e?.sku ? `${id("sku")}-error` : undefined}
                              autoFocus={index === 0}
                              labels={B.skuPicker}
                              contentClassName="min-w-64"
                            />
                          )}
                        />
                      ) : (
                        // Dòng có thùng giữ SKU (SCRUM-473) → ô chỉ đọc thay cho ô chọn
                        <Input
                          id={id("sku")}
                          autoFocus={index === 0}
                          aria-label={`SKU dòng ${index + 1}`}
                          placeholder={B.skuPlaceholder}
                          maxLength={RECEIPT_LIMITS.skuMax}
                          readOnly={locked[index]}
                          title={locked[index] ? RECEIPT_CARTON_LABELS.skuLocked : undefined}
                          aria-invalid={e?.sku ? true : undefined}
                          aria-describedby={e?.sku ? `${id("sku")}-error` : undefined}
                          className={`${CELL} font-[family-name:var(--font-mono)] uppercase`}
                          {...form.register(`lines.${index}.sku`)}
                        />
                      )}
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
                        readOnly={locked[index]}
                        title={locked[index] ? RECEIPT_CARTON_LABELS.lotLocked : undefined}
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
                        disabled={watched.length <= 1 || locked[index]}
                        title={locked[index] ? RECEIPT_CARTON_LABELS.removeLineLocked : undefined}
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
      {!pickSku && <p className="text-ink-tertiary mt-2 text-xs">{B.skuManualNotice}</p>}
      <div className="mt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({ ...EMPTY_BLIND_LINE, locationCode: watched[0]?.locationCode ?? "" })
          }
        >
          <Plus className="size-3.5" /> {B.addLine}
        </Button>
      </div>
    </Section>
  );
}
