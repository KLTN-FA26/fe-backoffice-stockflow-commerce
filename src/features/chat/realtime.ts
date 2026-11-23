"use client";

/**
 * Chat — STOMP events into the React Query cache (FE fix list A.3, BE `ChatBroadcaster` / `ChatTopics` /
 * `ChatEvent`). One socket for the whole back office (`lib/realtime`); these hooks only listen on it.
 *
 * | Destination                               | Event                                   | Cache                                |
 * | ----------------------------------------- | --------------------------------------- | ------------------------------------ |
 * | `/topic/chat.inbox`, `/user/queue/chat`   | `conversation.updated` (staff row)      | inbox row replaced by id; inbox + badge refetched |
 * | `/user/queue/chat`                        | `message.created` (an @mention)         | badge refetched, toast               |
 * | `/topic/chat.conversations.{id}[.staff]`  | `message.created` / `message.updated`   | message upserted by id; detail refetched (new one) |
 * | `/topic/chat.conversations.{id}`          | `conversation.updated` (customer's row) | detail refetched — never copied      |
 *
 * The BE pushes best effort (a failed push is dropped), so a reconnect refetches what this screen shows, and polling
 * stays as a slow safety net (`queries.ts`).
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { z } from "zod";

import { ADMIN_ROUTES, CHAT_REALTIME_COALESCE_MS, CHAT_REALTIME_LABELS } from "@/constants";
import { useChatSocketStatus, useChatSubscription } from "@/lib/realtime";
import { toast } from "@/components/shared/Toast";

import { chatKeys } from "./queries";
import { replaceInboxRow, replaceMessageInPages, upsertMessage } from "./realtime-cache";
import { chatConversationSchema, chatMessageSchema } from "./schemas";

import type { QueryKey } from "@tanstack/react-query";
import type { InboxPage, MessagePages } from "./realtime-cache";
import type { ChatMessagePage } from "./schemas";

export const CHAT_DESTINATIONS = {
  inbox: "/topic/chat.inbox",
  userQueue: "/user/queue/chat",
  conversation: (id: string) => `/topic/chat.conversations.${id}`,
  staff: (id: string) => `/topic/chat.conversations.${id}.staff`,
} as const;

/** BE `ChatEvent`: one envelope, switched on `type`. */
const chatEventSchema = z.object({
  type: z.string(),
  conversationId: z.string().nullish(),
  data: z.unknown(),
});

/** Many events in a burst → one refetch per key. */
function useCoalescedInvalidate() {
  const queryClient = useQueryClient();
  const pending = useRef(new Map<string, { queryKey: QueryKey; exact: boolean }>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return useCallback(
    (queryKey: QueryKey, exact = false) => {
      pending.current.set(JSON.stringify([queryKey, exact]), { queryKey, exact });
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        const batch = [...pending.current.values()];
        pending.current.clear();
        for (const filter of batch) void queryClient.invalidateQueries(filter);
      }, CHAT_REALTIME_COALESCE_MS);
    },
    [queryClient],
  );
}

/**
 * Runs `onReconnect` each time the socket comes up after being down — not when it was already up at mount: the
 * screen's own GET has just run.
 */
function useOnReconnect(live: boolean, onReconnect: () => void) {
  const previous = useRef(live);
  const latest = useRef(onReconnect);
  useEffect(() => {
    latest.current = onReconnect;
  });
  useEffect(() => {
    if (live && !previous.current) latest.current();
    previous.current = live;
  }, [live]);
}

/** Whether that conversation is the page open now (its messages arrive on screen; no toast needed). */
function reading(conversationId: string): boolean {
  return window.location.pathname === ADMIN_ROUTES.chat.detail(conversationId);
}

/**
 * The staff's queue and their own queue, wherever they are in the back office: the inbox rows and the menu badge stay
 * current, and an @mention tells them (unless they are reading that conversation already).
 */
export function useStaffChatRealtime(enabled: boolean) {
  const queryClient = useQueryClient();
  const invalidate = useCoalescedInvalidate();
  const live = useChatSocketStatus();
  const refresh = () => {
    invalidate(chatKeys.inboxes());
    invalidate(chatKeys.unread(), true);
  };
  const onEvent = (raw: unknown) => {
    const event = chatEventSchema.safeParse(raw);
    if (!event.success) return;
    if (event.data.type === "conversation.updated") {
      const row = chatConversationSchema.safeParse(event.data.data);
      if (row.success) {
        queryClient.setQueriesData<InboxPage>({ queryKey: chatKeys.inboxes() }, (page) =>
          replaceInboxRow(page, row.data),
        );
      }
      refresh();
    } else if (event.data.type === "message.created") {
      // On the person's own queue a staff message is a note that mentions them (`StaffChatService.note`).
      invalidate(chatKeys.unread(), true);
      const message = chatMessageSchema.safeParse(event.data.data);
      if (message.success && !reading(message.data.conversationId)) {
        toast.info(
          CHAT_REALTIME_LABELS.mentioned(message.data.senderName),
          message.data.body ?? undefined,
        );
      }
    }
  };
  useChatSubscription(enabled ? CHAT_DESTINATIONS.inbox : null, onEvent);
  useChatSubscription(enabled ? CHAT_DESTINATIONS.userQueue : null, onEvent);
  useOnReconnect(live, () => {
    if (enabled) refresh();
  });
}

/**
 * The open conversation: its messages (both topics: customer-visible and staff-only) and its detail. Subscribe only
 * once the GET found it (`enabled`): the BE answers a SUBSCRIBE to an unknown conversation by closing the socket.
 */
export function useConversationRealtime(id: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const invalidate = useCoalescedInvalidate();
  const live = useChatSocketStatus();
  const catchUp = () => {
    invalidate(chatKeys.conversation(id), true);
    invalidate(chatKeys.messages(id), true);
  };
  const onEvent = (raw: unknown) => {
    const event = chatEventSchema.safeParse(raw);
    if (!event.success || (event.data.conversationId && event.data.conversationId !== id)) return;
    const { type, data } = event.data;
    if (type === "message.created" || type === "message.updated") {
      const message = chatMessageSchema.safeParse(data);
      if (!message.success) return catchUp();
      queryClient.setQueryData<ChatMessagePage>(chatKeys.messages(id), (page) =>
        upsertMessage(page, message.data),
      );
      if (type === "message.updated") {
        for (const key of [chatKeys.older(id), chatKeys.gap(id)]) {
          queryClient.setQueryData<MessagePages>(key, (pages) =>
            replaceMessageInPages(pages, message.data),
          );
        }
      } else {
        // lastSeq / unread (mark read), and a first answer moves the status.
        invalidate(chatKeys.conversation(id), true);
      }
    } else if (type === "conversation.updated") {
      // The customer's view of it: the detail (buttons, nextStatuses) comes from the staff GET only.
      invalidate(chatKeys.conversation(id), true);
    }
    // `message.read`, `typing`: nothing on this screen shows them.
  };
  useChatSubscription(enabled ? CHAT_DESTINATIONS.conversation(id) : null, onEvent);
  useChatSubscription(enabled ? CHAT_DESTINATIONS.staff(id) : null, onEvent);
  useOnReconnect(live, () => {
    if (enabled) catchUp();
  });
}
