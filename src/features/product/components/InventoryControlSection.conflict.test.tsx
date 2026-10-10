import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import { INVENTORY_CONTROL_TEXT as text } from "../inventory-control/constants";
import { inventoryControlKeys } from "../inventory-control/queries";
import { change, enterEdit, identity, response, setupEditor } from "./inventory-edit-test-support";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("Inventory Control base version and conflict recovery", () => {
  it("a late background GET cannot overwrite the accepted PUT response", async () => {
    const { user, get, client } = setupEditor();
    await enterEdit(user);
    let resolve: ((value: { data: typeof response }) => void) | undefined;
    get.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    let refresh: Promise<void> | undefined;
    await act(async () => {
      refresh = client.refetchQueries({
        queryKey: inventoryControlKeys.detail(identity.productId, identity.variantId),
      });
    });
    await user.click(screen.getByRole("button", { name: text.save }));
    await screen.findByRole("button", { name: text.edit });
    await act(async () => {
      resolve?.({ data: { ...response, version: 11, reorderPoint: 25 } });
      await refresh;
    });
    expect(
      client.getQueryData(inventoryControlKeys.detail(identity.productId, identity.variantId)),
    ).toMatchObject({ concurrency: { version: 15 }, policy: { reorderPoint: 30 } });
    expect(screen.getByText(text.reorderPoint).nextElementSibling).toHaveTextContent("30");
  });
  it("background GET does not rebase a dirty draft or Save version", async () => {
    const { user, get, put, client } = setupEditor();
    await enterEdit(user);
    await change(user, text.reorderPoint, "45");
    get.mockResolvedValue({ data: { ...response, version: 11, reorderPoint: 25 } });
    await act(async () => {
      await client.refetchQueries({
        queryKey: inventoryControlKeys.detail(identity.productId, identity.variantId),
      });
    });
    expect(screen.getByRole("textbox", { name: text.reorderPoint })).toHaveValue("45");
    put.mockRejectedValue(new ApiError(409, "CONFLICT", "Conflicting state"));
    await user.click(screen.getByRole("button", { name: text.save }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text.stateConflict);
    expect(put.mock.calls[0]?.[1]).toMatchObject({ version: 7, reorderPoint: 45 });
    expect(screen.getByRole("textbox", { name: text.reorderPoint })).toHaveValue("45");
    await user.click(screen.getByRole("button", { name: text.save }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put.mock.calls[1]?.[1]).toMatchObject({ version: 7 });
  });
  it("captures even a clean edit and Cancel restores its local accepted base", async () => {
    const { user, get, client } = setupEditor();
    await enterEdit(user);
    get.mockResolvedValue({ data: { ...response, version: 11, reorderPoint: 25 } });
    await act(async () => {
      await client.refetchQueries({
        queryKey: inventoryControlKeys.detail(identity.productId, identity.variantId),
      });
    });
    expect(screen.getByRole("textbox", { name: text.reorderPoint })).toHaveValue("20");
    await user.click(screen.getByRole("button", { name: text.cancel }));
    expect(screen.getByText(text.reorderPoint).nextElementSibling).toHaveTextContent("20");
    await enterEdit(user);
    expect(screen.getByRole("textbox", { name: text.reorderPoint })).toHaveValue("20");
    await user.click(screen.getByRole("button", { name: text.cancel }));
    // A fresh response with identical cached content still updates read-only local state.
    await act(async () => {
      await client.refetchQueries({
        queryKey: inventoryControlKeys.detail(identity.productId, identity.variantId),
      });
    });
    await waitFor(() =>
      expect(screen.getByText(text.reorderPoint).nextElementSibling).toHaveTextContent("25"),
    );
  });
  it("read-only state follows a new background response", async () => {
    const { get, client } = setupEditor();
    await screen.findByRole("button", { name: text.edit });
    get.mockResolvedValue({ data: { ...response, version: 11, reorderPoint: 25 } });
    await act(async () => {
      await client.refetchQueries({
        queryKey: inventoryControlKeys.detail(identity.productId, identity.variantId),
      });
    });
    await waitFor(() =>
      expect(screen.getByText(text.reorderPoint).nextElementSibling).toHaveTextContent("25"),
    );
  });
  it("successful explicit reload replaces draft/base, clears conflict, and quotes reloaded version", async () => {
    const { user, get, put } = setupEditor();
    await enterEdit(user);
    await change(user, text.reorderPoint, "45");
    put.mockRejectedValueOnce(new ApiError(409, "CONFLICT", "Conflicting state"));
    await user.click(screen.getByRole("button", { name: text.save }));
    await screen.findByRole("alert");
    get.mockResolvedValue({ data: { ...response, version: 11, reorderPoint: 25 } });
    await user.click(screen.getByRole("button", { name: text.reload }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: text.reorderPoint })).toHaveValue("25"),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: text.save }));
    await screen.findByRole("button", { name: text.edit });
    expect(put.mock.calls[1]?.[1]).toMatchObject({ version: 11, reorderPoint: 25 });
  });
  it("failed reload preserves draft, original conflict and original version for retry", async () => {
    const { user, get, put } = setupEditor();
    await enterEdit(user);
    await change(user, text.reorderPoint, "45");
    put.mockRejectedValueOnce(new ApiError(409, "CONFLICT", "Conflicting state"));
    await user.click(screen.getByRole("button", { name: text.save }));
    await screen.findByRole("alert");
    get.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "Reload failed"));
    await user.click(screen.getByRole("button", { name: text.reload }));
    expect(await screen.findByText(text.reloadFailed)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: text.reorderPoint })).toHaveValue("45");
    expect(screen.getByText(text.stateConflict, { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: text.save }));
    await screen.findByRole("button", { name: text.edit });
    expect(put.mock.calls[1]?.[1]).toMatchObject({ version: 7, reorderPoint: 45 });
  });
  it.each([
    ["COUNT_POLICY_CONFLICT", text.countConflict],
    ["INVENTORY_POLICY_STOCK_CONFLICT", text.stockConflict],
  ])("shows %s distinctly with backend detail and preserves draft", async (code, label) => {
    const { user, put } = setupEditor();
    await enterEdit(user);
    await change(user, text.reorderPoint, "45");
    put.mockRejectedValue(new ApiError(409, code, "Backend compatibility detail"));
    await user.click(screen.getByRole("button", { name: text.save }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(label);
    expect(alert).toHaveTextContent("Backend compatibility detail");
    expect(screen.getByRole("textbox", { name: text.reorderPoint })).toHaveValue("45");
  });
});
