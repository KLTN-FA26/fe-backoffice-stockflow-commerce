"use client";

import { ArrowRightLeft } from "lucide-react";

import { TRANSFER_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

import type { TransferListState } from "./useTransferListState";

const E = UI_LABELS.emptyList;

/**
 * BE trả 400 cho tham số danh sách (UNSUPPORTED_PARAMETER: số trang vượt int, page/size ngoài
 * khoảng). Số trang sai → về trang đầu, giữ search / bộ lọc; còn lại mới bỏ bộ lọc.
 */
export function InvalidParamsState({ s }: { s: TransferListState }) {
  const badPage = s.filters.page > 1;
  return (
    <EmptyState
      icon={<ArrowRightLeft className="size-8" />}
      title={badPage ? E.invalidPageTitle : E.noResultsTitle}
      description={
        badPage ? E.invalidPageDescription : TRANSFER_ERROR_MESSAGES.UNSUPPORTED_PARAMETER
      }
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => (badPage ? void s.filters.setPage(1) : s.clearFilters())}
        >
          {badPage ? E.firstPage : E.clearFilters}
        </Button>
      }
    />
  );
}
