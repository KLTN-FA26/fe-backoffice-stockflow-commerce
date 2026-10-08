import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, vi, describe, expect, it } from "vitest";

import { createInventoryFixture } from "../fixtures";
import { createInventoryMockService } from "../mock-service";
import { AtpLookupPanel } from "./AtpLookupPanel";

import type { InventoryService } from "../service";

beforeAll(() => {
  // jsdom lacks the scrolling API used when Radix opens the warehouse menu.
  Element.prototype.scrollIntoView = vi.fn();
});

function renderLookup(service: InventoryService) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AtpLookupPanel rows={createInventoryFixture().stockLevels} service={service} />
    </QueryClientProvider>,
  );
}

async function submitLookup(user: ReturnType<typeof userEvent.setup>, sku: string) {
  const panel = screen.getByRole("region", { name: "ATP Lookup" });
  await user.type(within(panel).getByRole("textbox", { name: "SKU" }), sku);
  const warehouse = within(panel).getByRole("combobox", { name: "Kho" });
  warehouse.focus();
  await user.keyboard("{ArrowDown}{Enter}");
  await user.click(within(panel).getByRole("button", { name: "Tra ATP" }));
  return panel;
}

describe("ATP lookup UI", () => {
  it("requires SKU and warehouse before requesting the mock service", async () => {
    const user = userEvent.setup();
    const service = createInventoryMockService();
    const lookupAtp = vi.spyOn(service, "lookupAtp");
    renderLookup(service);
    await user.click(screen.getByRole("button", { name: "Tra ATP" }));
    expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toEqual([
      "Nhập SKU",
      "Chọn kho",
    ]);
    expect(lookupAtp).not.toHaveBeenCalled();
  });

  it("shows an explicit zero ATP result", async () => {
    const user = userEvent.setup();
    const service = createInventoryMockService();
    renderLookup(service);
    const panel = await submitLookup(user, "DEMO-SKU-002");
    expect(await within(panel).findByText("ATP bằng 0")).toBeInTheDocument();
  });

  it("shows no result for an unknown SKU/warehouse pair", async () => {
    const user = userEvent.setup();
    renderLookup(createInventoryMockService());
    const panel = await submitLookup(user, "UNKNOWN-SKU");
    expect(
      await within(panel).findByText("Không tìm thấy kết quả cho SKU và kho này"),
    ).toBeInTheDocument();
  });

  it("shows loading and allows retry after a lookup failure", async () => {
    const user = userEvent.setup();
    const mock = createInventoryMockService();
    let rejectLookup: ((error: Error) => void) | undefined;
    const service: InventoryService = {
      ...mock,
      lookupAtp: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((_, reject) => {
              rejectLookup = reject;
            }),
        )
        .mockImplementation((input, signal) => mock.lookupAtp(input, signal)),
    };
    renderLookup(service);
    const panel = await submitLookup(user, "DEMO-SKU-001");
    expect(within(panel).getByRole("status", { name: "Đang tra ATP" })).toBeInTheDocument();
    rejectLookup?.(new Error("Fixture failure"));
    expect(await within(panel).findByText("Không tra được ATP minh họa")).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Thử lại" }));
    expect(await within(panel).findByText("20")).toBeInTheDocument();
  });
});
