import type { z } from "zod";

import type {
  quarantineInput,
  releasedPutawayTaskDto,
  stockPackageDetailDto,
  stockPackageDto,
  stockPackageListInput,
  stockPackagePageDto,
} from "./quarantine-schemas";

export type StockPackageDetail = z.infer<typeof stockPackageDetailDto>;
export type ReleasedPutawayTask = z.infer<typeof releasedPutawayTaskDto>;
export type QuarantineInput = z.input<typeof quarantineInput>;
export type StockPackage = z.infer<typeof stockPackageDto>;
export type StockPackagePage = z.infer<typeof stockPackagePageDto>;
export type StockPackageListParams = z.input<typeof stockPackageListInput>;
