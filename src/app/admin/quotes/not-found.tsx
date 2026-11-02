import { ADMIN_ROUTES } from "@/constants";
import { RouteNotFound } from "@/components/backoffice/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFound
      title="Không tìm thấy báo giá"
      description="Báo giá không tồn tại hoặc đường dẫn không hợp lệ."
      href={ADMIN_ROUTES.quotes.list}
    />
  );
}
