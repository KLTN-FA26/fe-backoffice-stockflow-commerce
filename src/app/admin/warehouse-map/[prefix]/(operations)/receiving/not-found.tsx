import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

const { common, receipt } = UI_LABELS;

/** Phiếu nhận không tồn tại trong tab theo kho (api-conventions §8: mỗi nhóm route có error / not-found / loading). */
export default function ReceivingNotFound() {
  return (
    <EmptyState
      title={receipt.notFoundTitle}
      description={receipt.notFoundDescription}
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href={ADMIN_ROUTES.warehouseMap.root}>{common.backToList}</Link>
        </Button>
      }
    />
  );
}
