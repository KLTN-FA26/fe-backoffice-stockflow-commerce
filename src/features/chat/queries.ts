/** Chat — query key + hook. Chưa có STOMP: polling 5 giây (plan WF-02 §6). */

import { useQuery } from "@tanstack/react-query";

import { CHAT_BADGE_POLL_MS, CHAT_POLL_MS } from "@/constants";

import { getConversation, getCustomerOverview, listConversations, listMessages } from "./api";
import { getStaffUnread, listAgents, listCannedResponses, searchMessages } from "./api-tools";

import type { InboxParams } from "./api";

export const chatKeys = {
  all: ["chat"] as const,
  inbox: (params: InboxParams) => [...chatKeys.all, "inbox", params] as const,
  conversation: (id: string) => [...chatKeys.all, "conversation", id] as const,
  messages: (id: string) => [...chatKeys.all, "conversation", id, "messages"] as const,
  overview: (customerId: string) => [...chatKeys.all, "overview", customerId] as const,
  agents: () => [...chatKeys.all, "agents"] as const,
  search: (q: string, page: number) => [...chatKeys.all, "search", q, page] as const,
  unread: () => [...chatKeys.all, "unread"] as const,
  canned: (q: string) => [...chatKeys.all, "canned", q] as const,
};

export function useAgents(enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.agents(),
    queryFn: ({ signal }) => listAgents(signal),
    enabled,
  });
}

/** `q` đã đạt 2–200 ký tự mới gọi (BE trả 400 dưới / trên ngưỡng). */
export function useMessageSearch(q: string, page: number, enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.search(q, page),
    queryFn: ({ signal }) => searchMessages({ q, page }, signal),
    enabled,
  });
}

export function useStaffUnread(enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.unread(),
    queryFn: ({ signal }) => getStaffUnread(signal),
    enabled,
    refetchInterval: CHAT_BADGE_POLL_MS,
  });
}

export function useCannedResponses(q: string, enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.canned(q),
    queryFn: ({ signal }) => listCannedResponses(q || undefined, signal),
    enabled,
  });
}

export function useInbox(params: InboxParams, enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.inbox(params),
    queryFn: ({ signal }) => listConversations(params, signal),
    enabled,
    refetchInterval: CHAT_POLL_MS,
  });
}

export function useConversation(id: string, enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.conversation(id),
    queryFn: ({ signal }) => getConversation(id, signal),
    enabled,
    refetchInterval: CHAT_POLL_MS,
  });
}

/** 50 tin mới nhất (BE trả mới nhất trước khi đọc bằng `before`; không truyền = mới nhất). */
export function useMessages(id: string, enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.messages(id),
    queryFn: ({ signal }) => listMessages(id, undefined, signal),
    enabled,
    refetchInterval: CHAT_POLL_MS,
  });
}

export function useCustomerOverview(customerId: string | undefined) {
  return useQuery({
    queryKey: chatKeys.overview(customerId ?? ""),
    queryFn: ({ signal }) => getCustomerOverview(customerId ?? "", signal),
    enabled: !!customerId,
  });
}
