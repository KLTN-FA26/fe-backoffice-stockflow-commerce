"use client";

import { MessagesSquare } from "lucide-react";
import { parseAsInteger, parseAsStringLiteral, useQueryState } from "nuqs";

import { CHAT_CONVERSATION_STATUSES, CHAT_INBOX_SCOPES, CHAT_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { Notice } from "@/components/shared/Notice";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { chatErrorMessage } from "../mutations";
import { useInbox } from "../queries";

import { InboxFilters } from "./InboxFilters";
import { InboxRow } from "./InboxRow";

function InboxContent() {
  const canRead = useCan(CHAT_PERMISSIONS.read);
  // Bộ lọc trên URL (nuqs, state-persistence): F5 / gửi link giữ nguyên.
  const [scope, setScope] = useQueryState(
    "scope",
    parseAsStringLiteral(CHAT_INBOX_SCOPES).withDefault("all"),
  );
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(CHAT_CONVERSATION_STATUSES),
  );
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const query = useInbox(
    { scope, status: status ? [status] : undefined, page: Math.max(0, page - 1) },
    canRead,
  );
  const filtered = scope !== "all" || !!status;

  return (
    <div className="surface-soft space-y-3">
      <h1 className="sr-only">Hộp thư chat</h1>
      <InboxFilters
        scope={scope}
        status={status}
        onScope={(value) => void Promise.all([setScope(value), setPage(1)])}
        onStatus={(value) => void Promise.all([setStatus(value), setPage(1)])}
      />
      {!canRead ? (
        <Notice tone="warning">Bạn chưa có quyền xem hội thoại.</Notice>
      ) : query.isPending ? (
        <PageSkeleton variant="list" />
      ) : query.isError ? (
        <Notice tone="danger">
          {chatErrorMessage(query.error)}{" "}
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
        </Notice>
      ) : query.data.items.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={<MessagesSquare className="size-8" />}
            title="Không tìm thấy hội thoại"
            description="Không có hội thoại khớp bộ lọc."
            action={
              <Button
                variant="outline"
                onClick={() => void Promise.all([setScope("all"), setStatus(null), setPage(1)])}
              >
                Bỏ bộ lọc
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<MessagesSquare className="size-8" />}
            title="Chưa có hội thoại"
            description="Hội thoại mới của khách sẽ hiện ở đây."
          />
        )
      ) : (
        <Card className="divide-y divide-[var(--table-line)] p-0">
          {query.data.items.map((item) => (
            <InboxRow key={item.id} item={item} />
          ))}
        </Card>
      )}
      {query.data && (query.data.hasPrevious || query.data.hasNext) && (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!query.data.hasPrevious}
            onClick={() => void setPage(page - 1)}
          >
            Trang trước
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!query.data.hasNext}
            onClick={() => void setPage(page + 1)}
          >
            Trang sau
          </Button>
        </div>
      )}
    </div>
  );
}

/** Hộp thư của Sale (WF-02 pha E2, BE S1): lọc của tôi / chưa phân công / quá hạn / theo trạng thái. */
export function ChatInbox() {
  return (
    <PermissionBoundary permissions={[CHAT_PERMISSIONS.viewPage]}>
      <InboxContent />
    </PermissionBoundary>
  );
}
