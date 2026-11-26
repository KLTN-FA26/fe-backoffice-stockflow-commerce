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
  lastBin,
}: {
  task: PutawayTask;
  confirm: PutawayConfirmState;
  /** Ô kệ vừa cất cho thùng trước (từ nút "Cất thùng tiếp theo") — gợi ý dùng lại một chạm. */
  lastBin?: string | null;
}) {
  const { form, submit, pending, banner, alternative, chooseBin } = confirm;
  const { errors } = form.formState;
  const chosenBin = form.watch("locationCode");
  // Bốn nút một chạm cạnh ô quét: ô kệ BE đề nghị (khi bị từ chối), gợi ý số 1, ô kệ vừa dùng cho thùng trước.
  // Không tự điền ô quét (docs 05: ô kệ cuối cùng là ô kệ nhân viên quét) — chỉ bấm mới điền.
  const oneTap = [
    alternative,
    task.suggestions[0]?.locationCode,
    lastBin && lastBin !== task.suggestions[0]?.locationCode ? lastBin : null,
  ].filter((code, index, all): code is string => !!code && all.indexOf(code) === index);
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
          {oneTap.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {oneTap.map((code) => (
                <Button
                  key={code}
                  type="button"
                  variant="outline"
                  aria-pressed={chosenBin === code}
                  onClick={() => {
                    chooseBin(code);
                    focusField(
                      form.getValues("lpn")
                        ? PUTAWAY_FIELD_IDS.locationCode
                        : PUTAWAY_FIELD_IDS.lpn,
                    );
                  }}
                  className={`border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted h-11 rounded-[var(--r-sm)] px-3 text-[0.8125rem] ${MONO} ${
                    chosenBin === code ? "border-brand bg-bg-muted" : ""
                  }`}
                >
                  {code === lastBin && code !== task.suggestions[0]?.locationCode
                    ? L.takeLast(code)
                    : L.takeAlternative(code)}
                </Button>
              ))}
            </div>
          )}
        </div>
        <Button
          type="submit"
          disabled={pending}
          className={`${DETAIL_ACTION_CLASS.primary} h-11 text-sm`}
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          {L.submit}
        </Button>
      </form>
    </section>
  );
}
