import type { z } from "zod";

import type {
  bePutawaySuggestionSchema,
  bePutawayTaskPageSchema,
  bePutawayTaskSchema,
  putawayConfirmInputSchema,
} from "./schemas";
import type {
  beTripCartonSchema,
  beTripSchema,
  beTripStopSchema,
  tripLoadInputSchema,
  tripPlaceInputSchema,
} from "./trip-schemas";

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

export type PutawayTrip = z.infer<typeof beTripSchema>;
export type PutawayTripCarton = z.infer<typeof beTripCartonSchema>;
export type PutawayTripStop = z.infer<typeof beTripStopSchema>;
export type PutawayTripStatus = PutawayTrip["status"];
export type TripLoadValues = z.output<typeof tripLoadInputSchema>;
export type TripPlaceFormValues = z.input<typeof tripPlaceInputSchema>;
export type TripPlaceValues = z.output<typeof tripPlaceInputSchema>;
