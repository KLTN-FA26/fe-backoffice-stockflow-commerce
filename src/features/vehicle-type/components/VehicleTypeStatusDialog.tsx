"use client";

import { useState } from "react";

import { UI_LABELS, VEHICLE_TYPE_STATUS } from "@/constants";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { vehicleTypeErrorMessage } from "@/features/vehicle-type/errors";
import { useSetVehicleTypeStatus } from "@/features/vehicle-type/mutations";

import type { VehicleType } from "@/features/vehicle-type/types";

const C = UI_LABELS.vehicleType.confirm;
const L = UI_LABELS.vehicleType;

/**
 * Ngừng dùng / dùng lại một loại xe: PUT đủ trường của dòng với `status` mới và `version` đã đọc. Lỗi
 * (409 OPTIMISTIC_LOCK, 404, 403…) hiện ngay trong dialog; dữ liệu cũ thì mutation đã tải lại danh sách.
 */
export function VehicleTypeStatusDialog({
  vehicleType,
  target,
  onClose,
}: {
  vehicleType: VehicleType;
  target: VehicleType["status"];
  onClose: () => void;
}) {
  const mutation = useSetVehicleTypeStatus();
  const [error, setError] = useState<string | null>(null);
  const deactivating = target === VEHICLE_TYPE_STATUS.INACTIVE;
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${deactivating ? C.deactivateTitle : C.activateTitle} ${vehicleType.code}`}
      description={deactivating ? C.deactivateDescription : C.activateDescription}
      confirmLabel={deactivating ? L.deactivate : L.activate}
      variant={deactivating ? "danger" : "default"}
      loading={mutation.isPending}
      closeOnConfirm={false}
      error={error}
      onConfirm={() => {
        setError(null);
        mutation.mutate(
          { vehicleType, status: target },
          { onSuccess: onClose, onError: (e) => setError(vehicleTypeErrorMessage(e)) },
        );
      }}
    />
  );
}
