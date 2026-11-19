"use client";

import { RotateCw } from "lucide-react";

import { Notice } from "@/components/shared/Notice";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import { contractErrorMessage } from "../../sales-contract-mutations";

/** Đang tải (skeleton) hoặc lỗi (message BE + Thử lại) của khối hợp đồng. */
export function ContractLoadState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (error)
    return (
      <Notice tone="danger">
        {contractErrorMessage(error)}{" "}
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          <RotateCw className="size-3.5" /> Thử lại
        </Button>
      </Notice>
    );
  return (
    <div role="status" aria-label="Đang tải hợp đồng" className="space-y-2">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
