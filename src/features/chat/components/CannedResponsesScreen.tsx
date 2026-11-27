"use client";

import { useState } from "react";
import { MessageSquareText } from "lucide-react";

import { CHAT_CANNED_LABELS as L, CHAT_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { HeaderActions, HeaderCreateButton } from "@/components/shared/HeaderActions";
import { ListToolbar } from "@/components/shared/ListToolbar";
import { Notice } from "@/components/shared/Notice";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { chatErrorMessage } from "../mutations";
import { useCannedResponses } from "../queries";

import { cannedColumns, cannedHeaderFilters, matchesCannedColumns } from "./canned-columns";
import { CannedResponseDialog } from "./CannedResponseDialog";
import { DeleteCannedDialog } from "./DeleteCannedDialog";
import { useCannedFilters } from "./useCannedFilters";

import type { CannedResponse } from "../schemas";

/** EmptyState bỏ khung khi nằm trong thân bảng (backoffice-erp-ui A7). */
const IN_TABLE = "rounded-none border-0 bg-transparent py-10 whitespace-normal";

function CannedContent() {
  const canCreate = useCan(CHAT_PERMISSIONS.cannedCreate);
  const canUpdate = useCan(CHAT_PERMISSIONS.cannedUpdate);
  const canDelete = useCan(CHAT_PERMISSIONS.cannedDelete);
  const canShare = useCan(CHAT_PERMISSIONS.supervise);
  const canRead = useCan(CHAT_PERMISSIONS.cannedRead);
  const filters = useCannedFilters();
  const list = useCannedResponses(filters.serverQ, canRead, filters.serverCategory);
  const [editing, setEditing] = useState<CannedResponse | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<CannedResponse | null>(null);
  const { filtered, clear } = filters;
  /** Mở form: `null` = thêm mới, có mẫu = sửa. */
  const openForm = (item: CannedResponse | null) => {
    setEditing(item);
    setFormOpen(true);
  };
  const rows = list.data?.filter((item) => matchesCannedColumns(item, filters.columns)) ?? [];
  const columns = withHeaderFilters(
    cannedColumns({ canUpdate, canDelete, canShare, onEdit: openForm, onDelete: setDeleting }),
    cannedHeaderFilters(filters.category, filters.setCategory, filters.columns, filters.setColumn),
  );

  return (
    // Trang danh sách kiểu Vercel (backoffice-erp-ui A): không tiêu đề hiển thị, nút tạo mới trên thanh breadcrumb.
    <div className="surface-soft">
      <h1 className="sr-only">{L.title}</h1>
      <HeaderActions>
        <HeaderCreateButton
          onClick={() => canCreate && openForm(null)}
          disabled={!canCreate}
          aria-label={L.createAria}
          tooltip={canCreate ? L.createTooltip : L.createDenied}
        />
      </HeaderActions>
      {!canRead ? (
        <Notice tone="warning">{L.readDenied}</Notice>
      ) : (
        <>
          <ListToolbar<never, never, never>
            controlsIn="summary"
            search={filters.q}
            onSearchChange={filters.setQ}
            searchPlaceholder={L.searchPlaceholder}
            summaryItems={[
              {
                label: L.searchSummary,
                value: filters.q.trim() ? `“${filters.q}”` : L.unused,
                active: !!filters.q.trim(),
                onClear: () => filters.setQ(""),
              },
              { label: L.searchFields, value: L.searchFieldsValue },
              {
                label: L.columnSearch,
                value: filters.columnSummary,
                active: filters.columnSearchActive,
                onClear: filters.clearColumnSearch,
              },
            ]}
            onResetAll={clear}
            resetDisabled={!filtered}
          />
          {list.isPending ? (
            <PageSkeleton variant="list" />
          ) : list.isError ? (
            <Notice tone="danger">
              {chatErrorMessage(list.error)}{" "}
              <Button size="sm" variant="outline" onClick={() => void list.refetch()}>
                {L.retry}
              </Button>
            </Notice>
          ) : (
            <DataTable
              data={rows}
              columns={columns}
              rowKey={(item) => item.id}
              caption={L.caption}
              stickyHeader
              emptyState={
                rows.length > 0 ? undefined : (
                  <EmptyState
                    className={IN_TABLE}
                    icon={<MessageSquareText className="size-8" />}
                    title={filtered ? L.noMatchTitle : L.emptyTitle}
                    description={filtered ? L.noMatchDescription : L.emptyDescription}
                    action={
                      filtered ? (
                        <Button type="button" variant="outline" size="sm" onClick={clear}>
                          {L.clearFilters}
                        </Button>
                      ) : undefined
                    }
                  />
                )
              }
            />
          )}
          <CannedResponseDialog
            open={formOpen}
            editing={editing}
            canShare={canShare}
            onOpenChange={setFormOpen}
          />
          <DeleteCannedDialog item={deleting} onClose={() => setDeleting(null)} />
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
