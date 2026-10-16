"use client";

import Link from "next/link";
import { ClipboardCheck, Loader2, PlayCircle } from "lucide-react";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { hasManifestView } from "@/features/shipping/lifecycle";
import { useStartLoading } from "@/features/shipping/mutations";
import { Button } from "@/components/ui/button";

import type { AllowedLoadAction } from "@/features/shipping/lifecycle";
import type { Load } from "@/features/shipping/types";

const L = UI_LABELS.shipping;
const PRIMARY =
  "bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse rounded-[var(--r-sm)]";

/**
 * Nút hành động chính (góc phải-trên, mode-a §4.3): "Bắt đầu xếp hàng" khi xe đã tới, "Đối soát &
 * biên bản" khi đang xếp. Gate theo `allowedLoadActions` — không rải if/else trạng thái trong JSX.
 */
export function LoadingActions({
  load,
  actions,
}: {
  load: Load;
  actions: readonly AllowedLoadAction[];
}) {
  const start = useStartLoading();
  const codes = new Set(actions.map(({ action }) => action.code));
  const showManifest = codes.has("handover") || hasManifestView(load.status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {codes.has("startLoading") && (
        <Button
          size="sm"
          className={PRIMARY}
          disabled={start.isPending}
          onClick={() => start.mutate(load.loadId)}
        >
          {start.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <PlayCircle className="size-3.5" />
          )}
          {L.action.startLoading}
        </Button>
      )}
      {showManifest && (
        <Button size="sm" asChild className={PRIMARY}>
          <Link href={ADMIN_ROUTES.shipments.manifest(load.loadId)}>
            <ClipboardCheck className="size-3.5" /> {L.action.openManifest}
          </Link>
        </Button>
      )}
    </div>
  );
}
