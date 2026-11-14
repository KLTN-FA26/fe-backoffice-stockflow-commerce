/**
 * Fulfillment task — selectors thuần (không side effect), derive từ dữ liệu BE trả về.
 */

import { FULFILLMENT_LIMITS } from "@/constants";

/**
 * UUID rút gọn để hiện khi BE không trả mã đọc được. Lấy phần ĐUÔI: id của BE sinh theo thời gian
 * (vd `01a12aba-ed1f-70e8-…`), phần đầu là đồng hồ nên các bản ghi tạo gần nhau trùng 8 ký tự đầu;
 * phần đuôi mới là ngẫu nhiên.
 */
export function shortId(id: string): string {
  return id.slice(-FULFILLMENT_LIMITS.shortIdLength).toUpperCase();
}
