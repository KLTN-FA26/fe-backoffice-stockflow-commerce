import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { TRANSFER_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  TRANSFER_ROLE_PERMISSIONS as ROLES,
  mockTransferApi,
  renderTransferScreen,
} from "../__fixtures__/render";
import { TRANSFER_ID, apiTransfer, warehouses } from "../__fixtures__/transfer";
import { TransferEdit } from "./TransferEdit";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

// jsdom không có scrollIntoView (form cuộn tới lỗi máy chủ)
beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});
afterEach(() => vi.restoreAllMocks());

const PATH = `/inventory/transfer-orders/${TRANSFER_ID}`;
const L = UI_LABELS.transfer;

describe("TransferEdit — lệnh bị sửa ở nơi khác", () => {
  it("lưu gặp OPTIMISTIC_LOCK → nạp bản mới, báo rõ thay đổi chưa lưu đã bị bỏ", async () => {
    const user = userEvent.setup();
    let version = 3;
    const { put } = mockTransferApi(
      ROLES.inventoryPlanner,
      { [PATH]: () => apiTransfer({ version }), "/warehouses": () => warehouses },
      {},
      {
        [PATH]: () => {
          // Người khác vừa lưu → BE tăng version, lần lưu này bị từ chối
          version = 4;
          throw new ApiError(409, "OPTIMISTIC_LOCK", "stale");
        },
      },
    );
    renderTransferScreen(<TransferEdit id={TRANSFER_ID} />);

    await user.click(await screen.findByRole("button", { name: L.action.save }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0]?.[1]).toMatchObject({ version: 3 });

    expect(await screen.findByText(L.reloadedNotice)).toBeInTheDocument();
    // Form đã dựng lại theo bản mới → lỗi của form cũ không còn
    expect(screen.queryByText(TRANSFER_ERROR_MESSAGES.OPTIMISTIC_LOCK)).not.toBeInTheDocument();
  });
});
