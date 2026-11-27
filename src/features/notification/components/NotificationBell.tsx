"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { NOTIFICATION_CONFIG, NOTIFICATION_LABELS } from "@/constants/notifications";

import { useAuthStore } from "@/lib/auth/auth-store";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useMarkAllNotificationsRead, useMarkNotificationRead } from "../mutations";
import { useNotificationInbox, useNotificationUnreadCount } from "../queries";
import { NotificationItems } from "./NotificationItems";
import { NotificationPager } from "./NotificationPager";

import type { ReactNode } from "react";
import type { Notification } from "../types";

const L = NOTIFICATION_LABELS;
/** `itemAction`: thao tác gắn trên từng thông báo, do màn bọc cung cấp (xem `NotificationItems`). */
export function NotificationBell({
  itemAction,
  side = "bottom",
}: {
  itemAction?: (item: Notification) => ReactNode;
  /** Hướng mở danh sách: dưới chuông (topbar) hoặc sang phải (đáy sidebar). */
  side?: "bottom" | "right";
} = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const inbox = useNotificationInbox({ page, size: NOTIFICATION_CONFIG.pageSize, unreadOnly });
  const count = useNotificationUnreadCount(inbox.isSuccess);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const authenticated = useAuthStore((state) => state.status === "authenticated" && !!state.user);
  const unreadCount = count.data ?? inbox.data?.unreadCount ?? 0;
  // Mark-all-read (or rows read elsewhere) can shrink the unread filter below the current page;
  // step back to the last page that exists instead of an empty page with no pager.
  const lastPage = Math.max(0, (inbox.data?.totalPages ?? 1) - 1);
  if (inbox.data && page > lastPage) setPage(lastPage);
  const openNotification = (item: Notification) => {
    if (!item.read) {
      markRead.mutate(item.id, { onError: () => toast.error(L.updateError) });
    }
    if (item.link) {
      setOpen(false);
      router.push(item.link);
    }
  };
  // Signed out: nothing personal to show, and the dropdown must not stay open on another session.
  if (!authenticated) return null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void inbox.refetch();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          // Nút tròn có viền — cùng kiểu nút 3 chấm của menu tài khoản đứng cạnh ở đáy sidebar
          className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary aria-expanded:bg-bg-muted aria-expanded:text-ink-primary relative size-7 shrink-0 rounded-full border p-0"
          aria-label={unreadCount ? L.unreadBadge(unreadCount) : L.trigger}
          aria-expanded={open}
        >
          <Bell aria-hidden="true" className="size-3.5" />
          {unreadCount > 0 && (
            <span className="bg-danger ring-sidebar absolute -top-1.5 -right-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] font-semibold text-white tabular-nums ring-2">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="end"
        sideOffset={8}
        className="border-border-default bg-bg-surface text-ink-primary w-96 max-w-[calc(100vw-2rem)] gap-0 rounded-[var(--r-md)] border p-0 shadow-[var(--sh-lg)]"
      >
        <div className="border-border-default flex items-center justify-between gap-2 border-b px-3 py-3">
          <h2 className="text-sm font-semibold">{L.title}</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-ink-secondary h-auto px-2 text-xs"
            disabled={unreadCount === 0 || markAllRead.isPending}
            onClick={() =>
              markAllRead.mutate(undefined, { onError: () => toast.error(L.updateError) })
            }
          >
            {L.markAllRead}
          </Button>
        </div>
        <div className="border-border-default flex gap-1 border-b px-3 py-2">
          {([false, true] as const).map((onlyUnread) => (
            <Button
              key={String(onlyUnread)}
              type="button"
              size="sm"
              variant={unreadOnly === onlyUnread ? "secondary" : "ghost"}
              className="h-7 rounded-[var(--r-sm)] px-2 text-xs"
              aria-pressed={unreadOnly === onlyUnread}
              onClick={() => {
                setUnreadOnly(onlyUnread);
                setPage(0);
              }}
            >
              {onlyUnread ? L.unreadOnly : L.all}
            </Button>
          ))}
        </div>
        <div className="max-h-96 overflow-y-auto" aria-busy={inbox.isFetching}>
          {inbox.isPending ? (
            <p className="text-ink-tertiary px-4 py-8 text-center text-sm">{L.loading}</p>
          ) : inbox.isError ? (
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-sm">
              <p role="alert" className="text-danger">
                {L.error}
              </p>
              <Button type="button" size="sm" onClick={() => void inbox.refetch()}>
                {L.retry}
              </Button>
            </div>
          ) : inbox.data?.items.length === 0 ? (
            <p className="text-ink-tertiary px-4 py-8 text-center text-sm">
              {unreadOnly ? L.emptyUnread : L.empty}
            </p>
          ) : (
            <NotificationItems
              items={inbox.data?.items ?? []}
              onSelect={openNotification}
              itemAction={itemAction}
            />
          )}
        </div>
        {inbox.data && <NotificationPager page={page} data={inbox.data} onPageChange={setPage} />}
      </PopoverContent>
    </Popover>
  );
}
