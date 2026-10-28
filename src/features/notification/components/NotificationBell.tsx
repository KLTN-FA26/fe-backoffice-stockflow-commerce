"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { NOTIFICATION_CONFIG, NOTIFICATION_LABELS } from "@/constants/notifications";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useMarkAllNotificationsRead, useMarkNotificationRead } from "../mutations";
import { useNotificationInbox, useNotificationUnreadCount } from "../queries";
import { NotificationItems } from "./NotificationItems";

import type { Notification } from "../types";

const L = NOTIFICATION_LABELS;
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const inbox = useNotificationInbox({ page, size: NOTIFICATION_CONFIG.pageSize, unreadOnly });
  const count = useNotificationUnreadCount(inbox.isSuccess);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = count.data ?? inbox.data?.unreadCount ?? 0;
  const openNotification = (item: Notification) => {
    if (!item.read) {
      markRead.mutate(item.id, { onError: () => toast.error(L.updateError) });
    }
    if (item.link) {
      setOpen(false);
      router.push(item.link);
    }
  };
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
          className="text-ink-secondary hover:text-ink-primary relative ml-auto size-9 rounded-[var(--r-sm)]"
          aria-label={unreadCount ? L.unreadBadge(unreadCount) : L.trigger}
          aria-expanded={open}
        >
          <Bell aria-hidden="true" className="size-4" />
          {unreadCount > 0 && (
            <span className="bg-danger absolute -top-1 -right-1 flex min-h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] font-semibold text-white tabular-nums">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
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
            <NotificationItems items={inbox.data?.items ?? []} onSelect={openNotification} />
          )}
        </div>
        {inbox.data && inbox.data.totalPages > 1 && (
          <div className="border-border-default flex items-center justify-between gap-2 border-t px-3 py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!inbox.data.hasPrevious}
              onClick={() => setPage((p) => p - 1)}
            >
              {L.previous}
            </Button>
            <span className="text-ink-tertiary text-xs tabular-nums">
              {L.page(page + 1, inbox.data.totalPages)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!inbox.data.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              {L.next}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
