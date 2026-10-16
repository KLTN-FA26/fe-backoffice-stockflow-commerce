"use client";

import { InventoryError } from "@/features/inventory";

export default function ErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <InventoryError error={error} retry={retry} />;
}
