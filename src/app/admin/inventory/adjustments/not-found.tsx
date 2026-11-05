import { INVENTORY_LABELS } from "@/constants/inventory";

import { EmptyState } from "@/components/shared/EmptyState";

export default function NotFound() {
  return <EmptyState title={INVENTORY_LABELS.noResults} />;
}
