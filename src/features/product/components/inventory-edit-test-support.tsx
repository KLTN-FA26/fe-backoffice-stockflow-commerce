import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { api } from "@/lib/api/client";

import { INVENTORY_CONTROL_TEXT as text } from "../inventory-control/constants";
import { InventoryControlSection } from "./InventoryControlSection";

const access = vi.hoisted(() => ({ update: true }));
export { access };
vi.mock("@/lib/auth", () => ({
  useCan: (permission: string) => permission.endsWith(":READ") || access.update,
}));
vi.mock("@/providers/app-providers", () => ({ useIsMock: () => false }));
export const identity = {
  productId: "11111111-1111-4111-8111-111111111111",
  variantId: "22222222-2222-4222-8222-222222222222",
  sku: "CHAIR-BLUE",
};
export const response = {
  skuId: identity.variantId,
  sku: identity.sku,
  unitOfMeasure: "EACH",
  version: 7,
  reorderPoint: 20,
  safetyStock: 5,
  removalStrategy: "FIFO",
  trackingMode: "NONE",
  expiryTracked: false,
  usableOnHand: 12,
  reorderRequired: false,
};
export function setupEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const get = vi.spyOn(api, "get").mockResolvedValue({ data: response });
  const put = vi
    .spyOn(api, "put")
    .mockResolvedValue({ data: { ...response, version: 15, reorderPoint: 30 } });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={client}>
      <InventoryControlSection identity={identity} />
    </QueryClientProvider>,
  );
  return { client, get, put, user };
}
export async function enterEdit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: text.edit }));
}
export async function change(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  value: string,
) {
  const input = screen.getByRole("textbox", { name: label });
  await user.clear(input);
  if (value) await user.type(input, value);
}
