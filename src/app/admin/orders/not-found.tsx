import { OrderLoadError } from "@/features/order";

/** Đường dẫn trong /admin/orders không tồn tại — cùng màn "không tìm thấy" của chi tiết đơn. */
export default function OrdersNotFound() {
  return <OrderLoadError error={null} kind="not-found" />;
}
