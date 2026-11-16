"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { INVENTORY_ROUTES } from "@/constants/inventory";
import { QUARANTINE_ACTION, QUARANTINE_LABELS, QUARANTINE_LIMITS } from "@/constants/quarantine";

import { usePermissionChecker } from "@/lib/auth";

import { Alert } from "@/components/shared/Alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { quarantineActionError } from "../quarantine-errors";
import {
  allowedQuarantineActions,
  canWriteOffCarton,
  isHeldForOrder,
  isQuarantined,
} from "../quarantine-lifecycle";
import { useQuarantineCarton, useReleaseCarton } from "../quarantine-mutations";
import { quarantineInput } from "../quarantine-schemas";

import type { QuarantineAction } from "../quarantine-lifecycle";
import type { StockPackageDetail } from "../quarantine-types";

const L = QUARANTINE_LABELS;

/**
 * Cách ly / gỡ cách ly / ghi giảm một thùng (docs 20 §4.8). Quyết định do `allowedQuarantineActions(carton, can)`;
 * cách ly và gỡ cách ly không qua duyệt (đổi trạng thái, không đổi số lượng), ghi giảm đi qua phiếu điều chỉnh.
 */
export function QuarantineActions({ carton }: { carton: StockPackageDetail }) {
  const can = usePermissionChecker();
  const actions = allowedQuarantineActions(carton, can);
  const quarantine = useQuarantineCarton(carton.lpn);
  const release = useReleaseCarton(carton.lpn);
  const [action, setAction] = useState<QuarantineAction | null>(null);
  const [location, setLocation] = useState("");
  const [released, setReleased] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const pending = quarantine.isPending || release.isPending;
  const close = () => {
    setAction(null);
    setLocation("");
    setError(null);
  };
  const confirm = async (reason?: string) => {
    if (running.current || pending || !action) return;
    running.current = true;
    setError(null);
    try {
      if (action === QUARANTINE_ACTION.RELEASE) {
        await release.mutateAsync();
        setReleased(true);
      } else {
        const input = quarantineInput.safeParse({ locationCode: location, reason });
        if (!input.success) {
          setError(input.error.issues[0]?.message ?? L.quarantineLocation);
          return;
        }
        await quarantine.mutateAsync(input.data);
      }
      close();
    } catch (failure: unknown) {
      setError(quarantineActionError(failure).detail);
    } finally {
      running.current = false;
    }
  };
  const dialogAction = action && actions.includes(action) ? action : null;
  const isQuarantine = dialogAction === QUARANTINE_ACTION.QUARANTINE;
  return (
    <div className="space-y-[var(--el-gap)]">
      <div className="flex flex-wrap items-center gap-[var(--el-gap)]">
        {actions.map((value) => (
          <Button
            className="h-(--action-h) rounded-(--action-radius) px-(--action-px)"
            key={value}
            type="button"
            disabled={pending}
            variant={value === QUARANTINE_ACTION.RELEASE ? "default" : "outline"}
            onClick={() => setAction(value)}
          >
            {value === QUARANTINE_ACTION.RELEASE ? L.release : L.quarantine}
          </Button>
        ))}
        {canWriteOffCarton(carton, can) && (
          <Button asChild variant="outline" className="h-(--action-h) rounded-(--action-radius)">
            <Link
              href={`${INVENTORY_ROUTES.createAdjustment}?lpn=${encodeURIComponent(carton.lpn)}&direction=WRITE_OFF&reason=DAMAGED`}
            >
              {L.writeOff}
            </Link>
          </Button>
        )}
      </div>
      {isHeldForOrder(carton) && !isQuarantined(carton) && (
        <Alert tone="warning">{L.heldForOrder}</Alert>
      )}
      {released && (
        <div role="status">
          <Alert tone="info">{L.released}</Alert>
        </div>
      )}
      {dialogAction && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && close()}
          title={isQuarantine ? L.quarantine : L.release}
          description={isQuarantine ? L.quarantineDescription : L.releaseDescription}
          confirmLabel={isQuarantine ? L.quarantine : L.release}
          cancelLabel={L.back}
          requireReason={isQuarantine}
          reasonLabel={L.quarantineReason}
          reasonMaxLength={QUARANTINE_LIMITS.reasonLength}
          loading={pending}
          closeOnConfirm={false}
          error={error && <p>{error}</p>}
          variant="default"
          onConfirm={(reason) => void confirm(reason)}
        >
          {isQuarantine && (
            <div className="space-y-1.5">
              <label htmlFor="quarantine-location" className="text-sm font-medium">
                {L.quarantineLocation} *
              </label>
              <Input
                id="quarantine-location"
                value={location}
                maxLength={QUARANTINE_LIMITS.locationLength}
                autoComplete="off"
                onChange={(event) => setLocation(event.target.value)}
                aria-describedby="quarantine-location-hint"
              />
              <p id="quarantine-location-hint" className="text-ink-secondary text-sm">
                {L.quarantineLocationHint}
              </p>
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
