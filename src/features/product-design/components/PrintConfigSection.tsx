"use client";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { Alert } from "@/components/shared/Alert";
import { DETAIL_CARD_CLASS } from "@/components/shared/DetailSection";
import { Button } from "@/components/ui/button";

import { printConfigErrorMessage } from "../errors";
import { allowedActions, canViewPrintConfig, statusOfPrintConfig } from "../lifecycle";
import { usePrintConfig } from "../queries";
import { PrintConfigEditor } from "./PrintConfigEditor";
import { PrintConfigEmpty } from "./PrintConfigEmpty";
import { PrintConfigHeader } from "./PrintConfigHeader";
import { PrintConfigSkeleton } from "./PrintConfigSkeleton";
import { PrintConfigStatusActions } from "./PrintConfigStatusActions";
import { PrintConfigSummary } from "./PrintConfigSummary";

import type { ReactNode } from "react";
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
  /** Who the page is about (the variant and its product, from the page composer), at the head of the page band. */
  general?: ReactNode;
  /** Replaces the `.glb` loader (tests). */
  loadModel?: GlbLoader;
}

/**
 * The body of the "Cấu hình in" page of a variant of a customizable product. A band across the top says who it is about,
 * the configuration's status and what can be done now (activate, stop, save); under it, for who may edit, the file work
 * and the model side by side (`PrintConfigEditor`), otherwise the saved configuration. The page decides whether the
 * variant is customizable (the BE answers an empty list, and 409 on a save, for any other product).
 */
export function PrintConfigSection({
  productId,
  variantId,
  can,
  writable = true,
  readOnlyReason,
  general,
  loadModel,
}: PrintConfigSectionProps) {
  const query = usePrintConfig(productId, variantId);
  if (!canViewPrintConfig(can)) return null;

  if (query.data === undefined) {
    return (
      <div className="space-y-5">
        <PrintConfigHeader identity={general} status={undefined} />
        {query.isLoading && (
          <section className={DETAIL_CARD_CLASS}>
            <PrintConfigSkeleton />
          </section>
        )}
        {query.isError && (
          <div role="alert" className="space-y-2">
            <Alert tone="danger" title={TEXT.loadFailed}>
              {printConfigErrorMessage(query.error)}
            </Alert>
            <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
              {TEXT.retry}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const config = query.data;
  const status = config ? statusOfPrintConfig(config) : null;
  const canEdit = allowedActions(status, can, { writable }).some((a) => a.code === "save");
  // Read-only says why: the page's reason, else the one the section can tell itself.
  const reason = canEdit ? null : (readOnlyReason ?? (writable ? "permission" : "product"));

  const header = (save?: { button: ReactNode; alerts: ReactNode }) => (
    <PrintConfigHeader
      identity={general}
      status={status}
      readOnlyReason={reason && TEXT.readOnly[reason]}
      actions={
        config && (
          <PrintConfigStatusActions
            config={config}
            productId={productId}
            variantId={variantId}
            can={can}
            writable={writable}
          />
        )
      }
      save={save?.button}
      alerts={save?.alerts}
    />
  );

  if (canEdit) {
    return (
      <PrintConfigEditor
        key={variantId} // never the template: a refetch after a save must not remount (and lose the file)
        productId={productId}
        variantId={variantId}
        config={config}
        loadModel={loadModel}
        header={header}
      />
    );
  }
  return (
    <div className="space-y-5">
      {header()}
      {config ? <PrintConfigSummary config={config} /> : <PrintConfigEmpty />}
    </div>
  );
}
