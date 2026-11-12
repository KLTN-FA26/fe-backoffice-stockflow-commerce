import { PAYMENT_ROUTES } from "@/constants/payment";
import { RouteNotFound } from "@/components/backoffice/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFound
      title="Không tìm thấy đơn"
      description="Đơn không tồn tại hoặc chưa có khoản phải hoàn."
      href={PAYMENT_ROUTES.refunds.list}
    />
  );
}
