import { ADMIN_ROUTES, DESIGN_ROUND_LABELS } from "@/constants";
import { RouteNotFound } from "@/components/backoffice/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFound
      title={DESIGN_ROUND_LABELS.notFoundTitle}
      description={DESIGN_ROUND_LABELS.notFoundDescription}
      href={ADMIN_ROUTES.designReviewRounds.list}
      actionLabel="Về danh sách vòng duyệt"
    />
  );
}
