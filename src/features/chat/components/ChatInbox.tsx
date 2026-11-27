"use client";

import { useEffect, useState } from "react";
import { MessagesSquare, Plus } from "lucide-react";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import {
  CHAT_CONVERSATION_STATUSES,
  CHAT_INBOX_SCOPES,
  CHAT_PERMISSIONS,
  CHAT_SEARCH_MAX,
  CHAT_SEARCH_MIN,
} from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCan } from "@/lib/auth";
import { useSalesOwners } from "@/lib/references/sales-owner-queries";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { Notice } from "@/components/shared/Notice";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { SearchBar } from "@/components/shared/SearchBar";
import { Button } from "@/components/ui/button";

import { chatErrorMessage } from "../mutations";
import { useInbox } from "../queries";

import { InboxFilters } from "./InboxFilters";
import { InboxRow } from "./InboxRow";
import { OpenConversationDialog } from "./OpenConversationDialog";
import { SearchResults } from "./SearchResults";

/** Tìm trong tin nhắn (S21): gõ → 300 ms → URL `q`; dưới 2 ký tự thì chưa tìm (BE trả 400). */
function useInboxSearch() {
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [page, setPage] = useQueryState("qpage", parseAsInteger.withDefault(1));
  const [draft, setDraft] = useState(q);
  const debounced = useDebouncedValue(draft, 300).trim();
  useEffect(() => {
    if (debounced !== q) void Promise.all([setQ(debounced || null), setPage(1)]);
  }, [debounced, q, setQ, setPage]);
  const clear = () => {
    setDraft("");
    void Promise.all([setQ(null), setPage(1)]);
  };
  return { q, draft, setDraft, page, setPage, clear, active: q.length >= CHAT_SEARCH_MIN };
}

function Inbox({ canRead }: { canRead: boolean }) {
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
  const owners = useSalesOwners(query.data?.items.map((item) => item.customerId) ?? []);

  return (
    <>
      <InboxFilters
        scope={scope}
        status={status}
        onScope={(value) => void Promise.all([setScope(value), setPage(1)])}
        onStatus={(value) => void Promise.all([setStatus(value), setPage(1)])}
      />
      {query.isPending ? (
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
            <InboxRow key={item.id} item={item} owner={owners.get(item.customerId)} />
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
    </>
  );
}

function InboxContent() {
  const canRead = useCan(CHAT_PERMISSIONS.read);
  const canCreate = useCan(CHAT_PERMISSIONS.create);
  const [opening, setOpening] = useState(false);
  const search = useInboxSearch();

  return (
    <div className="surface-soft space-y-3">
      <h1 className="sr-only">Hộp thư chat</h1>
      {!canRead ? (
        <Notice tone="warning">Bạn chưa có quyền xem hội thoại.</Notice>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SearchBar
              aria-label="Tìm trong tin nhắn"
              placeholder="Tìm trong tin nhắn (từ 2 ký tự)…"
              value={search.draft}
              onChange={(value) => search.setDraft(value.slice(0, CHAT_SEARCH_MAX))}
              className="max-w-md"
            />
            {canCreate && (
              <Button size="sm" onClick={() => setOpening(true)}>
                <Plus className="size-3.5" /> Mở hội thoại mới
              </Button>
            )}
          </div>
          {canCreate && <OpenConversationDialog open={opening} onOpenChange={setOpening} />}
          {search.active ? (
            <SearchResults
              q={search.q}
              page={search.page}
              onPage={(next) => void search.setPage(next)}
              onClear={search.clear}
            />
          ) : (
            <Inbox canRead={canRead} />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Hộp thư của Sale (WF-02 pha E2, BE S1): lọc của tôi / chưa phân công / quá hạn / theo trạng thái; tìm trong
 * tin nhắn (S21).
 */
export function ChatInbox() {
  return (
    <PermissionBoundary permissions={[CHAT_PERMISSIONS.viewPage]}>
      <InboxContent />
    </PermissionBoundary>
  );
}
