import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";

import { findTransferPack, getTransferPack, getTransferPackageLabel } from "./transfer-pack-api";
import { packingKeys } from "./packing-queries";

/**
 * Key của trạm đóng gói chuyển kho nằm DƯỚI `packingKeys.all` (= dưới `fulfillmentKeys.all`): mọi mutation làm mới
 * "mọi thứ của xuất kho" làm mới luôn phiên đóng gói chuyển kho mà không phải nhớ thêm key.
 */
export const transferPackKeys = {
  all: [...packingKeys.all, "transfer"] as const,
  sessions: () => [...transferPackKeys.all, "session"] as const,
  session: (packId: string) => [...transferPackKeys.sessions(), packId] as const,
  /** Phiên hiện hành tìm theo lệnh (chưa biết packId). */
  byTransfer: (transferOrderId: string) =>
    [...transferPackKeys.all, "by-transfer", transferOrderId] as const,
  /** Nhãn nằm NGOÀI `all` (cùng gốc `packingKeys`): làm mới phiên sau khi lấy nhãn không kéo theo tải lại chính nhãn. */
  label: (packId: string, packageId: string) =>
    [...packingKeys.all, "transfer-label", packId, packageId] as const,
};

/**
 * Phiên hiện hành của lệnh khi URL chưa có `?pack` (không mở gì). Lệnh chưa từng đóng gói → 404 `NOT_FOUND` (không thử lại).
 * Cần `fulfillment-packages:READ`.
 */
export function useCurrentTransferPack(transferOrderId: string, options: { enabled: boolean }) {
  return useQuery({
    queryKey: transferPackKeys.byTransfer(transferOrderId),
    queryFn: ({ signal }) => findTransferPack(transferOrderId, signal),
    ...QUERY_TIMES.tracking,
    enabled: options.enabled && !!transferOrderId,
    retry: false,
  });
}

/** Nhãn một kiện: luôn lấy mới (in nhãn cũ làm nhãn hiện hành nên không giữ cache). */
export function useTransferPackageLabel(packId: string, packageId: string, enabled: boolean) {
  return useQuery({
    queryKey: transferPackKeys.label(packId, packageId),
    queryFn: ({ signal }) => getTransferPackageLabel({ packId, packageId }, signal),
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** Phiên đóng gói chuyển kho — nguồn sự thật của trạm: dòng của lệnh và các kiện. Cần `fulfillment-packages:READ`. */
export function useTransferPack(packId: string | null | undefined, options: { enabled: boolean }) {
  return useQuery({
    queryKey: transferPackKeys.session(packId ?? ""),
    queryFn: ({ signal }) => getTransferPack(packId ?? "", signal),
    ...QUERY_TIMES.tracking,
    enabled: options.enabled && !!packId,
  });
}
