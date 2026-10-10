import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { INVENTORY_CONTROL_TEXT as policyText } from "../inventory-control/constants";
import { CANONICAL_VARIANT_TEXT as text } from "../variant-constants";
import { canonicalVariantKeys } from "../variant-queries";
import { CanonicalSkuDetail } from "./CanonicalSkuDetail";
import { change, enterEdit, identity, response } from "./inventory-edit-test-support";

vi.mock("@/lib/auth", () => ({ useCan: () => true }));
vi.mock("@/providers/app-providers", () => ({ useIsMock: () => false }));

const variant = {
  ...identity,
  name: "Blue chair",
  status: "ACTIVE",
  defaultVariant: false,
  attributeSignature: "COLOR=BLUE",
  position: 0,
  version: 1,
};
let client: QueryClient;
afterEach(() => {
  cleanup();
  client.clear();
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
});
function setup(failInitially = false) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let failing = failInitially;
  const get = vi.spyOn(api, "get").mockImplementation(async (path) => {
    if (path.endsWith("inventory-control")) return { data: response };
    if (failing) throw new Error("Variant unavailable");
    return { data: variant };
  });
  render(
    <QueryClientProvider client={client}>
      <CanonicalSkuDetail productId={identity.productId} variantId={identity.variantId} />
    </QueryClientProvider>,
  );
  return {
    get,
    user: userEvent.setup(),
    fail: (value: boolean) => {
      failing = value;
    },
  };
}
const key = canonicalVariantKeys.detail(identity.productId, identity.variantId);
describe("canonical detail preserves the Inventory workspace", () => {
  it("treats initial Variant failure without accepted data as fatal", async () => {
    setup(true);
    expect(await screen.findByRole("alert")).toHaveTextContent(text.failed);
    expect(screen.queryByRole("region", { name: policyText.title })).not.toBeInTheDocument();
    expect(screen.queryByText(identity.sku)).not.toBeInTheDocument();
  });
  it("treats initial paused Variant read without data as fatal feedback", async () => {
    onlineManager.setOnline(false);
    setup();
    expect(await screen.findByRole("status")).toHaveTextContent(text.paused);
    expect(screen.queryByRole("region", { name: policyText.title })).not.toBeInTheDocument();
  });
  it("keeps accepted detail, dirty draft and base version through background failure/retry", async () => {
    const { user, fail } = setup();
    await enterEdit(user);
    await change(user, policyText.reorderPoint, "99");
    const editor = screen.getByRole("form", { name: policyText.editor });
    fail(true);
    await client.refetchQueries({ queryKey: key, exact: true });
    expect(await screen.findByRole("alert")).toHaveTextContent(text.failed);
    expect(screen.getByText(identity.sku, { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: policyText.editor })).toBe(editor);
    expect(screen.getByRole("textbox", { name: policyText.reorderPoint })).toHaveValue("99");
    fail(false);
    await user.click(screen.getByRole("button", { name: text.retry }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("form", { name: policyText.editor })).toBe(editor);
    expect(screen.getByRole("textbox", { name: policyText.reorderPoint })).toHaveValue("99");
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: { ...response, version: 8 } });
    await user.click(screen.getByRole("button", { name: policyText.save }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0]?.[1]).toMatchObject({ version: 7, reorderPoint: 99 });
  });
  it("keeps cached detail and dirty editor during paused background Variant reads", async () => {
    const { user } = setup();
    await enterEdit(user);
    await change(user, policyText.reorderPoint, "99");
    const editor = screen.getByRole("form", { name: policyText.editor });
    onlineManager.setOnline(false);
    await client.refetchQueries({ queryKey: key, exact: true });
    expect(await screen.findByText(text.paused)).toBeInTheDocument();
    expect(screen.getByText(identity.sku, { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: policyText.editor })).toBe(editor);
    expect(screen.getByRole("textbox", { name: policyText.reorderPoint })).toHaveValue("99");
    onlineManager.setOnline(true);
    await waitFor(() => expect(screen.queryByText(text.paused)).not.toBeInTheDocument());
    expect(screen.getByRole("form", { name: policyText.editor })).toBe(editor);
    expect(screen.getByRole("textbox", { name: policyText.reorderPoint })).toHaveValue("99");
  });
});
