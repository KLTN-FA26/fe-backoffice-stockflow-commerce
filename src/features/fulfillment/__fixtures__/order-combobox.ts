import { screen, waitFor } from "@testing-library/react";
import { expect } from "vitest";

type User = {
  click: (el: Element) => Promise<void>;
  type: (el: Element, text: string) => Promise<void>;
};

const ORDER_LABEL = "Đơn hàng";

/**
 * Mở danh sách của ô "Đơn hàng" (hộp Tạo nhiệm vụ lấy hàng) bằng cách GÕ: ô chỉ mở khi gõ ≥ 1 ký tự (R1 — bấm vào thân ô
 * chỉ đặt con trỏ), và gõ thì mở cả khi ô đã chọn sẵn đơn (chữ gõ thêm là từ khoá). Cách này chạy đúng cả khi ô còn mở
 * khi bấm lẫn khi chỉ mở khi gõ. Danh sách lọc theo "SO-" nên vẫn thấy mọi đơn.
 */
export async function openOrderList(user: User) {
  const box = await screen.findByRole("combobox", { name: ORDER_LABEL });
  await user.click(box);
  await user.type(box, "SO-");
  return box;
}

/** Gõ để mở ô "Đơn hàng" rồi bấm option khớp tên. */
export async function pickOrderByTyping(user: User, option: string | RegExp) {
  await openOrderList(user);
  await user.click(await screen.findByRole("option", { name: option }));
}

/** Hộp mở ra với đơn đã chọn sẵn khi chỉ có một đơn chờ xuất kho: ô hiện số đơn, không cần chọn lại. */
export async function expectOrderPrefilled(orderNumber: string) {
  await waitFor(() =>
    expect(
      (screen.getByRole("combobox", { name: ORDER_LABEL }) as HTMLInputElement).value,
    ).toContain(orderNumber),
  );
}
