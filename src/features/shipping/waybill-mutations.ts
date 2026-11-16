/**
 * Shipping — mutations mã vận đơn (docs 09 §4.4): nhập tay / sửa sau khi rời kho, xem trước và nhập file. Dùng bộ bọc
 * cache của `mutations.ts` (response là chuyến mới nhất → ghi thẳng vào cache chi tiết). Lịch sử mã vận đơn và biên bản nằm
 * dưới `loadKeys.all` nên được làm mới cùng chuyến.
 */

import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";

import { importWaybillFile, previewWaybillImport, recordWaybill } from "./waybill-api";
import { LOAD_LIST_KEY, toastIfStale, withLoadCache } from "./mutations";
import { loadKeys } from "./queries";

import type { Load, RecordWaybillInput, WaybillImport, WaybillImportFileInput } from "./types";

const T = TOAST_MESSAGES.shipping;

/**
 * Nhập tay mã vận đơn / sửa mã sau khi rời kho. Hộp thoại hiện lỗi inline (WAYBILL_DUPLICATE, lý do…); lỗi dữ liệu cũ vẫn
 * toast vì hộp thoại có thể đóng ngay khi tải lại. `waybillHistory` được làm mới qua `loadKeys.all`.
 */
export const useRecordWaybill = withLoadCache(
  createMutation<RecordWaybillInput, Load>(recordWaybill, {
    invalidate: [LOAD_LIST_KEY, [...loadKeys.all, "waybill-history"]],
    showErrorToast: false,
    onError: toastIfStale,
  }),
  (input) => input.loadId,
);

/** Xem trước file: không ghi gì nên không làm mới gì; lỗi hiện inline ở màn nhập file. */
export const usePreviewWaybillImport = createMutation<File, WaybillImport>(previewWaybillImport, {
  showErrorToast: false,
});

/** Nhập file: nhiều chuyến đổi mã cùng lúc → làm mới mọi thứ dưới chuyến xe (danh sách, chi tiết, lịch sử, biên bản). */
export const useImportWaybillFile = createMutation<WaybillImportFileInput, WaybillImport>(
  importWaybillFile,
  { invalidate: [loadKeys.all], successMessage: T.waybillImported, showErrorToast: false },
);
