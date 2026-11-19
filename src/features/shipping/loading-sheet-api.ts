/**
 * PDF phiếu xếp hàng của xe mà chuyến này là một (docs 09 §4.2 bước 5; WF4-PDF-PRINT-1118): cùng endpoint BE với màn kế
 * hoạch — `GET /fulfillment/load-plans/{loadPlanId}/vehicles/{vehicleSeq}/loading-sheet.pdf`, quyền
 * `fulfillment-load-plans:READ`. Khai báo lại ở đây để không import chéo `features/load-planning`.
 */

import { LOAD_PLAN_PRINT_LABELS } from "@/constants";
import { getFile } from "@/lib/api/file-download";

import type { DownloadedFile } from "@/lib/api/file-download";

export interface LoadingSheetInput {
  loadPlanId: string;
  vehicleSeq: number;
}

export function downloadLoadingSheet({
  loadPlanId,
  vehicleSeq,
}: LoadingSheetInput): Promise<DownloadedFile> {
  return getFile(
    `/fulfillment/load-plans/${encodeURIComponent(loadPlanId)}/vehicles/${vehicleSeq}/loading-sheet.pdf`,
    LOAD_PLAN_PRINT_LABELS.pdfFallbackName,
  );
}
