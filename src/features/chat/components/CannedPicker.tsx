"use client";

import { useState } from "react";
import { MessageSquareText } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { chatErrorMessage, usePreviewCanned } from "../mutations";
import { useCannedResponses } from "../queries";

/**
 * Câu trả lời mẫu (S24): chọn một câu → BE điền biến của hội thoại (S23: {customerName}, {quoteCode}…) → đưa vào
 * ô trả lời để Sale đọc lại, sửa rồi gửi như tin thường.
 */
export function CannedPicker({
  conversationId,
  onPick,
}: {
  conversationId: string;
  onPick: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const list = useCannedResponses(q.trim(), open);
  const preview = usePreviewCanned();

  const pick = (cannedResponseId: string) =>
    preview.mutate(
      { id: conversationId, cannedResponseId },
      {
        onSuccess: (rendered) => {
          onPick(rendered.text);
          setError(null);
          setOpen(false);
        },
        onError: (failure) => setError(chatErrorMessage(failure)),
      },
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="ghost">
          <MessageSquareText className="size-3.5" /> Câu trả lời mẫu
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-2 p-2">
        <Input
          aria-label="Tìm câu trả lời mẫu"
          placeholder="Tìm theo tiêu đề, phím tắt…"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        {error && (
          <p className="text-danger text-xs" role="alert">
            {error}
          </p>
        )}
        {list.isPending ? (
          <p className="text-ink-tertiary px-1 text-xs">Đang tải…</p>
        ) : list.isError ? (
          <p className="text-danger px-1 text-xs" role="alert">
            {chatErrorMessage(list.error)}
          </p>
        ) : list.data.length === 0 ? (
          <p className="text-ink-tertiary px-1 text-xs">Không có câu trả lời mẫu.</p>
        ) : (
          <ul aria-label="Câu trả lời mẫu" className="max-h-64 space-y-0.5 overflow-y-auto">
            {list.data.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={preview.isPending}
                  onClick={() => pick(item.id)}
                  className="hover:bg-bg-muted focus-visible:ring-accent w-full rounded-[var(--control-radius)] px-2 py-1.5 text-left focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="text-ink-primary block text-[0.8125rem] font-medium">
                    {item.title}
                    {item.shortcut && (
                      <span className="text-ink-tertiary font-[family-name:var(--font-mono)]">
                        {" "}
                        /{item.shortcut}
                      </span>
                    )}
                  </span>
                  <span className="text-ink-tertiary line-clamp-2 block text-xs">{item.body}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
