import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";

import { getTransferPack } from "./transfer-pack-api";
import { packingKeys } from "./packing-queries";

/**
 * Key của trạm đóng gói chuyển kho nằm DƯỚI `packingKeys.all` (= dưới `fulfillmentKeys.all`): mọi mutation làm mới
 * "mọi thứ của xuất kho" làm mới luôn phiên đóng gói chuyển kho mà không phải nhớ thêm key.
 */
export const transferPackKeys = {
  all: [...packingKeys.all, "transfer"] as const,
  sessions: () => [...transferPackKeys.all, "session"] as const,
  session: (packId: string) => [...transferPackKeys.sessions(), packId] as const,
};

/** Phiên đóng gói chuyển kho — nguồn sự thật của trạm: dòng của lệnh và các kiện. Cần `fulfillment-packages:READ`. */
export function useTransferPack(packId: string | null | undefined, options: { enabled: boolean }) {
  return useQuery({
    queryKey: transferPackKeys.session(packId ?? ""),
    queryFn: ({ signal }) => getTransferPack(packId ?? "", signal),
    ...QUERY_TIMES.tracking,
    enabled: options.enabled && !!packId,
  });
}
