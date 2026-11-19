import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LOAD_PLAN_PERMISSIONS, LOAD_PLAN_PRINT_LABELS } from "@/constants";
import { api } from "@/lib/api/client";
import { renderWithProviders } from "@/test/render";

import { ftlLoad } from "../../__fixtures__/ftl-load";
import { LoadActions } from "./LoadActions";

import type { ShippingActor } from "@/features/shipping/lifecycle";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

let actor: ShippingActor = { can: () => false };
vi.mock("../useShippingActor", () => ({ useShippingActor: () => actor }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const BUTTON = { name: LOAD_PLAN_PRINT_LABELS.pdfButton };
const rendered = (load = ftlLoad({ loadPlanId: "lp-1", vehicleSeq: 2 })) =>
  renderWithProviders(
    <LoadActions load={load} actions={[]} onHandover={() => {}} onControlledCancel={() => {}} />,
  );

describe("LoadActions — Tải PDF phiếu xếp hàng của xe (WF4-PDF-PRINT-1118)", () => {
  it("có fulfillment-load-plans:READ → bấm tải đúng xe của chuyến và lưu file BE trả về", async () => {
    actor = { can: (code) => code === LOAD_PLAN_PERMISSIONS.read };
    const pdf = new Blob(["%PDF"], { type: "application/pdf" });
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: pdf,
      headers: { "content-disposition": 'attachment; filename="loading-sheet-LP-1-vehicle2.pdf"' },
    });
    vi.stubGlobal("URL", { createObjectURL: () => "blob:sheet", revokeObjectURL: vi.fn() });
    const saved: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push(this.download);
    });

    rendered();
    await userEvent.setup().click(screen.getByRole("button", BUTTON));

    await waitFor(() => expect(saved).toEqual(["loading-sheet-LP-1-vehicle2.pdf"]));
    expect(get.mock.calls[0]?.[0]).toBe(
      "/fulfillment/load-plans/lp-1/vehicles/2/loading-sheet.pdf",
    );
  });

  it("chuyến đã huỷ → không có nút", () => {
    actor = { can: () => true };
    rendered(ftlLoad({ loadPlanId: "lp-1", vehicleSeq: 2, status: "CANCELLED" }));
    expect(screen.queryByRole("button", BUTTON)).not.toBeInTheDocument();
  });

  it("không có mã quyền đọc kế hoạch → không có nút", () => {
    actor = { can: () => false };
    rendered();
    expect(screen.queryByRole("button", BUTTON)).not.toBeInTheDocument();
  });

  it("chuyến không thuộc xe nào của kế hoạch → không có nút", () => {
    actor = { can: () => true };
    rendered(ftlLoad({ loadPlanId: undefined, vehicleSeq: undefined }));
    expect(screen.queryByRole("button", BUTTON)).not.toBeInTheDocument();
  });
});
