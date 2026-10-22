"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { ConflictKind } from "../../editor/use-save-flow";
import type { StateDiff } from "../../editor/diff";

const C = UI_LABELS.loadPlan.editor.conflict;
const SHOWN = 8;

const placeOf = (seq: number | null) => C.place(seq);

/** Nội dung xem trước khi ghi đè: người khác đã đổi chỗ những kiện nào so với bản bạn mở. */
function DiffSummary({ diff }: { diff: StateDiff }) {
  const shown = diff.moved.slice(0, SHOWN);
  return (
    <div className="space-y-2 text-[0.8125rem]">
      <p>{diff.moved.length > 0 ? C.changes(diff.moved.length) : C.noChanges}</p>
      <ul className="space-y-0.5 text-xs tabular-nums">
        {shown.map((m) => (
          <li key={m.ref}>{C.moved(m.label, placeOf(m.from), placeOf(m.to))}</li>
        ))}
        {diff.moved.length > shown.length && <li>{C.more(diff.moved.length - shown.length)}</li>}
      </ul>
      {diff.added.length > 0 && <p className="text-warning">{C.added(diff.added.length)}</p>}
      {diff.removed.length > 0 && <p className="text-warning">{C.removed(diff.removed.length)}</p>}
      {!diff.sameVehicles && <p className="text-warning">{C.vehiclesChanged}</p>}
      {!diff.canOverwrite && <p className="text-danger">{C.cannotOverwrite}</p>}
    </div>
  );
}

/**
 * Lưu bị từ chối vì kế hoạch đã đổi (409). Bản chỉnh của bạn vẫn còn: "Tải lại" bỏ nó và lấy bản mới; "Ghi đè sau khi
 * xem" mở bảng so sánh rồi mới gửi lại bản của bạn với version mới (chỉ khi tập xe và tập kiện còn khớp).
 */
export function ConflictPanel({
  kind,
  message,
  diff,
  ready,
  saving,
  onReload,
  onOverwrite,
}: {
  kind: ConflictKind;
  message: string;
  diff: StateDiff | null;
  ready: boolean;
  saving: boolean;
  onReload: () => void;
  onOverwrite: () => void;
}) {
  const [reviewing, setReviewing] = useState(false);
  return (
    <>
      <Alert tone="danger" title={C.title}>
        <p>{kind === "lock" ? C.description : message}</p>
        {!ready && <p role="status">{C.loading}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!ready || saving}
            onClick={onReload}
          >
            {C.reload}
          </Button>
          {kind === "lock" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!ready || saving}
              onClick={() => setReviewing(true)}
            >
              {C.review}
            </Button>
          )}
        </div>
      </Alert>
      <Dialog open={reviewing} onOpenChange={setReviewing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{C.reviewTitle}</DialogTitle>
            <DialogDescription>{C.description}</DialogDescription>
          </DialogHeader>
          {diff && <DiffSummary diff={diff} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReviewing(false)}>
              {C.back}
            </Button>
            <Button
              type="button"
              disabled={!diff?.canOverwrite || saving}
              onClick={() => {
                setReviewing(false);
                onOverwrite();
              }}
            >
              {C.overwrite}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
