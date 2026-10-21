import { PORTAL_ROUTES, UI_LABELS } from "@/constants";
import { RouteNotFound } from "@/components/backoffice/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFound
      title="Không tìm thấy trang"
      description="Trang không tồn tại hoặc bạn không có quyền xem."
      href={PORTAL_ROUTES.home}
      actionLabel={UI_LABELS.common.backToHome}
    />
  );
}
