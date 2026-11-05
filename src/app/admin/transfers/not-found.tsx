import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

const { common, transfer } = UI_LABELS;

/** Route lệnh chuyển kho không tồn tại (api-conventions §8). */
export default function TransfersNotFound() {
  return (
    <EmptyState
      title={transfer.notFoundTitle}
      description={transfer.notFoundDescription}
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href={ADMIN_ROUTES.transfers.list}>{common.backToList}</Link>
        </Button>
      }
    />
  );
}
