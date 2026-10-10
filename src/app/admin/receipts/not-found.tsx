import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

const { common, receipt } = UI_LABELS;

/** Route phiếu nhận không tồn tại (api-conventions §8: mỗi nhóm route có error / not-found / loading). */
export default function ReceiptsNotFound() {
  return (
    <EmptyState
      title={receipt.notFoundTitle}
      description={receipt.notFoundDescription}
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href={ADMIN_ROUTES.receipts.list}>{common.backToList}</Link>
        </Button>
      }
    />
  );
}
