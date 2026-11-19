"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";

import { ADMIN_ROUTES, CHAT_STATUS_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { Notice } from "@/components/shared/Notice";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { chatErrorMessage } from "../mutations";
import { useMessageSearch } from "../queries";
import { isInternalNote } from "../selectors";

/**
 * Kết quả tìm trong tin nhắn (S21): mỗi dòng là một tin (kể cả ghi chú nội bộ, đánh dấu rõ), bấm mở hội thoại.
 */
export function SearchResults({
  q,
  page,
  onPage,
  onClear,
}: {
  q: string;
  page: number;
  onPage: (page: number) => void;
  onClear: () => void;
}) {
  const query = useMessageSearch(q, Math.max(0, page - 1), true);

  if (query.isPending) return <PageSkeleton variant="list" />;
  if (query.isError)
    return (
      <Notice tone="danger">
        {chatErrorMessage(query.error)}{" "}
        <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
          Thử lại
        </Button>
      </Notice>
    );
  if (query.data.items.length === 0)
    return (
      <EmptyState
        icon={<SearchX className="size-8" />}
        title="Không tìm thấy tin nhắn"
        description={`Không có tin nào chứa “${q}”.`}
        action={
          <Button variant="outline" onClick={onClear}>
            Xoá tìm kiếm
          </Button>
        }
      />
    );

  return (
    <div className="space-y-2">
      <Card className="divide-y divide-[var(--table-line)] p-0">
        {query.data.items.map((hit) => (
          <Link
            key={hit.message.id}
            href={ADMIN_ROUTES.chat.detail(hit.conversationId)}
            className="hover:bg-bg-muted focus-visible:ring-accent block px-4 py-3 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
              <span className="text-ink-primary font-medium">
                {hit.customerName ?? "Khách"} · {hit.subject ?? "Hội thoại"}
              </span>
              <span className="text-ink-tertiary tabular-nums">
                {CHAT_STATUS_LABELS[hit.conversationStatus]} · {formatDateTime(hit.message.sentAt)}
              </span>
            </div>
            <p className="text-ink-secondary mt-1 line-clamp-2 text-[0.8125rem]">
              {isInternalNote(hit.message) && (
                <span className="bg-warning/15 text-ink-primary mr-1 rounded px-1 text-xs">
                  Ghi chú nội bộ
                </span>
              )}
              {hit.message.senderName && `${hit.message.senderName}: `}
              {hit.message.body ?? "—"}
            </p>
          </Link>
        ))}
      </Card>
      {(query.data.hasPrevious || query.data.hasNext) && (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!query.data.hasPrevious}
            onClick={() => onPage(page - 1)}
          >
            Trang trước
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!query.data.hasNext}
            onClick={() => onPage(page + 1)}
          >
            Trang sau
          </Button>
        </div>
      )}
    </div>
  );
}
