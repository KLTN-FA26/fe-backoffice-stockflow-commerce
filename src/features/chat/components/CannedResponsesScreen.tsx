"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, Pencil, Plus, Trash2 } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";

import { CHAT_PERMISSIONS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { Card } from "@/components/shared/Card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Notice } from "@/components/shared/Notice";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { SearchBar } from "@/components/shared/SearchBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { chatErrorMessage, useDeleteCannedResponse } from "../mutations";
import { useCannedResponses } from "../queries";

import { CannedResponseDialog } from "./CannedResponseDialog";

import type { CannedResponse } from "../schemas";

/** Ô tìm / lọc nhóm: gõ → 300 ms → URL (`q`, `category`). */
function useUrlFilter(key: string) {
  const [value, setValue] = useQueryState(key, parseAsString.withDefault(""));
  const [draft, setDraft] = useState(value);
  const debounced = useDebouncedValue(draft, 300).trim();
  useEffect(() => {
    if (debounced !== value) void setValue(debounced || null);
  }, [debounced, value, setValue]);
  return { value, draft, setDraft };
}

function CannedRow({
  item,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
}: {
  item: CannedResponse;
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-[var(--card-pad)] py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink-primary text-[0.875rem] font-medium">{item.title}</span>
          {item.shortcut && (
            <span className="text-ink-tertiary font-[family-name:var(--font-mono)] text-xs">
              /{item.shortcut}
            </span>
          )}
          {item.category && <Badge variant="outline">{item.category}</Badge>}
          {item.shared && <Badge variant="secondary">Dùng chung</Badge>}
        </div>
        <p className="text-ink-secondary line-clamp-3 text-[0.8125rem] whitespace-pre-line">
          {item.body}
        </p>
      </div>
      <div className="flex gap-1">
        {canUpdate && (
          <Button size="sm" variant="outline" onClick={onEdit} aria-label={`Sửa ${item.title}`}>
            <Pencil className="size-3.5" /> Sửa
          </Button>
        )}
        {canDelete && (
          <Button size="sm" variant="outline" onClick={onDelete} aria-label={`Xoá ${item.title}`}>
            <Trash2 className="size-3.5" /> Xoá
          </Button>
        )}
      </div>
    </li>
  );
}

function CannedContent() {
  const canCreate = useCan(CHAT_PERMISSIONS.cannedCreate);
  const canUpdate = useCan(CHAT_PERMISSIONS.cannedUpdate);
  const canDelete = useCan(CHAT_PERMISSIONS.cannedDelete);
  const canShare = useCan(CHAT_PERMISSIONS.supervise);
  const canRead = useCan(CHAT_PERMISSIONS.cannedRead);
  const search = useUrlFilter("q");
  const category = useUrlFilter("category");
  const list = useCannedResponses(search.value, canRead, category.value);
  const remove = useDeleteCannedResponse();
  const [editing, setEditing] = useState<CannedResponse | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<CannedResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const filtered = !!search.value || !!category.value;
  // Mẫu dùng chung chỉ người giám sát sửa / xoá được (BE `requireChangeableBy`); mẫu riêng thì chủ của nó.
  const can = (item: CannedResponse, allowed: boolean) => allowed && (!item.shared || canShare);

  return (
    <div className="surface-soft space-y-3">
      <h1 className="sr-only">Câu trả lời mẫu</h1>
      {!canRead ? (
        <Notice tone="warning">Bạn chưa có quyền xem câu trả lời mẫu.</Notice>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <SearchBar
                aria-label="Tìm câu trả lời mẫu"
                placeholder="Tìm theo tiêu đề, nội dung, phím tắt…"
                value={search.draft}
                onChange={search.setDraft}
                className="max-w-md"
              />
              <Input
                aria-label="Lọc theo nhóm"
                placeholder="Nhóm"
                value={category.draft}
                onChange={(event) => category.setDraft(event.target.value)}
                className="h-9 w-40 rounded-[var(--r-sm)] text-[0.8125rem]"
              />
            </div>
            {canCreate && (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="size-3.5" /> Thêm câu mẫu
              </Button>
            )}
          </div>
          {list.isPending ? (
            <PageSkeleton variant="list" />
          ) : list.isError ? (
            <Notice tone="danger">
              {chatErrorMessage(list.error)}{" "}
              <Button size="sm" variant="outline" onClick={() => void list.refetch()}>
                Thử lại
              </Button>
            </Notice>
          ) : list.data.length === 0 ? (
            <EmptyState
              icon={<MessageSquareText className="size-8" />}
              title={filtered ? "Không có câu mẫu khớp" : "Chưa có câu trả lời mẫu"}
              description={
                filtered
                  ? "Thử đổi từ khoá hoặc bỏ lọc nhóm."
                  : "Câu mẫu giúp trả lời nhanh những câu hỏi lặp lại."
              }
            />
          ) : (
            <Card className="p-0">
              <ul aria-label="Câu trả lời mẫu" className="divide-y divide-[var(--table-line)]">
                {list.data.map((item) => (
                  <CannedRow
                    key={item.id}
                    item={item}
                    canUpdate={can(item, canUpdate)}
                    canDelete={can(item, canDelete)}
                    onEdit={() => {
                      setEditing(item);
                      setFormOpen(true);
                    }}
                    onDelete={() => {
                      setDeleteError(null);
                      setDeleting(item);
                    }}
                  />
                ))}
              </ul>
            </Card>
          )}
          <CannedResponseDialog
            open={formOpen}
            editing={editing}
            canShare={canShare}
            onOpenChange={setFormOpen}
          />
          <ConfirmDialog
            open={!!deleting}
            onOpenChange={(next) => !next && setDeleting(null)}
            title="Xoá câu trả lời mẫu?"
            description={`"${deleting?.title ?? ""}" sẽ được lưu trữ, phím tắt dùng lại được.`}
            confirmLabel="Xoá"
            variant="danger"
            loading={remove.isPending}
            closeOnConfirm={false}
            error={deleteError}
            onConfirm={() => {
              if (!deleting) return;
              remove.mutate(
                { id: deleting.id },
                {
                  onSuccess: () => setDeleting(null),
                  onError: (failure) => setDeleteError(chatErrorMessage(failure)),
                },
              );
            }}
          />
        </>
      )}
    </div>
  );
}

/** Quản lý câu trả lời mẫu của Sale (S24): của mình + dùng chung; thêm / sửa / xoá theo quyền. */
export function CannedResponsesScreen() {
  return (
    <PermissionBoundary permissions={[CHAT_PERMISSIONS.cannedViewPage]}>
      <CannedContent />
    </PermissionBoundary>
  );
}
