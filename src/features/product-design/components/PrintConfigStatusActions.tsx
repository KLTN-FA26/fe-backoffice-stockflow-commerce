"use client";

import { useState } from "react";
import { Power, PowerOff } from "lucide-react";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

import { allowedActions, statusOfPrintConfig } from "../lifecycle";
import { useActivatePrintConfig, useDeactivatePrintConfig } from "../mutations";
import { modelFileStateOf } from "../selectors";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { PrintConfigDto } from "../types";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.status;
// The action buttons of the page band, beside the save: the page's action size.
const ACTION_CLASS =
  "h-(--action-h) rounded-(--action-radius) px-(--action-px) text-[0.8125rem] font-medium";
type StatusAction = "activate" | "deactivate";

/**
 * The sentence next to the status in the page band (`PrintConfigHeader` `hint`) for a saved configuration: what
 * activating does when it is offered, or why it cannot be activated yet (`.glb` or area ↔ mesh table missing; the BE
 * answers 409 / 422). `null` when there is nothing to say.
 */
export function printConfigStatusHint({
  config,
  can,
  writable,
}: {
  config: PrintConfigDto;
  can: (permission: PermissionCode) => boolean;
  writable: boolean;
}): string | null {
  const status = statusOfPrintConfig(config);
  const fileState = modelFileStateOf(config);
  if (fileState.kind !== "ready") {
    const couldActivate = allowedActions(status, can, { writable }).some(
      (action) => action.code === "activate",
    );
    return couldActivate ? TEXT.activateBlocked[fileState.kind] : null;
  }
  const offered = allowedActions(status, can, { writable, activatable: true }).some(
    (action) => action.code === "activate",
  );
  return offered ? TEXT.activateNote : null;
}

/**
 * Activate or stop a saved configuration. The buttons are the descriptors `allowedActions` returns for the status and
 * the permission (no status check here), each behind a confirmation that says what it means for customers. What
 * activating means, or why it is not offered, is the band's status sentence (`printConfigStatusHint`), not text under
 * the buttons. "Kích hoạt" is the page's primary action (solid, like the save); "Ngừng dùng" stays outlined.
 */
export function PrintConfigStatusActions({
  config,
  productId,
  variantId,
  can,
  writable,
}: {
  config: PrintConfigDto;
  productId: string;
  variantId: string;
  can: (permission: PermissionCode) => boolean;
  writable: boolean;
}) {
  const [asking, setAsking] = useState<StatusAction | null>(null);
  const activate = useActivatePrintConfig();
  const deactivate = useDeactivatePrintConfig();
  const status = statusOfPrintConfig(config);
  // BE: activation needs the `.glb` and a complete area ↔ mesh table (409 / 422); not offered without them.
  const fileState = modelFileStateOf(config);
  const activatable = fileState.kind === "ready";
  const actions = allowedActions(status, can, { writable, activatable }).filter(
    (action): action is typeof action & { code: StatusAction } => action.code !== "save",
  );
  if (actions.length === 0) return null;

  const mutation = asking === "activate" ? activate : deactivate;
  const confirm = () =>
    mutation.mutate(
      { productId, variantId, templateId: config.templateId, version: config.version },
      { onSuccess: () => setAsking(null) },
    );

  return (
    <>
      {actions.map((action) => (
        <Button
          key={action.code}
          type="button"
          variant={action.code === "activate" ? "default" : "outline"}
          size="sm"
          onClick={() => setAsking(action.code)}
          className={ACTION_CLASS}
        >
          {action.code === "activate" ? (
            <Power aria-hidden className="size-3.5" />
          ) : (
            <PowerOff aria-hidden className="size-3.5" />
          )}
          {action.label}
        </Button>
      ))}
      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(open) => !open && setAsking(null)}
        title={asking === "activate" ? TEXT.activateTitle : TEXT.deactivateTitle}
        description={asking === "activate" ? TEXT.activateDescription : TEXT.deactivateDescription}
        confirmLabel={actions.find((action) => action.code === asking)?.label}
        variant="default"
        closeOnConfirm={false}
        loading={mutation.isPending}
        onConfirm={confirm}
      />
    </>
  );
}
