import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOAD_PLAN_PRINT_LABELS as L, SHIPMENT_PERMISSIONS } from "@/constants";

import { LAYOUT_PICKUP_KIT } from "../../__fixtures__/layouts";
import { PLAN_ID, planFixture, planWithUnplaced, vehicleOfLayout } from "../../__fixtures__/plans";
import {
  LOAD_PLAN_ACTORS as ACTORS,
  mockLoadPlanApi,
  renderLoadPlanScreen,
} from "../../__fixtures__/render-plan";
import { captureStepImages, captureVehicleViews } from "../../lib/capture";
import { LoadSheetPrint } from "./LoadSheetPrint";

import type { PlanDetail } from "../../plan-types";

// jsdom không có WebGL: ảnh chụp giả (hình học cảnh đã test ở lib/capture.test.ts, lô ở lib/print-capture.test.ts)
vi.mock("../../lib/capture", () => ({
  captureVehicleViews: vi.fn(() => ({
    left: { dataUrl: "data:image/jpeg;base64,LEFT", aspect: 0.5 },
    right: { dataUrl: "data:image/jpeg;base64,RIGHT", aspect: 0.5 },
  })),
  captureStepImages: vi.fn((_l: unknown, steps: readonly unknown[]) =>
    steps.map((_, i) => `data:image/jpeg;base64,STEP${i + 1}`),
  ),
}));

const PATH = `/fulfillment/load-plans/${PLAN_ID}`;
const LOAD_ID = "load-1";
const BOOKED = {
  loadId: LOAD_ID,
  code: "LOAD-20261022-0001",
  status: "VEHICLE_BOOKED",
  carrierCode: "GHN",
  carrierName: "Giao Hàng Nhanh",
  vehiclePlate: "51C-123.45",
  driverName: "Nguyễn Văn Tài",
  driverPhone: "0901234567",
};
const PLAN_WITH_LOAD = planFixture({
  vehicles: [
    vehicleOfLayout(LAYOUT_PICKUP_KIT, {
      load: { loadId: LOAD_ID, code: "LOAD-20261022-0001", status: "VEHICLE_BOOKED" },
    }),
  ],
});
const WITH_LOADS = {
  permissions: [...ACTORS.viewOnly.permissions, SHIPMENT_PERMISSIONS.read],
};

const H = L.header;
const planWithLoad = (status: string) =>
  planFixture({
    vehicles: [
      vehicleOfLayout(LAYOUT_PICKUP_KIT, {
        load: { loadId: LOAD_ID, code: "LOAD-20261022-0001", status },
      }),
    ],
  });

/** `gate`: giữ yêu cầu `/fulfillment/loads/*` cho tới khi test mở cổng (mô phỏng mạng chậm). */
function renderSheet(
  actor: { permissions: string[] },
  plan: PlanDetail = planFixture(),
  seq = 1,
  gate?: Promise<void>,
) {
  const spies = mockLoadPlanApi(actor as never, {
    get: {
      [PATH]: () => plan,
      [`${PATH}/layouts`]: () => [LAYOUT_PICKUP_KIT],
      [`/fulfillment/loads/${LOAD_ID}`]: () => BOOKED,
    },
  });
  if (gate) {
    const original = spies.get.getMockImplementation();
    spies.get.mockImplementation(async (url: string, config?: { params?: unknown }) => {
      if (url.startsWith("/fulfillment/loads/")) await gate;
      return original ? original(url, config) : { data: undefined };
    });
  }
  renderLoadPlanScreen(<LoadSheetPrint id={PLAN_ID} seq={seq} />);
  return spies;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LoadSheetPrint — gating", () => {
  it("denies a user without fulfillment-load-plans:READ and never loads the plan", async () => {
    const { get } = renderSheet(ACTORS.noRead);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.printButton })).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === PATH)).toBe(false);
  });

  it("denies a user with no access at all", async () => {
    renderSheet(ACTORS.noAccess);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(captureVehicleViews).not.toHaveBeenCalled();
  });
});

describe("LoadSheetPrint — images and layout", () => {
  it("shows the progress first, and renders the sheet only once the images are ready", async () => {
    renderSheet(ACTORS.viewOnly);
    expect(await screen.findByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText(/Đang dựng ảnh 3D/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.printButton })).toBeDisabled();
    expect(screen.queryByText(L.documentTitle, { selector: "h2" })).not.toBeInTheDocument();

    expect(
      await screen.findByRole("heading", { name: L.documentTitle, level: 2 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.printButton })).toBeEnabled();
  });

  it("prints the header, the overview images, every step with its image and parcels, and the full table", async () => {
    renderSheet(ACTORS.viewOnly);
    await screen.findByRole("heading", { name: L.documentTitle, level: 2 });

    expect(screen.getByText(/^Kế hoạch LP-20261022-0001/)).toBeInTheDocument();
    expect(screen.getByText(/PICKUP-1T/)).toBeInTheDocument();
    expect(screen.getByText("1.000 kg")).toBeInTheDocument();
    expect(screen.getByAltText(/tổng quan, Bên trái/)).toHaveAttribute(
      "src",
      expect.stringContaining("LEFT"),
    );
    expect(screen.getByAltText(/tổng quan, Bên phải/)).toHaveAttribute(
      "src",
      expect.stringContaining("RIGHT"),
    );

    // 3 steps → 3 images in order, each with its own parcel table
    for (const n of [1, 2, 3]) {
      expect(screen.getByAltText(L.steps.imageAlt(n))).toHaveAttribute(
        "src",
        expect.stringContaining(`STEP${n}`),
      );
      expect(screen.getByRole("heading", { name: new RegExp(`Bước ${n}/3`) })).toBeInTheDocument();
    }
    expect(
      screen.getByRole("table", { name: "Bước 1/3" }).querySelectorAll("tbody tr"),
    ).toHaveLength(4);
    expect(
      screen.getByRole("table", { name: "Bước 2/3" }).querySelectorAll("tbody tr"),
    ).toHaveLength(16);

    const full = screen.getByRole("table", { name: L.parcel.title });
    expect(within(full).getAllByRole("row")).toHaveLength(1 + 23 + 1);
    expect(within(full).getByText(/Tổng: 23/)).toBeInTheDocument();
    expect(screen.getAllByText("SO-20261004-000001").length).toBeGreaterThan(0);
    expect(screen.getByText(L.signatures.warehouse)).toBeInTheDocument();
    expect(screen.queryByText(L.unplaced.title)).not.toBeInTheDocument();
    expect(captureStepImages).toHaveBeenCalledTimes(1);
  });

  it("opens the browser print dialog from the button", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderSheet(ACTORS.viewOnly);
    const button = await screen.findByRole("button", { name: L.printButton });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("falls back when the 3D capture fails: retry, or view the sheet without images", async () => {
    vi.mocked(captureVehicleViews).mockImplementationOnce(() => {
      throw new Error("no webgl");
    });
    renderSheet(ACTORS.viewOnly);
    expect(await screen.findByText(L.captureFailed)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: L.documentTitle, level: 2 }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.printButton })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: L.printWithoutImages }));
    expect(
      await screen.findByRole("heading", { name: L.documentTitle, level: 2 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.printButton })).toBeEnabled();
  });

  it("retries the capture and shows the sheet when it works the second time", async () => {
    vi.mocked(captureVehicleViews).mockImplementationOnce(() => {
      throw new Error("no webgl");
    });
    renderSheet(ACTORS.viewOnly);
    await userEvent.click(await screen.findByRole("button", { name: L.retry }));
    expect(
      await screen.findByRole("heading", { name: L.documentTitle, level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("img").length).toBeGreaterThan(2);
  });
});

describe("LoadSheetPrint — booking, unplaced note, bad input", () => {
  it("fills carrier, plate and driver from the dispatch load when the viewer may read loads", async () => {
    const { get } = renderSheet(WITH_LOADS, PLAN_WITH_LOAD);
    await screen.findByRole("heading", { name: L.documentTitle, level: 2 });
    expect(await screen.findByText("51C-123.45")).toBeInTheDocument();
    expect(screen.getByText("GHN Giao Hàng Nhanh")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn Tài · 0901234567")).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === `/fulfillment/loads/${LOAD_ID}`)).toBe(true);
  });

  it("leaves the booking boxes blank and never calls the load API without fulfillment-shipments:READ", async () => {
    const { get } = renderSheet(ACTORS.viewOnly, PLAN_WITH_LOAD);
    await screen.findByRole("heading", { name: L.documentTitle, level: 2 });
    expect(screen.queryByText("51C-123.45")).not.toBeInTheDocument();
    // booked (VEHICLE_BOOKED) but unreadable for this viewer: neutral dash + the reason, never "not booked"
    expect(screen.getByText(H.bookingNoPermission)).toBeInTheDocument();
    expect(screen.queryByText(H.notBooked)).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).startsWith("/fulfillment/loads"))).toBe(
      false,
    );
    expect(screen.getByRole("button", { name: L.printButton })).toBeEnabled();
  });

  it("still prints when the load cannot be read (404) — blanks instead of an error", async () => {
    mockLoadPlanApi(WITH_LOADS as never, {
      get: {
        [PATH]: () => PLAN_WITH_LOAD,
        [`${PATH}/layouts`]: () => [LAYOUT_PICKUP_KIT],
      },
    });
    renderLoadPlanScreen(<LoadSheetPrint id={PLAN_ID} seq={1} />);
    expect(
      await screen.findByRole("heading", { name: L.documentTitle, level: 2 }),
    ).toBeInTheDocument();
    expect(screen.queryByText("51C-123.45")).not.toBeInTheDocument();
    expect(await screen.findByText(H.bookingError)).toBeInTheDocument();
    expect(screen.queryByText(H.notBooked)).not.toBeInTheDocument();
  });

  it("says 'Chưa đặt xe' only when the load is PLANNED, even without permission, and never calls the load API", async () => {
    const { get } = renderSheet(ACTORS.viewOnly, planWithLoad("PLANNED"));
    await screen.findByRole("heading", { name: L.documentTitle, level: 2 });
    expect(screen.getByText(H.notBooked)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).startsWith("/fulfillment/loads"))).toBe(
      false,
    );
  });

  it("says the plan has no load yet (not 'not booked') when the vehicle has no dispatch load", async () => {
    renderSheet(WITH_LOADS);
    await screen.findByRole("heading", { name: L.documentTitle, level: 2 });
    expect(screen.getByText(H.noLoad)).toBeInTheDocument();
    expect(screen.queryByText(H.notBooked)).not.toBeInTheDocument();
  });

  it("shows a cancelled load as such, without fetching it", async () => {
    renderSheet(WITH_LOADS, planWithLoad("CANCELLED"));
    await screen.findByRole("heading", { name: L.documentTitle, level: 2 });
    expect(screen.getByText(H.bookingCancelled)).toBeInTheDocument();
  });

  it("keeps the print button disabled while the booking loads, with a loading text instead of 'not booked'", async () => {
    let open: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    renderSheet(WITH_LOADS, PLAN_WITH_LOAD, 1, gate);
    // images are ready (document rendered) but the booking has not settled
    expect(await screen.findByText(H.bookingLoading)).toBeInTheDocument();
    expect(screen.queryByText(H.notBooked)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.printButton })).toBeDisabled();

    open();
    expect(await screen.findByText("51C-123.45")).toBeInTheDocument();
    expect(screen.getByText(H.booked)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.printButton })).toBeEnabled();
  });

  it("prints a per-page footer with the plan code and the vehicle, and numbers pages in the @page margin", async () => {
    renderSheet(ACTORS.viewOnly);
    await screen.findByRole("heading", { name: L.documentTitle, level: 2 });
    expect(screen.getByText(L.footer("LP-20261022-0001", 1))).toBeInTheDocument();
    const css = document.querySelector("article style")?.textContent ?? "";
    expect(css).toContain("@page");
    expect(css).toContain("counter(page)");
    expect(css).toContain(L.pageWord);
  });

  it("adds the unplaced note, saying those parcels are not on this sheet", async () => {
    renderSheet(ACTORS.viewOnly, planWithUnplaced("TOO_LARGE"));
    expect(await screen.findByRole("heading", { name: L.unplaced.title })).toBeInTheDocument();
    expect(screen.getByText(L.unplaced.left(1))).toBeInTheDocument();
    expect(screen.getByText(L.unplaced.notAcknowledged)).toBeInTheDocument();
    expect(screen.getByText("Tủ vải")).toBeInTheDocument();
  });

  it("explains a vehicle the plan does not have, without capturing anything", async () => {
    renderSheet(ACTORS.viewOnly, planFixture(), 9);
    expect(await screen.findByText(L.vehicleNotFound)).toBeInTheDocument();
    expect(captureVehicleViews).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric vehicle sequence in the URL", async () => {
    renderSheet(ACTORS.viewOnly, planFixture(), Number.NaN);
    expect(await screen.findByText(L.badSeq)).toBeInTheDocument();
  });
});
