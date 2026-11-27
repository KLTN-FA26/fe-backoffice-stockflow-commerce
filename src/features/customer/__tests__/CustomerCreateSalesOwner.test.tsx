import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, mockApi, renderScreen } from "@/test/api-screen";
import { pickOption } from "@/test/ui-actions";
import {
  SALES_OWNER_MANAGE as MANAGE,
  SALES_OWNER_READ as READ,
  salesAgent,
} from "@/test/sales-owner-screen";
import "@/test/jsdom-popover";

import { CustomerCreate } from "../components/CustomerCreate";

import type { PermissionCode } from "@/lib/auth";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));

afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
});

/** Sales Manager theo HOP-DONG-API: tạo khách + giao người phụ trách. */
const MANAGER: PermissionCode[] = ["customer-customers:CREATE", READ, MANAGE];
const SUBMIT = /Tạo khách và gửi lời mời/;

const created = {
  customer: {
    customerId: "c-9",
    fullName: "Quán Cà Phê Nhỏ",
    email: "an@example.com",
    status: "PENDING_ACTIVATION",
    version: 0,
    createdAt: "2026-10-14T02:00:00Z",
  },
  invitation: {
    issuedAt: "2026-10-14T02:00:00Z",
    expiresAt: "2026-10-17T02:00:00Z",
    delivery: "SENT",
  },
};

async function fillRequired() {
  await userEvent.type(await screen.findByLabelText(/Tên công ty/), "Quán Cà Phê Nhỏ");
  await userEvent.type(screen.getByLabelText(/Họ tên/), "Nguyễn An");
  await userEvent.type(screen.getByLabelText(/^Email/), "an@example.com");
}

describe("Tạo khách — MST bắt buộc (KE-HOACH BR-S14, D4)", () => {
  it("BR-S14: no tax code → field error, nothing is posted", async () => {
    const api = mockApi("SALES_STAFF", { post: { "/customers": () => created } });
    renderScreen(<CustomerCreate />, "SALES_STAFF");
    await fillRequired();
    await userEvent.click(screen.getByRole("button", { name: SUBMIT }));
    expect(
      await screen.findByText("Nhập mã số thuế (hộ kinh doanh: số CCCD của chủ hộ)."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Mã số thuế/)).toHaveAttribute("aria-invalid", "true");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("BR-S14: a Sales does not see the manager's exemption", async () => {
    mockApi("SALES_STAFF", {}, { extra: [READ] });
    renderScreen(<CustomerCreate />, "SALES_STAFF");
    await screen.findByLabelText(/Tên công ty/);
    expect(screen.queryByText("Miễn MST (hộ kinh doanh / ngoại lệ)")).not.toBeInTheDocument();
    // BR-S02: Sale tạo thì chính họ phụ trách.
    expect(screen.getByText("Bạn sẽ là Sale phụ trách của khách này.")).toBeInTheDocument();
  });

  it("BR-S14: BE 400 CUSTOMER_TAX_CODE_REQUIRED → message on the tax code field", async () => {
    mockApi("SALES_STAFF", {
      post: {
        "/customers": () => {
          throw apiError(400, "CUSTOMER_TAX_CODE_REQUIRED");
        },
      },
    });
    renderScreen(<CustomerCreate />, "SALES_STAFF");
    await fillRequired();
    await userEvent.type(screen.getByLabelText(/Mã số thuế/), "0312345678");
    await userEvent.click(screen.getByRole("button", { name: SUBMIT }));
    expect(
      await screen.findByText("Nhập mã số thuế (hộ kinh doanh: số CCCD của chủ hộ)."),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("BR-S14: a Sales Manager exempts the tax code with a required reason", async () => {
    const api = mockApi(
      "SALES_MANAGER",
      {
        get: { "/customers/sales-agents": () => [salesAgent("s-1", "Trần Văn Sales")] },
        post: { "/customers": () => created },
      },
      { extra: MANAGER },
    );
    renderScreen(<CustomerCreate />, "SALES_MANAGER");
    await fillRequired();
    await pickOption(
      userEvent.setup(),
      await screen.findByRole("combobox", { name: /Người phụ trách/ }),
      "Trần Văn Sales",
    );
    await userEvent.click(screen.getByRole("checkbox", { name: /Miễn MST/ }));
    await userEvent.click(screen.getByRole("button", { name: SUBMIT }));
    expect(await screen.findByText("Nhập lý do miễn MST")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/Lý do miễn MST/), "Hộ kinh doanh chưa có MST");
    await userEvent.click(screen.getByRole("button", { name: SUBMIT }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/customers", {
        companyName: "Quán Cà Phê Nhỏ",
        contactName: "Nguyễn An",
        email: "an@example.com",
        taxCodeExemption: true,
        taxCodeExemptionReason: "Hộ kinh doanh chưa có MST",
        salesOwnerId: "s-1",
      }),
    );
  });
});

describe("Tạo khách — cảnh báo khách trùng (BR-S14, tình huống 16)", () => {
  it("BR-S14: a match on email shows who owns that customer, with a link", async () => {
    const api = mockApi(
      "SALES_STAFF",
      {
        get: {
          "/customers/duplicates": () => [
            {
              customerId: "c-1",
              fullName: "Quán Cà Phê Nhỏ (cũ)",
              matchedOn: ["email", "name"],
              salesOwnerName: "Trần Văn Sales",
            },
          ],
        },
      },
      { extra: [READ] },
    );
    renderScreen(<CustomerCreate />, "SALES_STAFF");
    await fillRequired();
    const panel = within(await screen.findByRole("region", { name: "Có thể đã có khách này" }));
    expect(panel.getByRole("link", { name: "Quán Cà Phê Nhỏ (cũ)" })).toHaveAttribute(
      "href",
      "/admin/customers/c-1",
    );
    expect(panel.getByText(/Trùng email, tên · do Trần Văn Sales phụ trách/)).toBeInTheDocument();
    // Debounce: sau khi gõ xong, một lần hỏi mang đủ các ô đã nhập.
    await waitFor(() => {
      const call = api.get.mock.calls.findLast(([url]) => url === "/customers/duplicates");
      expect((call?.[1] as { params: Record<string, string> }).params).toEqual({
        email: "an@example.com",
        name: "Quán Cà Phê Nhỏ",
      });
    });
  });

  it("fallback: the duplicates endpoint is missing → no panel, the form still submits", async () => {
    mockApi("SALES_STAFF", {
      get: {
        "/customers/duplicates": () => {
          throw apiError(404, "NOT_FOUND");
        },
      },
      post: { "/customers": () => created },
    });
    renderScreen(<CustomerCreate />, "SALES_STAFF");
    await fillRequired();
    await userEvent.type(screen.getByLabelText(/Mã số thuế/), "0312345678");
    await userEvent.click(screen.getByRole("button", { name: SUBMIT }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/customers/c-9"));
    expect(screen.queryByRole("region", { name: "Có thể đã có khách này" })).toBeNull();
  });
});

describe("Tạo khách — người phụ trách và khách tiềm năng (BR-S02, §10.7)", () => {
  it("§10.7: prefilled from the lead link; leadId is posted and the owner comes from the lead", async () => {
    const api = mockApi(
      "SALES_MANAGER",
      { get: { "/customers/sales-agents": () => [] }, post: { "/customers": () => created } },
      { extra: MANAGER },
    );
    renderScreen(
      <CustomerCreate />,
      "SALES_MANAGER",
      "?companyName=Qu%C3%A1n%20C%C3%A0%20Ph%C3%AA%20Nh%E1%BB%8F&taxCode=0312345678&contactName=Nguy%E1%BB%85n%20An&email=an%40example.com&leadId=lead-7",
    );
    expect(await screen.findByLabelText(/Tên công ty/)).toHaveValue("Quán Cà Phê Nhỏ");
    expect(screen.getByLabelText(/Mã số thuế/)).toHaveValue("0312345678");
    expect(
      screen.getByText(
        "Tạo từ khách tiềm năng — người phụ trách là Sale được giao khách tiềm năng đó.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Người phụ trách/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: SUBMIT }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/customers", {
        companyName: "Quán Cà Phê Nhỏ",
        contactName: "Nguyễn An",
        email: "an@example.com",
        taxCode: "0312345678",
        leadId: "lead-7",
      }),
    );
  });

  it("BR-S02: a Sales Manager picks the owner (required, 2026-11-28)", async () => {
    const api = mockApi(
      "SALES_MANAGER",
      {
        get: {
          "/customers/sales-agents": () => [
            salesAgent("s-1", "Trần Văn Sales"),
            salesAgent("s-2", "Lê Thị B"),
          ],
        },
        post: { "/customers": () => created },
      },
      { extra: MANAGER },
    );
    renderScreen(<CustomerCreate />, "SALES_MANAGER");
    await fillRequired();
    await userEvent.type(screen.getByLabelText(/Mã số thuế/), "0312345678");
    const picker = await screen.findByRole("combobox", { name: /Người phụ trách/ });
    expect(screen.getByText("Người phụ trách").closest("label")).toHaveTextContent("(bắt buộc)");
    await pickOption(userEvent.setup(), picker, "Trần Văn Sales");
    await userEvent.click(screen.getByRole("button", { name: SUBMIT }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/customers",
        expect.objectContaining({ salesOwnerId: "s-1" }),
      ),
    );
  });

  it("2026-11-28: the manager must pick an owner — empty → field error, nothing is posted", async () => {
    const api = mockApi(
      "SALES_MANAGER",
      {
        get: { "/customers/sales-agents": () => [salesAgent("s-1", "Trần Văn Sales")] },
        post: { "/customers": () => created },
      },
      { extra: MANAGER },
    );
    renderScreen(<CustomerCreate />, "SALES_MANAGER");
    await fillRequired();
    await userEvent.type(screen.getByLabelText(/Mã số thuế/), "0312345678");
    const picker = await screen.findByRole("combobox", { name: /Người phụ trách/ });
    expect(screen.queryByRole("option", { name: /Để trống/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: SUBMIT }));
    expect(await screen.findByText("Chọn Sale phụ trách khách này.")).toBeInTheDocument();
    expect(picker).toHaveAttribute("aria-invalid", "true");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("2026-11-28: BE 400 SALES_OWNER_REQUIRED → message on the owner field", async () => {
    mockApi(
      "SALES_MANAGER",
      {
        get: { "/customers/sales-agents": () => [salesAgent("s-1", "Trần Văn Sales")] },
        post: {
          "/customers": () => {
            throw apiError(400, "SALES_OWNER_REQUIRED");
          },
        },
      },
      { extra: MANAGER },
    );
    renderScreen(<CustomerCreate />, "SALES_MANAGER");
    await fillRequired();
    await userEvent.type(screen.getByLabelText(/Mã số thuế/), "0312345678");
    const picker = await screen.findByRole("combobox", { name: /Người phụ trách/ });
    await pickOption(userEvent.setup(), picker, "Trần Văn Sales");
    await userEvent.click(screen.getByRole("button", { name: SUBMIT }));
    expect(await screen.findByText("Chọn Sale phụ trách khách này.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Người phụ trách/ })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("2026-11-28: the Sales list cannot load → the manager is told, nothing is posted", async () => {
    const api = mockApi(
      "SALES_MANAGER",
      {
        get: {
          "/customers/sales-agents": () => {
            throw apiError(500, "INTERNAL_ERROR");
          },
        },
        post: { "/customers": () => created },
      },
      { extra: MANAGER },
    );
    renderScreen(<CustomerCreate />, "SALES_MANAGER");
    await fillRequired();
    await userEvent.type(screen.getByLabelText(/Mã số thuế/), "0312345678");
    expect(
      await screen.findByText(
        "Chưa tải được danh sách Sale. Tải lại trang để chọn người phụ trách.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: SUBMIT }));
    expect(await screen.findByText("Chọn Sale phụ trách khách này.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("D42 dự phòng: sales-agents 404 → người trả lời chat, bỏ chính quản lý đang tạo", async () => {
    mockApi(
      "SALES_MANAGER",
      {
        get: {
          "/customers/sales-agents": () => {
            throw apiError(404, "NOT_FOUND");
          },
          "/chat/agents": () => [
            { userId: "s-1", name: "Trần Văn Sales", online: true },
            { userId: "u-test", name: "Quản lý đang tạo", online: true },
          ],
        },
        post: { "/customers": () => created },
      },
      { extra: MANAGER },
    );
    renderScreen(<CustomerCreate />, "SALES_MANAGER");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("combobox", { name: /Người phụ trách/ }));
    expect(await screen.findByRole("option", { name: "Trần Văn Sales" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Quản lý đang tạo" })).toBeNull();
  });
});
