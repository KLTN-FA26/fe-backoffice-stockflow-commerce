"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { statusLabelVi } from "@/lib/status-map";

import { warehouseMapErrorMessage } from "@/features/warehouse-map/errors";
import { useChangePlaceStatus } from "@/features/warehouse-map/mutations";

import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Button } from "@/components/ui/button";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { LocationStatus } from "@/features/warehouse-map/types";

const P = UI_LABELS.warehouseMap.panel;

/**
 * Đổi trạng thái kệ / khu vực (docs 06 §4.1 bước 9). `targets` lấy từ `placeStatusTargets` — rỗng khi
 * thiếu quyền thì component này không được render. Không lan xuống bin: bin đọc là không dùng được qua
 * `effectiveStatus` (BR-16). Ra khỏi INACTIVE mà chỗ đã bị chiếm → BE 409 LAYOUT_OVERLAP, hiện tại chỗ.
 */
export function PlaceStatusControl({
  kind,
  id,
  targets,
}: {
  kind: "shelf" | "area";
  id: string;
  targets: readonly LocationStatus[];
}) {
  const change = useChangePlaceStatus();
  const [target, setTarget] = useState<LocationStatus | "">("");
  const [error, setError] = useState<string | null>(null);
  const label = (status: string) => statusLabelVi(status, "location") ?? status;

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Select
          value={target}
          onValueChange={(value) => setTarget(targets.find((status) => status === value) ?? "")}
        >
          <SelectTrigger aria-label={P.changeStatus} className={`${FORM_SELECT_CLASS} flex-1`}>
            <SelectValue placeholder={P.changeStatus} />
          </SelectTrigger>
          <TitledSelectContent title={P.changeStatus}>
            {targets.map((status) => (
              <SelectItem key={status} value={status}>
                {label(status)}
              </SelectItem>
            ))}
          </TitledSelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          disabled={!target || change.isPending}
          onClick={() => {
            if (!target) return;
            setError(null);
            change.mutate(
              { kind, id, status: target },
              {
                onSuccess: () => setTarget(""),
                onError: (failure) => setError(warehouseMapErrorMessage(failure)),
              },
            );
          }}
          className="h-9 rounded-(--action-radius)"
        >
          {change.isPending && <Loader2 className="size-3.5 animate-spin" />}
          {P.changeStatus}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
