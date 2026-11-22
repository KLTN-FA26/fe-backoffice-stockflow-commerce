import type { z } from "zod";

import type {
  bePutawaySuggestionSchema,
  bePutawayTaskPageSchema,
  bePutawayTaskSchema,
  putawayConfirmInputSchema,
} from "./schemas";

export type PutawayTask = z.infer<typeof bePutawayTaskSchema>;
export type PutawayTaskPage = z.infer<typeof bePutawayTaskPageSchema>;
export type PutawaySuggestion = z.infer<typeof bePutawaySuggestionSchema>;
export type PutawayTaskStatus = PutawayTask["status"];
export type PutawaySource = PutawayTask["source"];
export type PutawaySuggestionReason = PutawaySuggestion["reason"];

/** Giá trị form (trước zod) và sau khi parse (đã trim). */
export type PutawayConfirmFormValues = z.input<typeof putawayConfirmInputSchema>;
export type PutawayConfirmValues = z.output<typeof putawayConfirmInputSchema>;

export interface ConfirmPutawayInput {
  taskId: string;
  values: PutawayConfirmValues;
  idempotencyKey: string;
}
