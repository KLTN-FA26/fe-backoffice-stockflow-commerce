import { z } from "zod";

/** BE `PageResponse<T>` (common/api/PageResponse.java) — trang đánh số từ 0. */
export function bePageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(0),
    size: z.number().int().positive(),
    totalElements: z.number().int().min(0),
    totalPages: z.number().int().min(0),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  });
}
