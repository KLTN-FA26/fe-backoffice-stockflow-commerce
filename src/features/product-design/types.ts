import type { z } from "zod";

import type {
  printConfigBodySchema,
  printConfigDtoSchema,
  printConfigSaveInputSchema,
  storedPrintConfigSchema,
  surfaceSchema,
} from "./schemas";

/** What the back end returns for one print configuration (BE customization template). */
export type PrintConfigDto = z.infer<typeof printConfigDtoSchema>;
export type PrintConfigBody = z.infer<typeof printConfigBodySchema>;
export type PrintSurface = z.infer<typeof surfaceSchema>;
export type StoredPrintConfig = z.infer<typeof storedPrintConfigSchema>;
export type PrintConfigSaveInput = z.infer<typeof printConfigSaveInputSchema>;

/** A `.glb` as the screen hands it to a save: its name and the exact bytes that were measured. */
export type ModelFileBytes = NonNullable<PrintConfigSaveInput["file"]>;

export type PrintConfigStatus = "INACTIVE" | "ACTIVE";

/** Which template of which variant, and the `version` the screen last read (the BE's optimistic lock). */
export interface PrintConfigTarget {
  productId: string;
  variantId: string;
  templateId: string;
  version: number;
}
