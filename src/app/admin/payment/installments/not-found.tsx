import { PAYMENT_ROUTES } from "@/constants/payment";
import { RouteNotFound } from "@/components/backoffice/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFound
      title="Không tìm thấy đợt thanh toán"
      description="Đợt thanh toán không tồn tại hoặc đường dẫn không hợp lệ."
      href={PAYMENT_ROUTES.installments.list}
    />
  );
}
