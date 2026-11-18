/** Tải PDF phiếu xếp hàng của xe: gọi BE rồi lưu file; không đổi dữ liệu nên không invalidate gì. */

import { saveFile } from "@/lib/api/file-download";
import { createMutation } from "@/lib/api/query-factory";

import { downloadLoadingSheet } from "./loading-sheet-api";

import type { DownloadedFile } from "@/lib/api/file-download";
import type { LoadingSheetInput } from "./loading-sheet-api";

export const useDownloadLoadingSheet = createMutation<LoadingSheetInput, DownloadedFile>(
  downloadLoadingSheet,
  { onSuccess: saveFile },
);
