"use client";

import { useState } from "react";

import { Card } from "@/components/shared/Card";
import { Button } from "@/components/ui/button";
import { identityErrorMessage } from "@/lib/api/identity-errors";
import { formatDateTime } from "@/lib/format/date";

import { STATUS_CHANGE_LABELS, USER_UI } from "../../constants";
import { useUserStatusChanges } from "../../queries";
import { UserStatusBadge } from "../UserStatusBadge";

/**
 * Lịch sử trạng thái (SCRUM-474 LOCK-REASON): mọi lần quản trị viên khoá, mở khoá, vô hiệu hoá hoặc kích hoạt lại
 * tài khoản, mới nhất trước, kèm lý do và người thao tác. Chỉ đọc; đi cùng quyền xem tài khoản (BE
 * `identity-users:READ`). Đợt khoá tự động do nhập sai mật khẩu không phải quyết định của quản trị viên nên không có ở đây.
 */
export function StatusHistoryCard({ userId }: { userId: string }) {
  const [page, setPage] = useState(0);
  const query = useUserStatusChanges(userId, page);
  const data = query.data;

  return (
    <Card>
      <h2 className="text-ink-primary text-sm font-semibold">{USER_UI.historyTitle}</h2>
      <p className="text-ink-tertiary mb-3 text-xs">{USER_UI.historyDescription}</p>
      {query.isError ? (
        <div role="alert" className="text-danger flex items-center gap-2 text-[0.8125rem]">
          <span>{USER_UI.historyLoadFailed}</span>
          <span className="text-ink-tertiary">{identityErrorMessage(query.error)}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>
            {USER_UI.retry}
          </Button>
        </div>
      ) : !data ? (
        <p role="status" className="text-ink-tertiary text-xs">
          {USER_UI.loading}
        </p>
      ) : data.items.length === 0 ? (
        <p className="text-ink-tertiary text-xs">{USER_UI.historyEmpty}</p>
      ) : (
        <>
          <ol className="divide-border-default divide-y">
            {data.items.map((entry) => (
              <li key={entry.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-[0.8125rem]">
                  <span className="text-ink-primary font-medium">
                    {STATUS_CHANGE_LABELS[entry.action]}
                  </span>
                  <span className="text-ink-tertiary flex items-center gap-1 text-xs">
                    <UserStatusBadge status={entry.fromStatus} />→
                    <UserStatusBadge status={entry.toStatus} />
                  </span>
                  <span className="text-ink-tertiary ml-auto text-xs">
                    {formatDateTime(entry.changedAt)} · {USER_UI.historyBy} {entry.actorUsername}
                  </span>
                </div>
                <p className="text-ink-secondary mt-1 text-[0.8125rem] break-words whitespace-pre-line">
                  {entry.reason}
                </p>
              </li>
            ))}
          </ol>
          {(data.hasPrevious || data.hasNext) && (
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!data.hasPrevious || query.isFetching}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                {USER_UI.historyPrevious}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!data.hasNext || query.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                {USER_UI.historyNext}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
