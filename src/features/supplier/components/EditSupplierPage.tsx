"use client";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { useSupplier } from "../queries";
import { SupplierForm } from "./SupplierForm";
import { SupplierLoadError } from "./SupplierLoadError";

export function EditSupplierPage({ id }: { id: string }) {
  const query = useSupplier(id);

  if (query.isLoading) return <PageSkeleton variant="detail" />;
  if (query.isError || !query.data) {
    return <SupplierLoadError error={query.error} onRetry={() => void query.refetch()} />;
  }

  return <SupplierForm existingSupplier={query.data} />;
}
