import { EINVOICE_ROUTES } from "@/constants/einvoice";
import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { RouteNotFound } from "@/components/backoffice/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFound
      title={EINVOICE_LABELS.detail.notFoundTitle}
      description={EINVOICE_LABELS.detail.notFoundDescription}
      href={EINVOICE_ROUTES.list}
    />
  );
}
