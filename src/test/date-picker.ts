/**
 * Chọn ngày trên `DatePicker` (components/shared) như người dùng: bấm nút lịch, chọn năm + tháng ở
 * dropdown của Calendar, bấm ô ngày trong tháng đó.
 */

import { screen, waitFor, within } from "@testing-library/react";
import { expect } from "vitest";

import type { UserEvent } from "@testing-library/user-event";

/** Nút "Mở lịch" nằm cạnh ô gõ của DatePicker / DateTimePicker; `trigger` có thể là ô gõ (theo nhãn) hoặc chính nút. */
function calendarButton(trigger: HTMLElement): HTMLElement {
  if (trigger.tagName !== "INPUT") return trigger;
  return within(trigger.parentElement as HTMLElement).getByRole("button", { name: /^Mở lịch/ });
}

/** Mở lịch của `DatePicker` / `DateTimePicker` như người dùng: bấm nút "Mở lịch" cạnh ô gõ. */
export async function openDatePicker(user: UserEvent, field: HTMLElement) {
  await user.click(calendarButton(field));
}

export async function pickDate(user: UserEvent, trigger: HTMLElement, iso: string) {
  const [year, month] = iso.split("-").map(Number);
  await user.click(calendarButton(trigger));
  await user.selectOptions(await screen.findByRole("combobox", { name: "Chọn năm" }), String(year));
  await user.selectOptions(screen.getByRole("combobox", { name: "Chọn tháng" }), String(month - 1));
  // Đúng ô của ngày đó (data-day của gridcell là yyyy-MM-dd), khi tháng mới đã vẽ và ô bấm được: máy CI chậm có
  // thể vẫn còn tháng cũ, bấm vào đó không chọn được gì.
  const button = await waitFor(() => {
    const found = within(screen.getByRole("grid"))
      .getAllByRole("gridcell")
      .find((c) => c.getAttribute("data-day") === iso && !c.hasAttribute("data-outside"))
      ?.querySelector("button");
    if (!found || found.disabled) throw new Error(`Không thấy ngày ${iso} trên lịch`);
    return found;
  });
  await user.click(button);
  // Chọn xong thì lịch đóng; nơi giữ giá trị tuỳ test, nên chờ lịch đóng chứ không chờ chữ trên ô.
  await waitFor(() => expect(screen.queryByRole("grid")).not.toBeInTheDocument());
}

/** Gõ ngày giờ vào `DateTimePicker` như người dùng: `local` là `yyyy-MM-ddTHH:mm`, ô nhận 12 chữ số dd/MM/yyyy HH:mm. */
export async function typeDateTime(user: UserEvent, field: HTMLElement, local: string) {
  const [day, time] = local.split("T");
  const [y, m, d] = (day ?? "").split("-");
  await user.clear(field);
  await user.type(field, `${d}${m}${y}${(time ?? "").replace(":", "")}`);
}
