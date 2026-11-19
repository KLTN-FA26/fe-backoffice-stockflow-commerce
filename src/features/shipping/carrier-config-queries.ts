/**
 * Shipping — truy vấn cấu hình hãng tích hợp API đặt xe (mã dịch vụ, điểm lấy hàng). Hộp thoại hãng đọc danh sách MỘT lần
 * khi mở rồi giữ bản người dùng đang sửa: không tải lại khi đổi cửa sổ để không ghi đè dòng đang gõ dở.
 */

import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";

import {
  listCarrierServices,
  listPickupPoints,
  listServiceCodes,
  listVehicleTypeOptions,
} from "./carrier-config-api";
import { carrierKeys } from "./queries";

export const carrierConfigKeys = {
  serviceCodes: (carrierId: string) => [...carrierKeys.all, "service-codes", carrierId] as const,
  pickupPoints: (carrierId: string) => [...carrierKeys.all, "pickup-points", carrierId] as const,
  services: (carrierId: string, cityId: string) =>
    [...carrierKeys.all, "services", carrierId, cityId] as const,
  vehicleTypeOptions: () => [...carrierKeys.all, "vehicle-type-options"] as const,
};

const FRESH_ON_OPEN = {
  staleTime: 0,
  gcTime: 0,
  refetchOnWindowFocus: false,
  retry: false,
} as const;

/** Mã dịch vụ đã lưu của hãng (`fulfillment-shipments:READ`). `carrierId` rỗng = hãng mới, chưa có gì để đọc. */
export function useServiceCodes(carrierId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: carrierConfigKeys.serviceCodes(carrierId ?? ""),
    queryFn: ({ signal }) => listServiceCodes(carrierId ?? "", signal),
    enabled: enabled && !!carrierId,
    ...FRESH_ON_OPEN,
  });
}

/** Điểm lấy hàng đã lưu của hãng (`fulfillment-shipments:READ`). */
export function usePickupPoints(carrierId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: carrierConfigKeys.pickupPoints(carrierId ?? ""),
    queryFn: ({ signal }) => listPickupPoints(carrierId ?? "", signal),
    enabled: enabled && !!carrierId,
    ...FRESH_ON_OPEN,
  });
}

/**
 * Dịch vụ của hãng ở một thành phố: BE HỎI API CỦA HÃNG nên chỉ chạy khi người dùng bấm tra (`enabled` do nút bật), không
 * tự tải và không làm mới ngầm.
 */
export function useCarrierServices(
  carrierId: string | undefined,
  cityId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: carrierConfigKeys.services(carrierId ?? "", cityId),
    queryFn: ({ signal }) => listCarrierServices(carrierId ?? "", cityId, signal),
    enabled: enabled && !!carrierId && cityId !== "",
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** Loại xe cho ô chọn của bảng mã dịch vụ (danh mục hiếm đổi). */
export function useVehicleTypeOptions(enabled: boolean) {
  return useQuery({
    queryKey: carrierConfigKeys.vehicleTypeOptions(),
    queryFn: ({ signal }) => listVehicleTypeOptions(signal),
    enabled,
    ...QUERY_TIMES.master,
  });
}
