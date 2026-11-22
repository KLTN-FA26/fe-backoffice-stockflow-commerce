"use client";

import { Loader2, PackageCheck } from "lucide-react";

import { PUTAWAY_DETAIL_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import {
  DETAIL_ACTION_CLASS,
  DETAIL_CARD_CLASS,
  DetailCardTitle,
} from "@/components/shared/DetailSection";
import { Button } from "@/components/ui/button";

import { PutawayScanField } from "./PutawayScanField";

import type { PutawayTask } from "@/features/putaway/types";
import type { PutawayConfirmState } from "./usePutawayConfirm";

const L = PUTAWAY_DETAIL_LABELS;
const MONO = "font-[family-name:var(--font-mono)] tabular-nums";
export const PUTAWAY_FIELD_IDS = { lpn: "putaway-lpn", locationCode: "putaway-location" } as const;

const focusField = (id: string) => document.getElementById(id)?.focus();

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className={`text-ink-primary font-medium ${MONO}`}>{value}</dd>
    </div>
  );
}

/**
 * Thẻ xác nhận cất một thùng (docs 05 §4.4 bước 7–8): quét LPN → quét bin → xác nhận. Không cần chuột: con trỏ ở ô LPN
 * khi mở, Enter ở ô LPN sang ô bin, Enter ở ô bin là gửi. BR-07: bin khác gợi ý được, không hỏi lý do.
 */
export function PutawayConfirmCard({
  task,
  confirm,
}: {
  task: PutawayTask;
  confirm: PutawayConfirmState;
}) {
  const { form, submit, pending, banner, alternative, chooseBin } = confirm;
  const { errors } = form.formState;
  const lpn = form.register("lpn", { onChange: () => form.clearErrors("lpn") });
  const location = form.register("locationCode", {
    onChange: () => form.clearErrors("locationCode"),
  });

  return (
    <section className={DETAIL_CARD_CLASS} aria-labelledby="putaway-confirm-title">
      <DetailCardTitle icon={PackageCheck}>
        <span id="putaway-confirm-title">{L.confirmTitle}</span>
      </DetailCardTitle>
      <dl className="mb-3 space-y-1.5 text-[0.8125rem]">
        <Fact label={L.lpn} value={task.lpn ?? "—"} />
        <Fact label={L.best} value={task.suggestions[0]?.locationCode ?? "—"} />
      </dl>
      {banner && (
        <Alert tone="danger" className="mb-3">
          {banner}
        </Alert>
      )}
      <form onSubmit={(event) => void submit(event)} className="space-y-3" noValidate>
        <PutawayScanField
          id={PUTAWAY_FIELD_IDS.lpn}
          label={L.lpnField}
          hint={L.lpnHint}
          error={errors.lpn?.message}
          placeholder={L.lpnPlaceholder}
          autoFocus
          onKeyDown={(event) => {
            // Máy quét gửi Enter sau mã: sang ô bin, chưa gửi form
            if (event.key === "Enter") {
              event.preventDefault();
              focusField(PUTAWAY_FIELD_IDS.locationCode);
            }
          }}
          {...lpn}
        />
        <div className="space-y-2">
          <PutawayScanField
            id={PUTAWAY_FIELD_IDS.locationCode}
            label={L.locationField}
            hint={L.locationHint}
            error={errors.locationCode?.message}
            placeholder={L.locationPlaceholder}
            {...location}
          />
          {alternative && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => {
                chooseBin(alternative);
                focusField(PUTAWAY_FIELD_IDS.locationCode);
              }}
              className={`border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted h-7 rounded-[var(--r-sm)] px-2.5 text-xs ${MONO}`}
            >
              {L.takeAlternative(alternative)}
            </Button>
          )}
        </div>
        <Button type="submit" disabled={pending} className={DETAIL_ACTION_CLASS.primary}>
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          {L.submit}
        </Button>
      </form>
    </section>
  );
}
