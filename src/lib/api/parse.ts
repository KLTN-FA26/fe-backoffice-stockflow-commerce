/**
 * Parse a response body at the API boundary (api-conventions §3.2).
 *
 * A zod failure here is a FE↔BE contract bug, not a user error: it surfaces as an
 * `ApiError` with code `CONTRACT_MISMATCH` ("Dữ liệu trả về không đúng định dạng", §8)
 * and the zod issues are logged for debugging.
 */

import { ApiError } from "./error";

import type { z } from "zod";

export const CONTRACT_MISMATCH = "CONTRACT_MISMATCH";

export function parseResponse<T extends z.ZodType>(
  schema: T,
  data: unknown,
  what: string,
): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  console.error(`[api] ${what}: response does not match contract`, result.error.issues);
  throw new ApiError(0, CONTRACT_MISMATCH, "Dữ liệu trả về không đúng định dạng");
}
