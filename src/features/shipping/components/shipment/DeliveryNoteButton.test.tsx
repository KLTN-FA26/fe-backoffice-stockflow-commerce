import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SHIPPING_ERROR_MESSAGES as ERR, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { apiShipment } from "../../__fixtures__/load";
import {
  SHIPPING_ACTORS as ACTORS,
  mockShippingApi,
  renderShippingScreen,
} from "../../__fixtures__/render";
import { DeliveryNoteButton } from "./DeliveryNoteButton";

import type { ShipmentRow } from "../../types";
import type { TestActor } from "../../__fixtures__/render";

const L = UI_LABELS.shipping.shipment.deliveryNote;
const URL_NOTE = "/fulfillment/shipments/shp-1/delivery-note";
let clicked: string[];

beforeEach(() => {
  clicked = [];
  URL.createObjectURL = vi.fn(() => "blob:note");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push(this.download);
  });
});
afterEach(() => vi.restoreAllMocks());

function render(actor: TestActor, patch: Partial<ShipmentRow> = {}, handler?: () => unknown) {
  const spies = mockShippingApi(actor, {
    get: { [URL_NOTE]: handler ?? (() => new Blob(["%PDF"], { type: "application/pdf" })) },
  });
  renderShippingScreen(<DeliveryNoteButton shipment={apiShipment(patch).shipment} />);
  return spies;
}

describe("DeliveryNoteButton", () => {
  it("downloads the PDF as a blob and saves it under a name built from the shipment code", async () => {
    const user = userEvent.setup();
    const { get } = render(ACTORS.viewOnly, { status: "HANDED_OVER" });
    await user.click(await screen.findByRole("button", { name: L.button }));
    await waitFor(() => expect(clicked).toEqual(["bien-ban-giao-nhan-SO-1-S1.pdf"]));
    const call = get.mock.calls.find(([url]) => url === URL_NOTE);
    expect(call?.[1]).toMatchObject({ responseType: "blob" });
  });

  it("shows a Vietnamese error under the button when the BE refuses", async () => {
    const user = userEvent.setup();
    render(ACTORS.viewOnly, { status: "HANDED_OVER" }, () => {
      throw new ApiError(409, "SHIPMENT_STATE_CONFLICT", "en");
    });
    await user.click(await screen.findByRole("button", { name: L.button }));
    expect(await screen.findByRole("alert")).toHaveTextContent(ERR.SHIPMENT_STATE_CONFLICT);
    expect(clicked).toEqual([]);
    expect(screen.getByRole("button", { name: L.button })).toBeEnabled();
  });

  it("is hidden without fulfillment-shipments:READ and for a cancelled shipment", async () => {
    render(ACTORS.noAccess);
    expect(screen.queryByRole("button", { name: L.button })).not.toBeInTheDocument();
  });

  it("is hidden for a cancelled shipment", async () => {
    render(ACTORS.viewOnly, { status: "CANCELLED" });
    expect(screen.queryByRole("button", { name: L.button })).not.toBeInTheDocument();
  });
});
