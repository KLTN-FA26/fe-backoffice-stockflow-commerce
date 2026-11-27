import { OrderWarehouseName } from "./OrderWarehouseName";

import type { Order } from "../types";

/** Tên kho BE kèm sẵn trong đơn (FE#286): không gọi API, ai xem đơn cũng thấy; mã kho nhỏ ở dòng dưới. */
function WarehouseLabel({ name, code }: { name: string; code: string | null }) {
  return (
    <>
      <span className="block truncate">{name}</span>
      {code && code !== name && (
        <span className="text-ink-secondary block font-[family-name:var(--font-mono)] text-xs">
          {code}
        </span>
      )}
    </>
  );
}

/** Ô "Kho xuất" của thẻ thông tin đơn: tên BE kèm sẵn → tra danh mục (đơn cũ) → "Chưa chọn kho xuất". */
export function OrderWarehouseCell({
  order,
}: {
  order: Pick<Order, "warehouseId" | "warehouseName" | "warehouseCode">;
}) {
  if (order.warehouseName) {
    return <WarehouseLabel name={order.warehouseName} code={order.warehouseCode} />;
  }
  if (order.warehouseId) return <OrderWarehouseName warehouseId={order.warehouseId} />;
  return <>Chưa chọn kho xuất</>;
}
