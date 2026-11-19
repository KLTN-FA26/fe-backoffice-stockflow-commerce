import { ADMIN_ROUTES, PRODUCTION_LABELS } from "@/constants";
import { RouteNotFound } from "@/components/backoffice/RouteStates";

const C = PRODUCTION_LABELS.order.errorCopy;

export default function NotFound() {
  return (
    <RouteNotFound
      title={C.notFoundTitle}
      description={C.notFoundDescription}
      href={ADMIN_ROUTES.productionOrders.list}
    />
  );
}
