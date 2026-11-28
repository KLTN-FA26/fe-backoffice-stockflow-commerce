"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PUTAWAY_LABELS, PUTAWAY_LIMITS, WORKSPACE_PATHS } from "@/constants";
import { useWorkspaceHref } from "@/lib/workspace";
import { isPutawayTaskClosed } from "@/features/putaway/lifecycle";
import { ScanInput } from "@/components/backoffice/ScanInput";

import type { ScanFeedback } from "@/components/backoffice/ScanInput";
import type { PutawayTask } from "@/features/putaway/types";

const L = PUTAWAY_LABELS;

/**
 * Ô quét LPN ngay trên danh sách cất hàng: quét là mở thẳng màn cất thùng đó (không phân biệt hoa thường). Chỉ tìm trong
 * các thùng đang hiện ở danh sách (đã tải), nên không khớp thì nói "không có trong danh sách đang xem" chứ không khẳng
 * định thùng không tồn tại.
 */
export function PutawayScanBar({ tasks }: { tasks: readonly PutawayTask[] }) {
  const router = useRouter();
  const href = useWorkspaceHref();
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const onScan = (code: string) => {
    const hit = tasks.find(
      (task) =>
        task.lpn?.toUpperCase() === code.trim().toUpperCase() && !isPutawayTaskClosed(task.status),
    );
    if (hit) {
      setFeedback({ tone: "positive", message: L.scanOpened(code), seq: Date.now() });
      router.push(href(WORKSPACE_PATHS.putawayTask(hit.id)));
    } else {
      setFeedback({ tone: "danger", message: L.scanNotFound(code), seq: Date.now() });
    }
  };
  return (
    <div className="mb-3 max-w-xl">
      <ScanInput
        id="putaway-list-scan"
        label={L.scanLabel}
        placeholder={L.scanPlaceholder}
        hint={L.scanHint}
        maxLength={PUTAWAY_LIMITS.lpnMax}
        onScan={onScan}
        feedback={feedback}
      />
    </div>
  );
}
