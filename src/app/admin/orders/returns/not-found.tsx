import { RETURN_LABELS } from "@/constants/labels-return";
import { RETURN_ROUTES } from "@/constants/returns";
import { RouteNotFound } from "@/components/backoffice/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFound
      title={RETURN_LABELS.notFoundTitle}
      description={RETURN_LABELS.notFoundDescription}
      href={RETURN_ROUTES.list}
    />
  );
}
