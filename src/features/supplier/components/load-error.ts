import { ZodError } from "zod";

import { ApiError } from "@/lib/api/error";

export type LoadErrorKind = "not-found" | "forbidden" | "invalid-data" | "network" | "server";

/**
 * Phân loại lỗi khi tải 1 record (§8): chỉ 404 mới là "không tìm thấy".
 * ZodError = BE trả sai hợp đồng; status 0 = mất mạng/timeout (ApiError.from).
 */
export function classifyLoadError(error: unknown): LoadErrorKind {
  if (error instanceof ZodError) return "invalid-data";
  if (!(error instanceof ApiError)) return "server";
  if (error.status === 404) return "not-found";
  if (error.status === 403) return "forbidden";
  if (error.status === 0) return "network";
  return "server";
}
