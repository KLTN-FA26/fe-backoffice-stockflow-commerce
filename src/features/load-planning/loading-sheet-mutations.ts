/** Tải PDF phiếu xếp hàng: gọi BE rồi lưu file; không đổi dữ liệu nên không invalidate gì (api-conventions §2.3). */

import { createMutation } from "@/lib/api/query-factory";
import { saveFile } from "@/lib/api/file-download";

import { downloadLoadingSheet } from "./loading-sheet-api";

import type { DownloadedFile } from "@/lib/api/file-download";
import type { LoadingSheetInput } from "./loading-sheet-api";

export const useDownloadLoadingSheet = createMutation<LoadingSheetInput, DownloadedFile>(
  downloadLoadingSheet,
  { onSuccess: saveFile },
);
