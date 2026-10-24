"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { REPORTING_LABELS, REPORTING_REBUILD_PERMISSION } from "@/constants/reporting";

import { useCan } from "@/lib/auth";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { useRebuildReports } from "../mutations";

import type { DateRange } from "@/lib/date-range";

const L = REPORTING_LABELS;

/** "Tính lại số liệu" — only for `reporting-reports:EXPORT` (Backend phải re-check @RequiresPermission). */
export function RebuildAction({ range }: { range: DateRange }) {
  const canRebuild = useCan(REPORTING_REBUILD_PERMISSION);
  const [open, setOpen] = useState(false);
  const rebuild = useRebuildReports();
  if (!canRebuild) return null;
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <RefreshCw className="size-3.5" />
        {L.rebuild}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={L.rebuildTitle}
        description={L.rebuildDescription(range.from, range.to)}
        confirmLabel={L.rebuildConfirm}
        cancelLabel={L.rebuildCancel}
        variant="default"
        closeOnConfirm={false}
        loading={rebuild.isPending}
        error={rebuild.isError ? rebuild.error.message || L.rebuildFailed : undefined}
        onConfirm={() =>
          rebuild.mutate(range, {
            onSuccess: (result) => {
              setOpen(false);
              toast.success(L.rebuildDone(result.days, result.ordersCounted, result.ordersSeen));
            },
          })
        }
      />
    </>
  );
}
