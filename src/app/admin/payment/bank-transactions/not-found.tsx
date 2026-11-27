import { BANK_TRANSACTION_LABELS, BANK_TRANSACTION_ROUTES } from "@/constants/bank-transaction";
import { RouteNotFound } from "@/components/backoffice/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFound
      title={BANK_TRANSACTION_LABELS.notFoundTitle}
      description={BANK_TRANSACTION_LABELS.notFoundDescription}
      href={BANK_TRANSACTION_ROUTES.list}
    />
  );
}
