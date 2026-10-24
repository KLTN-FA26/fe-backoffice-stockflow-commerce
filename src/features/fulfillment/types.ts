import type { z } from "zod";

import type { DesignArtifactRole, PackStatus, PickLineStatus, PickStatus } from "@/constants";
import type {
  assignInputSchema,
  createTaskInputSchema,
  reverifyInputSchema,
} from "./input-schemas";
import type {
  bePickLineSchema,
  confirmPickInputSchema,
  shortPickInputSchema,
} from "./pick-line-schemas";
import type {
  assigneeSchema,
  beArtifactAccessSchema,
  beFulfillmentTaskSchema,
  beIntegrityEvidenceSchema,
  beTaskLineSchema,
  fulfillmentOrderLineSchema,
  fulfillmentOrderSchema,
  taskCandidateLineSchema,
  taskCandidatePageSchema,
  taskCandidateSchema,
} from "./schemas";

/* ── DTO trên wire ───────────────────────────────────────────────────── */

export type FulfillmentTaskApiDto = z.infer<typeof beFulfillmentTaskSchema>;
export type IntegrityEvidence = z.infer<typeof beIntegrityEvidenceSchema>;
export type TaskLine = z.infer<typeof beTaskLineSchema>;
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

/* ── Dòng lấy hàng (SCRUM-267, báo thiếu / phân bổ lại BE PR #147) ───── */

export type PickLineApiDto = z.infer<typeof bePickLineSchema>;

/** Model FE: giữ field BE, status đổi 1-1 sang tên enum BE dạng Title Case. */
export type PickLine = Omit<PickLineApiDto, "status"> & { status: PickLineStatus };

/** Giá trị form (chuỗi) và giá trị gửi BE (số lượng là số). */
export type ConfirmPickFormValues = z.input<typeof confirmPickInputSchema>;
export type ConfirmPickValues = z.output<typeof confirmPickInputSchema>;
export type ShortPickFormValues = z.input<ReturnType<typeof shortPickInputSchema>>;
export type ShortPickValues = z.output<ReturnType<typeof shortPickInputSchema>>;

export interface PickLineWriteInput {
  taskId: string;
  lineId: string;
  /** Mỗi lần thử một key; gửi lại đúng nội dung thì dùng lại key (BE IdempotencyFilter). */
  idempotencyKey: string;
}

export interface ConfirmPickLineInput extends PickLineWriteInput {
  values: ConfirmPickValues;
}

export interface ReportShortPickInput extends PickLineWriteInput {
  values: ShortPickValues;
}

export type ReallocateShortLineInput = PickLineWriteInput;
