import { useState } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, mockApi, renderScreen } from "@/test/api-screen";

import { DesignSnapshotField } from "./DesignSnapshotField";

import type { TestRole } from "@/test/api-screen";

afterEach(() => vi.restoreAllMocks());

const SNAP = {
  snapshotId: "snap-1",
  draftId: "d-1",
  designName: "Logo Mộc An ly 12oz",
  customerId: "c-1",
  productId: "p-1",
  checksum: "46b55acdb494",
  spec: "{}",
  confirmedAt: "2026-10-14T03:00:00Z",
  confirmedBy: "u-c",
  artifacts: [],
};
const page = (items: unknown[]) => ({
  items,
  page: 0,
  size: 50,
  totalElements: items.length,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
});

function Harness({
  onPick,
  sku = "CUP-PAPER-12OZ-WHT",
}: {
  onPick: (id: string) => void;
  sku?: string;
}) {
  const [value, setValue] = useState("");
  return (
    <DesignSnapshotField
      id="design"
      customerId="c-1"
      blankSku={sku}
      value={value}
      onChange={(id) => {
        setValue(id);
        onPick(id);
      }}
    />
  );
}

const render = (role: TestRole, onPick = vi.fn(), sku?: string) =>
  renderScreen(<Harness onPick={onPick} sku={sku} />, role);

describe("DesignSnapshotField — SCRUM-403/449 confirmed designs of the customer", () => {
  it("lists the customer's confirmed designs for the blank SKU and previews the one chosen", async () => {
    const onPick = vi.fn();
    const api = mockApi("SALES_STAFF", {
      get: {
        "/design-snapshots": () => page([SNAP]),
        "/design-snapshots/snap-1/preview": () => ({
          snapshotId: "snap-1",
          artifactId: "a",
          originalName: "preview.png",
          contentType: "image/png",
          sizeBytes: 10,
          checksum: "x",
          url: "https://files.example.com/preview.png",
          expiresAt: "2026-10-14T05:00:00Z",
        }),
      },
    });
    render("SALES_STAFF", onPick);
    const option = await screen.findByRole("option", { name: /Logo Mộc An ly 12oz/ });
    const params = api.get.mock.calls.find(([url]) => url === "/design-snapshots")?.[1] as {
      params: URLSearchParams;
    };
    expect(params.params.get("customerId")).toBe("c-1");
    expect(params.params.get("sku")).toBe("CUP-PAPER-12OZ-WHT");
    expect(screen.queryByPlaceholderText(/UUID/)).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(/Thiết kế khách đã xác nhận/), option);
    expect(onPick).toHaveBeenCalledWith("snap-1");
    expect(
      await screen.findByRole("img", { name: "Thiết kế khách đã xác nhận: Logo Mộc An ly 12oz" }),
    ).toHaveAttribute("src", "https://files.example.com/preview.png");
    const preview = api.get.mock.calls.find(([url]) => url === "/design-snapshots/snap-1/preview");
    expect((preview?.[1] as { params: URLSearchParams }).params.get("customerId")).toBe("c-1");
  });

  it("nothing for this blank → says so and can widen to every design of the customer", async () => {
    mockApi("SALES_STAFF", {
      get: {
        "/design-snapshots": (params) =>
          (params as URLSearchParams).get("sku") ? page([]) : page([SNAP]),
      },
    });
    render("SALES_STAFF");
    expect(
      await screen.findByText("Khách chưa có thiết kế đã xác nhận cho phôi CUP-PAPER-12OZ-WHT."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Thiết kế khách đã xác nhận/)).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Xem mọi thiết kế của khách" }));
    expect(await screen.findByRole("option", { name: /Logo Mộc An ly 12oz/ })).toBeInTheDocument();
  });

  it("unknown customer (404 CUSTOMER_NOT_FOUND) is explained, list stays empty", async () => {
    mockApi("SALES_STAFF", {
      get: {
        "/design-snapshots": () => {
          throw apiError(404, "CUSTOMER_NOT_FOUND");
        },
      },
    });
    render("SALES_STAFF", vi.fn(), "");
    expect(await screen.findByText("Không tìm thấy khách hàng này.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });

  it("preview of a snapshot that is not this customer's (404) shows a reason, no image", async () => {
    mockApi("SALES_STAFF", {
      get: {
        "/design-snapshots": () => page([SNAP]),
        "/design-snapshots/snap-1/preview": () => {
          throw apiError(404, "NOT_FOUND");
        },
      },
    });
    render("SALES_STAFF");
    await userEvent.selectOptions(
      screen.getByLabelText(/Thiết kế khách đã xác nhận/),
      await screen.findByRole("option", { name: /Logo Mộc An ly 12oz/ }),
    );
    expect(
      await screen.findByText(/không thuộc khách đang chọn, hoặc chưa có ảnh/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("a role without design-snapshots:READ never calls the API", async () => {
    const api = mockApi("ORDER_COORDINATOR", { get: {} });
    render("ORDER_COORDINATOR");
    expect(
      await screen.findByText("Bạn chưa có quyền xem thiết kế đã xác nhận của khách."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(api.get).not.toHaveBeenCalledWith("/design-snapshots", expect.anything()),
    );
  });
});
