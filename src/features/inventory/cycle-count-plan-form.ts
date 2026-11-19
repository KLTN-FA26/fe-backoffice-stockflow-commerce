import { splitCodes } from "./cycle-count-schemas";

import type { PlanCycleCountInput } from "./cycle-count-types";

/** What the plan form holds: the code lists as the text typed, the rest as the controls show them. */
export interface PlanFormValues {
  warehouseId: string;
  zoneIds: string[];
  shelves: string;
  locations: string;
  skus: string;
  blind: boolean;
  plannedDate: string;
  note: string;
  assignedUserId: string;
}

/** Blind by default (docs 20 §3); the rest empty - an absent day is today, an absent counter is given later. */
export const initialPlanForm = (warehouseId: string): PlanFormValues => ({
  warehouseId,
  zoneIds: [],
  shelves: "",
  locations: "",
  skus: "",
  blind: true,
  plannedDate: "",
  note: "",
  assignedUserId: "",
});

export function toPlanInput(values: PlanFormValues): PlanCycleCountInput {
  return {
    warehouseId: values.warehouseId,
    blind: values.blind,
    assignedUserId: values.assignedUserId || undefined,
    plannedDate: values.plannedDate || undefined,
    note: values.note || undefined,
    zoneIds: values.zoneIds,
    shelfCodes: splitCodes(values.shelves),
    locationCodes: splitCodes(values.locations),
    skus: splitCodes(values.skus),
  };
}
