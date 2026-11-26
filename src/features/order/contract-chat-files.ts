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

const conversationsSchema = z.object({ items: z.array(z.object({ id: z.string() })) });
const messagesSchema = z.object({
  items: z.array(
    z.object({
      visibility: z.string(),
      senderType: z.string(),
      sentAt: z.string(),
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
}

async function conversationIds(
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<string[]> {
  const { data } = await api.get<unknown>("/chat/conversations", {
    params: { ...params, size: String(MAX_CONVERSATIONS) },
    signal,
  });
  return conversationsSchema.parse(data).items.map((item) => item.id);
}

/**
 * Files the customer could have sent the signed copy as, from the chats about the contract, then the order. A signed
 * copy can only come after the contract was sent (docs 14 §4.3 bước 13-14), so a file sent earlier belongs to another
 * contract of the same order or customer and is left out (S06-5).
 */
export async function listContractChatFiles(
  contract: Pick<SalesContract, "id" | "orderId" | "sentAt">,
  signal?: AbortSignal,
): Promise<ChatFile[]> {
  const ids = [
    ...(await conversationIds({ contextKind: "CONTRACT", contextId: contract.id }, signal)),
    ...(await conversationIds({ contextKind: "ORDER", contextId: contract.orderId }, signal)),
  ];
  const unique = [...new Set(ids)].slice(0, MAX_CONVERSATIONS);
  const files: ChatFile[] = [];
  for (const conversationId of unique) {
    const { data } = await api.get<unknown>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
      { params: { limit: "50" }, signal },
    );
    for (const message of messagesSchema.parse(data).items) {
      // Internal notes never reach the customer; a deleted message's file is gone.
      if (message.deleted || message.visibility === "STAFF") continue;
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
