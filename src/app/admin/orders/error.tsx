"use client";

import { RotateCcw } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

/** Lỗi render bất ngờ trong nhóm route đơn hàng (lỗi API đã có màn riêng trong feature). */
export default function OrdersError({ reset }: { reset: () => void }) {
  return (
    <EmptyState
      title="Không hiển thị được màn hình đơn hàng"
      description="Đã xảy ra lỗi khi hiển thị. Thử tải lại màn hình."
      action={
        <Button
          type="button"
          onClick={reset}
          className="bg-brand text-ink-inverse hover:bg-brand-hover rounded-[var(--r-sm)]"
        >
          <RotateCcw className="size-3.5" />
          Tải lại
        </Button>
      }
    />
  );
}
