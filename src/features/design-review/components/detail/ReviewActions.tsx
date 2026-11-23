"use client";

import { useState } from "react";
import { CheckCircle2, Undo2 } from "lucide-react";

import { DESIGN_REVIEW_LABELS } from "@/constants";

import { usePermissionChecker } from "@/lib/auth/components/Can";

import {
  DESIGN_RETURN_SUGGEST_CODES,
  DESIGN_STALE_CODES,
  designReviewErrorMessage,
  isDesignErrorCode,
} from "@/features/design-review/errors";
import { allowedReviewActions } from "@/features/design-review/lifecycle";
import { useDesignArtifacts } from "@/features/design-review/queries";
import { designDecisionInputSchema } from "@/features/design-review/schemas";
import { currentSubmission } from "@/features/design-review/selectors";

import { DETAIL_ACTION_CLASS } from "@/components/shared/DetailSection";
import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { ApproveDialog } from "./ApproveDialog";
import { ReturnDialog } from "./ReturnDialog";

import type { DecideDesignMutation } from "@/features/design-review/mutations";
import type { Design } from "@/features/design-review/types";

type Dialog = "approve" | "return" | null;

/**
 * Thanh hành động: Duyệt / Trả lại theo `allowedReviewActions` (thiếu `approve` hoặc không còn chờ duyệt → chỉ xem).
 * Đang chạy: khoá mọi nút. `DESIGN_FILES_OUTDATED` khi duyệt → mở sẵn hộp trả lại kèm câu gợi ý.
 *
 * 12 BR-11: quyết định gắn với đúng bản người duyệt đã xem — `version` được chốt lúc mở hộp thoại, không lấy bản mới
 * nhất lúc gửi (tải lại khi focus cửa sổ có thể đổi sang bản khách vừa gửi lại). Dữ liệu cũ (CONFLICT…) → đóng hộp thoại,
 * tải lại mọi dữ liệu của thiết kế và nhắc xem lại.
 */
export function ReviewActions({
  design,
  decide,
}: {
  design: Design;
  decide: DecideDesignMutation;
}) {
  const can = usePermissionChecker();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reviewedVersion, setReviewedVersion] = useState(design.version);
  const [returnHint, setReturnHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staleNotice, setStaleNotice] = useState<string | null>(null);
  const [openNext, setOpenNext] = useState(true);
  // Cùng khoá với khối "File đã gửi": không gọi thêm.
  const artifacts = useDesignArtifacts(design.id);
  const printFileId = currentSubmission(artifacts.data ?? []).current.find(
    (artifact) => artifact.role === "PRINT_READY",
  )?.artifactId;
  const actions = allowedReviewActions(design, can);
  if (actions.length === 0) return null;

  /** `keepVersion`: chuyển từ Duyệt sang Trả lại sau lỗi — vẫn là bản người duyệt đã xem. */
  const open = (next: Dialog, hint: string | null = null, keepVersion = false) => {
    if (!keepVersion) setReviewedVersion(design.version);
    setError(null);
    setStaleNotice(null);
    setReturnHint(hint);
    setDialog(next);
  };
  const send = (input: unknown) => {
    const parsed = designDecisionInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setError(null);
    decide.decide(
      { id: design.id, version: reviewedVersion, ...parsed.data },
      {
        openNext: decide.fromQueue && openNext,
        onError: (failure) => {
          const message = designReviewErrorMessage(failure);
          if (isDesignErrorCode(failure, DESIGN_STALE_CODES)) {
            setDialog(null);
            setStaleNotice(`${message} ${DESIGN_REVIEW_LABELS.staleReload}`);
            return;
          }
          if (parsed.data.approved && isDesignErrorCode(failure, ["DESIGN_FILES_OUTDATED"])) {
            open("return", message, true);
            return;
          }
          setError(message);
        },
      },
    );
  };
  const suggestReturn =
    dialog === "approve" && isDesignErrorCode(decide.error, DESIGN_RETURN_SUGGEST_CODES);

  return (
    <div className="space-y-2">
      {actions.map((action) => (
        <Button
          key={action.code}
          type="button"
          size="sm"
          variant={action.code === "approve" ? "default" : "ghost"}
          disabled={decide.isPending}
          onClick={() => open(action.code)}
          className={
            action.code === "approve" ? DETAIL_ACTION_CLASS.primary : DETAIL_ACTION_CLASS.danger
          }
        >
          {action.code === "approve" ? (
            <CheckCircle2 className="size-3.5" />
          ) : (
            <Undo2 className="size-3.5" />
          )}
          {action.label}
        </Button>
      ))}
      {/* Vùng đọc cho trình đọc màn hình nằm trong hộp thoại đang mở; dòng này chỉ để nhìn. */}
      {decide.isPending && (
        <p className="text-ink-secondary text-center text-xs">{DESIGN_REVIEW_LABELS.deciding}</p>
      )}
      {staleNotice && (
        <Notice tone="warning" live>
          {staleNotice}
        </Notice>
      )}
      {decide.fromQueue && (
        // BO-UX-9: duyệt liền tay — sau quyết định sang thẳng thiết kế kế tiếp của hàng đợi.
        <div className="flex items-start gap-2 pt-1">
          <Checkbox
            id="review-open-next"
            checked={openNext}
            onCheckedChange={(checked) => setOpenNext(checked === true)}
          />
          <Label htmlFor="review-open-next" className="text-ink-secondary text-xs leading-snug">
            {DESIGN_REVIEW_LABELS.openNext}
          </Label>
        </div>
      )}
      <ApproveDialog
        designId={design.id}
        printFileId={printFileId}
        open={dialog === "approve"}
        onOpenChange={(next) => !next && setDialog(null)}
        pending={decide.isPending}
        error={
          error && suggestReturn ? `${error} Có thể bấm "${DESIGN_REVIEW_LABELS.return}".` : error
        }
        onConfirm={(notes) => send({ approved: true, notes })}
      />
      <ReturnDialog
        open={dialog === "return"}
        onOpenChange={(next) => !next && setDialog(null)}
        hint={returnHint}
        pending={decide.isPending}
        error={error}
        onSubmit={(notes) => send({ approved: false, notes })}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
