"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, LoaderCircle } from "lucide-react";

import { CHAT_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { formatDateTime } from "@/lib/format/date";
import { Button } from "@/components/ui/button";

import { fetchChatFile, useContractChatFiles } from "../../contract-chat-files";

import type { ChatFile } from "../../contract-chat-files";
import type { SalesContract } from "../../sales-contract-schemas";

/**
 * L-11: chọn bản ký khách đã gửi trong chat của hợp đồng / đơn, thay cho tải về rồi tải lên lại. Chỉ hiện khi người
 * dùng đọc được chat và có file hợp lệ (PDF, Word, Excel, ảnh) gửi SAU khi hợp đồng này được gửi; mới nhất lên đầu và được
 * chọn sẵn (R6, S06-5) — Sale vẫn xem lại rồi bấm "Ghi nhận đã ký". Mỗi file hai dòng: tên, rồi ai gửi và lúc nào.
 * Tải file thất bại thì nói rõ, vẫn chọn từ máy được.
 */
export function ChatFilePicker({
  contract,
  current,
  onPick,
}: {
  contract: Pick<SalesContract, "id" | "orderId" | "sentAt">;
  /** The file the form holds now: a file picked from the computer afterwards un-marks the chat file. */
  current: File | null;
  onPick: (file: File) => void;
}) {
  const canChat = useCan(CHAT_PERMISSIONS.read);
  const files = useContractChatFiles(contract, canChat);
  const [loading, setLoading] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ id: string; file: File } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoPicked = useRef(false);
  const inUse = picked && picked.file === current ? picked.id : null;
  const newest = files.data?.[0];

  const pick = async (file: ChatFile) => {
    setError(null);
    setLoading(file.attachmentId);
    try {
      const fetched = await fetchChatFile(file);
      onPick(fetched);
      setPicked({ id: file.attachmentId, file: fetched });
    } catch {
      setError("Không tải được file từ chat. Tải file về máy rồi chọn ở ô trên.");
    } finally {
      setLoading(null);
    }
  };

  // Chọn sẵn file mới nhất khách gửi — một lần, khi danh sách vừa có và ô file còn trống.
  useEffect(() => {
    if (!newest || autoPicked.current || current) return;
    autoPicked.current = true;
    void pick(newest);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi file mới nhất xuất hiện
  }, [newest?.attachmentId]);

  if (!canChat || !files.data?.length) return null;

  return (
    <section aria-labelledby="sign-chat-files" className="space-y-1.5">
      <h3 id="sign-chat-files" className="text-ink-secondary text-xs font-medium">
        Hoặc dùng file đã gửi trong chat
      </h3>
      <ul className="space-y-1.5">
        {files.data.map((file, index) => (
          <li key={file.attachmentId} className="flex items-start gap-2 text-[0.8125rem]">
            <FileText className="text-ink-secondary mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="text-ink-primary block break-all">{file.fileName}</span>
              <span className="text-ink-secondary block text-xs">
                {file.fromCustomer ? "Khách gửi" : "Nhân viên gửi"} · {formatDateTime(file.sentAt)}
                {index === 0 && " · mới nhất"}
              </span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading !== null}
              aria-pressed={inUse === file.attachmentId}
              aria-label={`Dùng file ${file.fileName}`}
              onClick={() => void pick(file)}
            >
              {loading === file.attachmentId && (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              )}
              {inUse === file.attachmentId ? "Đang dùng" : "Dùng file này"}
            </Button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
    </section>
  );
}
