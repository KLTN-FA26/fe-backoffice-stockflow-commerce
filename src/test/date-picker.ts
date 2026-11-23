/**
 * Chọn ngày trên `DatePicker` (components/shared) như người dùng: mở popover, chọn năm + tháng ở
 * dropdown của Calendar, bấm ô ngày trong tháng đó.
 */

import { screen, waitFor, within } from "@testing-library/react";
import { expect } from "vitest";

import type { UserEvent } from "@testing-library/user-event";

export async function pickDate(user: UserEvent, trigger: HTMLElement, iso: string) {
  const [year, month] = iso.split("-").map(Number);
  await user.click(trigger);
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
