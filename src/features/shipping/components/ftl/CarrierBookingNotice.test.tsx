import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UI_LABELS } from "@/constants";

import { ftlLoad } from "../../__fixtures__/ftl-load";

import { CarrierBookingNotice } from "./CarrierBookingNotice";

const N = UI_LABELS.shipping.ftl.bookingToCancel;
const cancelled = (status: "BOOKED" | "CANCELLED" | "CANCEL_FAILED") =>
  ftlLoad({
    status: "CANCELLED",
    carrierConnectionType: "API_BOOKING",
    carrierBookingToCancel: true,
    carrierBooking: { status, carrierOrderId: "AHA-1" },
  });

describe("CarrierBookingNotice — huỷ đơn ở hãng API (U64)", () => {
  it("đang huỷ tự động thì nêu tiến trình, không nhắc gọi hãng", () => {
    render(<CarrierBookingNotice load={cancelled("BOOKED")} />);
    expect(screen.getByText(N.apiCancellingTitle)).toBeInTheDocument();
    expect(screen.getByText(N.apiCancelling)).toBeInTheDocument();
    expect(screen.queryByText(N.title)).not.toBeInTheDocument();
  });

  it("hãng xác nhận huỷ thì nêu đã huỷ", () => {
    render(<CarrierBookingNotice load={cancelled("CANCELLED")} />);
    expect(screen.getByText(N.apiCancelledTitle)).toBeInTheDocument();
    expect(screen.queryByText(N.title)).not.toBeInTheDocument();
  });

  it("hãng từ chối huỷ thì giao bước tiếp theo cho điều phối", () => {
    render(<CarrierBookingNotice load={cancelled("CANCEL_FAILED")} />);
    expect(screen.getByText(N.apiFailedTitle)).toBeInTheDocument();
    expect(screen.getByText(N.apiFailed)).toBeInTheDocument();
  });
});
