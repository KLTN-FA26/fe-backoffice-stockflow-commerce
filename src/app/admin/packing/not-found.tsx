import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

const { common, fulfillment } = UI_LABELS;

/** Route không tồn tại (api-conventions §8: mỗi nhóm route có error / not-found / loading). */
export default function PackingNotFound() {
  return (
    <EmptyState
      title={fulfillment.notFoundTitle}
      description={fulfillment.notFoundDescription}
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href={ADMIN_ROUTES.packing.list}>{common.backToList}</Link>
        </Button>
      }
    />
  );
}
