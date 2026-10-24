import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { reprintLabelHref } from "@/features/shipping/errors";
import { Alert } from "@/components/shared/Alert";

const L = UI_LABELS.shipping.load;

/** Lối xử lý khi BE từ chối bàn giao vì nhãn kiện lệch COD (BR-04): in lại nhãn ở trạm đóng gói của đơn. */
export function RefusalNotice({
  orderNumber,
  taskId,
}: {
  orderNumber?: string;
  taskId?: string | null;
}) {
  return (
    <Alert tone="warning">
      <p>{L.reprintHint}</p>
      <p className="mt-1">
        <Link href={reprintLabelHref(taskId)} className="inline-flex items-center gap-1 underline">
          {L.reprintLabel}
          {orderNumber ? ` (${orderNumber})` : ""} <ExternalLink className="size-3" aria-hidden />
        </Link>
      </p>
    </Alert>
  );
}
