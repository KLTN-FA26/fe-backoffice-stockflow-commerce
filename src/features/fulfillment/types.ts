import type { z } from "zod";

import type { DesignArtifactRole, PackStatus, PickStatus } from "@/constants";
import type {
  assignInputSchema,
  createTaskInputSchema,
  reverifyInputSchema,
} from "./input-schemas";
import type {
  assignableUserSchema,
  beArtifactAccessSchema,
  beFulfillmentTaskSchema,
  beIntegrityEvidenceSchema,
  fulfillmentOrderLineSchema,
  fulfillmentOrderSchema,
} from "./schemas";

/* ── DTO trên wire ───────────────────────────────────────────────────── */

export type FulfillmentTaskApiDto = z.infer<typeof beFulfillmentTaskSchema>;
export type IntegrityEvidence = z.infer<typeof beIntegrityEvidenceSchema>;
export type ArtifactAccess = z.infer<typeof beArtifactAccessSchema>;
export type FulfillmentOrder = z.infer<typeof fulfillmentOrderSchema>;
export type FulfillmentOrderLine = z.infer<typeof fulfillmentOrderLineSchema>;
export type AssignableUser = z.infer<typeof assignableUserSchema>;

/* ── Model FE: giữ field BE, chỉ đổi 2 status sang nhãn docs 07 §5.1 / 08 §5 ── */

export type FulfillmentTask = Omit<FulfillmentTaskApiDto, "pickStatus" | "packStatus"> & {
  pickStatus: PickStatus;
  packStatus: PackStatus;
};

/* ── Input ───────────────────────────────────────────────────────────── */

export type CreateTaskValues = z.output<typeof createTaskInputSchema>;
export type AssignValues = z.output<typeof assignInputSchema>;
export type ReverifyValues = z.output<typeof reverifyInputSchema>;

export interface AssignTaskInput extends AssignValues {
  taskId: string;
}

export interface ReverifyTaskInput extends ReverifyValues {
  taskId: string;
}

export interface ArtifactUrlInput {
  taskId: string;
  /** Id dòng ĐƠN HÀNG — BE không có thực thể dòng task. */
  lineId: string;
  role: DesignArtifactRole;
}
