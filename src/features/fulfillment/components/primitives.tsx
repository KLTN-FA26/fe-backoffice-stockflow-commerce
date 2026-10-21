import { cn } from "cn";

import { UI_LABELS } from "@/constants";
import { shortId } from "@/features/fulfillment/selectors";

import type { ReactNode } from "react";

export const MONO = "font-[family-name:var(--font-mono)] tabular-nums";
export const NUM = `${MONO} text-right`;

/** Hai màn dùng chung một resource BE — `scope` chỉ quyết tiêu đề, cột và nhóm thao tác. */
export type FulfillmentScope = "picking" | "packing";

/** Số đo (kg, cm) kiểu vi-VN, tối đa `digits` chữ số lẻ — không thêm số 0 thừa. */
export function formatMeasure(value: number, digits = 3): string {
  return value.toLocaleString("vi-VN", { maximumFractionDigits: digits });
}

/** Ô nhập một dòng của form trạm đóng gói (cùng kiểu `fieldClass` của màn xếp xe). */
export function fieldClass(hasError = false): string {
  return cn(
    "h-8 w-full rounded-[var(--r-sm)] border bg-bg-surface px-2.5 text-[0.8125rem] text-ink-primary outline-none transition-colors placeholder:text-ink-tertiary disabled:bg-bg-muted disabled:text-ink-tertiary",
    hasError
      ? "border-danger focus:border-danger focus-visible:ring-2 focus-visible:ring-danger/20"
      : "border-border-default focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/20",
  );
}

/** Lỗi inline dưới ô — `id` để ô nhập trỏ `aria-describedby` tới. */
export function FieldError({ id, children }: { id?: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-danger mt-1 text-xs">
      {children}
    </p>
  );
}

/** Khối nội dung Mode A: nền surface, viền mảnh, tiêu đề nhỏ + hành động bên phải. */
export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-ink-primary text-[0.9375rem] font-semibold">{title}</h2>
          {description && (
            <p className="text-ink-secondary mt-0.5 text-[0.8125rem]">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Ô thông tin nhỏ (nhãn + giá trị), `mono` cho mã / số. */
export function InfoItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-ink-tertiary text-xs">{label}</div>
      <div
        className={`text-ink-primary mt-0.5 truncate text-[0.8125rem] font-medium ${mono ? MONO : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

/** Mã task hiển thị — BE chỉ có UUID, chưa có số task đọc được. */
export function taskCode(taskId: string): string {
  return shortId(taskId);
}

/** Số đơn nếu tra được, không thì id rút gọn (kèm `title` là id đầy đủ ở nơi dùng). */
export function orderLabel(
  orderId: string,
  orderNumbers: Readonly<Record<string, string>> | undefined,
): string {
  return orderNumbers?.[orderId] ?? shortId(orderId);
}

/** Tên người được gán: chính mình → "Tôi"; BE trả `assignedUserName` → tên; không thì id rút gọn. */
export function assigneeLabel(
  userId: string | null | undefined,
  userName: string | null | undefined,
  selfId: string | null,
): string {
  if (!userId) return "—";
  if (userId === selfId) return UI_LABELS.fulfillment.self;
  return userName || shortId(userId);
}
