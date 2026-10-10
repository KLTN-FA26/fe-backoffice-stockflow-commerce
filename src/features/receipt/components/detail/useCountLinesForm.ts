"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { ApiError } from "@/lib/api/error";
import { receiptErrorMessage, receiptLineFieldErrors } from "@/features/receipt/errors";
import { buildReceiptLinesSchema } from "@/features/receipt/input-schemas";
import { useSaveReceiptLines } from "@/features/receipt/mutations";
import {
  initialCountLines,
  poLinesOverOpenQuantity,
  receiptReceivedOn,
} from "@/features/receipt/selectors";

import type { FieldPath } from "react-hook-form";
import type {
  GoodsReceipt,
  ReceiptLinesFormInput,
  ReceiptLinesValues,
  ReceivablePo,
} from "@/features/receipt/types";

/**
 * State form kiểm đếm: react-hook-form + useFieldArray, zod theo ngày nhận (BR-06), cảnh báo vượt
 * SL còn mở, lưu = PUT thay toàn bộ; lỗi `@Valid` (`lines[i].field`) map về đúng ô.
 */
export function useCountLinesForm(
  receipt: GoodsReceipt,
  po: ReceivablePo,
  onDirtyChange: (dirty: boolean) => void,
  /** Lưu thành công — màn đóng form, hiện kết quả BE trả về. */
  onSaved?: () => void,
) {
  const schema = useMemo(
    () => buildReceiptLinesSchema({ receivedOn: receiptReceivedOn(receipt) }),
    [receipt],
  );
  const form = useForm<ReceiptLinesFormInput, unknown, ReceiptLinesValues>({
    resolver: zodResolver(schema),
    defaultValues: { lines: initialCountLines(receipt, po) },
    mode: "onChange",
  });
  const { fields, append, insert, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });
  const save = useSaveReceiptLines();
  const [serverError, setServerError] = useState<string | null>(null);
  // Phiếu chưa lưu dòng nào: dòng gợi ý từ PO cũng là thay đổi cần lưu
  const isDirty = form.formState.isDirty || receipt.lines.length === 0;
  const watched = useWatch({ control: form.control, name: "lines" });
  const overOpen = new Set(
    poLinesOverOpenQuantity(
      po.lines,
      watched.map((l) => ({
        purchaseOrderLineId: l.purchaseOrderLineId,
        quantity: Number(l.quantity) || 0,
      })),
    ),
  );
  const poLineById = new Map(po.lines.map((l) => [l.lineId, l]));
  const missingPoLines = po.lines.filter(
    (l) => l.openQuantity > 0 && !watched.some((w) => w.purchaseOrderLineId === l.lineId),
  );

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  const submit = form.handleSubmit((values) => {
    setServerError(null);
    save.mutate(
      { receiptId: receipt.id, lines: values.lines },
      {
        onSuccess: (saved) => {
          form.reset({ lines: initialCountLines(saved, po) });
          onSaved?.();
        },
        onError: (error) => {
          // Chỉ lỗi `@Valid` có fieldErrors (`lines[i].x`). BE gap: lỗi nghiệp vụ 409 (dung sai,
          // lô / hạn dùng, mã khu) không kèm fieldErrors → chỉ hiện câu chung ở đầu form.
          const fieldErrors = error instanceof ApiError ? receiptLineFieldErrors(error) : [];
          for (const fe of fieldErrors) {
            form.setError(`lines.${fe.index}.${fe.field}` as FieldPath<ReceiptLinesFormInput>, {
              message: fe.message,
            });
          }
          setServerError(receiptErrorMessage(error));
        },
      },
    );
  });

  /**
   * "Tách lô": thêm dòng cùng dòng PO + cùng vị trí nhận ngay dưới, chuyển 1 đơn vị từ dòng gốc
   * sang (tổng không đổi); dòng gốc chỉ còn 1 thì dòng mới để SL 1.
   */
  const split = (index: number) => {
    const source = watched[index];
    if (!source) return;
    const quantity = Number(source.quantity) || 0;
    if (quantity > 1) {
      form.setValue(`lines.${index}.quantity`, quantity - 1, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    insert(index + 1, {
      ...blankFor(source.purchaseOrderLineId, 1),
      locationCode: source.locationCode,
    });
  };

  const blankFor = (lineId: string, quantity: number) => ({
    purchaseOrderLineId: lineId,
    quantity,
    lotNumber: "",
    expiryDate: "",
    locationCode: watched[0]?.locationCode ?? "",
    note: "",
  });

  return {
    form,
    fields,
    append,
    split,
    remove,
    save,
    serverError,
    clearServerError: () => setServerError(null),
    isDirty,
    watched,
    overOpen,
    poLineById,
    missingPoLines,
    submit,
    blankFor,
  };
}
