import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { cn } from "cn";
import { Alert } from "@/components/shared/Alert";
import { DETAIL_CARD_CLASS } from "@/components/shared/DetailSection";
import { Skeleton } from "@/components/ui/skeleton";

import { PRINT_CONFIG_SAVE_HINT_ID } from "./PrintConfigSaveBar";
import { PrintConfigStatusMark } from "./PrintConfigStatusMark";

import type { ReactNode } from "react";
import type { PrintConfigStatus } from "../types";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.cards;

/**
 * The band at the head of the page, across both columns. Top row: who the page is about (the page composer's
 * `identity`) on the left, what can be done now (activate / stop, cancel, save) on the right. Under it, one status strip
 * that reads as a sentence: "Cấu hình in: ● status", then the next step (`hint`: what the save will do, or what is
 * missing, such as the .glb file) — instead of a lone label column and a hint squeezed under the save button. Last, the
 * sentences that explain a state: why the page is read-only, why the save is blocked, why it failed.
 */
export function PrintConfigHeader({
  identity,
  status,
  actions,
  save,
  hint,
  statusNote,
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
  /** The next step next to the status: what the save will do, or why there is nothing to save yet. */
  hint?: string | null;
  /**
   * While editing, the status's own sentence beside the save's hint: what activating does, or why it cannot be
   * activated yet (`printConfigStatusHint`).
   */
  statusNote?: string | null;
  /** The sentence saying why nothing can be changed, or `null` for who may edit. */
  readOnlyReason?: string | null;
  /** The save's alerts (`PrintConfigSaveAlerts`). */
  alerts?: ReactNode;
}) {
  const notes = readOnlyReason || alerts;
  return (
    <section aria-label={TEXT.header} className={cn(DETAIL_CARD_CLASS, "space-y-3")}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-56 flex-1">{identity}</div>
        {(actions || save) && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {actions}
            {save}
          </div>
        )}
      </div>
      <div className="bg-bg-subtle flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--r-md)] px-3 py-2">
        {/* A div, not a p: the loading Skeleton is a div, which a p cannot hold (hydration error). */}
        <div className="flex items-center gap-2 text-[0.8125rem]">
          <span className="text-ink-secondary">{TEXT.configStatus}:</span>
          {status === undefined ? (
            <Skeleton className="h-4 w-28" />
          ) : (
            <PrintConfigStatusMark status={status} />
          )}
        </div>
        {hint && (
          <p
            id={PRINT_CONFIG_SAVE_HINT_ID}
            className="text-ink-secondary border-border-default min-w-0 flex-1 text-[0.8125rem] sm:border-l sm:pl-4"
          >
            {hint}
          </p>
        )}
        {statusNote && (
          <p
            role="status"
            className="text-ink-secondary border-border-default min-w-0 flex-1 text-[0.8125rem] sm:border-l sm:pl-4"
          >
            {statusNote}
          </p>
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
