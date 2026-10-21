import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

import type { PurchaseOrder } from "@/features/purchase-order";

const L = UI_LABELS.purchaseOrder;

/** Màn sửa nháp mở với PO không sửa được (không phải nháp thường, hoặc thiếu quyền). */
export function PoNotEditable({ po }: { po: PurchaseOrder }) {
  return (
    <>
      <PageHeader title={po.poNumber} />
      <EmptyState
        title={L.draftEdit.notEditableTitle}
        description={L.draftEdit.notEditableDescription}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href={ADMIN_ROUTES.purchaseOrders.detail(po.poId)}>
              {L.draftEdit.backToDetail}
            </Link>
          </Button>
        }
      />
    </>
  );
}
