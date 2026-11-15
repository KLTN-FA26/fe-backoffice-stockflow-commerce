/**
 * Print configuration — lifecycle and action gating.
 *
 * Source: BE `CustomizationTemplateController` (origin/develop): a template is created inactive;
 * `POST …/activation` makes it the variant's active one (retiring the previous), `POST …/deactivation` stops new
 * designs on it. Its only status is `active` (boolean), so there are two statuses and no terminal one.
 *
 * ASSUMPTION (owner decision, permission stand-in): the BE guards these endpoints with
 * `product-customization-templates:*`, which `permissions.ts` does not list. We use the permission that governs
 * editing product data (`PRODUCT_PERMISSIONS.update`) and `read` to view, and invent none; the BE re-checks and
 * answers 403. UI-only gate. Replace with the BE's permission codes when `permissions.ts` has them.
 */
import { PRINT_CONFIG_ACTION_LABELS as LABELS } from "@/constants/labels-print-config";
import { PRODUCT_PERMISSIONS } from "@/constants/permissions";
import { allowedTransitions, canTransition, isTerminal } from "@/lib/domain/lifecycle";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { PrintConfigStatus } from "./types";

export { allowedTransitions, canTransition, isTerminal };

export const PRINT_CONFIG_TRANSITIONS: Record<PrintConfigStatus, readonly PrintConfigStatus[]> = {
  INACTIVE: ["ACTIVE"],
  ACTIVE: ["INACTIVE"],
};

export const statusOfPrintConfig = (config: { active: boolean }): PrintConfigStatus =>
  config.active ? "ACTIVE" : "INACTIVE";

export type PrintConfigActionCode = "save" | "activate" | "deactivate";

export interface PrintConfigAction {
  readonly code: PrintConfigActionCode;
  readonly label: string;
  readonly permission: PermissionCode;
  /** `null` = no configuration yet (the save creates one). */
  readonly fromStatuses: readonly (PrintConfigStatus | null)[];
  readonly targetStatus?: PrintConfigStatus;
}

export const PRINT_CONFIG_ACTIONS: readonly PrintConfigAction[] = [
  {
    code: "save",
    label: LABELS.save,
    permission: PRODUCT_PERMISSIONS.update,
    fromStatuses: [null, "INACTIVE", "ACTIVE"],
  },
  {
    code: "activate",
    label: LABELS.activate,
    permission: PRODUCT_PERMISSIONS.update,
    fromStatuses: ["INACTIVE"],
    targetStatus: "ACTIVE",
  },
  {
    code: "deactivate",
    label: LABELS.deactivate,
    permission: PRODUCT_PERMISSIONS.update,
    fromStatuses: ["ACTIVE"],
    targetStatus: "INACTIVE",
  },
];

/** Who may open the configuration at all. */
export const canViewPrintConfig = (can: (permission: PermissionCode) => boolean): boolean =>
  can(PRODUCT_PERMISSIONS.read);

/**
 * Actions available now. `writable` is false when the product is discontinued or the variant obsolete (BE
 * `requireWritable`: 409 CONFLICT, templates kept as they are); the screen knows it from the product feature.
 */
export function allowedActions(
  status: PrintConfigStatus | null,
  can: (permission: PermissionCode) => boolean,
  options: { writable?: boolean } = {},
): readonly PrintConfigAction[] {
  if (!canViewPrintConfig(can) || options.writable === false) return [];
  return PRINT_CONFIG_ACTIONS.filter(
    (action) => action.fromStatuses.includes(status) && can(action.permission),
  );
}
