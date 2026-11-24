"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import {
  PRINT_CONFIG_ACTION_LABELS,
  PRINT_CONFIG_SCREEN_LABELS,
} from "@/constants/labels-print-config";
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
import { ReferenceFileSection } from "./ReferenceFileSection";

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
 * the configuration's status and what can be done now (activate, stop, edit or save). A stored configuration opens in
 * the view mode (one read-only card, `PrintConfigSummary`); who may edit switches to the edit mode with "Sửa cấu hình"
 * (`PrintConfigEditor`), and back with "Huỷ sửa" or once the save is stored. With nothing stored the page opens straight
 * in the edit mode for who may edit. The page decides whether the variant is customizable (the BE answers an empty
 * list, and 409 on a save, for any other product).
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
  const [editing, setEditing] = useState(false);
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

  // BD-7: a saved configuration's reference die-line; attaching follows the save's gate (UPDATE, product still sold).
  const reference = config && <ReferenceFileSection config={config} canAttach={canEdit} />;
  if (canEdit && (editing || config === null)) {
    return (
      <div className="space-y-5">
        <PrintConfigEditor
          key={variantId} // never the template: a refetch after a save must not remount (and lose the file)
          productId={productId}
          variantId={variantId}
          config={config}
          loadModel={loadModel}
          header={header}
          onCancel={config ? () => setEditing(false) : undefined}
          onSaved={() => setEditing(false)}
        />
        {reference}
      </div>
    );
  }
  const edit = canEdit && (
    <Button
      type="button"
      variant="outline"
      className="h-(--action-h) rounded-(--action-radius) px-(--action-px) text-[0.8125rem] font-medium"
      onClick={() => setEditing(true)}
    >
      <Pencil aria-hidden className="size-3.5" />
      {PRINT_CONFIG_ACTION_LABELS.edit}
    </Button>
  );
  return (
    <div className="space-y-5">
      {header(edit ? { button: edit, alerts: null } : undefined)}
      {config ? <PrintConfigSummary config={config} /> : <PrintConfigEmpty />}
      {reference}
    </div>
  );
}
