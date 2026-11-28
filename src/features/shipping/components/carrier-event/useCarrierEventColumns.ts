import { SHIPMENT_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";
import { useActiveCarriers } from "@/features/shipping/queries";

import { buildCarrierEventColumns } from "./carrier-event-columns";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { CarrierEventRow } from "@/features/shipping/carrier-event-types";

/**
 * Cột của nhật ký sự kiện: mã chuyến / lô là liên kết khi xem được trang giao hàng; cột hãng hiện tên hãng (R3: tên trước,
 * mã ở chú thích) — danh mục hãng cần `fulfillment-shipments:READ`, thiếu quyền hoặc hãng đã ngừng dùng thì cột chỉ còn mã.
 */
export function useCarrierEventColumns(
  open: (row: CarrierEventRow) => void,
): ColumnDef<CarrierEventRow>[] {
  const canLink = useCan(SHIPMENT_PERMISSIONS.viewPage);
  const carriers = useActiveCarriers({}, { enabled: useCan(SHIPMENT_PERMISSIONS.read) });
  const names = new Map(carriers.data?.items.map((carrier) => [carrier.carrierId, carrier.name]));
  return buildCarrierEventColumns(open, canLink, (row) =>
    row.carrierId ? names.get(row.carrierId) : undefined,
  );
}
