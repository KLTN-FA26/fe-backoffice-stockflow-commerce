/**
 * BE `PrintConfigRules` on the screen: a value the BE would refuse shows its sentence on its input, before anything is
 * sent. The seeded variant is the sample cup (90 / 60 / 110 mm, band at 6 and 8 mm: a band 97.018 mm high).
 */
import { configure, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { resetPrintConfigMockStore } from "@/lib/api/mock-routes-print-configs";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import { DEFAULTS_SECTION, editStored, renderSection, saveStored } from "./print-config-test-utils";

vi.setConfig({ testTimeout: 60_000 });
configure({ asyncUtilTimeout: 45_000 });

const SAVE = { name: "Lưu cấu hình in" };

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetProductMockStore();
  resetVariantMockStore();
  resetPrintConfigMockStore();
});
afterEach(() => vi.restoreAllMocks());

async function typeInto(user: ReturnType<typeof userEvent.setup>, label: string, text: string) {
  const field = screen.getByLabelText(label);
  await user.clear(field);
  await user.type(field, text);
  return field;
}

describe("PrintConfigSection: BE PrintConfigRules before the save", () => {
  it("NoSafeArea: a margin that leaves nothing to print is refused on its input, nothing is sent", async () => {
    const put = vi.spyOn(api, "put");
    const user = userEvent.setup();
    renderSection();
    await editStored(user);
    await screen.findByRole("region", DEFAULTS_SECTION);
    const field = await typeInto(user, "Lề an toàn (mm)", "48.51");
    await user.click(screen.getByRole("button", SAVE));

    expect(
      await screen.findByText(/Lề an toàn phải nhỏ hơn 48,51 mm \(một nửa cạnh ngắn nhất/),
    ).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(put).not.toHaveBeenCalled();

    await typeInto(user, "Lề an toàn (mm)", "48.5");
    await saveStored(user);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0]?.[1]).toMatchObject({
      printAreas: [expect.objectContaining({ code: "BODY", safeMarginMm: 48.5 })],
    });
  });

  it("MAX_SEAM_MM: a seam over 100 mm is refused on its field (the defaults card is always open)", async () => {
    const put = vi.spyOn(api, "put");
    const user = userEvent.setup();
    renderSection();
    await editStored(user);
    const defaults = await screen.findByRole("region", DEFAULTS_SECTION);
    await typeInto(user, "Mép dán (mm)", "100.01");

    await user.click(screen.getByRole("button", SAVE));
    expect(await screen.findByText("Tối đa 100 mm.")).toBeInTheDocument();
    expect(screen.getByLabelText("Mép dán (mm)")).toHaveAttribute("aria-invalid", "true");
    expect(within(defaults).getByLabelText("Mép dán (mm)")).toBeVisible();
    expect(put).not.toHaveBeenCalled();
  });
});
