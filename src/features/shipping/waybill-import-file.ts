/**
 * File nhập mã vận đơn (docs 09 §4.4): CSV UTF-8 hoặc Excel `.xlsx` theo file mẫu — BE đọc cả hai, kết quả như nhau. Kiểm ở
 * máy chỉ theo đuôi file (BE nhận biết định dạng bằng nội dung, nên file đổi đuôi vẫn được BE đọc đúng hoặc từ chối rõ ràng);
 * `.xls` cũ và mọi đuôi khác bị từ chối ngay, không gọi API.
 */

export const WAYBILL_IMPORT_EXTENSIONS = [".csv", ".xlsx"] as const;

/** Giá trị `accept` của ô chọn file (đuôi trước, kiểu MIME sau — Windows hay báo CSV là `application/vnd.ms-excel`). */
export const WAYBILL_IMPORT_ACCEPT =
  ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function isWaybillImportFile(file: Pick<File, "name">): boolean {
  const name = file.name.trim().toLowerCase();
  return WAYBILL_IMPORT_EXTENSIONS.some((extension) => name.endsWith(extension));
}
