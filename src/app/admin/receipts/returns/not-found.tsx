import { RETURN_RECEIPT_LABELS } from "@/constants/labels-return";
import { RETURN_ROUTES } from "@/constants/returns";
import { RouteNotFound } from "@/components/backoffice/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFound
      title={RETURN_RECEIPT_LABELS.notFoundTitle}
      description={RETURN_RECEIPT_LABELS.notFoundDescription}
      href={RETURN_ROUTES.receipts.list}
    />
  );
}
