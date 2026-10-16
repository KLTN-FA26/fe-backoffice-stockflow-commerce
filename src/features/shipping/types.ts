import type { z } from "zod";

import type { handoverInputSchema, scanPackageInputSchema } from "./input-schemas";
import type { beLoadLineSchema, beLoadRowSchema, beLoadSchema, beManifestSchema } from "./schemas";

export type Load = z.infer<typeof beLoadSchema>;
export type LoadRow = z.infer<typeof beLoadRowSchema>;
export type LoadLine = z.infer<typeof beLoadLineSchema>;
export type LoadManifest = z.infer<typeof beManifestSchema>;

export type ScanPackageValues = z.output<typeof scanPackageInputSchema>;
export type HandoverFormInput = z.input<typeof handoverInputSchema>;
export type HandoverValues = z.output<typeof handoverInputSchema>;

export interface ScanPackageInput {
  loadId: string;
  packageCode: string;
}

export interface HandoverLoadInput {
  loadId: string;
  version: number;
  values: HandoverValues;
  /** Một key cho một lần mở dialog bàn giao — gửi lại (retry) dùng lại key, BE không bàn giao hai lần. */
  idempotencyKey: string;
}
