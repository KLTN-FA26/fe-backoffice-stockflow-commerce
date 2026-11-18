import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UI_LABELS } from "@/constants";
import { carrierBookingSchema } from "@/features/shipping/ftl-schemas";

import { plannedLoad } from "../../__fixtures__/ftl-load";

import { CarrierOrderNotice } from "./CarrierOrderNotice";

const N = UI_LABELS.shipping.waybill.apiBooking.notice;

describe("CarrierOrderNotice — đơn của chuyến ở hãng đặt xe qua API (docs 09 BR-29)", () => {
  it("UNCONFIRMED (lời gọi hãng không trả về) là trạng thái đã biết, có nhãn và là cảnh báo (RTM 09A-131)", () => {
    const booking = carrierBookingSchema.parse({ status: "UNCONFIRMED" });
    expect(booking.status).toBe("UNCONFIRMED");

    const { container } = render(
      <CarrierOrderNotice load={plannedLoad({ carrierBooking: booking })} />,
    );

    expect(
      screen.getByText("Chưa rõ hãng đã tạo đơn — kiểm trên cổng hãng rồi huỷ đặt"),
    ).toBeInTheDocument();
    expect(screen.queryByText(N.status.UNKNOWN)).not.toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain("text-warning");
  });

  it("đơn đã tạo ở hãng chỉ là thông tin, không cảnh báo", () => {
    const booking = carrierBookingSchema.parse({ status: "BOOKED", carrierOrderId: "AHA-1" });

    const { container } = render(
      <CarrierOrderNotice load={plannedLoad({ carrierBooking: booking })} />,
    );

    expect(screen.getByText(N.status.BOOKED)).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain("text-info");
  });
});
