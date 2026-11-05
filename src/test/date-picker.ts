/**
 * Chọn ngày trên `DatePicker` (components/shared) như người dùng: mở popover, chọn năm + tháng ở
 * dropdown của Calendar, bấm ô ngày trong tháng đó.
 */

import { screen, within } from "@testing-library/react";

import type { UserEvent } from "@testing-library/user-event";

export async function pickDate(user: UserEvent, trigger: HTMLElement, iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  await user.click(trigger);
  await user.selectOptions(await screen.findByRole("combobox", { name: "Chọn năm" }), String(year));
  await user.selectOptions(screen.getByRole("combobox", { name: "Chọn tháng" }), String(month - 1));
  const cell = within(screen.getByRole("grid"))
    .getAllByRole("gridcell")
    .find((c) => c.textContent === String(day) && !c.hasAttribute("data-outside"));
  if (!cell) throw new Error(`Không thấy ngày ${iso} trên lịch`);
  await user.click(within(cell).getByRole("button"));
}
