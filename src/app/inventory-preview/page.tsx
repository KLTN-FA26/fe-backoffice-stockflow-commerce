"use client";

import { InventoryOverview, createInventoryMockService } from "@/features/inventory";

const previewService = createInventoryMockService();

/** Local review route with synthetic data; production navigation is a later step. */
export default function InventoryPreviewPage() {
  return (
    <main className="bg-bg-base min-h-screen p-[var(--card-pad)]">
      <div className="mx-auto max-w-6xl">
        <InventoryOverview service={previewService} />
      </div>
    </main>
  );
}
