"use client";

import { Controller, useFieldArray, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { toLocalIsoDate } from "@/lib/format/date";
import { DatePicker } from "@/components/shared/DatePicker";
import { FORM_INPUT_CLASS, fieldA11y } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { cartonGaps } from "../../sales-contract-rules";

import { RequiredMark } from "../FormFieldError";

import type { UseFormReturn } from "react-hook-form";
import type { ContractFormValues } from "../../sales-contract-form";
import type { Order } from "../../types";

const NUM = `${FORM_INPUT_CLASS} w-24 text-right font-[family-name:var(--font-mono)] tabular-nums`;

function FieldError({ id, message }: { id?: string; message?: string }) {
  return message ? (
    <p id={id ? `${id}-error` : undefined} className="text-danger mt-1 text-xs">
      {message}
    </p>
  ) : null;
}

/**
 * Lịch giao nhiều đợt: cửa sổ từ – đến (bắt buộc trước khi gửi hợp đồng), số thùng từng dòng đơn. F-04.2: hiện ngay "còn thiếu / dư X thùng"
 * theo từng SKU (Σ thùng các đợt = số thùng dòng đơn) — chỉ báo sớm, BE vẫn kiểm (DELIVERY_SCHEDULE_INVALID).
 */
export function DeliveryScheduleEditor({
  form,
  lines,
}: {
  form: UseFormReturn<ContractFormValues>;
  lines: readonly Order["lines"][number][];
}) {
  const { control, register, formState } = form;
  const batches = useFieldArray({ control, name: "deliverySchedule" });
  const schedule = useWatch({ control, name: "deliverySchedule" }) ?? [];
  const gaps = cartonGaps(lines, schedule);
  // Ngày theo giờ Việt Nam: cửa sổ giao không bắt đầu trước hôm nay khi gửi hợp đồng (docs 14 BR-23).
  const today = toLocalIsoDate(new Date().toISOString());
  const errors = formState.errors.deliverySchedule;
  const listError = errors?.root?.message ?? errors?.message;

  return (
    <fieldset className="space-y-3">
      <legend className="text-ink-primary text-sm font-semibold">Lịch giao</legend>
      {listError && (
        <p role="alert" className="text-danger text-xs">
          {listError}
        </p>
      )}
      {batches.fields.map((field, i) => {
        const batchErrors = errors?.[i];
        return (
          <div
            key={field.id}
            className="border-border-default space-y-2 rounded-[var(--r-sm)] border p-3"
          >
            <div className="flex flex-wrap items-start gap-3">
              <span className="text-ink-secondary pt-6 text-xs font-medium">Đợt {i + 1}</span>
              {(["windowStart", "windowEnd"] as const).map((key) => {
                const id = `batch-${i}-${key}`;
                const message = batchErrors?.[key]?.message;
                const label = key === "windowStart" ? "Từ ngày" : "Đến ngày";
                const start = schedule[i]?.windowStart ?? "";
                const end = schedule[i]?.windowEnd ?? "";
                // Đợt sau bắt đầu không sớm hơn đợt trước (BR-23).
                const previous = (i > 0 ? schedule[i - 1]?.windowStart : "") ?? "";
                const earliest = previous > today ? previous : today;
                return (
                  <div key={key} className="w-44">
                    <label htmlFor={id} className="text-ink-secondary text-xs">
                      {label} <RequiredMark />
                    </label>
                    <Controller
                      control={control}
                      name={`deliverySchedule.${i}.${key}`}
                      render={({ field: date }) => (
                        <DatePicker
                          ref={date.ref}
                          value={date.value ?? ""}
                          onChange={date.onChange}
                          onBlur={date.onBlur}
                          clearable
                          // Chặn chéo như biểu mẫu dời cửa sổ: "Đến ngày" không trước "Từ ngày", "Từ ngày" không sau "Đến ngày".
                          min={key === "windowStart" ? earliest : start || earliest}
                          max={key === "windowStart" ? end || undefined : undefined}
                          {...fieldA11y(id, message)}
                          aria-label={`Đợt ${i + 1} ${label.toLowerCase()}`}
                        />
                      )}
                    />
                    <FieldError id={id} message={message} />
                  </div>
                );
              })}
              {batches.fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-5"
                  aria-label={`Xoá đợt giao ${i + 1}`}
                  onClick={() => batches.remove(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
            {lines.map((line, j) => {
              const id = `batch-${i}-line-${j}`;
              const message = batchErrors?.lines?.[j]?.cartons?.message;
              return (
                <div key={line.lineId} className="text-[0.8125rem]">
                  <div className="text-ink-secondary flex items-center gap-2">
                    <label htmlFor={id} className="w-56 truncate">
                      <span className="font-[family-name:var(--font-mono)]">{line.sku}</span>
                      {line.designName && (
                        <span className="text-ink-secondary block truncate text-xs">
                          {line.designName}
                        </span>
                      )}
                    </label>
                    <Input
                      {...register(`deliverySchedule.${i}.lines.${j}.cartons`)}
                      {...fieldA11y(id, message, true)}
                      aria-label={`Đợt ${i + 1} — ${line.sku} (thùng)`}
                      inputMode="numeric"
                      className={NUM}
                    />
                    {/* BO-UX-29: số thùng đặt của dòng ngay cạnh ô, không phải kéo xuống bảng đối chiếu. */}
                    <span id={`${id}-hint`}>
                      / {(line.cartons ?? 0).toLocaleString("vi-VN")} thùng
                    </span>
                  </div>
                  <FieldError id={id} message={message} />
                </div>
              );
            })}
            <FieldError
              message={batchErrors?.lines?.message ?? batchErrors?.lines?.root?.message}
            />
          </div>
        );
      })}
      <ul aria-label="Đối chiếu số thùng" className="space-y-0.5 text-[0.8125rem]">
        {gaps.map((gap) => (
          <li
            key={gap.orderLineId}
            className={gap.diff === 0 ? "text-ink-secondary" : "text-danger"}
          >
            <span className="font-[family-name:var(--font-mono)]">{gap.sku}</span>: {gap.scheduled}{" "}
            / {gap.ordered} thùng
            {gap.diff < 0 && ` — còn thiếu ${-gap.diff} thùng`}
            {gap.diff > 0 && ` — dư ${gap.diff} thùng`}
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={batches.fields.length >= 20}
        onClick={() =>
          batches.append({
            windowStart: "",
            windowEnd: "",
            // Đợt mới điền sẵn số thùng CÒN LẠI của từng dòng đơn (Σ các đợt = số thùng dòng đơn, BR-23).
            lines: lines.map((line) => ({
              orderLineId: line.lineId,
              cartons: String(
                Math.max(0, -(gaps.find((gap) => gap.orderLineId === line.lineId)?.diff ?? 0)),
              ),
            })),
          })
        }
      >
        <Plus className="size-3.5" /> Thêm đợt giao
      </Button>
    </fieldset>
  );
}
