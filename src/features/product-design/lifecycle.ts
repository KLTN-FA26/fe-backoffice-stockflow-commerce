/**
 * Print configuration — lifecycle and action gating.
 *
 * Source: BE `CustomizationTemplateController` / `PrintConfigService` (origin/develop d47ed4ae): a template is created
 * inactive; `POST …/activation` makes it the variant's active one (retiring the previous), `POST …/deactivation` stops
 * new designs on it. Its only status is `active` (boolean), so there are two statuses and no terminal one. Activation
 * needs the template's `.glb` and a complete area ↔ mesh table (409 / 422 otherwise): the screen says so with
 * `activatable: false` (`modelFileStateOf`).
 *
 * Permissions are the BE's `product-customization-templates:*` (controller `@RequiresPermission`): READ views, CREATE
 * creates a template (the first save of a variant: one multipart `POST`), UPDATE saves changes to one and activates /
 * deactivates. Sales staff do not hold it (owner), whatever they may do with product data. UI-only gate; the BE
 * re-checks and answers 403.
 */
import { PRINT_CONFIG_ACTION_LABELS as LABELS } from "@/constants/labels-print-config";
import { CUSTOMIZATION_TEMPLATE_PERMISSIONS as PERMISSIONS } from "@/constants/permissions";
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
  /** The permission the action needs on a saved configuration. */
  readonly permission: PermissionCode;
  /** The permission it needs instead when it starts from no configuration (the first save creates the template). */
  readonly createPermission?: PermissionCode;
  /** `null` = no configuration yet (the save creates one). */
  readonly fromStatuses: readonly (PrintConfigStatus | null)[];
  readonly targetStatus?: PrintConfigStatus;
}

export const PRINT_CONFIG_ACTIONS: readonly PrintConfigAction[] = [
  {
    code: "save",
    label: LABELS.save,
    permission: PERMISSIONS.update,
    createPermission: PERMISSIONS.create,
    fromStatuses: [null, "INACTIVE", "ACTIVE"],
  },
  {
    code: "activate",
    label: LABELS.activate,
    permission: PERMISSIONS.update,
    fromStatuses: ["INACTIVE"],
    targetStatus: "ACTIVE",
  },
  {
    code: "deactivate",
    label: LABELS.deactivate,
    permission: PERMISSIONS.update,
    fromStatuses: ["ACTIVE"],
    targetStatus: "INACTIVE",
  },
];

/** Who may open the configuration at all. */
export const canViewPrintConfig = (can: (permission: PermissionCode) => boolean): boolean =>
  can(PERMISSIONS.read);

export interface AllowedActionOptions {
  /**
   * False when the product is discontinued or the variant obsolete (BE `requireWritable`: 409 CONFLICT, templates kept
   * as they are); the screen knows it from the product feature.
   */
  writable?: boolean;
  /** False when the stored `.glb` or its area ↔ mesh table does not allow activation (BE 409 / 422). */
  activatable?: boolean;
}

/** Actions available now. */
export function allowedActions(
  status: PrintConfigStatus | null,
  can: (permission: PermissionCode) => boolean,
  options: AllowedActionOptions = {},
): readonly PrintConfigAction[] {
  if (!canViewPrintConfig(can) || options.writable === false) return [];
  return PRINT_CONFIG_ACTIONS.filter(
    (action) =>
      action.fromStatuses.includes(status) &&
      can(status === null ? (action.createPermission ?? action.permission) : action.permission) &&
      !(action.code === "activate" && options.activatable === false),
  );
}
