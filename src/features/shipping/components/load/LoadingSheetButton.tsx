"use client";

import { LOAD_PLAN_PRINT_LABELS } from "@/constants";
import { useDownloadLoadingSheet } from "@/features/shipping/loading-sheet-mutations";
import { PdfDownloadButton } from "@/components/shared/PdfDownloadButton";

/** "Tải PDF" phiếu xếp hàng của xe của chuyến (docs 09 §4.2 bước 5). Hiện khi `canDownloadLoadingSheet`. */
export function LoadingSheetButton({
  loadPlanId,
  vehicleSeq,
}: {
  loadPlanId: string;
  vehicleSeq: number;
}) {
  const { mutate, isPending } = useDownloadLoadingSheet();
  return (
    <PdfDownloadButton
      label={LOAD_PLAN_PRINT_LABELS.pdfButton}
      pendingLabel={LOAD_PLAN_PRINT_LABELS.pdfBusy}
      pending={isPending}
      onDownload={() => mutate({ loadPlanId, vehicleSeq })}
    />
  );
}
