import { z } from "zod";

// Only the paging total is read: counters never look at the rows.
export const countPageDto = z.object({ totalElements: z.number().int().nonnegative() });
