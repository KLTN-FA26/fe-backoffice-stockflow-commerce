import { ADMIN_ROUTES } from "@/constants";
import { RouteNotFound } from "@/components/backoffice/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFound
      title="Không tìm thấy hội thoại"
      description="Hội thoại không tồn tại hoặc đường dẫn không hợp lệ."
      href={ADMIN_ROUTES.chat.list}
    />
  );
}
