import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UI_LABELS } from "@/constants";

import { ftlLoad } from "../../__fixtures__/ftl-load";
import { SHIPPING_ACTORS, mockShippingApi, renderShippingScreen } from "../../__fixtures__/render";

import { DriverSearchNotice } from "./DriverSearchNotice";

const B = UI_LABELS.shipping.ftl.booking;
const waiting = ftlLoad({
  carrierConnectionType: "API_BOOKING",
  driverName: undefined,
  carrierBooking: { status: "BOOKED", carrierOrderId: "AHA-1" },
});

describe("DriverSearchNotice — tài xế trả chuyến (U73)", () => {
  it("nhân viên kho thấy thời điểm huỷ và bước tiếp theo từ chi tiết chuyến", () => {
    mockShippingApi(SHIPPING_ACTORS.warehouseStaff);
    renderShippingScreen(
      <DriverSearchNotice load={{ ...waiting, driverReleasedAt: "2026-11-25T07:00:00Z" }} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /Tài xế đã huỷ lúc .*14:00.*đang chờ hãng tìm tài xế mới/,
    );
  });

  it("chưa có sự kiện huỷ: vẫn nói hãng đang tìm tài xế", () => {
    mockShippingApi(SHIPPING_ACTORS.warehouseStaff);
    renderShippingScreen(<DriverSearchNotice load={waiting} />);
    expect(screen.getByRole("status")).toHaveTextContent(B.findingDriver);
  });

  it("đã có tài xế mới thì không còn thông báo đang tìm", () => {
    mockShippingApi(SHIPPING_ACTORS.warehouseStaff);
    renderShippingScreen(
      <DriverSearchNotice
        load={{ ...waiting, driverName: "Tài xế mới", driverReleasedAt: "2026-11-25T07:00:00Z" }}
      />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
