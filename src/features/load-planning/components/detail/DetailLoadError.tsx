"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { classifyLoadError } from "@/lib/api/load-error";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

import type { LoadErrorKind } from "@/lib/api/load-error";

const { common, loadError, loadPlan } = UI_LABELS;

const COPY: Record<LoadErrorKind, { title: string; description: string }> = {
  "not-found": { title: loadPlan.notFoundTitle, description: loadPlan.notFoundDescription },
  forbidden: { title: loadError.forbiddenTitle, description: loadPlan.forbiddenDescription },
  "no-read": { title: loadPlan.noReadTitle, description: loadPlan.noReadDescription },
  "invalid-data": {
    title: loadError.invalidDataTitle,
    description: loadError.invalidDataDescription,
  },
  network: { title: loadError.networkTitle, description: loadError.networkDescription },
  server: { title: loadError.serverTitle, description: loadError.serverDescription },
  permissions: { title: loadError.permissionsTitle, description: loadError.permissionsDescription },
};

/** Lỗi tải một kế hoạch: 404 / 403 / sai hợp đồng / mất mạng / 5xx là các thông điệp riêng (api-conventions §8). */
export function DetailLoadError({
  error,
  kind: forced,
  onRetry,
}: {
  error: unknown;
  kind?: LoadErrorKind;
  onRetry?: () => void;
}) {
  const kind = forced ?? classifyLoadError(error);
  const retryable = onRetry && (kind === "network" || kind === "server" || kind === "invalid-data");
  return (
    <EmptyState
      icon={<CalendarClock className="size-8" />}
      title={COPY[kind].title}
      description={COPY[kind].description}
      action={
        <div className="flex gap-2">
          {retryable && (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              {common.retry}
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={ADMIN_ROUTES.loadPlans.list}>{common.backToList}</Link>
          </Button>
        </div>
      }
    />
  );
}
