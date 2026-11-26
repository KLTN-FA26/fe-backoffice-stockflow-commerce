"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import {
  PICK_LINE_ERROR_MESSAGES,
  PICK_LINE_LABELS,
  PICK_LINE_LIMITS,
  TOAST_MESSAGES,
} from "@/constants";
import { ApiError } from "@/lib/api/error";
import { createIdempotencyAttempt } from "@/lib/api/idempotency";
import { shortPickError } from "@/features/fulfillment/pick-line-errors";
import { useReportShortPick } from "@/features/fulfillment/pick-line-mutations";
import { shortPickInputSchema } from "@/features/fulfillment/pick-line-schemas";
import { sameScannedCode } from "@/features/fulfillment/pick-line-selectors";
import { ScanInput } from "@/components/backoffice/ScanInput";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { toast } from "@/components/shared/Toast";

import { ShortPickReasonField } from "./ShortPickReasonField";

import type { ScanFeedback } from "@/components/backoffice/ScanInput";
import type { PickLine, ShortPickFormValues, ShortPickValues } from "@/features/fulfillment/types";

const L = PICK_LINE_LABELS;

export interface ShortPickProps {
  taskId: string;
  line: PickLine;
  /** Báo thiếu xong — màn bỏ câu "Đã lấy dòng …" của lần xác nhận trước. */
  onReported?: () => void;
}

/**
 * Báo thiếu một thùng (X-SHORT bước 01, BE `POST …/pick-lines/{lineId}/short`, docs 07 §4.4 bước 9): người được gán
 * đứng ở bin, chọn vị trí + lý do (không thấy thùng / thùng hư hỏng). Báo thiếu CẢ thùng — không nhập số tìm thấy.
 * BE chuyển dòng sang SHORT, tạm giữ đơn (INVENTORY), mở kiểm kê mù cho thùng, không trừ tồn; người lấy làm tiếp
 * dòng khác. Idempotency như xác nhận dòng.
 */
export function ShortPickDialog({
  taskId,
  line,
  onReported,
  onClose,
}: ShortPickProps & { onClose: () => void }) {
  const report = useReportShortPick();
  const [attempt] = useState(() => createIdempotencyAttempt());
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ShortPickFormValues, unknown, ShortPickValues>({
    resolver: zodResolver(shortPickInputSchema),
    defaultValues: { locationCode: "" },
  });
  const { errors } = form.formState;
  // Thùng đã về khu chờ xuất thì quét khu chờ, không phải ô kệ lấy ra (BE `PickList.expectedAt`)
  const expectedLocation = line.stagedLocationCode ?? line.locationCode;
  const scannedLocation = useWatch({ control: form.control, name: "locationCode" });
  const [wrongLocation, setWrongLocation] = useState<ScanFeedback | null>(null);
  const onScanLocation = (code: string) => {
    if (!sameScannedCode(code, expectedLocation)) {
      setWrongLocation({
        tone: "danger",
        message: PICK_LINE_ERROR_MESSAGES.locationMismatch(expectedLocation),
        seq: (wrongLocation?.seq ?? 0) + 1,
      });
      form.setValue("locationCode", "");
      return;
    }
    setWrongLocation(null);
    form.clearErrors("locationCode");
    form.setValue("locationCode", code.trim());
  };
  // Quét xong vị trí → sang ô lý do, như thẻ xác nhận dòng (không cần chuột). Sau khi ô quét đã khoá: ô quét tự giành
  // lại focus ngay sau mỗi lần quét nên không đưa focus đi trong lúc xử lý mã được.
  useEffect(() => {
    if (scannedLocation) document.getElementById("short-reason")?.focus();
  }, [scannedLocation]);
  const locationFeedback: ScanFeedback | null = scannedLocation
    ? { tone: "positive", message: PICK_LINE_LABELS.locationOk(scannedLocation) }
    : errors.locationCode?.message
      ? { tone: "danger", message: errors.locationCode.message }
      : wrongLocation;

  const submit = form.handleSubmit((values) => {
    if (report.isPending) return;
    setServerError(null);
    const idempotencyKey = attempt.keyFor({ lineId: line.lineId, ...values });
    report.mutate(
      { taskId, lineId: line.lineId, values, idempotencyKey },
      {
        onSuccess: (updated) => {
          attempt.reset();
          toast.success(TOAST_MESSAGES.fulfillment.shortReported(updated.sku, updated.lpn));
          onReported?.();
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiError) attempt.settle(error);
          else attempt.reset();
          const result = shortPickError(error, line);
          if (result.field) {
            // BE từ chối vị trí → mở lại ô quét để quét lại
            if (result.field === "locationCode") form.setValue("locationCode", "");
            form.setError(result.field, { type: "server", message: result.message });
          } else if (result.stale) {
            toast.error(result.message);
            onClose();
          } else {
            setServerError(result.message);
          }
        },
      },
    );
  });

  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={L.shortTitle}
        // Thùng đã về khu chờ xuất thì quét khu chờ, không phải bin lấy ra (BE `PickList.expectedAt`)
        description={L.target(
          line.stagedLocationCode ?? line.locationCode,
          line.lpn,
          line.sku,
          line.allocatedQty,
        )}
        submitLabel={L.shortAction}
        canSubmit={!!scannedLocation}
        isPending={report.isPending}
        error={serverError}
        onSubmit={() => void submit()}
        onCancel={onClose}
      >
        <ScanInput
          id="short-location"
          label={L.shortScanLocation}
          placeholder={L.scanLocationPlaceholder}
          hint={L.shortScanHint(expectedLocation)}
          maxLength={PICK_LINE_LIMITS.codeMax}
          disabled={!!scannedLocation}
          feedback={locationFeedback}
          submitLabel={scannedLocation ? undefined : L.scanLocationConfirm}
          onScan={onScanLocation}
        />
        <ShortPickReasonField
          control={form.control}
          error={errors.reason?.message}
          onPicked={() => form.clearErrors("reason")}
        />
      </FormDialogBody>
    </FormDialog>
  );
}
