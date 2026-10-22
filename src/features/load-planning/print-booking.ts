/**
 * Thông tin đặt xe in trên phiếu xếp hàng (SCRUM-287 PR F6): hãng, biển số, tài xế của chuyến (dispatch load) mà một xe đã
 * chốt trở thành. Kế hoạch chỉ mang `load: {loadId, code, status}`; phần đặt xe nằm ở `GET /fulfillment/loads/{id}`
 * (BE PR #162 `LoadResponse`, quyền `fulfillment-shipments:READ`). Feature không import chéo `features/shipping`, nên chỉ
 * đọc đúng các trường cần, mọi trường đều `nullish` (chuyến chưa đặt xe thì vắng).
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { SHARED_QUERY_ROOTS } from "@/constants";
import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";

const LOADS_PATH = "/fulfillment/loads";

export const beLoadBookingSchema = z.object({
  loadId: z.string(),
  code: z.string(),
  status: z.string().nullish(),
  carrierCode: z.string().nullish(),
  carrierName: z.string().nullish(),
  vehiclePlate: z.string().nullish(),
  driverName: z.string().nullish(),
  driverPhone: z.string().nullish(),
});

export type LoadBooking = z.infer<typeof beLoadBookingSchema>;

export async function getLoadBooking(loadId: string, signal?: AbortSignal): Promise<LoadBooking> {
  const { data } = await api.get<unknown>(`${LOADS_PATH}/${encodeURIComponent(loadId)}`, {
    signal,
  });
  return beLoadBookingSchema.parse(data);
}

/** Dưới root `fulfillment-loads` để mọi thay đổi chuyến (đặt xe, huỷ đặt) làm mới phiếu. */
export const loadBookingKey = (loadId: string) =>
  [SHARED_QUERY_ROOTS.fulfillmentLoads, "booking", loadId] as const;

/** Chỉ tải khi `bookingNeedsFetch` (xe đã đặt xe và người xem có quyền đọc lô); thiếu quyền / lỗi thì phiếu ghi đúng lý do. */
export function useLoadBooking(loadId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: loadBookingKey(loadId ?? ""),
    queryFn: ({ signal }) => getLoadBooking(loadId ?? "", signal),
    enabled: enabled && !!loadId,
    retry: false,
    ...QUERY_TIMES.detail,
  });
}
