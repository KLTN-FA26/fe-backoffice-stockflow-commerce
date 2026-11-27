import { screen } from "@testing-library/react";

type User = {
  type: (el: Element, text: string) => Promise<void>;
  click: (el: Element) => Promise<void>;
};

/**
 * Picks a customer SKU in the quote line's search box (S02-1): types part of its name — which opens the list however the
 * combobox opens (typing always does) — then clicks the option. `line` is 0-based among the lines on screen.
 */
export async function pickSku(user: User, name: string, line = 0) {
  const boxes = await screen.findAllByRole("combobox", { name: /Sản phẩm \(SKU riêng\)/ });
  const box = boxes[line];
  if (!box) throw new Error(`No SKU box for line ${line}`);
  await user.type(box, name);
  await user.click(await screen.findByRole("option", { name: new RegExp(name) }));
}
