import type { z } from "zod";

import type {
  quarantineInput,
  releasedPutawayTaskDto,
  stockPackageDetailDto,
} from "./quarantine-schemas";

export type StockPackageDetail = z.infer<typeof stockPackageDetailDto>;
export type ReleasedPutawayTask = z.infer<typeof releasedPutawayTaskDto>;
export type QuarantineInput = z.input<typeof quarantineInput>;
