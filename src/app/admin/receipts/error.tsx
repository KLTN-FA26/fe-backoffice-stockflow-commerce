"use client";

import { RotateCcw } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

export default function ReceiptsError({ reset }: { reset: () => void }) {
  return (
    <EmptyState
      title={UI_LABELS.loadError.networkTitle}
      description={UI_LABELS.loadError.networkDescription}
      action={
        <Button
          type="button"
          onClick={reset}
          className="bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse rounded-[var(--r-sm)]"
        >
          <RotateCcw className="size-3.5" />
          {UI_LABELS.common.retry}
        </Button>
      }
    />
  );
}
