"use client";

import { useState } from "react";

import { WAREHOUSE_PERMISSIONS } from "@/constants";
import { apiErrorMessage } from "@/lib/api/error-message";
import { useCan } from "@/lib/auth/components/Can";
import { useWarehouseOptions } from "@/lib/references/warehouse-options";
import { sampleErrorMessage } from "@/features/sample-request/errors";
import { useSubmitSample } from "@/features/sample-request/mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";

/**
 * Nộp lần mẫu vào một kho thật (SCRUM-403): danh sách kho đang hoạt động từ `GET /warehouses`
 * (SALES_STAFF có `warehouse-warehouses:READ` từ BE PR #109, V20261015000800). Không có ô nhập mã kho.
 */
function SubmitForm({ id, onClose }: { id: string; onClose: () => void }) {
  const canListWarehouses = useCan(WAREHOUSE_PERMISSIONS.read);
  const warehouses = useWarehouseOptions(canListWarehouses);
  const [warehouseId, setWarehouseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = useSubmitSample();
  const options = warehouses.data ?? [];

  let status: string | undefined;
  if (!canListWarehouses)
    status = "Tài khoản chưa được cấp quyền xem danh sách kho — chưa nộp mẫu được.";
  else if (warehouses.isPending) status = "Đang tải danh sách kho…";
  else if (warehouses.isError) status = apiErrorMessage(warehouses.error);
  else if (options.length === 0) status = "Chưa có kho nào đang hoạt động.";

  return (
    <FormDialogBody
      title="Gửi sản xuất mẫu"
      description="Tạo lệnh sản xuất mẫu và giữ phôi ngay tại kho được chọn. Kho thiếu phôi khả dụng thì hệ thống từ chối."
      submitLabel="Gửi sản xuất"
      canSubmit={options.some((warehouse) => warehouse.warehouseId === warehouseId)}
      isPending={submit.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => {
        setError(null);
        submit.mutate(
          { id, warehouseId },
          { onSuccess: onClose, onError: (failure) => setError(sampleErrorMessage(failure)) },
        );
      }}
    >
      <FormField id="submit-warehouse" label="Kho sản xuất" required hint={status}>
        <select
          {...fieldA11y("submit-warehouse", undefined, !!status)}
          value={warehouseId}
          disabled={options.length === 0}
          onChange={(event) => setWarehouseId(event.target.value)}
          className={`${FORM_INPUT_CLASS} border px-2`}
        >
          <option value="">— Chọn kho —</option>
          {options.map((warehouse) => (
            <option key={warehouse.warehouseId} value={warehouse.warehouseId}>
              {warehouse.code} — {warehouse.name}
            </option>
          ))}
        </select>
      </FormField>
      {warehouses.isError && (
        <Button type="button" variant="link" size="xs" onClick={() => void warehouses.refetch()}>
          Thử lại
        </Button>
      )}
    </FormDialogBody>
  );
}

export function SubmitSampleDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && <SubmitForm id={id} onClose={() => onOpenChange(false)} />}
    </FormDialog>
  );
}
