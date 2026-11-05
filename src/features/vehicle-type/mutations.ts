/**
 * Mutation danh mục loại xe + invalidation (api-conventions §2.3). Thành công hay lỗi dữ liệu cũ
 * (`isStaleVehicleTypeError`: OPTIMISTIC_LOCK, loại xe không còn) đều tải lại danh sách + chi tiết,
 * để lần thử sau gửi đúng `version`. Lỗi hiện trong dialog đã map tiếng Việt nên không bật toast lỗi.
 */

import { TOAST_MESSAGES, VEHICLE_TYPE_STATUS } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";
import { toast } from "@/components/shared/Toast";

import { createVehicleType, setVehicleTypeStatus, updateVehicleType } from "./api";
import { isStaleVehicleTypeError } from "./errors";
import { vehicleTypeKeys } from "./queries";

const T = TOAST_MESSAGES.vehicleType;
const ROOT = [vehicleTypeKeys.all];
const base = { invalidate: ROOT, showErrorToast: false } as const;

export const useCreateVehicleType = withStaleRefetch(
  createMutation(createVehicleType, { ...base, successMessage: T.created }),
  ROOT,
  isStaleVehicleTypeError,
);

export const useUpdateVehicleType = withStaleRefetch(
  createMutation(updateVehicleType, { ...base, successMessage: T.updated }),
  ROOT,
  isStaleVehicleTypeError,
);

/** Ngừng dùng / dùng lại từ bảng — toast theo trạng thái mới. */
export const useSetVehicleTypeStatus = withStaleRefetch(
  createMutation(setVehicleTypeStatus, {
    ...base,
    onSuccess: (saved) =>
      toast.success(saved.status === VEHICLE_TYPE_STATUS.ACTIVE ? T.activated : T.deactivated),
  }),
  ROOT,
  isStaleVehicleTypeError,
);
