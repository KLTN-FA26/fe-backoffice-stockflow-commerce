"use client";

import { useState } from "react";
import { CheckCircle2, Undo2 } from "lucide-react";

import { DESIGN_REVIEW_LABELS } from "@/constants";

import { usePermissionChecker } from "@/lib/auth/components/Can";

import {
  DESIGN_RETURN_SUGGEST_CODES,
  designReviewErrorMessage,
  isDesignErrorCode,
} from "@/features/design-review/errors";
import { allowedReviewActions } from "@/features/design-review/lifecycle";
import { designDecisionInputSchema } from "@/features/design-review/schemas";

import { DETAIL_ACTION_CLASS } from "@/components/shared/DetailSection";
import { Button } from "@/components/ui/button";

import { ApproveDialog } from "./ApproveDialog";
import { ReturnDialog } from "./ReturnDialog";

import type { UseMutationResult } from "@tanstack/react-query";
import type { ApiError } from "@/lib/api/error";
import type { DecideDesignInput } from "@/features/design-review/api";
import type { Design } from "@/features/design-review/types";

type Dialog = "approve" | "return" | null;

/**
 * Thanh hành động: Duyệt / Trả lại theo `allowedReviewActions` (thiếu `approve` hoặc không còn chờ duyệt → chỉ xem).
 * Đang chạy: khoá mọi nút. `DESIGN_FILES_OUTDATED` khi duyệt → mở sẵn hộp trả lại kèm câu gợi ý.
 */
export function ReviewActions({
  design,
  decide,
}: {
  design: Design;
  decide: UseMutationResult<Design, ApiError, DecideDesignInput>;
}) {
  const can = usePermissionChecker();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [returnHint, setReturnHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const actions = allowedReviewActions(design, can);
  if (actions.length === 0) return null;

  const open = (next: Dialog, hint: string | null = null) => {
    setError(null);
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
    decide.mutate(
      { id: design.id, version: design.version, ...parsed.data },
      {
        onError: (failure) => {
          const message = designReviewErrorMessage(failure);
          if (parsed.data.approved && isDesignErrorCode(failure, ["DESIGN_FILES_OUTDATED"])) {
            open("return", message);
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
      {decide.isPending && (
        <p role="status" className="text-ink-secondary text-center text-xs">
          {DESIGN_REVIEW_LABELS.deciding}
        </p>
      )}
      <ApproveDialog
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
