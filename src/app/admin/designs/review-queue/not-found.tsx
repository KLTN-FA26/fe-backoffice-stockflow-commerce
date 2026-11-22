import { ADMIN_ROUTES, DESIGN_REVIEW_LABELS } from "@/constants";
import { RouteNotFound } from "@/components/backoffice/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFound
      title={DESIGN_REVIEW_LABELS.notFoundTitle}
      description={DESIGN_REVIEW_LABELS.notFoundDescription}
      href={ADMIN_ROUTES.designs.reviewQueue}
      actionLabel={DESIGN_REVIEW_LABELS.backToQueue}
    />
  );
}
