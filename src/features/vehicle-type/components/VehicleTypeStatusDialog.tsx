"use client";

import { useState } from "react";

import { UI_LABELS, VEHICLE_TYPE_STATUS } from "@/constants";

import { vehicleTypeErrorMessage } from "@/features/vehicle-type/errors";
import { useSetVehicleTypeStatus } from "@/features/vehicle-type/mutations";
import { useVehicleType } from "@/features/vehicle-type/queries";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

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
  // Bản mới nhất của dòng: sau 409 OPTIMISTIC_LOCK mutation tải lại chi tiết, bấm xác nhận lần nữa
  // gửi đúng version mới thay vì bản chụp lúc mở dialog (nếu không sẽ 409 mãi)
  const current = useVehicleType(vehicleType.vehicleTypeId).data ?? vehicleType;
  const [error, setError] = useState<string | null>(null);
  const deactivating = target === VEHICLE_TYPE_STATUS.INACTIVE;
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${deactivating ? C.deactivateTitle : C.activateTitle} ${current.code}`}
      description={deactivating ? C.deactivateDescription : C.activateDescription}
      confirmLabel={deactivating ? L.deactivate : L.activate}
      variant={deactivating ? "danger" : "default"}
      loading={mutation.isPending}
      closeOnConfirm={false}
      error={error}
      onConfirm={() => {
        setError(null);
        mutation.mutate(
          { vehicleType: current, status: target },
          { onSuccess: onClose, onError: (e) => setError(vehicleTypeErrorMessage(e)) },
        );
      }}
    />
  );
}
