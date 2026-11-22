import { z } from "zod";

// Only the paging total is read: counters never look at the rows.
export const countPageDto = z.object({ totalElements: z.number().int().nonnegative() });

/** Dòng báo giá — chỉ hạn hiệu lực (ô "Báo giá sắp hết hạn"). */
export const expiringQuotesPageDto = z.object({
  items: z.array(z.object({ validUntil: z.string() })),
});
