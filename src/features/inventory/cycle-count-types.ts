import type { z } from "zod";

import type { CYCLE_COUNT_STATUSES } from "@/constants/cycle-count";

import type {
  addCountLineInput,
  cancelCycleCountInput,
  countLineInput,
  cycleCountDto,
  cycleCountLineAdjustmentDto,
  cycleCountLineDto,
  cycleCountListInput,
  cycleCountPageDto,
  cycleCountSummaryDto,
  recountCycleCountInput,
} from "./cycle-count-schemas";

export type CycleCount = z.infer<typeof cycleCountDto>;
export type CycleCountSummary = z.infer<typeof cycleCountSummaryDto>;
export type CycleCountLine = z.infer<typeof cycleCountLineDto>;
export type CycleCountLineAdjustment = z.infer<typeof cycleCountLineAdjustmentDto>;
export type CycleCountPage = z.infer<typeof cycleCountPageDto>;
export type CycleCountListParams = z.input<typeof cycleCountListInput>;
export type CountLineInput = z.input<typeof countLineInput>;
export type AddCountLineInput = z.input<typeof addCountLineInput>;
export type CancelCycleCountInput = z.input<typeof cancelCycleCountInput>;
export type RecountCycleCountInput = z.input<typeof recountCycleCountInput>;

export type CycleCountStatus = (typeof CYCLE_COUNT_STATUSES)[number];
