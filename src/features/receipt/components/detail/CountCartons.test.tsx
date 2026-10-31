import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import {
  PO_ID,
  RECEIPT_ID,
  apiReceipt,
  cartonLine,
  receivablePo,
} from "../../__fixtures__/receipt";
import {
  RECEIPT_ROLE_PERMISSIONS as ROLES,
  mockReceiptApi,
  renderReceiptScreen,
} from "../../__fixtures__/render";
import { ReceiptDetail } from "../ReceiptDetail";

import type { GoodsReceiptApiDto } from "../../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const PATH = `/goods-receipts/${RECEIPT_ID}`;

function renderDraft(receipt: GoodsReceiptApiDto, onPut: (body: unknown) => unknown) {
  const spies = mockReceiptApi(
    ROLES.warehouseManager,
    { [PATH]: () => receipt, [`/purchase-orders/${PO_ID}`]: () => receivablePo },
    {},
    { [`${PATH}/lines`]: (_p, body) => onPut(body) },
  );
  renderReceiptScreen(<ReceiptDetail id={RECEIPT_ID} />);
  return spies;
}

describe("Lưu lại kiểm đếm giữ nguyên thùng (BE spec SCRUM-473 §3 rule 6: thùng không gửi lên = VOID)", () => {
  it("chỉ sửa ghi chú rồi lưu → body vẫn gửi đủ LPN + SL + đơn vị của dòng", async () => {
    const user = userEvent.setup();
    const receipt = apiReceipt({ lines: [cartonLine({ lotNumber: "L01" })] });
    const { put } = renderDraft(receipt, () => receipt);

    await user.click(await screen.findByRole("button", { name: /Sửa kiểm đếm/ }));
    await user.type(await screen.findByLabelText("Ghi chú dòng 1"), "móp góc");
    await user.click(screen.getByRole("button", { name: /Lưu kiểm đếm/ }));

    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0]?.[1]).toEqual({
      lines: [
        expect.objectContaining({
          quantity: 4990,
          lotNumber: "L01",
          note: "móp góc",
          unitOfMeasure: "CARTON",
          packages: [
            { lpn: "LPN-20261024-000001", quantity: 1000 },
            { lpn: "LPN-20261024-000002", quantity: 980 },
          ],
        }),
      ],
    });
  });

  it("lưu lỗi mạng rồi bấm lưu lại cùng nội dung → cùng Idempotency-Key (không cấp LPN hai lần)", async () => {
    const user = userEvent.setup();
    const receipt = apiReceipt({ lines: [cartonLine({ lotNumber: "L01" })] });
    let calls = 0;
    const { put } = renderDraft(receipt, () => {
      calls += 1;
      if (calls === 1) throw new ApiError(0, "NETWORK_ERROR", "offline");
      return receipt;
    });

    await user.click(await screen.findByRole("button", { name: /Sửa kiểm đếm/ }));
    await user.type(await screen.findByLabelText("Ghi chú dòng 1"), "x");
    const save = screen.getByRole("button", { name: /Lưu kiểm đếm/ });
    await user.click(save);
    expect(await screen.findByText(/Không kết nối được máy chủ/)).toBeInTheDocument();
    await user.click(save);

    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    const keyOf = (call: number) =>
      (put.mock.calls[call]?.[2] as { headers?: Record<string, string> } | undefined)?.headers?.[
        "Idempotency-Key"
      ];
    expect(keyOf(0)).toEqual(expect.any(String));
    expect(keyOf(1)).toBe(keyOf(0));
  });
});
