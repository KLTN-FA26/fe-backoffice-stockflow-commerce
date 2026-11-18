/** Chat — query key + hook. Chưa có STOMP: polling 5 giây (plan WF-02 §6). */

import { useQuery } from "@tanstack/react-query";

import { CHAT_POLL_MS } from "@/constants";

import { getConversation, getCustomerOverview, listConversations, listMessages } from "./api";

import type { InboxParams } from "./api";

export const chatKeys = {
  all: ["chat"] as const,
  inbox: (params: InboxParams) => [...chatKeys.all, "inbox", params] as const,
  conversation: (id: string) => [...chatKeys.all, "conversation", id] as const,
  messages: (id: string) => [...chatKeys.all, "conversation", id, "messages"] as const,
  overview: (customerId: string) => [...chatKeys.all, "overview", customerId] as const,
};

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
