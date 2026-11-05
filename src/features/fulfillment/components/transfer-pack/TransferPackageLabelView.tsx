"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { transferPackErrorMessage } from "@/features/fulfillment/transfer-pack-errors";
import {
  transferPackKeys,
  useTransferPackageLabel,
} from "@/features/fulfillment/transfer-pack-queries";
import { Alert } from "@/components/shared/Alert";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import { TransferLabelSheet } from "./TransferLabelSheet";

const L = UI_LABELS.packing;
const T = UI_LABELS.transferPack.label;

/**
 * Nhãn một kiện đã niêm phong của lệnh chuyển kho (BE `GET …/packages/{id}/label`). Thay vùng nội dung của trạm (trạng thái
 * trên URL `?label=`) để `window.print()` chỉ ra tờ nhãn. Nhãn đã cũ (`labelOutdated`): mở nhãn là in lại — BE làm nhãn hiện
 * hành nên phiên được tải lại để cờ "Cần in lại nhãn" biến mất; màn nói rõ để dán nhãn mới. Kiện chưa niêm phong → BE 409.
 */
export function TransferPackageLabelView({
  packId,
  packageId,
  wasOutdated,
  onBack,
}: {
  packId: string;
  packageId: string;
  /** Kiện đang mang cờ nhãn cũ lúc mở nhãn. */
  wasOutdated: boolean;
  onBack: () => void;
}) {
  const query = useTransferPackageLabel(packId, packageId, true);
  const queryClient = useQueryClient();
  const [outdated] = useState(wasOutdated);
  const label = query.data;

  // Nhãn đã lấy (BE đã làm nhãn hiện hành) hoặc phiên đã đổi → tải lại phiên để cờ và trạng thái kiện khớp BE
  useEffect(() => {
    if (query.isSuccess || query.isError) {
      void queryClient.invalidateQueries({ queryKey: transferPackKeys.all });
    }
  }, [query.isSuccess, query.isError, queryClient]);

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
          {transferPackErrorMessage(query.error)}{" "}
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
          {outdated && (
            <Alert tone="info" className="print:hidden">
              {T.outdatedFixed}
            </Alert>
          )}
          <p className="text-ink-tertiary text-center text-xs print:hidden">{L.label.printHint}</p>
          <TransferLabelSheet label={label} />
        </>
      )}
    </div>
  );
}
