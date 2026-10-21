"use client";

import { InventoryError } from "@/features/inventory";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <InventoryError error={error} retry={reset} />;
}
