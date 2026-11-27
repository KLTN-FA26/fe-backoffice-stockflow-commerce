/**
 * Thao tác UI dùng chung cho test back-office sau khi đổi sang combobox (`combobox-select`) và menu "⋯" của dòng
 * (`RowActionsMenu`). Truy vấn theo role / tên người dùng thấy, như testing.md.
 */
import { screen, within } from "@testing-library/react";

import type { UserEvent } from "@testing-library/user-event";

type Name = string | RegExp;

/**
 * Chọn một mục trong combobox (thay `user.selectOptions` của `<select>` cũ): mở `trigger` (phần tử, hoặc tên truy cập /
 * nhãn của combobox) rồi bấm `role="option"` có tên `option`.
 */
export async function pickOption(user: UserEvent, trigger: HTMLElement | Name, option: Name) {
  const button =
    trigger instanceof HTMLElement ? trigger : screen.getByRole("combobox", { name: trigger });
  await user.click(button);
  await user.click(await screen.findByRole("option", { name: option }));
}

/** Tên truy cập của nút "⋯" của dòng: luôn bắt đầu bằng "Thao tác". */
const ROW_MENU = /^Thao tác/;

/**
 * Bấm một thao tác của dòng nằm trong menu "⋯" (`RowActionsMenu`). `scope` khoanh vùng (vd dòng `row`); không có thì
 * thử lần lượt mọi menu "⋯" trên trang tới khi thấy mục tên `action`. Trả về mục đã bấm.
 */
export async function clickRowAction(user: UserEvent, action: Name, scope?: HTMLElement) {
  const triggers = (scope ? within(scope) : screen).getAllByRole("button", { name: ROW_MENU });
  for (const trigger of triggers) {
    await user.click(trigger);
    const item =
      screen.queryByRole("button", { name: action }) ??
      screen.queryByRole("link", { name: action });
    if (item && trigger.getAttribute("aria-expanded") === "true") {
      await user.click(item);
      return item;
    }
    await user.keyboard("{Escape}");
  }
  throw new Error(`Không thấy thao tác ${String(action)} trong menu "⋯" nào`);
}

/** Mở menu "⋯" của dòng (để kiểm mục bị khoá / lý do) — trả về nội dung popover đang mở. */
export async function openRowMenu(user: UserEvent, scope?: HTMLElement) {
  const trigger = (scope ? within(scope) : screen).getAllByRole("button", { name: ROW_MENU })[0];
  await user.click(trigger);
  return screen.findByRole("dialog");
}
