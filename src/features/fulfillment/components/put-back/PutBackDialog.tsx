"use client";

import { useState } from "react";

import { PUT_BACK_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { createIdempotencyAttempt } from "@/lib/api/idempotency";
import { useWarehouseLocations } from "@/lib/references/warehouse-locations";
import { putBackError } from "@/features/fulfillment/pick-line-errors";
import {
  defaultPutBackLocation,
  putBackLocationOptions,
} from "@/features/fulfillment/pick-line-selectors";
import { usePutBackLine } from "@/features/fulfillment/put-back-mutations";
import { putBackInputSchema } from "@/features/fulfillment/put-back-schemas";
import { Alert } from "@/components/shared/Alert";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { toast } from "@/components/shared/Toast";

import { CodeField } from "../picking/CodeField";

import type { PutBackRow } from "@/features/fulfillment/types";

const P = PUT_BACK_LABELS;

/**
 * Trả một dòng đã lấy về kệ (BE `POST …/pick-lines/{lineId}/put-back`): chọn bin đang dùng được của kho
 * task, mặc định là bin đã lấy ra. Idempotency theo nội dung (cùng bin → cùng key). Lỗi bin hiện dưới ô;
 * dòng không còn để trả → toast + đóng, hàng đợi tự tải lại.
 */
export function PutBackDialog({ row, onClose }: { row: PutBackRow; onClose: () => void }) {
  const locations = useWarehouseLocations(row.warehouseId);
  const putBack = usePutBackLine();
  const [attempt] = useState(() => createIdempotencyAttempt());
  const [picked, setPicked] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  // Không tải được sơ đồ kho → chỉ còn bin đã lấy ra (BE vẫn kiểm bin: sai thì PUT_BACK_LOCATION_INVALID)
  const fallback = locations.isError;
  const options = fallback
    ? [{ value: row.fromLocationCode, label: row.fromLocationCode }]
    : putBackLocationOptions(locations.data);
  // Chưa chọn gì → mặc định bin đã lấy ra (khi danh sách bin đã tải và bin đó còn dùng được)
  const locationCode =
    picked ??
    (fallback
      ? row.fromLocationCode
      : defaultPutBackLocation(row.fromLocationCode, locations.data));

  const submit = () => {
    if (putBack.isPending) return;
    const parsed = putBackInputSchema.safeParse({ locationCode });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    const code = parsed.data.locationCode;
    setServerError(null);
    putBack.mutate(
      {
        taskId: row.taskId,
        lineId: row.lineId,
        locationCode: code,
        idempotencyKey: attempt.keyFor({ lineId: row.lineId, locationCode: code }),
      },
      {
        onSuccess: () => {
          attempt.reset();
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiError) attempt.settle(error);
          else attempt.reset();
          const result = putBackError(error);
          if (result.field) {
            setFieldError(result.message);
          } else if (result.stale) {
            toast.error(result.message);
            onClose();
          } else {
            setServerError(result.message);
          }
        },
      },
    );
  };

  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={P.action}
        description={P.summary(row.pickedQty, row.sku, row.lotNumber, row.orderNumber)}
        submitLabel={P.action}
        canSubmit={!locations.isPending}
        isPending={putBack.isPending}
        error={serverError}
        onSubmit={submit}
        onCancel={onClose}
      >
        {fallback && (
          <Alert tone="warning" title={P.locationsFallback}>
            {null}
          </Alert>
        )}
        <CodeField
          id="put-back-location"
          label={P.location}
          placeholder={P.locationPlaceholder}
          options={options}
          value={locationCode}
          error={fieldError}
          autoFocus
          onChange={(value) => {
            setPicked(value);
            setFieldError(undefined);
            setServerError(null);
          }}
        />
      </FormDialogBody>
    </FormDialog>
  );
}
