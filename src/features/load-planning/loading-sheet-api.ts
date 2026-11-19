/**
 * PDF phiếu xếp hàng của một xe (docs 09 §4.2 bước 5 "xuất PDF sơ đồ xếp cho từng xe"; WF4-PDF-PRINT-1118), BE
 * `LoadPlanController`: `GET /fulfillment/load-plans/{id}/vehicles/{seq}/loading-sheet.pdf` (`fulfillment-load-plans:READ`).
 * Trang in HTML (`LoadSheetPrint`) vẫn còn; đây là file BE sinh, có sơ đồ 2D vẽ theo tỉ lệ.
 */

import { LOAD_PLAN_PRINT_LABELS } from "@/constants";
import { getFile } from "@/lib/api/file-download";

import { loadPlanPath } from "./api";

import type { DownloadedFile } from "@/lib/api/file-download";

export interface LoadingSheetInput {
  planId: string;
  /** Số thứ tự xe trong kế hoạch (`PlanVehicle.seq`). */
  seq: number;
}

export function downloadLoadingSheet({ planId, seq }: LoadingSheetInput): Promise<DownloadedFile> {
  return getFile(
    `${loadPlanPath(planId)}/vehicles/${seq}/loading-sheet.pdf`,
    LOAD_PLAN_PRINT_LABELS.pdfFallbackName,
  );
}
