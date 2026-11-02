import type { z } from "zod";

import type {
  orderStatusCountDto,
  rebuildResultDto,
  salesDailyDto,
  salesSummaryDto,
  topProductDto,
} from "./schemas";

export type SalesDaily = z.infer<typeof salesDailyDto>;
export type TopProduct = z.infer<typeof topProductDto>;
export type OrderStatusCount = z.infer<typeof orderStatusCountDto>;
export type SalesSummary = z.infer<typeof salesSummaryDto>;
export type RebuildResult = z.infer<typeof rebuildResultDto>;

export type { DateRange } from "@/lib/date-range";
