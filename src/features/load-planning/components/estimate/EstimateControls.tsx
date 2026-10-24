"use client";

import { Loader2 } from "lucide-react";

import {
  LOAD_ESTIMATE_LABELS,
  LOAD_ESTIMATE_LIMITS,
  LOAD_ESTIMATE_SELECTION_MODES,
  VEHICLE_TYPE_KIND_LABELS,
} from "@/constants";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";

import type { EstimateVehicleType } from "../../estimate-types";

export type SelectionMode = (typeof LOAD_ESTIMATE_SELECTION_MODES)[number];

interface EstimateControlsProps {
  /** Loại xe đang dùng; `undefined` khi chưa tải xong. */
  vehicleTypes: readonly EstimateVehicleType[] | undefined;
  vehicleTypesState: "loading" | "error" | "ready";
  onRetryVehicleTypes: () => void;
  selectedIds: readonly string[];
  onSelectedChange: (ids: string[]) => void;
  mode: SelectionMode;
  onModeChange: (mode: SelectionMode) => void;
  onRun: () => void;
  isPending: boolean;
  /** Lý do chưa chạy được (vd chưa chọn kho) — nút khoá và nêu lý do. */
  blockedReason: string | null;
  hasResult: boolean;
}

const KIND_LABEL = (kind: string): string =>
  Object.hasOwn(VEHICLE_TYPE_KIND_LABELS, kind)
    ? VEHICLE_TYPE_KIND_LABELS[kind as keyof typeof VEHICLE_TYPE_KIND_LABELS]
    : kind;

/**
 * Chọn loại xe (nhiều) + cách chọn xe, rồi "Ước tính". Không chọn loại nào = mọi loại đang dùng (BE). Tối đa
 * `LOAD_ESTIMATE_LIMITS.vehicleTypesMax` loại (BE `@Size(max = 20)`). Hai nhóm là checkbox / radio gốc: bàn phím và
 * trình đọc màn hình dùng được, không cần dropdown. Cần `fulfillment-load-estimates:CREATE` — cha quyết có render không.
 */
export function EstimateControls(props: EstimateControlsProps) {
  const L = LOAD_ESTIMATE_LABELS.controls;
  const { selectedIds, vehicleTypes } = props;
  const atMax = selectedIds.length >= LOAD_ESTIMATE_LIMITS.vehicleTypesMax;

  const toggle = (id: string, checked: boolean) =>
    props.onSelectedChange(checked ? [...selectedIds, id] : selectedIds.filter((x) => x !== id));

  return (
    <div className="border-border-default flex flex-col gap-4 rounded border p-3">
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="text-[0.8125rem] font-medium">{L.vehicleTypes}</legend>
        <p className="text-ink-tertiary mt-0.5 text-xs">
          {L.vehicleTypesHint(LOAD_ESTIMATE_LIMITS.vehicleTypesMax)}
        </p>
        {props.vehicleTypesState === "loading" && (
          <p className="text-ink-tertiary mt-2 text-xs">{L.vehicleTypesLoading}</p>
        )}
        {props.vehicleTypesState === "error" && (
          <p role="alert" className="text-danger mt-2 text-xs">
            {L.vehicleTypesFailed}{" "}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={props.onRetryVehicleTypes}
            >
              {LOAD_ESTIMATE_LABELS.current.retry}
            </Button>
          </p>
        )}
        {props.vehicleTypesState === "ready" && vehicleTypes?.length === 0 && (
          <p className="text-ink-tertiary mt-2 text-xs">{L.vehicleTypesEmpty}</p>
        )}
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {vehicleTypes?.map((type) => {
            const checked = selectedIds.includes(type.vehicleTypeId);
            return (
              <label
                key={type.vehicleTypeId}
                className="border-border-default hover:bg-bg-muted flex cursor-pointer items-start gap-2 rounded-[var(--r-sm)] border px-2.5 py-1.5"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && atMax}
                  onChange={(event) => toggle(type.vehicleTypeId, event.target.checked)}
                  className="accent-ink-primary mt-0.5"
                />
                <span className="min-w-0 text-[0.8125rem]">
                  <span className="text-ink-primary block font-medium">{type.name}</span>
                  <span className="text-ink-tertiary block text-xs">
                    {type.code} · {KIND_LABEL(type.kind)} · {formatNumber(type.maxPayloadKg)} kg
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {atMax && <p className="text-warning mt-1 text-xs">{L.tooManyTypes}</p>}
      </fieldset>

      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="text-[0.8125rem] font-medium">{L.selectionMode}</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {LOAD_ESTIMATE_SELECTION_MODES.map((mode) => (
            <label
              key={mode}
              className="border-border-default hover:bg-bg-muted has-[:checked]:border-ink-primary flex cursor-pointer items-start gap-2 rounded-[var(--r-sm)] border px-2.5 py-1.5"
            >
              <input
                type="radio"
                name="estimate-selection-mode"
                value={mode}
                checked={props.mode === mode}
                onChange={() => props.onModeChange(mode)}
                className="accent-ink-primary mt-0.5"
              />
              <span className="text-[0.8125rem]">
                <span className="text-ink-primary block font-medium">{L.modes[mode]}</span>
                <span className="text-ink-tertiary block text-xs">{L.modeHints[mode]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          onClick={props.onRun}
          disabled={props.isPending || props.blockedReason !== null}
        >
          {props.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
          {props.isPending ? L.running : props.hasResult ? L.rerun : L.run}
        </Button>
        {props.blockedReason && <p className="text-ink-tertiary text-xs">{props.blockedReason}</p>}
      </div>
    </div>
  );
}
