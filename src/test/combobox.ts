import { screen } from "@testing-library/react";

/**
 * Mở danh sách của một `InputCombobox` bằng nút mũi tên (R1: bấm vào thân ô chỉ đặt con trỏ, danh sách chỉ mở khi gõ ≥ 1
 * ký tự hoặc bấm mũi tên). `label` là `ariaLabel` của ô.
 */
export async function openComboboxList(
  user: { click: (el: Element) => Promise<void> },
  label: string | RegExp,
) {
  await user.click(await screen.findByRole("button", { name: wrap(label) }));
}

function wrap(label: string | RegExp): string | RegExp {
  return typeof label === "string"
    ? `Mở danh sách ${label}`
    : new RegExp(`Mở danh sách .*${label.source}`);
}
