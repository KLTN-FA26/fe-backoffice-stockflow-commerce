import type { z } from "zod";

import type { PackStatus, PickLineStatus, PickStatus } from "@/constants";
import type { assignInputSchema, createTaskInputSchema } from "./input-schemas";
import type {
  bePickLineSchema,
  confirmPickInputSchema,
  shortPickInputSchema,
} from "./pick-line-schemas";
import type { bePutBackRowSchema, putBackInputSchema } from "./put-back-schemas";
import type {
  assigneeSchema,
  beFulfillmentTaskSchema,
  beTaskLineSchema,
  taskCandidateLineSchema,
  taskCandidatePageSchema,
  taskCandidateSchema,
} from "./schemas";

/* ── DTO trên wire ───────────────────────────────────────────────────── */

export type FulfillmentTaskApiDto = z.infer<typeof beFulfillmentTaskSchema>;
export type TaskLine = z.infer<typeof beTaskLineSchema>;
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

/** Đích vắng = DISPATCH (mặc định của BE, docs 07 §3). */
export type CreateTaskValues = z.input<typeof createTaskInputSchema>;
export type AssignValues = z.output<typeof assignInputSchema>;

export interface AssignTaskInput extends AssignValues {
  taskId: string;
}

/* ── Dòng lấy hàng (SCRUM-267, báo thiếu / phân bổ lại BE PR #147) ───── */

export type PickLineApiDto = z.infer<typeof bePickLineSchema>;

/** Model FE: giữ field BE, status đổi 1-1 sang tên enum BE dạng Title Case. */
export type PickLine = Omit<PickLineApiDto, "status"> & { status: PickLineStatus };

/** Giá trị form và giá trị gửi BE (`{locationCode, lpn}` / `{locationCode, reason}` — không có số lượng). */
export type ConfirmPickFormValues = z.input<typeof confirmPickInputSchema>;
export type ConfirmPickValues = z.output<typeof confirmPickInputSchema>;
export type ShortPickFormValues = z.input<typeof shortPickInputSchema>;
export type ShortPickValues = z.output<typeof shortPickInputSchema>;

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

/* ── Trả hàng về kệ (SCRUM-275) ──────────────────────────────────────── */

export type PutBackRowApiDto = z.infer<typeof bePutBackRowSchema>;
export type PutBackRow = PutBackRowApiDto;
export type PutBackValues = z.output<typeof putBackInputSchema>;

export interface PutBackLineInput extends PutBackValues {
  taskId: string;
  lineId: string;
  /** Mỗi lần thử một key; gửi lại đúng nội dung thì dùng lại key (BE IdempotencyFilter). */
  idempotencyKey: string;
}
