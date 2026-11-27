"use client";

import { cn } from "cn";

import type { ProductAttributes } from "../axes-schemas";

type Axis = ProductAttributes["axes"][number];

/**
 * Trục biến thể dạng bảng: mỗi trục một dòng (tên + mã | các giá trị), giá trị nói rõ trạng thái —
 * đang có biến thể dùng (viền đậm, chấm xanh), chưa dùng (viền nét đứt), đã vô hiệu (gạch ngang).
 * Chân bảng: số tổ hợp tối đa = tích số giá trị đang bật của các trục.
 */
export function AxesTable({ axes }: { axes: readonly Axis[] }) {
  const combinations = axes.reduce(
    (total, axis) => total * axis.options.filter((option) => option.active).length,
    1,
  );
  return (
    <>
      <ul className="divide-y divide-(--table-line)">
        {axes.map((axis) => {
          const active = axis.options.filter((option) => option.active).length;
          return (
            <li key={axis.attributeId} className="grid gap-2 px-4 py-3 sm:grid-cols-[11rem_1fr]">
              <div className="min-w-0">
                <p className="text-ink-primary text-[0.8125rem] font-semibold">
                  {axis.name}
                  <span className="text-ink-tertiary ml-1.5 text-xs font-normal tabular-nums">
                    {active} giá trị
                  </span>
                </p>
                <p className="text-ink-tertiary font-[family-name:var(--font-mono)] text-xs">
                  {axis.code}
                </p>
              </div>
              <div className="flex flex-wrap content-start gap-1.5">
                {axis.options.map((option) => (
                  <span
                    key={option.valueId}
                    title={
                      !option.active
                        ? "Đã vô hiệu"
                        : option.usedByVariant
                          ? "Đang có biến thể dùng"
                          : "Chưa có biến thể dùng"
                    }
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-(--control-radius) border px-2.5 text-xs font-medium",
                      !option.active
                        ? "border-border-default text-ink-tertiary line-through"
                        : option.usedByVariant
                          ? "border-border-strong bg-bg-surface text-ink-primary"
                          : "border-border-strong text-ink-secondary border-dashed",
                    )}
                  >
                    {option.hexColor ? (
                      <span
                        aria-hidden
                        className="border-border-default size-3 rounded-full border"
                        style={{ backgroundColor: option.hexColor }}
                      />
                    ) : (
                      option.active &&
                      option.usedByVariant && (
                        <span aria-hidden className="bg-positive size-1.5 rounded-full" />
                      )
                    )}
                    {option.label}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="text-ink-tertiary bg-bg-subtle flex flex-wrap items-center justify-between gap-2 border-t border-(--table-line) px-4 py-2 text-xs">
        <span>
          Tổ hợp tối đa:{" "}
          <span className="text-ink-primary font-semibold tabular-nums">{combinations}</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span aria-hidden className="bg-positive size-1.5 rounded-full" /> Có biến thể dùng
          </span>
          <span className="flex items-center gap-1">
            <span
              aria-hidden
              className="border-border-strong size-2.5 rounded-sm border border-dashed"
            />
            Chưa dùng
          </span>
        </span>
      </div>
    </>
  );
}
