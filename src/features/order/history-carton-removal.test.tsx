import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrderHistoryItem } from "./components/OrderHistoryItem";
import { toOrderHistoryEntry } from "./history-api";

/** WF4-F2C (docs 08 §4.2 bước 4): kho loại thùng ở trạm kiểm thùng hiện trong lịch sử đơn, đơn treo hay không. */
describe("order history — CARTON_REMOVAL", () => {
  const dto = {
    type: "CARTON_REMOVAL",
    from: null,
    to: null,
    reason: "móp góc, rách băng keo",
    occurredAt: "2026-11-28T05:29:00Z",
    actorName: "Phạm Văn Long",
    cartonLpn: "LPN-20261128-000046",
    cartonRemovalReason: "DAMAGED",
    continuesPartial: true,
  } as const;

  it("maps to its own entry kind with the LPN, reason and whether the order goes on in part", () => {
    expect(toOrderHistoryEntry(dto)).toMatchObject({
      kind: "carton-removal",
      lpn: "LPN-20261128-000046",
      removalReason: "DAMAGED",
      continuesPartial: true,
      reason: "móp góc, rách băng keo",
    });
  });

  it("order already allowed in part: 'Kho loại thùng LPN… (hư hỏng) – giao một phần' with the station's note", () => {
    render(
      <ul>
        <OrderHistoryItem entry={toOrderHistoryEntry(dto)} />
      </ul>,
    );
    expect(
      screen.getByText("Kho loại thùng LPN-20261128-000046 (hư hỏng) – giao một phần"),
    ).toBeInTheDocument();
    expect(screen.getByText("móp góc, rách băng keo")).toBeInTheDocument();
    expect(screen.queryByText("Thay đổi không rõ")).not.toBeInTheDocument();
  });

  it("order not allowed in part: it was held for Sales", () => {
    render(
      <ul>
        <OrderHistoryItem entry={toOrderHistoryEntry({ ...dto, continuesPartial: false })} />
      </ul>,
    );
    expect(
      screen.getByText("Kho loại thùng LPN-20261128-000046 (hư hỏng) – đơn treo, chờ Sale quyết"),
    ).toBeInTheDocument();
  });

  it("unknown reason code: the bracket is left out; missing LPN falls back to the unknown entry", () => {
    expect(toOrderHistoryEntry({ ...dto, cartonLpn: null })).toMatchObject({ kind: "unknown" });
    render(
      <ul>
        <OrderHistoryItem entry={toOrderHistoryEntry({ ...dto, cartonRemovalReason: "NEW" })} />
      </ul>,
    );
    expect(
      screen.getByText("Kho loại thùng LPN-20261128-000046 – giao một phần"),
    ).toBeInTheDocument();
  });
});
