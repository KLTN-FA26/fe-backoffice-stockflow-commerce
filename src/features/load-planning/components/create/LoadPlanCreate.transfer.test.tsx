import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_ROUTES,
  LOAD_PLAN_ERROR_MESSAGES,
  LOAD_PLAN_FIELD_MESSAGES,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useAppStore } from "@/lib/store/use-app-store";

import {
  PLAN_ID,
  TRANSFER_NUMBER,
  TRANSFER_ORDER_ID,
  VEHICLE_TYPE_ID,
  WAREHOUSE_ID,
  candidateFixture,
  transferCandidateFixture,
  transferPlanFixture,
} from "../../__fixtures__/plans";
import {
  LOAD_PLAN_ACTORS as ACTORS,
  mockLoadPlanApi,
  renderLoadPlanScreen,
} from "../../__fixtures__/render-plan";
import { clearCreatePlanRequestId } from "../../request-ids";
import { LoadPlanCreate } from "./LoadPlanCreate";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const L = UI_LABELS.loadPlan.createForm;
const T = UI_LABELS.loadPlan.transfer;
const PATH = "/fulfillment/load-plans";
const CANDIDATES = "/fulfillment/load-plan-candidates";

const vehicleType = {
  vehicleTypeId: VEHICLE_TYPE_ID,
  code: "PICKUP",
  name: "Pickup truck",
  kind: "PICKUP",
  innerLengthMm: 1500,
  innerWidthMm: 1140,
  innerHeightMm: 500,
  maxPayloadKg: 800,
  availableCount: 10,
  status: "ACTIVE",
};

beforeEach(() => {
  clearCreatePlanRequestId();
  window.sessionStorage.clear();
  useAppStore.setState({ warehouseId: WAREHOUSE_ID });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  push.mockClear();
  useAppStore.setState({ warehouseId: null });
});

/** Ứng viên theo nguồn: BE nhận `sourceType=TRANSFER` để trả lệnh chuyển kho, không có thì trả lô giao. */
function candidatesFor(transfers = [transferCandidateFixture()]): (params: unknown) => unknown {
  return (params) =>
    (params as { sourceType?: string }).sourceType === "TRANSFER"
      ? transfers
      : [candidateFixture()];
}

function renderCreate(
  options: { search?: string; transfers?: ReturnType<typeof transferCandidateFixture>[] } = {},
) {
  const spies = mockLoadPlanApi(ACTORS.dispatcher, {
    get: {
      [CANDIDATES]: candidatesFor(options.transfers),
      "/fulfillment/vehicle-types": () => ({
        items: [vehicleType],
        page: 0,
        size: 100,
        totalElements: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      }),
    },
    post: {
      [PATH]: () => transferPlanFixture({ status: "DRAFT", version: 0, vehicles: [] }),
      [`${PATH}/${PLAN_ID}/calculation`]: () => transferPlanFixture({ version: 5 }),
    },
  });
  renderLoadPlanScreen(<LoadPlanCreate />, options.search);
  return spies;
}

const candidateCalls = (get: { mock: { calls: unknown[][] } }) =>
  get.mock.calls
    .filter(([url]) => url === CANDIDATES)
    .map(([, config]) => (config as { params: object }).params);

describe("LoadPlanCreate — nguồn lệnh chuyển kho (LP-9, BE PR #164)", () => {
  it("mặc định nguồn là đơn khách; chuyển sang 'Lệnh chuyển kho' thì hỏi ứng viên với sourceType=TRANSFER và chỉ hiện lệnh", async () => {
    const user = userEvent.setup();
    const { get } = renderCreate();
    expect(await screen.findByText(candidateFixture().code)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Đơn hàng" })).toBeChecked();
    expect(
      candidateCalls(get).every((p) => !("sourceType" in p) || p.sourceType === undefined),
    ).toBe(true);

    await user.click(screen.getByRole("radio", { name: "Lệnh chuyển kho" }));
    expect(await screen.findByText(TRANSFER_NUMBER)).toBeInTheDocument();
    expect(screen.queryByText(candidateFixture().code)).not.toBeInTheDocument();
    expect(screen.getByText(T.transfersTitle)).toBeInTheDocument();
    expect(candidateCalls(get)).toContainEqual(
      expect.objectContaining({ warehouseId: WAREHOUSE_ID, sourceType: "TRANSFER" }),
    );
    // Kho đích tra từ danh mục kho
    const row = screen
      .getByRole("radio", { name: `${T.transferNumber} ${TRANSFER_NUMBER}` })
      .closest("tr") as HTMLElement;
    expect(await within(row).findByText("HCM · Kho TP.HCM")).toBeInTheDocument();
  });

  it("chọn một lệnh + loại xe → POST {sourceType: TRANSFER, transferOrderIds: [một lệnh]} KHÔNG có shipmentIds, rồi tính xếp xe và mở chi tiết", async () => {
    const user = userEvent.setup();
    const { post } = renderCreate();
    await user.click(await screen.findByRole("radio", { name: "Lệnh chuyển kho" }));
    await user.click(
      await screen.findByRole("radio", { name: `${T.transferNumber} ${TRANSFER_NUMBER}` }),
    );
    await user.click(await screen.findByRole("checkbox", { name: /PICKUP/ }));
    await user.click(screen.getByRole("button", { name: L.submit }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(ADMIN_ROUTES.loadPlans.detail(PLAN_ID)));
    const [createUrl, body] = post.mock.calls[0];
    expect(createUrl).toBe(PATH);
    expect(body).toEqual({
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      warehouseId: WAREHOUSE_ID,
      sourceType: "TRANSFER",
      transferOrderIds: [TRANSFER_ORDER_ID],
      vehicleTypeIds: [VEHICLE_TYPE_ID],
      selectionMode: "SINGLE_TYPE",
      note: undefined,
    });
    expect(body).not.toHaveProperty("shipmentIds");
    expect(post.mock.calls[1][0]).toBe(`${PATH}/${PLAN_ID}/calculation`);
  });

  it("mỗi kế hoạch một lệnh: chọn lệnh thứ hai thay lệnh thứ nhất (radio)", async () => {
    const user = userEvent.setup();
    const second = transferCandidateFixture({
      transferOrderId: "other-to",
      code: "TO-20261022-0002",
    });
    const { post } = renderCreate({ transfers: [transferCandidateFixture(), second] });
    await user.click(await screen.findByRole("radio", { name: "Lệnh chuyển kho" }));
    const first = await screen.findByRole("radio", {
      name: `${T.transferNumber} ${TRANSFER_NUMBER}`,
    });
    const other = screen.getByRole("radio", { name: `${T.transferNumber} TO-20261022-0002` });
    await user.click(first);
    await user.click(other);
    expect(first).not.toBeChecked();
    expect(other).toBeChecked();
    await user.click(await screen.findByRole("checkbox", { name: /PICKUP/ }));
    await user.click(screen.getByRole("button", { name: L.submit }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toMatchObject({ transferOrderIds: ["other-to"] });
  });

  it("chưa chọn lệnh → báo ngay trong form, không gọi BE", async () => {
    const user = userEvent.setup();
    const { post } = renderCreate();
    await user.click(await screen.findByRole("radio", { name: "Lệnh chuyển kho" }));
    await screen.findByText(TRANSFER_NUMBER);
    await user.click(await screen.findByRole("checkbox", { name: /PICKUP/ }));
    await user.click(screen.getByRole("button", { name: L.submit }));
    expect(await screen.findByText(LOAD_PLAN_FIELD_MESSAGES.transferRequired)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("lựa chọn của hai nguồn giữ riêng: lô đã tick ở nguồn đơn không bị gửi khi lập kế hoạch lệnh", async () => {
    const user = userEvent.setup();
    const { post } = renderCreate();
    await user.click(
      await screen.findByRole("checkbox", { name: `${L.shipmentCode} ${candidateFixture().code}` }),
    );
    await user.click(screen.getByRole("radio", { name: "Lệnh chuyển kho" }));
    await user.click(
      await screen.findByRole("radio", { name: `${T.transferNumber} ${TRANSFER_NUMBER}` }),
    );
    await user.click(await screen.findByRole("checkbox", { name: /PICKUP/ }));
    await user.click(screen.getByRole("button", { name: L.submit }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).not.toHaveProperty("shipmentIds");
  });

  it("mở từ 'Lập kế hoạch xe' (?sourceType=TRANSFER&transferOrderId&warehouseId): nguồn, kho và lệnh chọn sẵn", async () => {
    const user = userEvent.setup();
    useAppStore.setState({ warehouseId: null });
    const { post, get } = renderCreate({
      search: `?sourceType=TRANSFER&transferOrderId=${TRANSFER_ORDER_ID}&warehouseId=${WAREHOUSE_ID}`,
    });
    expect(await screen.findByRole("radio", { name: "Lệnh chuyển kho" })).toBeChecked();
    expect(
      await screen.findByRole("radio", { name: `${T.transferNumber} ${TRANSFER_NUMBER}` }),
    ).toBeChecked();
    expect(candidateCalls(get)).toContainEqual(
      expect.objectContaining({ warehouseId: WAREHOUSE_ID, sourceType: "TRANSFER" }),
    );
    await user.click(await screen.findByRole("checkbox", { name: /PICKUP/ }));
    await user.click(screen.getByRole("button", { name: L.submit }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toMatchObject({
      warehouseId: WAREHOUSE_ID,
      sourceType: "TRANSFER",
      transferOrderIds: [TRANSFER_ORDER_ID],
    });
  });

  it("lệnh chọn sẵn không còn là ứng viên (đã có kế hoạch khác / chưa đóng gói): cảnh báo, không gửi id mồ côi", async () => {
    const user = userEvent.setup();
    const { post } = renderCreate({
      transfers: [],
      search: `?sourceType=TRANSFER&transferOrderId=${TRANSFER_ORDER_ID}&warehouseId=${WAREHOUSE_ID}`,
    });
    expect(await screen.findByText(T.preselectedGone)).toBeInTheDocument();
    expect(screen.getByText(T.transfersEmpty)).toBeInTheDocument();
    await user.click(await screen.findByRole("checkbox", { name: /PICKUP/ }));
    await user.click(screen.getByRole("button", { name: L.submit }));
    expect(await screen.findByText(LOAD_PLAN_FIELD_MESSAGES.transferRequired)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("kho chưa chọn: nhắc chọn kho thay vì danh sách lệnh; đổi kho bỏ lệnh đã chọn", async () => {
    useAppStore.setState({ warehouseId: null });
    renderCreate();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: "Lệnh chuyển kho" }));
    expect(await screen.findByText(T.pickWarehouseFirst)).toBeInTheDocument();
  });

  it("BE từ chối bằng mã mới → câu tiếng Việt: LOAD_PLAN_SOURCE_MISMATCH, TRANSFER_NOT_PACKED", async () => {
    const user = userEvent.setup();
    const { post } = renderCreate();
    await user.click(await screen.findByRole("radio", { name: "Lệnh chuyển kho" }));
    await user.click(
      await screen.findByRole("radio", { name: `${T.transferNumber} ${TRANSFER_NUMBER}` }),
    );
    await user.click(await screen.findByRole("checkbox", { name: /PICKUP/ }));
    post.mockRejectedValueOnce(new ApiError(409, "LOAD_PLAN_SOURCE_MISMATCH", "mix"));
    await user.click(screen.getByRole("button", { name: L.submit }));
    expect(
      await screen.findByText(LOAD_PLAN_ERROR_MESSAGES.LOAD_PLAN_SOURCE_MISMATCH),
    ).toBeInTheDocument();
    post.mockRejectedValueOnce(new ApiError(409, "TRANSFER_NOT_PACKED", "not packed"));
    await user.click(screen.getByRole("button", { name: L.submit }));
    expect(
      await screen.findByText(LOAD_PLAN_ERROR_MESSAGES.TRANSFER_NOT_PACKED),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("gửi lại sau mất phản hồi dùng CÙNG requestId (dấu vân tay có nguồn + lệnh), và khác với kế hoạch đơn khách", async () => {
    const user = userEvent.setup();
    const { post } = renderCreate();
    await user.click(await screen.findByRole("radio", { name: "Lệnh chuyển kho" }));
    await user.click(
      await screen.findByRole("radio", { name: `${T.transferNumber} ${TRANSFER_NUMBER}` }),
    );
    await user.click(await screen.findByRole("checkbox", { name: /PICKUP/ }));
    post.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "offline"));
    await user.click(screen.getByRole("button", { name: L.submit }));
    expect(await screen.findByText(L.errorTitle)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: L.submit }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const ids = post.mock.calls
      .filter(([url]) => url === PATH)
      .map(([, body]) => (body as { requestId: string }).requestId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });
});
