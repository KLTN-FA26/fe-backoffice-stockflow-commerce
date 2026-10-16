import { ZodError } from "zod";

import { ApiError } from "./error";

/**
 * Loại lỗi khi tải dữ liệu một màn (api-conventions §8). Bản dùng chung cho mọi feature —
 * `features/supplier/components/load-error.ts` có bản tương tự từ PR #17.
 */
export type LoadErrorKind =
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
 * Chỉ 404 (hoặc 400 do id sai định dạng UUID) mới là "không tìm thấy".
 * ZodError = BE trả sai hợp đồng; status 0 = mất mạng/timeout (ApiError.from).
 */
export function classifyLoadError(error: unknown): LoadErrorKind {
  if (error instanceof ZodError) return "invalid-data";
  if (!(error instanceof ApiError)) return "server";
  if (error.status === 404 || error.status === 400) return "not-found";
  if (error.status === 403) return "forbidden";
  if (error.status === 0) return "network";
  return "server";
}
