"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { ApiError } from "@/lib/api/error";
import { createIdempotencyAttempt } from "@/lib/api/idempotency";
import { getGoodsReceipt } from "@/features/receipt/api";
import { countLineCartonContexts } from "@/features/receipt/carton-selectors";
import { initialCountLines } from "@/features/receipt/count-selectors";
import {
  isStaleCartonError,
  receiptErrorMessage,
  receiptLineFieldErrors,
} from "@/features/receipt/errors";
import { buildReceiptLinesSchema } from "@/features/receipt/input-schemas";
import { useSaveReceiptLines } from "@/features/receipt/mutations";
import { receiptKeys } from "@/features/receipt/queries";
import { poLinesOverOpenQuantity, receiptReceivedOn } from "@/features/receipt/selectors";

import { CARTON_SET_OPTIONS } from "../cartons/carton-form";

import type { FieldPath } from "react-hook-form";
import type { CartonDraft } from "../cartons/CartonEditor";
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
  const queryClient = useQueryClient();
  // SCRUM-473: gửi lại cùng nội dung (mất mạng / BE nhả claim) dùng lại key — BE không cấp LPN hai lần
  const [attempt] = useState(() => createIdempotencyAttempt());
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
  // SCRUM-473: đơn vị / thùng đã lưu của từng dòng form; trình chia thùng mở theo `field.id`
  const cartonContexts = countLineCartonContexts(
    receipt.lines,
    watched.map((l) => ({
      purchaseOrderLineId: l.purchaseOrderLineId,
      lotNumber: l.lotNumber ?? "",
      sku: poLineById.get(l.purchaseOrderLineId)?.sku,
      packages: l.packages,
    })),
  );
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggleCartons = (rowId: string) =>
    setExpanded((open) => {
      const next = new Set(open);
      if (!next.delete(rowId)) next.add(rowId);
      return next;
    });
  const setLineCartons = (index: number, next: CartonDraft) => {
    setServerError(null);
    form.setValue(`lines.${index}.unitOfMeasure`, next.unitOfMeasure, CARTON_SET_OPTIONS);
    form.setValue(`lines.${index}.packages`, next.packages, CARTON_SET_OPTIONS);
  };
  const missingPoLines = po.lines.filter(
    (l) => l.openQuantity > 0 && !watched.some((w) => w.purchaseOrderLineId === l.lineId),
  );

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  const submit = form.handleSubmit((values) => {
    setServerError(null);
    const idempotencyKey = attempt.keyFor({ receiptId: receipt.id, lines: values.lines });
    save.mutate(
      { receiptId: receipt.id, lines: values.lines, idempotencyKey },
      {
        onSuccess: (saved) => {
          attempt.reset();
          // Hiện ngay kết quả BE trả về (LPN mới, SL) — không để màn kết quả nháy số cũ tới khi tải lại xong
          queryClient.setQueryData(receiptKeys.detail(saved.id), saved);
          form.reset({ lines: initialCountLines(saved, po) });
          onSaved?.();
        },
        onError: (error) => {
          if (error instanceof ApiError) attempt.settle(error);
          else attempt.reset();
          // Thùng đã đổi ở nơi khác: nạp lại phiếu và đặt lại form, nếu không mỗi lần lưu lại gửi lại LPN cũ và lỗi mãi
          if (isStaleCartonError(error)) {
            void queryClient
              .fetchQuery({
                queryKey: receiptKeys.detail(receipt.id),
                queryFn: ({ signal }) => getGoodsReceipt(receipt.id, signal),
                staleTime: 0,
              })
              .then((fresh) => form.reset({ lines: initialCountLines(fresh, po) }));
          }
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
    unitOfMeasure: "",
    packages: [],
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
    cartons: { contexts: cartonContexts, expanded, toggle: toggleCartons, set: setLineCartons },
  };
}
