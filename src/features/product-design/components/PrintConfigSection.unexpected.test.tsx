/**
 * A failure while the save is being prepared (before any request) must reach the person as a Vietnamese sentence: a
 * throw inside react-hook-form's `handleSubmit` would otherwise be an unhandled rejection and a button that does nothing.
 */
import { configure, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PRINT_CONFIG_ERROR_MESSAGES } from "@/constants/labels-print-config";
import { api } from "@/lib/api/client";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { resetPrintConfigMockStore } from "@/lib/api/mock-routes-print-configs";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import { renderSection } from "./print-config-test-utils";

vi.mock("./save-input", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  buildSaveInput: () => {
    throw new Error("unexpected shape");
  },
}));

vi.setConfig({ testTimeout: 60_000 });
configure({ asyncUtilTimeout: 45_000 });

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetProductMockStore();
  resetVariantMockStore();
  resetPrintConfigMockStore();
});
afterEach(() => vi.restoreAllMocks());

describe("a save that cannot be prepared", () => {
  it("shows the Vietnamese fallback sentence, sends nothing, and keeps the form", async () => {
    const put = vi.spyOn(api, "put");
    const user = userEvent.setup();
    renderSection();
    await user.click(await screen.findByRole("button", { name: /Nâng cao/ }));
    const seam = screen.getByLabelText("Mép dán (mm)");
    await user.clear(seam);
    await user.type(seam, "6");
    await user.click(screen.getByRole("button", { name: "Lưu cấu hình in" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(PRINT_CONFIG_ERROR_MESSAGES.fallback);
    expect(alert).not.toHaveTextContent("unexpected shape");
    expect(put).not.toHaveBeenCalled();
    expect(seam).toHaveValue(6);
  });
});
