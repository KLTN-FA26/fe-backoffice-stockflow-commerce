"use client";

import { ArrowLeft, Printer } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { packingErrorMessage } from "@/features/fulfillment/packing-errors";
import { usePackageLabel } from "@/features/fulfillment/packing-queries";
import { Alert } from "@/components/shared/Alert";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import { LabelSheet } from "./LabelSheet";

const L = UI_LABELS.packing;

/**
 * Nhãn một kiện đã niêm phong (BE `GET .../packages/{pid}/label`, `no-store`). Thay vùng nội dung của
 * trạm (trạng thái nằm trên URL `?label=`) thay vì hộp thoại: khung back-office đã ẩn khi in
 * (`print:hidden`), nên `window.print()` chỉ ra đúng tờ nhãn. Kiện chưa niêm phong → BE 409.
 */
export function PackageLabelView({
  taskId,
  packageId,
  onBack,
}: {
  taskId: string;
  packageId: string;
  onBack: () => void;
}) {
  const query = usePackageLabel({ taskId, packageId }, true);
  const label = query.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="size-3.5" /> {L.label.close}
        </Button>
        {label && (
          <Button type="button" size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" /> {L.action.print}
          </Button>
        )}
      </div>
      {query.isPending && <Skeleton className="mx-auto h-96 w-full max-w-[26rem]" />}
      {query.isError && (
        <Alert tone="danger" title={L.label.unavailableTitle} className="print:hidden">
          {packingErrorMessage(query.error)}{" "}
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => void query.refetch()}
          >
            {UI_LABELS.common.retry}
          </Button>
        </Alert>
      )}
      {label && (
        <>
          <p className="text-ink-tertiary text-center text-xs print:hidden">
            {label.provisional && `${L.label.provisionalHint} `}
            {L.label.printHint}
          </p>
          <LabelSheet label={label} />
        </>
      )}
    </div>
  );
}
