import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RECEIPT_CARTON_LABELS as L } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { RECEIPT_ID, apiReceipt, cartonLine, cartonPackage } from "../../__fixtures__/receipt";
import {
  RECEIPT_ROLE_PERMISSIONS as ROLES,
  mockReceiptApi,
  renderReceiptScreen,
} from "../../__fixtures__/render";
import { ReceiptDetail } from "../ReceiptDetail";

import type { ReceiptLineDto } from "../../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const PATH = `/goods-receipts/${RECEIPT_ID}`;

/** Ví dụ issue #104 đã chuyển sang khu QC HCM-QCA01: thùng …001 (1.000), …002 (980), 3.010 lẻ. */
function inQc(overrides: Partial<ReceiptLineDto> = {}): ReceiptLineDto {
  return cartonLine({
    lotNumber: "L01",
    qcProgress: "IN_QC_AREA",
    qcLocationCode: "HCM-QCA01",
    movedToQcAt: "2026-10-09T02:15:00Z",
    packages: [
      cartonPackage({ status: "IN_STOCK", locationCode: "HCM-QCA01" }),
      cartonPackage({
        id: "c0000000-0000-4000-8000-000000000002",
        lpn: "LPN-20261024-000002",
        quantity: 980,
        receivedQty: 980,
        status: "IN_STOCK",
        locationCode: "HCM-QCA01",
      }),
    ],
    ...overrides,
  });
}

function renderQc(line: ReceiptLineDto, inspect: (body: unknown) => unknown) {
  const receipt = apiReceipt({ status: "IN_QC", lines: [line] });
  const spies = mockReceiptApi(
    ROLES.qcStaff,
    { [PATH]: () => receipt },
    { [`${PATH}/lines/${line.id}/inspection`]: (_p, body) => inspect(body) },
  );
  renderReceiptScreen(<ReceiptDetail id={RECEIPT_ID} />);
  return spies;
}

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  label: string,
  value: string,
) {
  const input = within(dialog).getByLabelText(label);
  await user.clear(input);
  await user.type(input, value);
}

describe("Kết luận QC theo nguyên thùng (issue #104 §2, BR-08)", () => {
  // Nhiều ô phải gõ — nới thời gian cho máy CI chậm
  it(
    "ví dụ issue: thùng …002 cách ly + 3 lẻ, 2 lẻ không đạt → body như BE yêu cầu",
    { timeout: 15_000 },
    async () => {
      const user = userEvent.setup();
      const line = inQc();
      const { post } = renderQc(line, () => apiReceipt({ status: "IN_QC", lines: [line] }));
      await user.click(await screen.findByRole("button", { name: "Kết luận QC" }));
      const dialog = await screen.findByRole("dialog");

      // Mặc định mọi thùng Đạt, phần lẻ Đạt = 3.010
      expect(
        within(dialog).getByRole("radio", { name: L.qcChoice("Đạt", "LPN-20261024-000001") }),
      ).toBeChecked();
      expect(within(dialog).getByLabelText(L.qcLooseAccepted)).toHaveValue(3010);

      await user.click(
        within(dialog).getByRole("radio", { name: L.qcChoice("Cách ly", "LPN-20261024-000002") }),
      );
      await fill(user, dialog, L.qcLooseAccepted, "3005");
      await fill(user, dialog, "SL lẻ cách ly", "3");
      await fill(user, dialog, "Khu cách ly", "HCM-QC01");
      await fill(user, dialog, "Lý do cách ly", "Dented");
      await fill(user, dialog, "SL lẻ không đạt", "2");
      await fill(user, dialog, "Khu không đạt", "HCM-RTV01");
      await fill(user, dialog, "Lý do không đạt", "Torn");
      expect(within(dialog).getByText("Tổng: 4990 / 4990")).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Kết luận QC" }));

      await waitFor(() => expect(post).toHaveBeenCalled());
      expect(post.mock.calls[0]?.[1]).toEqual({
        accepted: 4005,
        quarantined: {
          quantity: 3,
          packages: ["LPN-20261024-000002"],
          locationCode: "HCM-QC01",
          reason: "Dented",
        },
        rejected: { quantity: 2, packages: [], locationCode: "HCM-RTV01", reason: "Torn" },
      });
    },
  );

  it("thùng không còn ở khu QC: không chọn được, tính là Đạt", async () => {
    const user = userEvent.setup();
    const line = inQc({
      packages: [cartonPackage({ status: "IN_STOCK", locationCode: "HCM-A01-L1-B01" })],
      quantity: 1000 + 3010,
    });
    renderQc(line, () => apiReceipt());
    await user.click(await screen.findByRole("button", { name: "Kết luận QC" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("radio", { name: L.qcChoice("Cách ly", "LPN-20261024-000001") }),
    ).toBeDisabled();
    expect(within(dialog).getByText(L.qcCartonAway("HCM-A01-L1-B01"))).toBeInTheDocument();
  });

  it("BE báo thùng không ở khu QC (STOCK_PACKAGE_WRONG_LOCATION) → lỗi hiện ở đúng thùng", async () => {
    const user = userEvent.setup();
    const line = inQc();
    renderQc(line, () => {
      throw new ApiError(
        422,
        "STOCK_PACKAGE_WRONG_LOCATION",
        "LPN-…002 is at HCM-QC01",
        {
          "quarantined.packages[0]": "LPN-20261024-000002 is at HCM-QC01",
        },
        undefined,
        { "quarantined.packages[0]": "STOCK_PACKAGE_WRONG_LOCATION" },
      );
    });
    await user.click(await screen.findByRole("button", { name: "Kết luận QC" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("radio", { name: L.qcChoice("Cách ly", "LPN-20261024-000002") }),
    );
    await fill(user, dialog, L.qcLooseAccepted, "3010");
    await fill(user, dialog, "Khu cách ly", "HCM-QC01");
    await fill(user, dialog, "Lý do cách ly", "Dented");
    await user.click(within(dialog).getByRole("button", { name: "Kết luận QC" }));
    expect(
      await within(dialog).findByText(/Thùng không còn nằm ở khu QC của dòng/, {
        selector: "[id^='qc-carton-']",
      }),
    ).toBeInTheDocument();
  });
});

describe("Kết luận QC sau khi phiếu tải lại", () => {
  it("BE báo thùng đã rời khu QC → phiếu tải lại, dialog dùng vị trí mới: thùng không chọn được nữa", async () => {
    const user = userEvent.setup();
    const line = inQc();
    let current = apiReceipt({ status: "IN_QC", lines: [line] });
    mockReceiptApi(
      ROLES.qcStaff,
      { [PATH]: () => current },
      {
        [`${PATH}/lines/${line.id}/inspection`]: () => {
          // Thùng …002 đã bị chuyển tay sang khu cách ly trước khi kết luận tới BE
          current = apiReceipt({
            status: "IN_QC",
            lines: [
              inQc({
                packages: [
                  cartonPackage({ status: "IN_STOCK", locationCode: "HCM-QCA01" }),
                  cartonPackage({
                    id: "c0000000-0000-4000-8000-000000000002",
                    lpn: "LPN-20261024-000002",
                    quantity: 980,
                    receivedQty: 980,
                    status: "IN_STOCK",
                    locationCode: "HCM-QC01",
                  }),
                ],
              }),
            ],
          });
          throw new ApiError(
            422,
            "STOCK_PACKAGE_WRONG_LOCATION",
            "LPN-20261024-000002 is at HCM-QC01",
          );
        },
      },
    );
    renderReceiptScreen(<ReceiptDetail id={RECEIPT_ID} />);
    await user.click(await screen.findByRole("button", { name: "Kết luận QC" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("radio", { name: L.qcChoice("Cách ly", "LPN-20261024-000002") }),
    );
    await fill(user, dialog, L.qcLooseAccepted, "3010");
    await fill(user, dialog, "Khu cách ly", "HCM-QC01");
    await fill(user, dialog, "Lý do cách ly", "Dented");
    await user.click(within(dialog).getByRole("button", { name: "Kết luận QC" }));

    expect(await within(dialog).findByText(L.qcCartonAway("HCM-QC01"))).toBeInTheDocument();
    expect(
      within(dialog).getByRole("radio", { name: L.qcChoice("Cách ly", "LPN-20261024-000002") }),
    ).toBeDisabled();
  });
});
