import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createInventoryMockService } from "../mock-service";
import { ReservationsPanel } from "./ReservationsPanel";

import type { InventoryService } from "../service";

function renderReservations(service: InventoryService) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReservationsPanel service={service} />
    </QueryClientProvider>,
  );
}

describe("read-only reservations", () => {
  it("shows order, SKU, quantity, location, timestamps and separate nullable fields", async () => {
    renderReservations(createInventoryMockService());
    const panel = screen.getByRole("region", { name: "Reservations" });
    expect(await within(panel).findByText("DEMO-ORDER-001")).toBeInTheDocument();
    expect(within(panel).getByText("DEMO-ORDER-002")).toBeInTheDocument();
    const rows = within(panel).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText("DEMO-WH-A")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Chưa có vị trí")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Chưa có thời điểm giữ")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Chưa có thời điểm hết hạn")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Trạng thái mẫu")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /sửa|xóa/i })).not.toBeInTheDocument();
  });

  it("shows a reservation-specific loading state then empty data", async () => {
    let complete:
      ((rows: Awaited<ReturnType<InventoryService["loadReservations"]>>) => void) | undefined;
    const service: InventoryService = {
      ...createInventoryMockService(),
      loadReservations: () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    };
    renderReservations(service);
    const panel = screen.getByRole("region", { name: "Reservations" });
    expect(within(panel).getByRole("status", { name: "Đang tải nội dung" })).toBeInTheDocument();
    complete?.([]);
    expect(await within(panel).findByText("Chưa có reservation")).toBeInTheDocument();
  });

  it("retries a failed reservation load", async () => {
    const user = userEvent.setup();
    const mock = createInventoryMockService();
    const service: InventoryService = {
      ...mock,
      loadReservations: vi
        .fn()
        .mockRejectedValueOnce(new Error("Fixture failure"))
        .mockImplementation((signal) => mock.loadReservations(signal)),
    };
    renderReservations(service);
    const panel = screen.getByRole("region", { name: "Reservations" });
    expect(
      await within(panel).findByText("Không tải được reservation minh họa"),
    ).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Thử lại" }));
    expect(await within(panel).findByText("DEMO-ORDER-001")).toBeInTheDocument();
  });
});
