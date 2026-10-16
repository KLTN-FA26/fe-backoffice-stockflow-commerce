import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

const { common, shipping } = UI_LABELS;

/** Route chuyến xe không tồn tại (api-conventions §8). */
export default function ShipmentsNotFound() {
  return (
    <EmptyState
      title={shipping.notFoundTitle}
      description={shipping.notFoundDescription}
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href={ADMIN_ROUTES.shipments.list}>{common.backToList}</Link>
        </Button>
      }
    />
  );
}
