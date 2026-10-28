"use client";

import { Download, Loader2 } from "lucide-react";

import {
  DESIGN_ARTIFACT_ROLES,
  DESIGN_ARTIFACT_ROLE_LABELS,
  FULFILLMENT_ERROR_MESSAGES,
} from "@/constants";
import { fulfillmentErrorMessage } from "@/features/fulfillment/errors";
import { useDesignArtifactDownload } from "@/features/fulfillment/mutations";
import { isSafeArtifactUrl } from "@/features/fulfillment/selectors";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import type { DesignArtifactRole } from "@/constants";

/**
 * Tải từng file của bundle thiết kế đã khoá. Mỗi lần bấm xin một URL ký mới (BE trả `no-store`,
 * URL hết hạn nhanh) rồi mở ở tab khác — không giữ URL lại.
 *
 * Tab được mở NGAY trong cú bấm, URL gán sau khi API trả về: nếu chờ API xong mới `window.open`
 * thì lệnh mở không còn nằm trong thao tác của người dùng và trình duyệt chặn như popup.
 */
export function ArtifactButtons({ taskId, lineId }: { taskId: string; lineId: string }) {
  const download = useDesignArtifactDownload();
  const pendingRole = download.isPending ? download.variables?.role : undefined;

  const open = (role: DesignArtifactRole) => {
    const tab = window.open("", "_blank");
    if (!tab) {
      toast.error(FULFILLMENT_ERROR_MESSAGES.popupBlocked);
      return;
    }
    // Trang đích là file ở kho lưu trữ — không cho nó tham chiếu ngược về cửa sổ back-office
    tab.opener = null;
    download.mutate(
      { taskId, lineId, role },
      {
        onSuccess: (artifact) => {
          // Lớp chặn cuối: schema đã chỉ nhận http(s), kiểm lại ngay trước khi gán vào tab
          if (!isSafeArtifactUrl(artifact.url)) {
            tab.close();
            toast.error(FULFILLMENT_ERROR_MESSAGES.artifactUrlInvalid);
            return;
          }
          tab.location.href = artifact.url;
        },
        onError: (error) => {
          tab.close();
          toast.error(fulfillmentErrorMessage(error, "artifact"));
        },
      },
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {DESIGN_ARTIFACT_ROLES.map((role) => (
        <Button
          key={role}
          type="button"
          variant="outline"
          size="sm"
          disabled={download.isPending}
          onClick={() => open(role)}
          className="border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted rounded-[var(--r-sm)]"
        >
          {pendingRole === role ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="text-accent size-3.5" />
          )}
          {DESIGN_ARTIFACT_ROLE_LABELS[role]}
        </Button>
      ))}
    </div>
  );
}
