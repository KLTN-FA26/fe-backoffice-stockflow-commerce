"use client";

import { useState } from "react";

import { PUT_BACK_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { createIdempotencyAttempt } from "@/lib/api/idempotency";
import { useWarehouseLocations } from "@/lib/references/warehouse-locations";
import { putBackError } from "@/features/fulfillment/pick-line-errors";
import { putBackChoices } from "@/features/fulfillment/put-back-choices";
import { usePutBackLine } from "@/features/fulfillment/put-back-mutations";
import { putBackInputSchema } from "@/features/fulfillment/put-back-schemas";
import { Alert } from "@/components/shared/Alert";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { toast } from "@/components/shared/Toast";

import { CodeField } from "../picking/CodeField";
import { PutBackLpnField } from "./PutBackLpnField";

import type { PutBackRow } from "@/features/fulfillment/types";

const P = PUT_BACK_LABELS;

/**
 * Cất lại nguyên thùng (BE `POST …/pick-lines/{lineId}/put-back`, docs 07 §4.5 bước 14): chọn bin đang dùng được của
 * kho task (mặc định bin đã lấy ra) VÀ quét LPN của thùng để xác nhận. Thùng hư hỏng loại ở trạm kiểm (`quarantine`)
 * thì chọn khu cách ly thay cho bin. Idempotency theo nội dung (cùng bin + LPN → cùng key). Lỗi bin / LPN hiện dưới ô
 * tương ứng; dòng không còn để trả → toast + đóng, hàng đợi tự tải lại.
 */
export function PutBackDialog({ row, onClose }: { row: PutBackRow; onClose: () => void }) {
  const quarantine = row.quarantine === true;
  const locations = useWarehouseLocations(row.warehouseId);
  const putBack = usePutBackLine();
  const [attempt] = useState(() => createIdempotencyAttempt());
  const [picked, setPicked] = useState<string | null>(null);
  const [lpn, setLpn] = useState("");
  const [locationError, setLocationError] = useState<string | undefined>();
  const [lpnError, setLpnError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const { fallback, options, defaultCode } = putBackChoices(row, locations.data, locations.isError);
  // Chưa chọn gì → mặc định bin đã lấy ra (khi danh sách bin đã tải và bin đó còn dùng được)
  const locationCode = picked ?? defaultCode;
  const overflow = row.overflowLocationCodes ?? [];

  const submit = () => {
    if (putBack.isPending) return;
    const parsed = putBackInputSchema.safeParse({ locationCode, lpn });
    if (!parsed.success) {
      const issues = parsed.error.flatten().fieldErrors;
      setLocationError(issues.locationCode?.[0]);
      setLpnError(issues.lpn?.[0]);
      return;
    }
    const values = parsed.data;
    setServerError(null);
    putBack.mutate(
      {
        taskId: row.taskId,
        lineId: row.lineId,
        ...values,
        idempotencyKey: attempt.keyFor({ lineId: row.lineId, ...values }),
      },
      {
        onSuccess: () => {
          attempt.reset();
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiError) attempt.settle(error);
          else attempt.reset();
          const result = putBackError(error, row);
          if (result.field === "lpn") {
            setLpnError(result.message);
            setLpn("");
          } else if (result.field) {
            setLocationError(result.message);
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
        description={P.summary(row.pickedQty, row.sku, row.lotNumber, row.orderNumber, row.lpn)}
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
        {quarantine && (
          <Alert tone="info" title={P.quarantineHint}>
            {null}
          </Alert>
        )}
        {overflow.length > 0 && !quarantine && (
          <Alert tone="info" title={P.overflowHint}>
            {null}
          </Alert>
        )}
        <CodeField
          id="put-back-location"
          label={quarantine ? P.quarantineLocation : P.location}
          placeholder={quarantine ? P.quarantineLocationPlaceholder : P.locationPlaceholder}
          options={options}
          value={locationCode}
          error={locationError}
          autoFocus
          onChange={(value) => {
            setPicked(value);
            setLocationError(undefined);
            setServerError(null);
            document.getElementById("put-back-lpn")?.focus();
          }}
        />
        <PutBackLpnField
          value={lpn}
          error={lpnError}
          onChange={(value) => {
            setLpn(value);
            setLpnError(undefined);
            setServerError(null);
          }}
        />
      </FormDialogBody>
    </FormDialog>
  );
}
