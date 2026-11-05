"use client";

import { UI_LABELS } from "@/constants";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

export default function InventoryError({ reset }: { reset: () => void }) {
  return (
    <EmptyState
      title={UI_LABELS.loadError.serverTitle}
      description={UI_LABELS.loadError.serverDescription}
      action={<Button onClick={reset}>{UI_LABELS.common.retry}</Button>}
    />
  );
}
