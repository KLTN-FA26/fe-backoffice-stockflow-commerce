import type { z } from "zod";

import type { DesignArtifactRole, PackStatus, PickStatus } from "@/constants";
import type {
  assignInputSchema,
  createTaskInputSchema,
  reverifyInputSchema,
} from "./input-schemas";
import type {
  assigneeSchema,
  beArtifactAccessSchema,
  beFulfillmentTaskSchema,
  beIntegrityEvidenceSchema,
  fulfillmentOrderLineSchema,
  fulfillmentOrderSchema,
  taskCandidateLineSchema,
  taskCandidatePageSchema,
  taskCandidateSchema,
} from "./schemas";

/* ── DTO trên wire ───────────────────────────────────────────────────── */

export type FulfillmentTaskApiDto = z.infer<typeof beFulfillmentTaskSchema>;
export type IntegrityEvidence = z.infer<typeof beIntegrityEvidenceSchema>;
export type ArtifactAccess = z.infer<typeof beArtifactAccessSchema>;
export type FulfillmentOrder = z.infer<typeof fulfillmentOrderSchema>;
export type FulfillmentOrderLine = z.infer<typeof fulfillmentOrderLineSchema>;
export type TaskCandidate = z.infer<typeof taskCandidateSchema>;
export type TaskCandidateLine = z.infer<typeof taskCandidateLineSchema>;
export type TaskCandidatePage = z.infer<typeof taskCandidatePageSchema>;
export type Assignee = z.infer<typeof assigneeSchema>;

/* ── Model FE: giữ field BE, 2 status đổi 1-1 sang tên enum BE dạng Title Case (BE là chuẩn) ── */

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
