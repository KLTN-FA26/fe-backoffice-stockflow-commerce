"use client";

import { RotateCcw } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

export default function UsersError({ reset }: { reset: () => void }) {
  return (
    <EmptyState
      title="Không tải được màn hình quản lý người dùng"
      description="Kiểm tra kết nối hoặc thử tải lại màn hình."
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
