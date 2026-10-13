import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SAMPLE_API_STATUSES } from "@/constants";
import { mockApi, renderScreen } from "@/test/api-screen";

import { PortalSampleDetail, SampleDetailView } from "..";
import { SAMPLE_TRANSITIONS, allowedSampleActions } from "../lifecycle";

import type { PermissionCode } from "@/lib/auth/me-permissions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const has =
  (...codes: string[]) =>
  (code: PermissionCode) =>
    codes.includes(code);

const sample = (status: string, extra: Record<string, unknown> = {}) => ({
  id: "s-1",
  requestNumber: "SR-20261014-0001",
  customerId: "c-1",
  round: 1,
  status,
  specification: {
    designSnapshotId: "5f1a2b3c-0000-4000-8000-000000000001",
    blankSku: "CUP-PAPER-12OZ",
    quantity: 5,
  },
  rounds: [
    {
      id: "s-1",
      requestNumber: "SR-20261014-0001",
      round: 1,
      status,
      designSnapshotId: "5f1a2b3c-0000-4000-8000-000000000001",
      blankSku: "CUP-PAPER-12OZ",
      quantity: 5,
    },
  ],
  createdAt: "2026-10-14T02:00:00Z",
  version: 0,
  ...extra,
});

afterEach(() => vi.restoreAllMocks());

describe("SAMPLE_TRANSITIONS (BE SampleStatus, docs SCRUM-394)", () => {
  it("covers every BE status; APPROVED / CANCELLED / CHANGES_REQUESTED end their round", () => {
    expect(Object.keys(SAMPLE_TRANSITIONS).sort()).toEqual([...SAMPLE_API_STATUSES].sort());
    expect(SAMPLE_TRANSITIONS.APPROVED).toEqual([]);
    expect(SAMPLE_TRANSITIONS.CANCELLED).toEqual([]);
  });
  it("Q5: a cancelled round reopens only when its LSX was cancelled, once", () => {
    const sales = has("production-sample-requests:CREATE");
    expect(
      allowedSampleActions(
        { status: "CANCELLED", hasNextRound: false, productionCancelled: true },
        sales,
      ),
    ).toEqual(["nextRound"]);
    expect(
      allowedSampleActions(
        { status: "CANCELLED", hasNextRound: false, productionCancelled: false },
        sales,
      ),
    ).toEqual([]);
    expect(
      allowedSampleActions(
        { status: "CHANGES_REQUESTED", hasNextRound: true, productionCancelled: false },
        sales,
      ),
    ).toEqual([]);
  });
});

describe("Sample detail — role gating", () => {
  it("SALES_STAFF on DRAFT: edit / submit / cancel; submit without warehouse list asks for an id", async () => {
    mockApi("SALES_STAFF", {
      get: {
        "/production/sample-requests/s-1": () => sample("DRAFT"),
        "/customers/c-1": () => ({
          customerId: "c-1",
          fullName: "Bao Bì Xanh",
          email: "a@x.vn",
          status: "ACTIVE",
        }),
      },
    });
    renderScreen(<SampleDetailView id="s-1" />, "SALES_STAFF");
    expect(await screen.findByRole("button", { name: "Sửa quy cách" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Huỷ yêu cầu" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Gửi sản xuất" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/Mã kho/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Gửi sản xuất" })).toBeDisabled();
  });

  it("QC_STAFF (read only) sees the round but no mutating action", async () => {
    mockApi("QC_STAFF", { get: { "/production/sample-requests/s-1": () => sample("READY") } });
    renderScreen(<SampleDetailView id="s-1" />, "QC_STAFF");
    expect(await screen.findByRole("heading", { name: /SR-20261014-0001/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đã gửi mẫu cho khách" })).not.toBeInTheDocument();
  });

  it("CUSTOMER on SENT_TO_CUSTOMER approves through the real endpoint", async () => {
    const api = mockApi("CUSTOMER", {
      get: {
        "/production/sample-requests/s-1": () =>
          sample("SENT_TO_CUSTOMER", { sentAt: "2026-10-14T05:00:00Z" }),
      },
      post: { "/production/sample-requests/s-1/approval": () => sample("APPROVED") },
    });
    renderScreen(<PortalSampleDetail id="s-1" />, "CUSTOMER");
    await userEvent.click(await screen.findByRole("button", { name: "Duyệt mẫu" }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Duyệt mẫu" }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/production/sample-requests/s-1/approval", undefined),
    );
  });

  it("CUSTOMER cannot approve a sample that was not sent yet", async () => {
    mockApi("CUSTOMER", {
      get: { "/production/sample-requests/s-1": () => sample("IN_PRODUCTION") },
    });
    renderScreen(<PortalSampleDetail id="s-1" />, "CUSTOMER");
    expect(await screen.findByText("SR-20261014-0001")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Duyệt mẫu" })).not.toBeInTheDocument();
  });
});
