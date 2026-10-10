import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import { INVENTORY_CONTROL_TEXT as text } from "../inventory-control/constants";
import { inventoryControlKeys } from "../inventory-control/queries";
import {
  access,
  change,
  enterEdit,
  identity,
  response,
  setupEditor,
} from "./inventory-edit-test-support";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  access.update = true;
});
describe("Inventory Control editing", () => {
  it("enters edit from accepted policy; evaluation remains read-only", async () => {
    const { user } = setupEditor();
    await enterEdit(user);
    expect(screen.getByRole("textbox", { name: text.reorderPoint })).toHaveValue("20");
    const evaluation = screen.getByRole("region", { name: text.evaluation });
    expect(within(evaluation).getByText("12 EACH")).toBeInTheDocument();
    expect(within(evaluation).queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("Cancel restores accepted local base without PUT", async () => {
    const { user, put } = setupEditor();
    await enterEdit(user);
    await change(user, text.reorderPoint, "45");
    await user.click(screen.getByRole("button", { name: text.cancel }));
    expect(screen.getByText(text.reorderPoint).nextElementSibling).toHaveTextContent("20");
    expect(put).not.toHaveBeenCalled();
    await enterEdit(user);
    expect(screen.getByRole("textbox", { name: text.reorderPoint })).toHaveValue("20");
  });
  it("submits null and zero with exact version, adopts returned policy/version into cache and next edit", async () => {
    const { user, put, client } = setupEditor();
    await enterEdit(user);
    await change(user, text.reorderPoint, "");
    await change(user, text.safetyStock, "0");
    await user.click(screen.getByRole("button", { name: text.save }));
    await screen.findByRole("button", { name: text.edit });
    expect(put.mock.calls[0]?.[1]).toEqual({
      version: 7,
      reorderPoint: null,
      safetyStock: 0,
      removalStrategy: "FIFO",
      trackingMode: "NONE",
      expiryTracked: false,
      maxShelfLifeDays: null,
    });
    expect(screen.getByText(text.reorderPoint).nextElementSibling).toHaveTextContent("30");
    expect(
      client.getQueryData(inventoryControlKeys.detail(identity.productId, identity.variantId)),
    ).toMatchObject({ concurrency: { version: 15 } });
    await enterEdit(user);
    await user.click(screen.getByRole("button", { name: text.save }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put.mock.calls[1]?.[1]).toMatchObject({ version: 15, reorderPoint: 30 });
  });
  it.each(["1e", "1e309", "9007199254740993", "1.5", "-1"])(
    "retains/rejects raw malformed or lossy integer %s",
    async (raw) => {
      const { user, put } = setupEditor();
      await enterEdit(user);
      await change(user, text.reorderPoint, raw);
      await user.click(screen.getByRole("button", { name: text.save }));
      expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
      expect(screen.getByRole("textbox", { name: text.reorderPoint })).toHaveValue(raw);
      expect(put).not.toHaveBeenCalled();
    },
  );
  it("rejects safety stock above reorder point without PUT", async () => {
    const { user, put } = setupEditor();
    await enterEdit(user);
    await change(user, text.safetyStock, "21");
    await user.click(screen.getByRole("button", { name: text.save }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text.thresholdRelation);
    expect(put).not.toHaveBeenCalled();
  });
  it("validates dependencies without silently changing selections", async () => {
    const { user, put } = setupEditor();
    await enterEdit(user);
    await user.click(screen.getByRole("checkbox", { name: text.expiryTracked }));
    await user.click(screen.getByRole("button", { name: text.save }));
    expect(await screen.findByText(text.expiryTracking)).toBeInTheDocument();
    expect(screen.getByText(text.expiryRemoval)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: text.removalStrategy })).toHaveValue("FIFO");
    await user.selectOptions(screen.getByRole("combobox", { name: text.removalStrategy }), "FEFO");
    await user.selectOptions(
      screen.getByRole("combobox", { name: text.trackingMode }),
      "LOT_SERIAL",
    );
    await change(user, text.maxShelfLifeDays, "1");
    await user.click(screen.getByRole("button", { name: text.save }));
    await screen.findByRole("button", { name: text.edit });
    expect(put.mock.calls[0]?.[1]).toMatchObject({
      expiryTracked: true,
      trackingMode: "LOT_SERIAL",
      removalStrategy: "FEFO",
      maxShelfLifeDays: 1,
    });
  });
  it("blocks duplicates and disables controls while saving", async () => {
    const { user, put } = setupEditor();
    let resolve: ((value: { data: typeof response }) => void) | undefined;
    put.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    await enterEdit(user);
    await user.dblClick(screen.getByRole("button", { name: text.save }));
    expect(put).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox", { name: text.reorderPoint })).toBeDisabled();
    expect(screen.getByRole("button", { name: text.cancel })).toBeDisabled();
    resolve?.({ data: response });
    await screen.findByRole("button", { name: text.edit });
  });
  it("keeps draft and accepted cache after failed PUT", async () => {
    const { user, put, client } = setupEditor();
    put.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "Save failed"));
    await enterEdit(user);
    await change(user, text.reorderPoint, "45");
    await user.click(screen.getByRole("button", { name: text.save }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed");
    expect(screen.getByRole("textbox", { name: text.reorderPoint })).toHaveValue("45");
    expect(
      client.getQueryData(inventoryControlKeys.detail(identity.productId, identity.variantId)),
    ).toMatchObject({ concurrency: { version: 7 }, policy: { reorderPoint: 20 } });
  });
  it("does not offer Edit without Product UPDATE", async () => {
    access.update = false;
    setupEditor();
    await screen.findByText("12 EACH");
    expect(screen.queryByRole("button", { name: text.edit })).not.toBeInTheDocument();
  });
});
