import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

const { common, purchaseOrder } = UI_LABELS;

/** Route PO không tồn tại (api-conventions §8: mỗi nhóm route có error / not-found / loading). */
export default function PurchaseOrdersNotFound() {
  return (
    <EmptyState
      title={purchaseOrder.notFoundTitle}
      description={purchaseOrder.notFoundDescription}
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href={ADMIN_ROUTES.purchaseOrders.list}>{common.backToList}</Link>
        </Button>
      }
    />
  );
}
