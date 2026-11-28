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
 * dùng đọc được chat và có file hợp lệ (PDF, Word, Excel, ảnh) gửi SAU khi hợp đồng này được gửi; mới nhất lên đầu. Một
 * hội thoại có thể mang nhiều hợp đồng nên danh sách chỉ là ứng viên: chọn sẵn CHỈ khi file do khách gửi VÀ BE gắn nó với
 * đúng hợp đồng này (`forThisContract`), không thì Sale tự chọn. Không bao giờ thay file Sale đã chọn / tải lên. Mỗi file hai
 * dòng: tên, rồi ai gửi và lúc nào. Tải file thất bại thì nói rõ, vẫn chọn từ máy được.
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

  // The file the form holds now, read after the (slow) download too: a file the user chose meanwhile is never replaced.
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  });

  const pick = async (file: ChatFile, automatic = false) => {
    setError(null);
    setLoading(file.attachmentId);
    try {
      const fetched = await fetchChatFile(file);
      if (automatic && currentRef.current) return;
      onPick(fetched);
      setPicked({ id: file.attachmentId, file: fetched });
    } catch {
      if (!automatic) setError("Không tải được file từ chat. Tải file về máy rồi chọn ở ô trên.");
    } finally {
      setLoading(null);
    }
  };

  // Chọn sẵn một lần, chỉ file khách gửi mà BE gắn với hợp đồng này, và chỉ khi ô file còn trống.
  const preselect = files.data?.find((file) => file.fromCustomer && file.forThisContract);
  useEffect(() => {
    if (!preselect || autoPicked.current || currentRef.current) return;
    autoPicked.current = true;
    void pick(preselect, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi file đủ điều kiện xuất hiện
  }, [preselect?.attachmentId]);

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
