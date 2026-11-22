/**
 * Chat — pure cache updates for socket events (FE fix list A.3). The socket only ever adds what a refetch would bring:
 * a message by its id, an inbox row by its id. What decides buttons (`canReply`, `canClaim`, `canAssign`,
 * `nextStatuses`) is never taken from a socket row: the queue's realtime row is no one's in particular
 * (`ChatViews.staffBroadcastRow`), so the viewer's own values stay until the GET brings fresh ones.
 */

import type { ChatConversation, ChatMessage, ChatMessagePage } from "./schemas";

export interface InboxPage {
  items: ChatConversation[];
}

export interface MessagePages {
  pages: ChatMessagePage[];
  pageParams: unknown[];
}

/**
 * The newest page (`GET .../messages`, the newest first) with `message` in it: replaced by id when present, else added
 * in `seq` order. No page loaded yet → nothing (the first GET brings it).
 */
export function upsertMessage(
  page: ChatMessagePage | undefined,
  message: ChatMessage,
): ChatMessagePage | undefined {
  if (!page) return page;
  const present = page.items.some((item) => item.id === message.id);
  const items = present
    ? page.items.map((item) => (item.id === message.id ? message : item))
    : [...page.items, message].sort((a, b) => b.seq - a.seq);
  return { ...page, items, lastSeq: Math.max(page.lastSeq, message.seq) };
}

/** Older / gap pages: only an edit of a message already shown (a new one belongs to the newest page). */
export function replaceMessageInPages<T extends MessagePages>(
  data: T | undefined,
  message: ChatMessage,
): T | undefined {
  if (!data?.pages.some((page) => page.items.some((item) => item.id === message.id))) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => (item.id === message.id ? message : item)),
    })),
  };
}

/**
 * An inbox page with the socket's row in place of the row of the same id. The viewer's own figures stay: `unread`
 * (the broadcast row counts for nobody) and the action flags. A row not on the page is left to the refetch, which
 * knows whether it belongs to this filter and page.
 */
export function replaceInboxRow<T extends InboxPage>(
  page: T | undefined,
  row: ChatConversation,
): T | undefined {
  if (!page?.items.some((item) => item.id === row.id)) return page;
  return {
    ...page,
    items: page.items.map((item) =>
      item.id === row.id
        ? {
            ...row,
            unread: item.unread,
            nextStatuses: item.nextStatuses,
            canReply: item.canReply,
            canClaim: item.canClaim,
            canAssign: item.canAssign,
          }
        : item,
    ),
  };
}
