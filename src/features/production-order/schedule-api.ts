/**
 * `GET /production-schedule?producerId&warehouseId&from&to&alertsOnly&limit` (production-schedule:READ; Quản lý kho
 * chỉ thấy kho mình — BE lọc). Mỗi danh sách tối đa `limit` dòng (mặc định 100, tối đa 200), `truncated` báo bị cắt.
 */

import { PRODUCTION_LIMITS } from "@/constants";
import { api } from "@/lib/api/client";

import { productionScheduleDto } from "./schedule-schemas";

import type { ProductionSchedule, ProductionScheduleParams } from "./schedule-schemas";

export const PRODUCTION_SCHEDULE_PATH = "/production-schedule";

export async function getProductionSchedule(
  params: ProductionScheduleParams,
  signal?: AbortSignal,
): Promise<ProductionSchedule> {
  const { data } = await api.get<unknown>(PRODUCTION_SCHEDULE_PATH, {
    params: {
      producerId: params.producerId || undefined,
      warehouseId: params.warehouseId || undefined,
      from: params.from || undefined,
      to: params.to || undefined,
      alertsOnly: params.alertsOnly || undefined,
      limit: params.limit ?? PRODUCTION_LIMITS.scheduleLimit,
    },
    signal,
  });
  return productionScheduleDto.parse(data);
}
