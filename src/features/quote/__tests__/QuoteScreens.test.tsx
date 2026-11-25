import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/shared/Toast";
import { useBreadcrumbLabelStore } from "@/lib/store/use-breadcrumb-labels";
import { apiError, bePage, mockApi, renderScreen } from "@/test/api-screen";

import { QuoteCreate, QuoteDetail, QuoteEdit, QuoteList } from "..";
import {
  CUSTOMER,
  CUSTOMER_ID,
  ORDER_ID,
  QUOTE_ACCEPTED,
  QUOTE_DRAFT_PLATE_UNPRICED,
  QUOTE_ID,
  QUOTE_ROW,
  SKU,
} from "../__fixtures__/quote-ds02";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(`customerId=${CUSTOMER_ID}`),
}));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

const detailUrl = `/quotes/${QUOTE_ID}`;
const priced = {
  ...QUOTE_DRAFT_PLATE_UNPRICED,
  fees: QUOTE_ACCEPTED.fees,
  priced: true,
  proposed: QUOTE_ACCEPTED.proposed,
};

const revisionDraft = {
  ...QUOTE_DRAFT_PLATE_UNPRICED,
  revision: 2,
  sentAt: "2099-11-12T06:00:00Z",
  history: [
    { revision: 1, toStatus: "DRAFT", changedAt: "2099-11-12T03:00:00Z" },
    { revision: 1, fromStatus: "DRAFT", toStatus: "SENT", changedAt: "2099-11-12T06:00:00Z" },
    {
      revision: 1,
      fromStatus: "SENT",
      toStatus: "CHANGES_REQUESTED",
      reason: "Giảm giá 5%",
      changedAt: "2099-11-13T03:00:00Z",
    },
    {
      revision: 2,
      fromStatus: "CHANGES_REQUESTED",
      toStatus: "DRAFT",
      changedAt: "2099-11-14T03:00:00Z",
    },
  ],
};

describe("Quote list", () => {
  it("real rows, Vietnamese status, status filter as repeated params (page 0-based)", async () => {
    const api = mockApi("SALES_STAFF", {
      get: { "/quotes": () => bePage([QUOTE_ROW]), [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER },
    });
    renderScreen(<QuoteList />, "SALES_STAFF", "?status=CONVERTED");
    expect(await screen.findByRole("link", { name: "QT-20261120-9001" })).toHaveAttribute(
      "href",
      detailUrl.replace("/quotes", "/admin/quotes"),
    );
    expect(await screen.findAllByText("Đã tạo đơn")).not.toHaveLength(0);
    const call = api.get.mock.calls.find((c) => c[0] === "/quotes")?.[1] as {
      params: URLSearchParams;
    };
    expect(call.params.getAll("status")).toEqual(["CONVERTED"]);
    expect(call.params.get("page")).toBe("0");
  });
});

describe("Quote detail", () => {
  it("TC-F03-02: shows BE line total, fee and total with tax", async () => {
    mockApi("SALES_STAFF", {
      get: { [detailUrl]: () => QUOTE_ACCEPTED, [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    const table = await screen.findByRole("table", { name: "Các dòng của báo giá" });
    expect(within(table).getByText(SKU)).toBeInTheDocument();
    expect(within(table).getAllByText(/69\.000\.000/)).not.toHaveLength(0);
    expect(screen.getAllByText(/1\.500\.000/)).not.toHaveLength(0);
    expect(screen.getByText(/77\.550\.000/)).toBeInTheDocument();
  });

  it.each([{ fees: 0 }, {}])(
    "báo giá có dòng chưa giá vẫn mở được (proposed %j)",
    async (proposed) => {
      mockApi("SALES_STAFF", {
        get: {
          [detailUrl]: () => ({ ...QUOTE_DRAFT_PLATE_UNPRICED, proposed }),
          [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        },
      });
      renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
      expect(await screen.findByText(/Chưa đủ giá/)).toBeInTheDocument();
      expect(screen.queryByText(/Dữ liệu trả về không đúng định dạng/)).not.toBeInTheDocument();
    },
  );

  it("DRAFT with an unpriced plate fee: send is blocked with the reason", async () => {
    mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => QUOTE_DRAFT_PLATE_UNPRICED,
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
      },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    expect(await screen.findByRole("button", { name: /Gửi khách/ })).toBeDisabled();
    expect(screen.getByText("Chưa nhập phí khuôn — sửa báo giá để nhập")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo đơn" })).not.toBeInTheDocument();
  });

  it("DRAFT send posts {version}; a BE refusal shows its Vietnamese message", async () => {
    const message = "Báo giá QT-20261120-9001 đã hết hiệu lực.";
    const api = mockApi("SALES_STAFF", {
      get: { [detailUrl]: () => priced, [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER },
      post: {
        [`${detailUrl}/sending`]: () => {
          throw apiError(409, "QUOTE_EXPIRED", undefined, message);
        },
      },
    });
    const toastError = vi.spyOn(toast, "error");
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    await userEvent.click(await screen.findByRole("button", { name: /Gửi khách/ }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Gửi khách" }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`${detailUrl}/sending`, { version: 0 }),
    );
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(message));
  });

  it("LC-3: cancelling a draft warns that a quote request it came from will close", async () => {
    mockApi("SALES_STAFF", {
      get: { [detailUrl]: () => priced, [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    await userEvent.click(await screen.findByRole("button", { name: "Huỷ báo giá" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(
        /Nếu nháp này lập từ yêu cầu báo giá của khách, huỷ sẽ đóng yêu cầu đó\. Chỉ sai giá hay số thùng thì sửa nháp thay vì huỷ\./,
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Huỷ báo giá" })).toBeDisabled();
  });

  it("stale version (409 OPTIMISTIC_LOCK) → 'đã tải lại' and refetch", async () => {
    const api = mockApi("SALES_STAFF", {
      get: { [detailUrl]: () => priced, [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER },
      post: {
        [`${detailUrl}/sending`]: () => {
          throw apiError(409, "OPTIMISTIC_LOCK");
        },
      },
    });
    const toastError = vi.spyOn(toast, "error");
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    await userEvent.click(await screen.findByRole("button", { name: /Gửi khách/ }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Gửi khách" }),
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Dữ liệu vừa thay đổi, đã tải lại."),
    );
    await waitFor(() =>
      expect(api.get.mock.calls.filter((c) => c[0] === detailUrl).length).toBeGreaterThan(1),
    );
  });

  it("TC-F04-01: ACCEPTED → Tạo đơn posts conversion and goes to the order's contract", async () => {
    const converted = {
      ...QUOTE_ACCEPTED,
      status: "CONVERTED",
      version: 3,
      convertedOrder: {
        orderId: ORDER_ID,
        orderNumber: "SO-20261120-900001",
        status: "DRAFT",
        total: 77550000,
      },
    };
    const api = mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => QUOTE_ACCEPTED,
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        [`/customers/${CUSTOMER_ID}/addresses`]: () => [],
      },
      post: { [`${detailUrl}/conversion`]: () => converted },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    await userEvent.click(await screen.findByRole("button", { name: "Tạo đơn" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Đơn chưa giữ hàng; bước tiếp theo là lập hợp đồng/),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Tạo đơn" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`${detailUrl}/conversion`, { version: 2 }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/orders/${ORDER_ID}#contract`));
  });
  it("SKU_NOT_SELLABLE khi tạo đơn: câu BE hiện đúng một lần, không nối thêm câu của FE", async () => {
    const message =
      "Báo giá QT-20261120-9001 có SKU không còn bán (LY-X): huỷ báo giá kèm lý do rồi lập báo giá mới.";
    mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => QUOTE_ACCEPTED,
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        [`/customers/${CUSTOMER_ID}/addresses`]: () => [],
      },
      post: {
        [`${detailUrl}/conversion`]: () => {
          throw apiError(409, "SKU_NOT_SELLABLE", undefined, message);
        },
      },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    await userEvent.click(await screen.findByRole("button", { name: "Tạo đơn" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Tạo đơn" }));
    await within(dialog).findByText(/lập báo giá mới/);
    expect(within(dialog).getAllByText(/lập báo giá mới/)).toHaveLength(1);
    expect(dialog.textContent).not.toContain("Huỷ báo giá (ghi lý do)");
  });

  it.each([
    ["every line PURCHASABLE", ["PURCHASABLE"], false],
    ["lines without purchasability (old data)", [undefined], false],
    ["one line no longer sold", ["PURCHASABLE", "PRODUCT_INACTIVE"], true],
  ])("BE-14: ACCEPTED shows the SKU cancel button only when %s", async (_name, values, shown) => {
    const line = QUOTE_ACCEPTED.lines[0]!;
    mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => ({
          ...QUOTE_ACCEPTED,
          lines: values.map((purchasability, index) => ({
            ...line,
            id: `line-${index}`,
            lineNo: index + 1,
            purchasability,
          })),
        }),
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
      },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    await screen.findByRole("button", { name: "Tạo đơn" });
    expect(screen.queryByRole("button", { name: "Huỷ báo giá đã chấp nhận" }) !== null).toBe(shown);
  });

  it.each([
    ["ACTIVE", false],
    ["BLOCKED", true],
    ["INACTIVE", true],
  ])("LC-2: ACCEPTED, every SKU sold, customer %s → cancel button %s", async (status, shown) => {
    mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => QUOTE_ACCEPTED,
        [`/customers/${CUSTOMER_ID}`]: () => ({ ...CUSTOMER, status }),
      },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    await screen.findByRole("button", { name: "Tạo đơn" });
    await screen.findByText(CUSTOMER.fullName);
    expect(screen.queryByRole("button", { name: "Huỷ báo giá đã chấp nhận" }) !== null).toBe(shown);
  });

  it("LC-2: the cancel dialog of an accepted quote names both reasons and needs a reason", async () => {
    mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => QUOTE_ACCEPTED,
        [`/customers/${CUSTOMER_ID}`]: () => ({ ...CUSTOMER, status: "BLOCKED" }),
      },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    await userEvent.click(await screen.findByRole("button", { name: "Huỷ báo giá đã chấp nhận" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/khách không còn hoạt động/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Huỷ báo giá" })).toBeDisabled();
  });

  it("QD-16: an accepted legacy quote cannot become an order but can be cancelled, even for an ACTIVE customer", async () => {
    mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => ({ ...QUOTE_ACCEPTED, legacy: true }),
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
      },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    expect(await screen.findByText(/huỷ báo giá này rồi lập báo giá mới/)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Huỷ báo giá đã chấp nhận" }));
    expect(screen.queryByRole("button", { name: "Tạo đơn" })).not.toBeInTheDocument();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Báo giá cũ .* không tạo đơn được/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Huỷ báo giá" })).toBeDisabled();
  });

  it("DRAFT có dòng chưa có nhóm thuế: chặn gửi và nêu dòng", async () => {
    const line = { ...priced.lines[0], taxClass: undefined, taxRate: undefined };
    mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => ({ ...priced, lines: [line] }),
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
      },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    expect(await screen.findByRole("button", { name: /Gửi khách/ })).toBeDisabled();
    expect(screen.getByText(/Dòng 1 .*chưa có nhóm thuế/)).toBeInTheDocument();
  });

  it("bản nháp sửa hiện 'Khách yêu cầu sửa' lấy từ lịch sử (BE đã xoá customerFeedback)", async () => {
    mockApi("SALES_STAFF", {
      get: { [detailUrl]: () => revisionDraft, [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF");
    expect(await screen.findByText(/Khách yêu cầu sửa/)).toBeInTheDocument();
    expect(screen.getByText(/Khách yêu cầu sửa/).parentElement).toHaveTextContent("Giảm giá 5%");
  });
});

describe("Quote form", () => {
  it("lists only ACTIVE customer SKUs and fills tiers from the suggested price", async () => {
    mockApi("SALES_STAFF", {
      get: {
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        "/customer-skus": () => [
          {
            variantId: "v1",
            productId: "p1",
            sku: SKU,
            name: "Ly 12oz xanh",
            ownerCustomerId: CUSTOMER_ID,
            status: "ACTIVE",
          },
          {
            variantId: "v2",
            productId: "p1",
            sku: "LY-CU",
            ownerCustomerId: CUSTOMER_ID,
            status: "OBSOLETE",
          },
        ],
        [`/catalog/customer-prices/${CUSTOMER_ID}/${SKU}`]: () => ({
          customerId: CUSTOMER_ID,
          sku: SKU,
          measure: "CARTON",
          moq: 20,
          tiers: QUOTE_ACCEPTED.lines[0]?.tiers ?? [],
          version: 1,
        }),
      },
    });
    renderScreen(<QuoteCreate />, "SALES_STAFF");
    const select = await screen.findByLabelText(/SKU riêng của khách/);
    expect(within(select).queryByRole("option", { name: /LY-CU/ })).not.toBeInTheDocument();
    await within(select).findByRole("option", { name: new RegExp(SKU) });
    await userEvent.selectOptions(select, SKU);
    await userEvent.click(await screen.findByRole("button", { name: /Dùng giá gợi ý/ }));
    expect(screen.getByLabelText("Đơn giá ₫ một cái (bậc 2)")).toHaveValue("1.150");
    expect(
      screen.getByText((_, el) => el?.tagName === "SPAN" && el.textContent === "MOQ: 20 thùng"),
    ).toBeInTheDocument();
  });

  it("WF-02 audit: editing a draft shows the line's SKU and names the quote in the breadcrumb", async () => {
    let releaseSkus: (value: unknown) => void = () => undefined;
    const skus = new Promise((resolve) => {
      releaseSkus = resolve;
    });
    mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => QUOTE_DRAFT_PLATE_UNPRICED,
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        // The SKU list arrives after the form: the select must still show the line's SKU.
        "/customer-skus": () => skus,
        [`/catalog/customer-prices/${CUSTOMER_ID}/${SKU}`]: () => ({
          customerId: CUSTOMER_ID,
          sku: SKU,
          measure: "CARTON",
          moq: 20,
          tiers: QUOTE_ACCEPTED.lines[0]?.tiers ?? [],
          version: 1,
        }),
      },
    });
    renderScreen(<QuoteEdit id={QUOTE_ID} />, "SALES_STAFF");
    const select = await screen.findByLabelText(/SKU riêng của khách/);
    expect(select).toHaveValue(SKU);
    releaseSkus([
      {
        variantId: "v1",
        productId: "p1",
        sku: SKU,
        name: "Ly 12oz xanh",
        ownerCustomerId: CUSTOMER_ID,
        status: "ACTIVE",
      },
    ]);
    await within(select).findByRole("option", { name: /Ly 12oz xanh/ });
    expect(select).toHaveValue(SKU);
    expect(useBreadcrumbLabelStore.getState().labels[QUOTE_ID]).toBe(
      QUOTE_DRAFT_PLATE_UNPRICED.quoteNumber,
    );
  });
  it("WF-02 A3: the form previews goods, fees, tax by the saved rates and the total with tax", async () => {
    mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => QUOTE_DRAFT_PLATE_UNPRICED,
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        "/customer-skus": () => [
          {
            variantId: "v1",
            productId: "p1",
            sku: SKU,
            name: "Ly 12oz xanh",
            ownerCustomerId: CUSTOMER_ID,
            status: "ACTIVE",
          },
        ],
        [`/catalog/customer-prices/${CUSTOMER_ID}/${SKU}`]: () => null,
      },
    });
    renderScreen(<QuoteEdit id={QUOTE_ID} />, "SALES_STAFF");
    const preview = (await screen.findByRole("heading", { name: "Tạm tính báo giá" })).closest(
      "div",
    ) as HTMLElement;
    // 60 thùng × 1.000 cái × 1.150 ₫; phí khuôn chưa nhập; thuế 10% theo dòng đã lưu.
    expect(within(preview).getByText(/69\.000\.000/)).toBeInTheDocument();
    expect(within(preview).getByText(/6\.900\.000/)).toBeInTheDocument();
    expect(within(preview).getByText(/75\.900\.000/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Phí khuôn \/ bản in/), "1500000");
    // + 1.500.000 phí và 150.000 thuế của phí (thuế suất phí đã lưu).
    expect(await within(preview).findByText(/77\.550\.000/)).toBeInTheDocument();
    expect(within(preview).getByText(/7\.050\.000/)).toBeInTheDocument();
  });
  it("trang sửa bản nháp sửa hiện 'Khách yêu cầu sửa' và nội dung", async () => {
    mockApi("SALES_STAFF", {
      get: {
        [detailUrl]: () => revisionDraft,
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        "/customer-skus": () => [],
      },
    });
    renderScreen(<QuoteEdit id={QUOTE_ID} />, "SALES_STAFF");
    expect(await screen.findByText(/Khách yêu cầu sửa/)).toBeInTheDocument();
    expect(screen.getByText("Giảm giá 5%")).toBeInTheDocument();
  });

  it("đã bấm lưu một lần, giá riêng về sau → lỗi dưới MOQ hiện ngay, không đợi lần lưu sau", async () => {
    let releasePrice: (value: unknown) => void = () => undefined;
    mockApi("SALES_STAFF", {
      get: {
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        "/customer-skus": () => [
          {
            variantId: "v1",
            productId: "p1",
            sku: SKU,
            name: "Ly 12oz xanh",
            ownerCustomerId: CUSTOMER_ID,
            status: "ACTIVE",
          },
        ],
        [`/catalog/customer-prices/${CUSTOMER_ID}/${SKU}`]: () =>
          new Promise((resolve) => {
            releasePrice = resolve;
          }),
      },
    });
    renderScreen(<QuoteCreate />, "SALES_STAFF");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Lưu nháp" })); // submitted once
    const select = await screen.findByLabelText(/SKU riêng của khách/);
    await within(select).findByRole("option", { name: new RegExp(SKU) });
    await user.selectOptions(select, SKU);
    await user.type(screen.getByLabelText(/Số thùng/), "5");
    expect(screen.queryAllByText(/nhập bậc giá đã thoả thuận/)).toHaveLength(0);
    releasePrice({
      customerId: CUSTOMER_ID,
      sku: SKU,
      measure: "CARTON",
      moq: 20,
      tiers: QUOTE_ACCEPTED.lines[0]?.tiers ?? [],
      version: 1,
    });
    expect(await screen.findAllByText(/nhập bậc giá đã thoả thuận/)).not.toHaveLength(0);
  });

  it("một dòng thêm sau lần bấm lưu đầu không bị báo lỗi khi vừa hiện", async () => {
    mockApi("SALES_STAFF", {
      get: {
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        "/customer-skus": () => [
          {
            variantId: "v1",
            productId: "p1",
            sku: SKU,
            name: "Ly 12oz xanh",
            ownerCustomerId: CUSTOMER_ID,
            status: "ACTIVE",
          },
        ],
      },
    });
    renderScreen(<QuoteCreate />, "SALES_STAFF");
    const user = userEvent.setup();
    const select = await screen.findByLabelText(/SKU riêng của khách/); // the customer is chosen
    await within(select).findByRole("option", { name: new RegExp(SKU) });
    await user.click(screen.getByRole("button", { name: "Lưu nháp" })); // submitted once
    // The tiers error of the form schema (no customer price nor standard price → at least one tier), on line 1.
    const TIERS_ERROR =
      "Chưa có giá riêng của khách lẫn giá chuẩn cho SKU này — nhập ít nhất một bậc giá";
    const before = screen.queryAllByText(TIERS_ERROR).length;
    expect(before).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Thêm dòng/ }));
    expect(await screen.findByText("Dòng 2")).toBeInTheDocument();
    // The new line adds no tiers error of its own.
    expect(screen.queryAllByText(TIERS_ERROR)).toHaveLength(before);
  });

  it("dưới MOQ của giá riêng, để trống bậc giá → lỗi tại dòng, không gọi API", async () => {
    const api = mockApi("SALES_STAFF", {
      get: {
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
        "/customer-skus": () => [
          {
            variantId: "v1",
            productId: "p1",
            sku: SKU,
            name: "Ly 12oz xanh",
            ownerCustomerId: CUSTOMER_ID,
            status: "ACTIVE",
          },
        ],
        [`/catalog/customer-prices/${CUSTOMER_ID}/${SKU}`]: () => ({
          customerId: CUSTOMER_ID,
          sku: SKU,
          measure: "CARTON",
          moq: 20,
          tiers: QUOTE_ACCEPTED.lines[0]?.tiers ?? [],
          version: 1,
        }),
      },
    });
    renderScreen(<QuoteCreate />, "SALES_STAFF");
    const select = await screen.findByLabelText(/SKU riêng của khách/);
    await within(select).findByRole("option", { name: new RegExp(SKU) });
    await userEvent.selectOptions(select, SKU);
    await userEvent.type(screen.getByLabelText(/Số thùng/), "5");
    expect(await screen.findByText(/Dưới mức tối thiểu 20 thùng của bảng giá/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Lưu nháp" }));
    expect(await screen.findAllByText(/nhập bậc giá/)).not.toHaveLength(0);
    expect(api.post).not.toHaveBeenCalled();
  });
});
