import type { z } from "zod";

import type {
  beCarrierEventDetailSchema,
  beCarrierEventRowSchema,
  carrierEventNoteSchema,
} from "./carrier-event-schemas";

export type CarrierEventRow = z.infer<typeof beCarrierEventRowSchema>;
export type CarrierEventDetail = z.infer<typeof beCarrierEventDetailSchema>;
export type CarrierEventNoteValues = z.infer<ReturnType<typeof carrierEventNoteSchema>>;
