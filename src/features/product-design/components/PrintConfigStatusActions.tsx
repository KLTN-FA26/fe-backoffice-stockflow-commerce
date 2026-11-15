"use client";

import { useState } from "react";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

import { allowedActions, statusOfPrintConfig } from "../lifecycle";
import { useActivatePrintConfig, useDeactivatePrintConfig } from "../mutations";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { PrintConfigDto } from "../types";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.status;
type StatusAction = "activate" | "deactivate";

/**
 * Activate or stop a saved configuration. The buttons are the descriptors `allowedActions` returns for the status and
 * the permission (no status check here), each behind a confirmation that says what it means for customers.
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
  const actions = allowedActions(statusOfPrintConfig(config), can, { writable }).filter(
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
    <div className="flex flex-wrap items-center gap-3">
      {actions.map((action) => (
        <Button
          key={action.code}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAsking(action.code)}
        >
          {action.label}
        </Button>
      ))}
      {actions.some((action) => action.code === "activate") && (
        <p className="text-ink-tertiary text-xs">{TEXT.activateNote}</p>
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
      />
    </div>
  );
}
