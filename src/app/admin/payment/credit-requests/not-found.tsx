import { CREDIT_REQUEST_LABELS, CREDIT_REQUEST_ROUTES } from "@/constants/credit-request";
import { RouteNotFound } from "@/components/backoffice/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFound
      title={CREDIT_REQUEST_LABELS.notFoundTitle}
      description={CREDIT_REQUEST_LABELS.notFoundDescription}
      href={CREDIT_REQUEST_ROUTES.list}
    />
  );
}
