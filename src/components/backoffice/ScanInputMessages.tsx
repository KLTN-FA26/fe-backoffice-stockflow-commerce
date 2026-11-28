import { cn } from "cn";
import { CheckCircle2, XCircle } from "lucide-react";

export interface ScanFeedback {
  tone: "positive" | "danger";
  message: string;
  /** Tăng mỗi lần quét — cùng một thông báo lặp lại vẫn chớp lại và được đọc lại. */
  seq?: number;
}

export const FEEDBACK_CLASSES: Record<ScanFeedback["tone"], { field: string; text: string }> = {
  positive: {
    // Ô quét luôn focus → phải đè cả viền focus-visible, nếu không màu phản hồi không hiện
    field:
      "border-positive focus-visible:border-positive bg-[color-mix(in_srgb,var(--positive)_8%,transparent)] dark:bg-[color-mix(in_srgb,var(--positive)_14%,transparent)]",
    text: "text-positive",
  },
  danger: {
    field:
      "border-danger focus-visible:border-danger bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] dark:bg-[color-mix(in_srgb,var(--danger)_14%,transparent)]",
    text: "text-danger",
  },
};

/** Gợi ý + kết quả quét của một ô quét: hai vùng đọc cho trình đọc màn hình và một dòng nhìn thấy được. */
export function ScanInputMessages({
  id,
  hint,
  feedback,
}: {
  id: string;
  hint?: string;
  feedback?: ScanFeedback | null;
}) {
  const tone = feedback ? FEEDBACK_CLASSES[feedback.tone] : null;
  const FeedbackIcon = feedback?.tone === "danger" ? XCircle : CheckCircle2;
  return (
    <>
      {/* Hai vùng live cố định (đổi `role` trên cùng một node thì trình đọc màn hình đọc không ổn
          định): lỗi → alert đọc ngay, đúng → status lịch sự. `key` theo `seq` để đọc lại khi lặp. */}
      {hint && (
        <span id={`${id}-hint`} className="sr-only">
          {hint}
        </span>
      )}
      <span role="alert" className="sr-only">
        {feedback?.tone === "danger" && <span key={feedback.seq}>{feedback.message}</span>}
      </span>
      <span role="status" className="sr-only">
        {feedback?.tone === "positive" && <span key={feedback.seq}>{feedback.message}</span>}
      </span>
      <p
        key={feedback?.seq}
        // Chỉ để nhìn: gợi ý đã đọc qua aria-describedby, kết quả quét đọc qua hai vùng live phía trên
        aria-hidden
        className={cn(
          "flex min-h-5 items-center gap-1.5 text-[0.8125rem]",
          tone?.text ?? "text-ink-tertiary",
          feedback && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150",
        )}
      >
        {feedback ? (
          <>
            <FeedbackIcon className="size-4 shrink-0" /> {feedback.message}
          </>
        ) : (
          hint
        )}
      </p>
    </>
  );
}
