import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";
import { toLocalDateTime } from "@/lib/format";

import { DeliveryTimeField } from "./DeliveryTimeField";

const D = UI_LABELS.shipping.shipment.outcomeDialog;

function Harness() {
  const [value, setValue] = useState("");
  return (
    <DeliveryTimeField value={value} onChange={setValue} handedOverAt="2026-11-26T01:00:00Z" />
  );
}

describe("DeliveryTimeField — 'Bây giờ' và giới hạn bây giờ", () => {
  afterEach(() => vi.useRealTimers());

  it("'Bây giờ' dùng đồng hồ thật và ô không chuyển đỏ sau vài phút (max không bị đóng băng lúc mở)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-26T05:00:00Z"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = render(<Harness />);

    await user.click(screen.getByRole("button", { name: D.deliveredNow }));
    const field = screen.getByLabelText(D.deliveredAt);
    expect(field).toHaveValue("26/11/2026 12:00");
    expect(field).not.toHaveAttribute("aria-invalid");

    // Ba phút sau, hộp thoại vẫn mở và vẽ lại: giờ vừa chọn vẫn không vượt "bây giờ"
    vi.setSystemTime(new Date("2026-11-26T05:03:00Z"));
    rerender(<Harness />);
    expect(screen.getByLabelText(D.deliveredAt)).not.toHaveAttribute("aria-invalid");
    expect(toLocalDateTime()).toBe("2026-11-26T12:03");
  });

  it("giờ ở tương lai thật vẫn đỏ viền (lý do chữ do caller nói qua `error`)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-26T05:00:00Z"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    const field = screen.getByLabelText(D.deliveredAt);
    await user.type(field, "261120261300");
    expect(field).toHaveAttribute("aria-invalid", "true");
  });
});
