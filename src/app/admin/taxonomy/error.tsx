"use client";

import { RotateCcw } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

export default function TaxonomyError({ reset }: { reset: () => void }) {
  return (
    <EmptyState
      title="Không tải được thương hiệu / danh mục"
      description="Kiểm tra kết nối hoặc thử tải lại."
      action={
        <Button
          type="button"
          onClick={reset}
          className="bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse rounded-[var(--r-sm)]"
        >
          <RotateCcw className="size-3.5" />
          Tải lại
        </Button>
      }
    />
  );
}
