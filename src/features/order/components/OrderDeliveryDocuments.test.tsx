import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ORDER_DELIVERY_DOCUMENT_PERMISSIONS, UI_LABELS } from "@/constants";

import { apiOrder } from "../__fixtures__/order";
import { ORDER_PERMISSION_SETS, mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { OrderDetail } from "./OrderDetail";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const D = UI_LABELS.shipping.afterHandover.documents;
const DETAIL_PATH = `/orders/${apiOrder.orderId}`;
const DOCS_PATH = `/fulfillment/orders/${apiOrder.orderId}/delivery-documents`;

const documents = [
  {
    shipmentId: "shp-1",
    shipmentCode: "SO-1-S1",
    status: "DELIVERED",
    podFiles: [
      {
        fileId: "pod-1",
        fileName: "bien-ban.pdf",
        contentType: "application/pdf",
        sizeBytes: 10,
        uploadedAt: "2026-11-20T02:00:00Z",
      },
    ],
    vehicles: [
      {
        loadId: "ld-1",
        loadCode: "LD-1",
        waybillNo: "WB-1",
        waybillFiles: [
          {
            fileId: "wb-1",
            fileName: "van-don.pdf",
            contentType: "application/pdf",
            sizeBytes: 10,
            uploadedAt: "2026-11-19T02:00:00Z",
          },
        ],
      },
    ],
  },
];

async function renderDetail(permissions: readonly PermissionCode[]) {
  const get = mockOrderApiGet(permissions, {
    [DETAIL_PATH]: () => apiOrder,
    [DOCS_PATH]: () => documents,
    [`${DOCS_PATH}/pod-files/pod-1/download-url`]: () => ({ url: "https://files.example/pod" }),
    [`${DOCS_PATH}/waybill-files/wb-1/download-url`]: () => ({ url: "https://files.example/wb" }),
  });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
  return get;
}

describe("OrderDetail — file vận đơn & POD cho Sale (docs 09 §2, §7)", () => {
  it("Sale có quyền: thấy POD và file vận đơn của từng lô, bấm tải lấy link mới mỗi lần và mở tab mới", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const get = await renderDetail([
      ...ORDER_PERMISSION_SETS.salesStaff,
      ORDER_DELIVERY_DOCUMENT_PERMISSIONS.read,
    ]);
    const card = await screen.findByRole("region", { name: D.title });
    expect(within(card).getByText("bien-ban.pdf")).toBeInTheDocument();
    expect(within(card).getByText("van-don.pdf")).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: `${D.download} bien-ban.pdf` }));
    expect(open).toHaveBeenCalledWith("https://files.example/pod", "_blank", "noopener,noreferrer");
    await user.click(within(card).getByRole("button", { name: `${D.download} van-don.pdf` }));
    expect(open).toHaveBeenCalledWith("https://files.example/wb", "_blank", "noopener,noreferrer");
    expect(get.mock.calls.filter(([url]) => String(url).endsWith("/download-url"))).toHaveLength(2);
  });

  it("không có quyền: không thấy thẻ, không gọi API file", async () => {
    const get = await renderDetail(ORDER_PERMISSION_SETS.salesStaff);
    await screen.findAllByText(apiOrder.orderNumber);
    expect(screen.queryByRole("region", { name: D.title })).not.toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === DOCS_PATH)).toBe(false);
  });
});
