import { ZodError } from "zod";

import { ApiError } from "@/lib/api/error";

/** Cùng bộ loại lỗi với NCC (`features/supplier/load-error.ts`) — không import chéo feature. */
export type OrderLoadErrorKind =
  | "not-found"
  | "forbidden"
  // Có VIEW_PAGE (mở trang) nhưng thiếu READ (đọc dữ liệu) — chỉ ép từ trang, không suy từ lỗi
  | "no-read"
  | "invalid-data"
  | "network"
  | "server"
  // Không tải được /identity/me/permissions — chỉ ép từ gate
  | "permissions";

/**
 * Phân loại lỗi khi tải đơn (§8). Khác NCC một luật: 400 `UNSUPPORTED_PARAMETER` cũng là
 * "không tìm thấy" — BE khai báo `orderId` là UUID (`OrderController#findOne`), id sai định dạng
 * (gõ tay URL, link cũ) không bao giờ hợp lệ.
 */
export function classifyOrderLoadError(error: unknown): OrderLoadErrorKind {
  if (error instanceof ZodError) return "invalid-data";
  if (!(error instanceof ApiError)) return "server";
  if (error.status === 404 || error.code === "UNSUPPORTED_PARAMETER") return "not-found";
  if (error.status === 403) return "forbidden";
  if (error.status === 0 || error.code === "NETWORK_ERROR") return "network";
  return "server";
}
