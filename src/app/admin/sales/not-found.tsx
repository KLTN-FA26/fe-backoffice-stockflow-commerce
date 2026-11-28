import { SALES_ROUTES } from "@/constants/sales-owner";
import { RouteNotFound } from "@/components/backoffice/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFound
      title="Không tìm thấy trang"
      description="Trang phân công khách không tồn tại hoặc đường dẫn không hợp lệ."
      href={SALES_ROUTES.assignment}
    />
  );
}
