import { LOAD_STATUS, SHARED_QUERY_ROOTS, SHIPPING_LIMITS } from "@/constants";
import { useQuery } from "@tanstack/react-query";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getLoad, getManifest, listLoads } from "./api";
import { listCarriers } from "./carrier-api";
import { getShipment, listShipments } from "./shipment-api";
import { getWaybillHistory } from "./waybill-api";

import type { ListLoadParams } from "./api";
import type { ListCarrierParams } from "./carrier-api";
import type { ListShipmentParams } from "./shipment-api";
import type { Carrier, Load, LoadRow, Shipment, ShipmentRow } from "./types";

export const loadKeys = createQueryKeys<ListLoadParams>(SHARED_QUERY_ROOTS.fulfillmentLoads);
export const shipmentKeys = createQueryKeys<ListShipmentParams>("fulfillment-shipments");
export const carrierKeys = createQueryKeys<ListCarrierParams>("fulfillment-carriers");

export const manifestKey = (loadId: string) => [...loadKeys.all, "manifest", loadId] as const;
export const waybillHistoryKey = (loadId: string) =>
  [...loadKeys.all, "waybill-history", loadId] as const;

export const useLoads = createListQuery<LoadRow, ListLoadParams>(loadKeys, listLoads);

/**
 * Chi tiết chuyến: đang xếp hàng (LOADING) thì tự tải lại định kỳ — kiện quét từ máy khác hiện ra và
 * nút bàn giao tự mở khi đủ kiện, không cần F5. Chuyến khác trạng thái thì thôi.
 */
export const useLoad = createDetailQuery<Load>(loadKeys, getLoad, {
  refetchInterval: (query) =>
    query.state.data?.status === LOAD_STATUS.LOADING ? SHIPPING_LIMITS.loadPollMs : false,
});

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
