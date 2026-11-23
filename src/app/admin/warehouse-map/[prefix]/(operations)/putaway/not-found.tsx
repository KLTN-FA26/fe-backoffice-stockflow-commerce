import Link from "next/link";

import { ADMIN_ROUTES, PUTAWAY_LABELS, UI_LABELS } from "@/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

const { errorCopy } = PUTAWAY_LABELS;

/** Route không tồn tại (api-conventions §8: mỗi nhóm route có error / not-found / loading). */
export default function PutawayNotFound() {
  return (
    <EmptyState
      title={errorCopy.notFoundTitle}
      description={errorCopy.notFoundDescription}
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href={ADMIN_ROUTES.warehouseMap.root}>{UI_LABELS.common.backToList}</Link>
        </Button>
      }
    />
  );
}
