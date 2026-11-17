"use client";

import { useId } from "react";

import {
  PRINT_CONFIG_SCREEN_LABELS,
  PRINT_CONFIG_STATUS_LABELS,
} from "@/constants/labels-print-config";
import { Alert } from "@/components/shared/Alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { printConfigErrorMessage } from "../errors";
import { allowedActions, canViewPrintConfig, statusOfPrintConfig } from "../lifecycle";
import { usePrintConfig } from "../queries";
import { PrintConfigEditor } from "./PrintConfigEditor";
import { PrintConfigEmpty } from "./PrintConfigEmpty";
import { PrintConfigSkeleton } from "./PrintConfigSkeleton";
import { PrintConfigStatusActions } from "./PrintConfigStatusActions";
import { PrintConfigSummary } from "./PrintConfigSummary";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { GlbLoader } from "./use-glb-reading";

const TEXT = PRINT_CONFIG_SCREEN_LABELS;

export interface PrintConfigSectionProps {
  productId: string;
  variantId: string;
  /** The permission check of the page (`usePermissionChecker()`): `lifecycle.ts` decides what it allows. */
  can: (permission: PermissionCode) => boolean;
  /** False when the product is discontinued or the variant obsolete (BE 409): the section is read-only. */
  writable?: boolean;
  /** Why the page makes the section read-only, when it knows (the page composer passes it). */
  readOnlyReason?: "permission" | "product" | "variant";
  /** Replaces the `.glb` loader (tests). */
  loadModel?: GlbLoader;
}

/**
 * The "Cấu hình in" section of a variant of a customizable product: the saved configuration, and for who may edit it,
 * the upload of the `.glb`, what was read from it, the checks, the defaults and the save. The page decides whether the
 * variant is customizable (the BE answers an empty list, and 409 on a save, for any other product).
 */
export function PrintConfigSection({
  productId,
  variantId,
  can,
  writable = true,
  readOnlyReason,
  loadModel,
}: PrintConfigSectionProps) {
  const headingId = useId();
  const query = usePrintConfig(productId, variantId);
  if (!canViewPrintConfig(can)) return null;

  const config = query.data ?? null;
  const status = config ? statusOfPrintConfig(config) : null;
  const canEdit = allowedActions(status, can, { writable }).some((a) => a.code === "save");
  // Read-only says why: the page's reason, else the one the section can tell itself.
  const reason = canEdit ? null : (readOnlyReason ?? (writable ? "permission" : "product"));

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 id={headingId} className="text-ink-primary text-sm font-semibold">
          {TEXT.title}
        </h3>
        {status && <Badge variant="outline">{PRINT_CONFIG_STATUS_LABELS[status]}</Badge>}
      </div>

      {reason && query.data !== undefined && (
        <Alert tone="info">
          <span role="status">{TEXT.readOnly[reason]}</span>
        </Alert>
      )}
      {query.isLoading && <PrintConfigSkeleton />}
      {query.isError && query.data === undefined && (
        <div role="alert" className="space-y-2">
          <Alert tone="danger" title={TEXT.loadFailed}>
            {printConfigErrorMessage(query.error)}
          </Alert>
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
            {TEXT.retry}
          </Button>
        </div>
      )}
      {query.data !== undefined && (
        <>
          {config ? <PrintConfigSummary config={config} /> : <PrintConfigEmpty canEdit={canEdit} />}
          {config && (
            <PrintConfigStatusActions
              config={config}
              productId={productId}
              variantId={variantId}
              can={can}
              writable={writable}
            />
          )}
          {canEdit && (
            <PrintConfigEditor
              key={variantId} // never the template: a refetch after a save must not remount (and lose the file)
              productId={productId}
              variantId={variantId}
              config={config}
              loadModel={loadModel}
            />
          )}
        </>
      )}
    </section>
  );
}
