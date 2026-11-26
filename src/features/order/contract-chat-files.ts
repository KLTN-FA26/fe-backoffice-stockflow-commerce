/**
 * L-11: files the customer already sent in the chat about this contract or its order, so Sales can record the signed
 * copy from there instead of downloading it and uploading it again. Reads the staff chat endpoints only
 * (`chat-conversations:READ`): conversations by document (`contextKind` + `contextId`), their latest messages, and the
 * attachment's short-lived link, whose bytes the browser fetches like the print configuration's model file.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";
import { QUERY_TIMES } from "@/lib/api/query-client";

import { orderKeys } from "./queries";
import { isSignedFileTypeAllowed } from "./sales-contract-rules";

import type { SalesContract } from "./sales-contract-schemas";

/** At most this many files are offered, newest first. */
const MAX_FILES = 8;
const MAX_CONVERSATIONS = 3;

const conversationsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      /** The documents the thread is about (one thread can carry several contracts). */
      contexts: z
        .array(z.object({ id: z.string(), kind: z.string(), refId: z.string() }))
        .default([]),
    }),
  ),
});
const messagesSchema = z.object({
  items: z.array(
    z.object({
      visibility: z.string(),
      senderType: z.string(),
      sentAt: z.string(),
      /** The thread context the message is about (BE `ChatMessageView.contextId`); null when none in particular. */
      contextId: z.string().nullish(),
      deleted: z.boolean().default(false),
      attachments: z
        .array(
          z.object({
            id: z.string(),
            fileName: z.string(),
            contentType: z.string(),
            sizeBytes: z.number(),
          }),
        )
        .default([]),
    }),
  ),
});
const linkSchema = z.object({ url: z.string() });

export interface ChatFile {
  conversationId: string;
  attachmentId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  sentAt: string;
  /** Sent by the customer (not by staff). */
  fromCustomer: boolean;
  /**
   * The message is tied to THIS contract (its `contextId` is this contract's context of the thread). The BE sets no
   * context on a file message today, so this is usually false: then nothing says which contract the file is for.
   */
  forThisContract: boolean;
}

interface ThreadRef {
  id: string;
  /** This contract's context ids in the thread (kind CONTRACT, ref = the contract). */
  contractContexts: string[];
}

async function threads(
  params: Record<string, string>,
  contractId: string,
  signal?: AbortSignal,
): Promise<ThreadRef[]> {
  const { data } = await api.get<unknown>("/chat/conversations", {
    params: { ...params, size: String(MAX_CONVERSATIONS) },
    signal,
  });
  return conversationsSchema.parse(data).items.map((item) => ({
    id: item.id,
    contractContexts: item.contexts
      .filter((context) => context.kind === "CONTRACT" && context.refId === contractId)
      .map((context) => context.id),
  }));
}

/**
 * Files the customer could have sent the signed copy as, from the chats about the contract, then the order. A thread can
 * carry several contracts, so: a file message the BE ties to another document is left out; a signed copy cannot exist
 * before the contract was sent (docs 14 §4.3 bước 13-14), so an earlier file is left out too (S06-5). What stays is a
 * candidate, not a proof it is this contract's: only a customer file tied to this contract (`forThisContract`) may be
 * chosen for Sale.
 */
export async function listContractChatFiles(
  contract: Pick<SalesContract, "id" | "orderId" | "sentAt">,
  signal?: AbortSignal,
): Promise<ChatFile[]> {
  const found = [
    ...(await threads({ contextKind: "CONTRACT", contextId: contract.id }, contract.id, signal)),
    ...(await threads({ contextKind: "ORDER", contextId: contract.orderId }, contract.id, signal)),
  ];
  const unique = [...new Map(found.map((thread) => [thread.id, thread])).values()].slice(
    0,
    MAX_CONVERSATIONS,
  );
  const files: ChatFile[] = [];
  for (const { id: conversationId, contractContexts } of unique) {
    const { data } = await api.get<unknown>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
      { params: { limit: "50" }, signal },
    );
    for (const message of messagesSchema.parse(data).items) {
      // Internal notes never reach the customer; a deleted message's file is gone.
      if (message.deleted || message.visibility === "STAFF") continue;
      // A message the BE ties to another document of the thread (another contract) is not this contract's.
      const forThisContract = !!message.contextId && contractContexts.includes(message.contextId);
      if (message.contextId && !forThisContract) continue;
      for (const attachment of message.attachments) {
        if (!isSignedFileTypeAllowed({ name: attachment.fileName, type: attachment.contentType }))
          continue;
        files.push({
          conversationId,
          attachmentId: attachment.id,
          fileName: attachment.fileName,
          contentType: attachment.contentType,
          sizeBytes: attachment.sizeBytes,
          sentAt: message.sentAt,
          fromCustomer: message.senderType === "CUSTOMER",
          forThisContract,
        });
      }
    }
  }
  const sentAfter = contract.sentAt ? Date.parse(contract.sentAt) : Number.NaN;
  return files
    .filter((file) => Number.isNaN(sentAfter) || Date.parse(file.sentAt) >= sentAfter)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
    .slice(0, MAX_FILES);
}

/** The attachment as a `File`, ready for the signature upload. */
export async function fetchChatFile(file: ChatFile): Promise<File> {
  const { data } = await api.get<unknown>(
    `/chat/conversations/${encodeURIComponent(file.conversationId)}/attachments/${encodeURIComponent(file.attachmentId)}/link`,
  );
  const response = await fetch(linkSchema.parse(data).url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  // Bytes, not the response's Blob: a File built from them works in every runtime (jsdom included).
  const bytes = await response.arrayBuffer();
  return new File([bytes], file.fileName, {
    type: file.contentType || response.headers.get("content-type") || "",
  });
}

export function useContractChatFiles(
  contract: Pick<SalesContract, "id" | "orderId" | "sentAt">,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [
      ...orderKeys.all,
      "contract-chat-files",
      contract.id,
      contract.sentAt ?? "",
    ] as const,
    queryFn: ({ signal }) => listContractChatFiles(contract, signal),
    enabled,
    ...QUERY_TIMES.list,
  });
}
