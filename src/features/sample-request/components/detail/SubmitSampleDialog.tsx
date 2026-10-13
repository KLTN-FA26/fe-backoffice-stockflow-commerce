"use client";

import { useState } from "react";

import { WAREHOUSE_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { useWarehouseOptions } from "@/lib/references/warehouse-options";
import { sampleErrorMessage } from "@/features/sample-request/errors";
import { useSubmitSample } from "@/features/sample-request/mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function SubmitForm({ id, onClose }: { id: string; onClose: () => void }) {
  // GAP BE (d215f6e): SALES_STAFF không có `warehouse-warehouses:READ` → không tải được danh sách
  // kho; khi đó cho nhập mã kho (BE vẫn kiểm tra kho tồn tại + đang hoạt động).
  const canListWarehouses = useCan(WAREHOUSE_PERMISSIONS.read);
  const warehouses = useWarehouseOptions(canListWarehouses);
  const [warehouseId, setWarehouseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = useSubmitSample();
  const listed = canListWarehouses && warehouses.isSuccess;

  return (
    <FormDialogBody
      title="Gửi sản xuất mẫu"
      description="Tạo lệnh sản xuất mẫu và giữ phôi ngay tại kho được chọn. Kho thiếu phôi khả dụng thì hệ thống từ chối."
      submitLabel="Gửi sản xuất"
      canSubmit={UUID.test(warehouseId)}
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
      {listed ? (
        <FormField id="submit-warehouse" label="Kho sản xuất" required>
          <select
            id="submit-warehouse"
            value={warehouseId}
            onChange={(event) => setWarehouseId(event.target.value)}
            className={`${FORM_INPUT_CLASS} border px-2`}
          >
            <option value="">— Chọn kho —</option>
            {(warehouses.data ?? []).map((warehouse) => (
              <option key={warehouse.warehouseId} value={warehouse.warehouseId}>
                {warehouse.code} — {warehouse.name}
              </option>
            ))}
          </select>
        </FormField>
      ) : (
        <FormField
          id="submit-warehouse-id"
          label="Mã kho (UUID)"
          required
          hint="Tài khoản chưa được cấp quyền xem danh sách kho (đã báo BE). Nhập mã kho do điều phối cung cấp."
        >
          <Input
            id="submit-warehouse-id"
            value={warehouseId}
            onChange={(event) => setWarehouseId(event.target.value.trim())}
            className={`${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)]`}
          />
        </FormField>
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
