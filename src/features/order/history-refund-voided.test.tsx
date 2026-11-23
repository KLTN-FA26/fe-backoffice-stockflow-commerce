import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrderHistoryItem } from "./components/OrderHistoryItem";
import { toOrderHistoryEntry } from "./history-api";

/** WF-05 BE-52 / TT-3 (audit r2 M-7): phiếu hoàn bị huỷ hiện trong lịch sử đơn cùng lý do, không "Thay đổi không rõ". */
describe("order history — REFUND_VOIDED", () => {
  const dto = {
    type: "REFUND_VOIDED",
    from: null,
    to: null,
    reason: "Chuyển nhầm tài khoản",
    occurredAt: "2026-11-20T03:00:00Z",
    actorName: "Kế toán A",
  } as const;

  it("maps to its own entry kind", () => {
    expect(toOrderHistoryEntry(dto)).toMatchObject({
      kind: "refund-voided",
      reason: "Chuyển nhầm tài khoản",
      actorName: "Kế toán A",
    });
  });

  it("renders a Vietnamese head and the void's reason", () => {
    render(
      <ul>
        <OrderHistoryItem entry={toOrderHistoryEntry(dto)} />
      </ul>,
    );
    expect(screen.getByText("Huỷ phiếu hoàn tiền")).toBeInTheDocument();
    expect(screen.getByText("Chuyển nhầm tài khoản")).toBeInTheDocument();
    expect(screen.queryByText("Thay đổi không rõ")).not.toBeInTheDocument();
  });
});
