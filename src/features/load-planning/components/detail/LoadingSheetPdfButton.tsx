"use client";

import { LOAD_PLAN_PRINT_LABELS } from "@/constants";
import { PdfDownloadButton } from "@/components/shared/PdfDownloadButton";

import { useDownloadLoadingSheet } from "../../loading-sheet-mutations";

/**
 * "Tải PDF" phiếu xếp hàng của một xe (docs 09 §4.2 bước 5): BE sinh file, trình duyệt lưu. Cùng mã quyền đọc kế hoạch với
 * chính trang này (`fulfillment-load-plans:READ`), nên không cần gate riêng; backend vẫn re-check.
 */
export function LoadingSheetPdfButton({ planId, seq }: { planId: string; seq: number }) {
  const { mutate, isPending } = useDownloadLoadingSheet();
  return (
    <PdfDownloadButton
      label={LOAD_PLAN_PRINT_LABELS.pdfButton}
      pendingLabel={LOAD_PLAN_PRINT_LABELS.pdfBusy}
      pending={isPending}
      onDownload={() => mutate({ planId, seq })}
    />
  );
}
