import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EINVOICE_LIMITS } from "@/constants/einvoice";

import { ACCOUNTANT_GRANTS, mockEInvoiceApi, renderEInvoiceScreen } from "../__fixtures__/screen";
import { SeriesForm } from "../components/SeriesForm";

afterEach(() => vi.restoreAllMocks());

describe("SeriesForm year (UX audit S01-7)", () => {
  it("is chosen from this year and its neighbours, not typed; this year is the default", async () => {
    mockEInvoiceApi(ACCOUNTANT_GRANTS, {});
    renderEInvoiceScreen(<SeriesForm provider="SANDBOX" />);
    const year = new Date().getFullYear();
    const trigger = await screen.findByRole("combobox", { name: /Năm/ });
    expect(trigger).toHaveTextContent(String(year));
    await userEvent.click(trigger);
    const options = await screen.findAllByRole("option");
    // BE accepts years from EINVOICE_LIMITS.yearMin (2026): earlier neighbours are not offered
    expect(options.map((o) => o.textContent)).toEqual(
      [year - 1, year, year + 1].filter((y) => y >= EINVOICE_LIMITS.yearMin).map(String),
    );
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });
});
