import { PAYMENT_ROUTES } from "@/constants/payment";
import { RouteNotFound } from "@/components/backoffice/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFound
      title="Không tìm thấy phiếu thu"
      description="Phiếu thu không tồn tại hoặc đường dẫn không hợp lệ."
      href={PAYMENT_ROUTES.receipts.list}
    />
  );
}
