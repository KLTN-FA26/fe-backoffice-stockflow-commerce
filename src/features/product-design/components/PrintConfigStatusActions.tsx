"use client";

import { useState } from "react";

import { PRINT_CONFIG_SCREEN_LABELS, pendingDesignWarning } from "@/constants/labels-print-config";
import { Alert } from "@/components/shared/Alert";
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
 * Activate or stop a saved configuration. The buttons are the descriptors `allowedActions` returns for the status and
 * the permission (no status check here), each behind a confirmation that says what it means for customers. A
 * configuration whose `.glb` or area ↔ mesh table does not allow activation says why instead of offering it.
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
  const activateBlocked =
    fileState.kind !== "ready" &&
    allowedActions(status, can, { writable }).some((action) => action.code === "activate");
  if (actions.length === 0 && !activateBlocked) return null;

  const mutation = asking === "activate" ? activate : deactivate;
  const warning = asking ? pendingDesignWarning(asking, { hasStored: true }) : null;
  const confirm = () =>
    mutation.mutate(
      { productId, variantId, templateId: config.templateId, version: config.version },
      { onSuccess: () => setAsking(null) },
    );

  return (
    <div className="flex max-w-64 flex-col items-end gap-1.5">
      {actions.map((action) => (
        <Button
          key={action.code}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAsking(action.code)}
          className={ACTION_CLASS}
        >
          {action.label}
        </Button>
      ))}
      {actions.some((action) => action.code === "activate") && (
        <p className="text-ink-tertiary text-right text-xs">{TEXT.activateNote}</p>
      )}
      {activateBlocked && (
        <p role="status" className="text-ink-secondary text-right text-xs">
          {TEXT.activateBlocked[fileState.kind]}
        </p>
      )}
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
      >
        {warning && <Alert tone="warning">{warning}</Alert>}
      </ConfirmDialog>
    </div>
  );
}
