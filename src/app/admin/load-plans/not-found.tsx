import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

const { common, shipping } = UI_LABELS;

/** Route nhóm bắt buộc có not-found (api-conventions §8) — kế hoạch xếp xe đang phát triển. */
export default function LoadPlansNotFound() {
  return (
    <EmptyState
      title={shipping.loadPlanTitle}
      description={shipping.loadPlanInProgress}
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href={ADMIN_ROUTES.shipments.list}>{common.backToList}</Link>
        </Button>
      }
    />
  );
}
