"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Ghi chú tự do của dòng (≤ 255 ký tự): cắt gọn trong ô; trigger là nút nên bàn phím focus được
 * và trình đọc màn hình đọc đủ nội dung (không chỉ dựa vào `title` khi rê chuột).
 */
export function LineNoteCell({ note }: { note: string | null | undefined }) {
  return (
    <td className="text-ink-secondary px-3 py-2">
      {note ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="focus-visible:ring-border-strong block max-w-[12rem] truncate rounded-[var(--r-sm)] text-left focus-visible:ring-2 focus-visible:outline-none"
              >
                {note}
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs break-words whitespace-normal">
              {note}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        "—"
      )}
    </td>
  );
}
