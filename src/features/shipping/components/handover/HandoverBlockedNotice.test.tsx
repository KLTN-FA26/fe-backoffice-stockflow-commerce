import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";
import { blockedOrder } from "@/features/shipping/__fixtures__/ftl-load";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

import { HandoverBlockedNotice } from "./HandoverBlockedNotice";

const B = UI_LABELS.shipping.waybill.blocked;

// HandoverReasonLink (A4) đọc quyền qua useCan; ở đây không cấp quyền nào → không có liên kết, chỉ kiểm tra lý do.
vi.mock("@/lib/auth/components/Can", () => ({
  useCan: () => false,
}));

describe("HandoverBlockedNotice — một lần ký thấy đủ mọi lý do (A3)", () => {
  it("đơn có hai lý do: liệt kê cả hai trong cùng một đơn", () => {
    render(
      <HandoverBlockedNotice
        orders={[
          blockedOrder({
            reasonCodes: ["ORDER_BALANCE_NOT_PAID", "DELIVERY_BATCH_WINDOW_NOT_OPEN"],
            windowStart: "2026-11-20",
          }),
        ]}
      />,
    );
    const item = screen.getByRole("link", { name: "SO-2" }).closest("li");
    expect(item).not.toBeNull();
    const reasons = within(item as HTMLElement).getAllByRole("listitem");
    expect(reasons.map((li) => li.textContent)).toEqual([
      B.unpaidBatch(formatMoney(15_000_000, "VND"), 1),
      B.windowNotOpenBatch(formatDate("2026-11-20"), 1),
    ]);
  });

  it("đơn một lý do: vẫn một câu sau mã đơn, không danh sách con", () => {
    render(<HandoverBlockedNotice orders={[blockedOrder()]} />);
    const item = screen.getByRole("link", { name: "SO-2" }).closest("li") as HTMLElement;
    expect(within(item).queryAllByRole("listitem")).toHaveLength(0);
    expect(item.textContent).toContain(B.unpaidBatch(formatMoney(15_000_000, "VND"), 1));
  });
});
