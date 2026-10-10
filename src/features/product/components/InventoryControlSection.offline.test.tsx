import { onlineManager } from "@tanstack/react-query";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import { INVENTORY_CONTROL_TEXT as text } from "../inventory-control/constants";
import { change, enterEdit, response, setupEditor } from "./inventory-edit-test-support";

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
});
describe("Inventory Control queued saves and error containment", () => {
  it.each(["success", "error"])(
    "explains an offline queued save and resumes to %s",
    async (outcome) => {
      const { user, put, client } = setupEditor();
      if (outcome === "error")
        put.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "Save failed"));
      await enterEdit(user);
      await change(user, text.reorderPoint, "99");
      onlineManager.setOnline(false);
      await user.dblClick(screen.getByRole("button", { name: text.save }));
      expect(await screen.findByRole("status")).toHaveTextContent("chờ kết nối");
      expect(screen.queryByRole("button", { name: text.saving })).not.toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: text.reorderPoint })).toHaveValue("99");
      expect(screen.getByRole("textbox", { name: text.reorderPoint })).toBeDisabled();
      // TanStack keeps this mutation queued; Cancel must not imply it was discarded.
      expect(screen.getByRole("button", { name: text.cancel })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Chờ kết nối…" })).toBeDisabled();
      expect(put).not.toHaveBeenCalled();
      onlineManager.setOnline(true);
      if (outcome === "success") await screen.findByRole("button", { name: text.edit });
      else {
        expect(await screen.findByRole("alert")).toHaveTextContent("Save failed");
        expect(screen.getByRole("textbox", { name: text.reorderPoint })).toHaveValue("99");
        expect(screen.getByRole("button", { name: text.cancel })).toBeEnabled();
      }
      expect(put).toHaveBeenCalledTimes(1);
      expect(put.mock.calls[0]?.[1]).toMatchObject({ version: 7, reorderPoint: 99 });
      client.clear();
    },
  );
  it("shows active saving only while transmitting online", async () => {
    const { user, put, client } = setupEditor();
    let resolve: ((value: { data: typeof response }) => void) | undefined;
    put.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    await enterEdit(user);
    await user.click(screen.getByRole("button", { name: text.save }));
    expect(await screen.findByRole("button", { name: text.saving })).toBeDisabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    resolve?.({ data: response });
    await screen.findByRole("button", { name: text.edit });
    client.clear();
  });
  it("wraps the complete backend error without truncating its long token", async () => {
    const { user, put, client } = setupEditor();
    const detail = `Backend detail\n${"X".repeat(400)}`;
    put.mockRejectedValue(new ApiError(409, "INVENTORY_POLICY_STOCK_CONFLICT", detail));
    await enterEdit(user);
    await user.click(screen.getByRole("button", { name: text.save }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(detail);
    expect(alert).toHaveClass("wrap-anywhere", "whitespace-pre-wrap", "min-w-0");
    await waitFor(() => expect(screen.getByRole("button", { name: text.cancel })).toBeEnabled());
    client.clear();
  });
});
