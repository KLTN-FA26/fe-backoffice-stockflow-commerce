"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

/** `error.tsx` của nhóm route (api-conventions §8): lỗi máy chủ / mạng + Thử lại. */
export function RouteError({ reset }: { reset: () => void }) {
  return (
    <EmptyState
      title={UI_LABELS.loadError.networkTitle}
      description={UI_LABELS.loadError.networkDescription}
      action={
        <Button type="button" onClick={reset} className="rounded-[var(--r-sm)]">
          <RotateCcw className="size-3.5" />
          {UI_LABELS.common.retry}
        </Button>
      }
    />
  );
}

/** `not-found.tsx` của nhóm route — luôn có đường về danh sách. */
export function RouteNotFound({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href={href}>{UI_LABELS.common.backToList}</Link>
        </Button>
      }
    />
  );
}
