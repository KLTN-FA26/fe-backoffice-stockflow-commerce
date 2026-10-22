import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getVehicleType, listVehicleTypes } from "./api";

import type { ListVehicleTypeParams } from "./api";
import type { VehicleType } from "./types";

/** Khoá gốc `fulfillment-vehicle-types`: mọi mutation làm mới danh sách lẫn chi tiết qua `all`. */
export const vehicleTypeKeys = createQueryKeys<ListVehicleTypeParams>("fulfillment-vehicle-types");

export const useVehicleTypes = createListQuery<VehicleType, ListVehicleTypeParams>(
  vehicleTypeKeys,
  listVehicleTypes,
);

export const useVehicleType = createDetailQuery<VehicleType>(vehicleTypeKeys, getVehicleType);
