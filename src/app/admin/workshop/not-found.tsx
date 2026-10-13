import { ADMIN_ROUTES } from "@/constants";
import { RouteNotFound } from "@/components/backoffice/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFound
      title="Không tìm thấy trang"
      description="Trang xưởng in không tồn tại."
      href={ADMIN_ROUTES.workshop}
    />
  );
}
