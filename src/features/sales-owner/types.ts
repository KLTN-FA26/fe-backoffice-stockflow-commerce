import type { z } from "zod";

import type {
  chatWorkloadRowSchema,
  leadSchema,
  ownerChangeRequestSchema,
  staffCoverSchema,
  transferBatchSchema,
  transferResultSchema,
} from "./schemas";

export type ChatWorkloadRow = z.infer<typeof chatWorkloadRowSchema>;
export type TransferResult = z.infer<typeof transferResultSchema>;
export type TransferBatch = z.infer<typeof transferBatchSchema>;
export type Lead = z.infer<typeof leadSchema>;
export type StaffCover = z.infer<typeof staffCoverSchema>;
export type OwnerChangeRequest = z.infer<typeof ownerChangeRequestSchema>;
