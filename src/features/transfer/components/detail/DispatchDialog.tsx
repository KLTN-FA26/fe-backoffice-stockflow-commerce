"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { TRANSFER_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import {
  isStaleTransferError,
  stockErrorsByLine,
  transferErrorMessage,
} from "@/features/transfer/errors";
import { buildDispatchSchema } from "@/features/transfer/input-schemas";
import { useDispatchTransferOrder } from "@/features/transfer/mutations";
import { defaultDispatchLines } from "@/features/transfer/selectors";
import { Alert } from "@/components/shared/Alert";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { toast } from "@/components/shared/Toast";
import { Input } from "@/components/ui/input";

import { FieldError, MONO, fieldClass } from "../primitives";

import type { TransferDispatchValues, TransferOrder } from "@/features/transfer/types";

/**
 * Xuất kho tại kho nguồn (PICKING → IN_TRANSIT): nhập SL thực xuất từng dòng, mặc định = SL yêu cầu.
 * Cho xuất thiếu (0..SL yêu cầu, tổng ≥ 1) — BE TransferOrderServiceImpl#dispatch. Không nhập mã
 * vận đơn / hãng: hệ thống không theo dõi hành trình (rescope SCRUM-327).
 */
export function DispatchDialog({
  transfer,
  open,
  onClose,
}: {
  transfer: TransferOrder;
  open: boolean;
  onClose: () => void;
}) {
  const dispatch = useDispatchTransferOrder();
  const [serverError, setServerError] = useState<string | null>(null);
  // Thiếu tồn theo dòng giữ ngoài RHF: `setError` làm `isValid` = false → không bấm xuất lại được dù
  // tồn đã được bổ sung; sửa đúng dòng thì bỏ đánh dấu dòng đó
  const [stockErrors, setStockErrors] = useState<Record<number, string>>({});
  const form = useForm<TransferDispatchValues>({
    resolver: zodResolver(buildDispatchSchema(transfer.lines)),
    mode: "onChange",
    defaultValues: { lines: defaultDispatchLines(transfer) },
  });
  const shipped = useWatch({ control: form.control, name: "lines" });
  const errors = form.formState.errors.lines;
  // Ô bỏ trống (NaN) cũng tính là xuất thiếu
  const partial = transfer.lines.some((line, i) => {
    const value = shipped?.[i]?.shippedQuantity ?? line.requested;
    return Number.isNaN(value) || value < line.requested;
  });

  const submit = form.handleSubmit((values) => {
    setServerError(null);
    setStockErrors({});
    dispatch.mutate(
      { transferId: transfer.transferId, lines: values.lines },
      {
        onSuccess: onClose,
        onError: (error) => {
          // Lệnh đổi ở nơi khác (vd đã dừng lấy hàng) → dữ liệu đã tải lại, nút xuất có thể không còn
          // — báo bằng toast vì dialog đóng ngay
          if (isStaleTransferError(error)) {
            toast.error(transferErrorMessage(error));
            onClose();
            return;
          }
          // Dialog không gắn lỗi `@Valid` vào ô → mọi VALIDATION_FAILED dùng câu riêng của xuất kho
          setServerError(
            error instanceof ApiError && error.code === "VALIDATION_FAILED"
              ? TRANSFER_ERROR_MESSAGES.validationDispatch
              : transferErrorMessage(error),
          );
          // Thiếu tồn → đánh dấu đúng dòng (theo SKU + lô); dòng xuất 0 không trừ tồn nên không đánh dấu
          const stockLines = transfer.lines.map((line, i) => ({
            ...line,
            skip: values.lines[i]?.shippedQuantity === 0,
          }));
          setStockErrors(stockErrorsByLine(error, stockLines, "shippedQuantity"));
        },
      },
    );
  });

  return (
    // Đang gửi thì không cho đóng: đóng giữa chừng sẽ mất thông báo lỗi và cho bấm xuất lần hai
    <FormDialog open={open} onOpenChange={(next) => !next && !dispatch.isPending && onClose()}>
      <FormDialogBody
        title={`${UI_LABELS.transfer.dispatchTitle} ${transfer.number}`}
        description={UI_LABELS.transfer.dispatchDescription}
        submitLabel={UI_LABELS.transfer.action.dispatch}
        canSubmit={form.formState.isValid}
        isPending={dispatch.isPending}
        // Lỗi FE hiện tại (vd tổng 0) đứng trước lỗi máy chủ của lần gửi trước
        error={errors?.root?.message ?? errors?.message ?? serverError}
        onSubmit={() => void submit()}
        onCancel={() => !dispatch.isPending && onClose()}
      >
        <div className="max-h-[320px] space-y-2 overflow-y-auto">
          {transfer.lines.map((line, index) => {
            const fieldId = `dispatch-${line.lineId}`;
            const message = errors?.[index]?.shippedQuantity?.message ?? stockErrors[index];
            return (
              <div key={line.lineId} className="grid grid-cols-[1fr_7rem] items-start gap-3">
                <label htmlFor={fieldId} className="text-[0.8125rem]">
                  <span className={`text-ink-primary ${MONO}`}>{line.sku}</span>
                  {line.lotNumber && (
                    <span className={`text-ink-tertiary ml-1 ${MONO}`}>· {line.lotNumber}</span>
                  )}
                  <span className="text-ink-tertiary block text-xs tabular-nums">
                    {UI_LABELS.transfer.field.requested} {line.requested}
                  </span>
                </label>
                <div>
                  <Input
                    id={fieldId}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={line.requested}
                    aria-invalid={message ? true : undefined}
                    aria-describedby={message ? `${fieldId}-error` : undefined}
                    className={`${fieldClass(!!message)} text-right ${MONO}`}
                    {...form.register(`lines.${index}.shippedQuantity`, {
                      valueAsNumber: true,
                      // Sửa số → lỗi máy chủ của lần gửi trước (chung + của dòng này) không còn đúng
                      onChange: () => {
                        setServerError(null);
                        setStockErrors(({ [index]: _edited, ...rest }) => rest);
                      },
                    })}
                  />
                  <FieldError id={`${fieldId}-error`}>{message}</FieldError>
                </div>
              </div>
            );
          })}
        </div>
        {partial && <Alert tone="warning">{UI_LABELS.transfer.partialDispatch}</Alert>}
      </FormDialogBody>
    </FormDialog>
  );
}
