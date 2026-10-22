import type { z } from "zod";

import type { VehicleTypeBody } from "./input-schemas";
import type { beVehicleTypeSchema } from "./schemas";

export type VehicleType = z.infer<typeof beVehicleTypeSchema>;
export type { VehicleTypeBody, VehicleTypeFormInput, VehicleTypeFormValues } from "./input-schemas";

/** Sửa một loại xe: `version` của lần đọc trước (BE trả 409 OPTIMISTIC_LOCK nếu đã đổi). */
export interface UpdateVehicleTypeInput {
  vehicleTypeId: string;
  version: number;
  body: VehicleTypeBody;
}

/** Đổi trạng thái từ bảng: PUT đủ trường của dòng hiện có, chỉ đổi `status`. */
export interface SetVehicleTypeStatusInput {
  vehicleType: VehicleType;
  status: VehicleType["status"];
}
