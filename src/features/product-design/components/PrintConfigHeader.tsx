import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { cn } from "cn";
import { Alert } from "@/components/shared/Alert";
import { DETAIL_CARD_CLASS } from "@/components/shared/DetailSection";
import { Skeleton } from "@/components/ui/skeleton";

import { PrintConfigStatusMark } from "./PrintConfigStatusMark";

import type { ReactNode } from "react";
import type { PrintConfigStatus } from "../types";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.cards;

/**
 * The band at the head of the page, across both columns: who the page is about (the page composer's `identity`), the
 * configuration's status, and what can be done now (activate / stop, save) on the right, so the status and the save stay
 * in view next to the work instead of in a short column of their own. Under it, the sentences that explain a state: why
 * the page is read-only, why the save is blocked, why it failed.
 */
export function PrintConfigHeader({
  identity,
  status,
  actions,
  save,
  readOnlyReason,
  alerts,
}: {
  identity?: ReactNode;
  /** `undefined` while the configuration loads; `null` = none yet. */
  status: PrintConfigStatus | null | undefined;
  /** Activate / stop (`PrintConfigStatusActions`), when there is a configuration. */
  actions?: ReactNode;
  /** The save (`PrintConfigSaveButton`), for who may edit. */
  save?: ReactNode;
  /** The sentence saying why nothing can be changed, or `null` for who may edit. */
  readOnlyReason?: string | null;
  /** The save's alerts (`PrintConfigSaveAlerts`). */
  alerts?: ReactNode;
}) {
  const notes = readOnlyReason || alerts;
  return (
    <section aria-label={TEXT.header} className={cn(DETAIL_CARD_CLASS, "space-y-3")}>
      <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
        {/* A floor on the name column: narrower than this, the status and the actions wrap below it instead of
            squeezing the product name to one word a line (seen at ~970px with the activate hint showing). */}
        <div className="min-w-56 flex-1">{identity}</div>
        <div className="space-y-1">
          <p className="text-ink-tertiary text-xs font-medium">{TEXT.configStatus}</p>
          {status === undefined ? (
            <Skeleton className="h-5 w-32" />
          ) : (
            <PrintConfigStatusMark status={status} size="md" />
          )}
        </div>
        {(actions || save) && (
          <div className="flex flex-wrap items-start justify-end gap-2">
            {actions}
            {save}
          </div>
        )}
      </div>
      {notes && (
        <div className="space-y-2">
          {readOnlyReason && (
            <Alert tone="info">
              <span role="status">{readOnlyReason}</span>
            </Alert>
          )}
          {alerts}
        </div>
      )}
    </section>
  );
}
