import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

const { common, loadPlan } = UI_LABELS;

/** Route nhóm bắt buộc có not-found (api-conventions §8). */
export default function LoadPlansNotFound() {
  return (
    <EmptyState
      title={loadPlan.notFoundTitle}
      description={loadPlan.notFoundDescription}
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href={ADMIN_ROUTES.loadPlans.list}>{common.backToList}</Link>
        </Button>
      }
    />
  );
}
