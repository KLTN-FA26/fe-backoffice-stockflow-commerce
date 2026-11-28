import {
  LOAD_STATUS,
  SHARED_QUERY_ROOTS,
  SHIPMENT_PERMISSIONS,
  SHIPPING_LIMITS,
} from "@/constants";
import { CARRIER_BOOKING_STATUS } from "@/constants/statuses";
import { useQuery } from "@tanstack/react-query";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { useCan } from "@/lib/auth";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getLoad, getManifest, listLoads } from "./api";
import { isApiBookedLoad, latestCarrierId } from "./ftl-selectors";
import { listCarriers } from "./carrier-api";
import { getShipment, listShipments } from "./shipment-api";
import { getWaybillHistory, listImportWarehouses } from "./waybill-api";

import type { ListLoadParams } from "./api";
import type { ListCarrierParams } from "./carrier-api";
import type { ListShipmentParams } from "./shipment-api";
import type { Carrier, Load, LoadRow, Shipment, ShipmentRow } from "./types";

const baseLoadKeys = createQueryKeys<ListLoadParams>(SHARED_QUERY_ROOTS.fulfillmentLoads);
export const loadKeys = {
  ...baseLoadKeys,
  /** Hãng dùng gần nhất của kho (gần đúng) — ô chọn hãng khi đặt xe. */
  recentCarrier: (warehouseId: string) =>
    [...baseLoadKeys.all, "recent-carrier", warehouseId] as const,
};
export const shipmentKeys = createQueryKeys<ListShipmentParams>("fulfillment-shipments");
export const carrierKeys = createQueryKeys<ListCarrierParams>("fulfillment-carriers");

export const manifestKey = (loadId: string) => [...loadKeys.all, "manifest", loadId] as const;
export const waybillHistoryKey = (loadId: string) =>
  [...loadKeys.all, "waybill-history", loadId] as const;

/** Kho được chọn khi nhập mã vận đơn (BE giới hạn theo kho được gán) — dưới root chuyến xe. */
export const importWarehouseKey = () => [...loadKeys.all, "waybill-import-warehouses"] as const;

export const useLoads = createListQuery<LoadRow, ListLoadParams>(loadKeys, listLoads);

/**
 * Chi tiết chuyến: đang xếp hàng thì tải lại kiện quét từ máy khác; chuyến API đã huỷ còn đơn ở hãng thì
 * tải lại tới khi hãng xác nhận huỷ (hoặc lỗi), không để người dùng đợi một phút mà không thấy tiến trình.
 * Chuyến đã đặt qua API cũng tải lại để nhận tài xế mới / sự kiện tài xế huỷ qua webhook.
 */
export const useLoad = createDetailQuery<Load>(loadKeys, getLoad, {
  refetchInterval: (query) => {
    const load = query.state.data;
    if (load?.status === LOAD_STATUS.LOADING) return SHIPPING_LIMITS.loadPollMs;
    if (load?.status === LOAD_STATUS.VEHICLE_BOOKED && isApiBookedLoad(load))
      return SHIPPING_LIMITS.loadPollMs;
    if (
      load?.status === LOAD_STATUS.CANCELLED &&
      isApiBookedLoad(load) &&
      load.carrierBookingToCancel &&
      ([CARRIER_BOOKING_STATUS.BOOKED, CARRIER_BOOKING_STATUS.REQUESTED] as const).some(
        (status) => load.carrierBooking?.status === status,
      )
    )
      return SHIPPING_LIMITS.loadPollMs;
    return false;
  },
});

/**
 * Hãng dùng gần nhất của kho — GẦN ĐÚNG: hãng có chuyến bàn giao muộn nhất trong 20 chuyến đã bàn giao mà BE liệt kê trước
 * (BE xếp theo mới tạo nhất, không theo ngày bàn giao) — để đưa lên đầu ô chọn hãng khi đặt xe. Chỉ gọi khi người dùng được
 * đọc danh sách chuyến; lỗi → không có gợi ý, không chặn.
 */
export function useApproxRecentCarrierId(warehouseId: string | undefined) {
  const canRead = useCan(SHIPMENT_PERMISSIONS.read);
  return useQuery({
    queryKey: loadKeys.recentCarrier(warehouseId ?? ""),
    queryFn: async ({ signal }) =>
      latestCarrierId(
        (
          await listLoads(
            { warehouseId, status: LOAD_STATUS.DISPATCHED, size: SHIPPING_LIMITS.recentLoadsSize },
            signal,
          )
        ).items,
      ),
    enabled: canRead && !!warehouseId,
    ...QUERY_TIMES.master,
    retry: false,
  });
}

export function useManifest(loadId: string, enabled = true) {
  return useQuery({
    queryKey: manifestKey(loadId),
    queryFn: ({ signal }) => getManifest(loadId, signal),
    enabled: enabled && !!loadId,
    ...QUERY_TIMES.detail,
    // Biên bản in luôn lấy bản mới: đối soát đang xếp thay đổi từng lần quét
    refetchOnMount: "always",
    // Đang xếp hàng (LOADING) → tự tải lại: kiện quét từ máy khác hiện ra, bản đủ kiện mở nút in
    refetchInterval: (query) =>
      query.state.data?.status === LOAD_STATUS.LOADING ? SHIPPING_LIMITS.loadPollMs : false,
  });
}

export const useShipments = createListQuery<ShipmentRow, ListShipmentParams>(
  shipmentKeys,
  listShipments,
);

export const useShipment = createDetailQuery<Shipment>(shipmentKeys, getShipment);

/** Danh mục hãng (màn danh mục): lọc theo trạng thái / từ khoá, phân trang ở máy chủ. */
export const useCarriers = createListQuery<Carrier, ListCarrierParams>(carrierKeys, listCarriers, {
  ...QUERY_TIMES.master,
});

/**
 * Lịch sử mã vận đơn của chuyến (docs 09 §4.4, BR-24). Chỉ tải khi người dùng mở phần lịch sử (`enabled`); khoá nằm
 * dưới `loadKeys.all` nên mọi thao tác làm mới chuyến cũng làm mới lịch sử.
 */
export function useWaybillHistory(loadId: string, enabled: boolean) {
  return useQuery({
    queryKey: waybillHistoryKey(loadId),
    queryFn: ({ signal }) => getWaybillHistory(loadId, signal),
    enabled: enabled && !!loadId,
    ...QUERY_TIMES.detail,
  });
}

/** Hãng đang dùng (BE `status=ACTIVE`) để chọn cho chuyến; một trang 200 dòng là đủ danh mục hãng. */
export const useActiveCarriers = createListQuery<Carrier, ListCarrierParams>(
  carrierKeys,
  (params, signal) => listCarriers({ ...params, status: "ACTIVE" }, signal),
  { ...QUERY_TIMES.master },
);

/** Kho người dùng được nhập mã vận đơn (`fulfillment-waybill-imports:CREATE`): danh mục, ít đổi. */
export function useImportWarehouses(enabled = true) {
  return useQuery({
    queryKey: importWarehouseKey(),
    queryFn: ({ signal }) => listImportWarehouses(signal),
    enabled,
    ...QUERY_TIMES.master,
  });
}
