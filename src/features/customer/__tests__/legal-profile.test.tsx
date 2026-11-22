import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, mockApi, renderScreen } from "@/test/api-screen";

import { LegalProfileCard } from "../components/detail/LegalProfileCard";

const CUSTOMER = "c-1";
const PATH = `/customers/${CUSTOMER}/legal-profile`;

const profile = {
  customerId: CUSTOMER,
  companyName: "Công ty Bao Bì Xanh",
  taxCode: "0312345678",
  registeredAddress: "12 Nguyễn Huệ, Quận 1",
  representativeName: "Nguyễn Văn An",
  representativeTitle: "Giám đốc",
  version: 3,
};

function notFound() {
  throw apiError(404, "LEGAL_PROFILE_NOT_FOUND");
}

function renderCard(searchParams = "") {
  renderScreen(
    <LegalProfileCard customerId={CUSTOMER} canRead canUpdate />,
    "SALES_STAFF",
    searchParams,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("LegalProfileCard", () => {
  it("GET 404 LEGAL_PROFILE_NOT_FOUND → Chưa có thông tin pháp lý + nút Nhập", async () => {
    mockApi("SALES_STAFF", { get: { [PATH]: notFound } });
    renderCard();
    expect(await screen.findByText(/Chưa có thông tin pháp lý/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nhập thông tin pháp lý" })).toBeInTheDocument();
  });

  it("shows the saved profile with a Sửa button", async () => {
    mockApi("SALES_STAFF", { get: { [PATH]: () => profile } });
    renderCard();
    expect(await screen.findByText("12 Nguyễn Huệ, Quận 1")).toBeInTheDocument();
    expect(screen.getByText("Dùng email liên hệ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sửa/ })).toBeInTheDocument();
  });

  it("opens the dialog by itself when the URL has ?legalProfile=edit", async () => {
    mockApi("SALES_STAFF", { get: { [PATH]: notFound } });
    renderCard("?legalProfile=edit");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/Địa chỉ đăng ký kinh doanh/)).toBeInTheDocument();
  });

  it("lưu lần đầu gửi version null và đúng body (không có tài khoản ngân hàng)", async () => {
    const api = mockApi("SALES_STAFF", {
      get: { [PATH]: notFound },
      put: { [PATH]: () => profile },
    });
    renderCard("?legalProfile=edit");
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByLabelText(/Địa chỉ đăng ký kinh doanh/),
      "12 Nguyễn Huệ, Quận 1",
    );
    await userEvent.type(
      within(dialog).getByLabelText(/Người đại diện theo pháp luật/),
      "Nguyễn Văn An",
    );
    await userEvent.type(within(dialog).getByLabelText(/Chức vụ/), "Giám đốc");
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledWith(PATH, {
      registeredAddress: "12 Nguyễn Huệ, Quận 1",
      representativeName: "Nguyễn Văn An",
      representativeTitle: "Giám đốc",
      version: null,
    });
  });

  it("có số tài khoản mà trống Ngân hàng → lỗi tại ô, không gọi PUT", async () => {
    const api = mockApi("SALES_STAFF", { get: { [PATH]: () => profile }, put: {} });
    renderCard("?legalProfile=edit");
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Số tài khoản"), "0123 456.789");
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
    expect(await within(dialog).findByText("Nhập ngân hàng")).toBeInTheDocument();
    expect(within(dialog).getByText("Nhập chủ tài khoản")).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  it("BE-8: 400 with fieldErrors marks every wrong field at once, bank fields come back as bankAccount.*", async () => {
    mockApi("SALES_STAFF", {
      get: { [PATH]: () => profile },
      put: {
        [PATH]: () => {
          throw apiError(400, "VALIDATION_FAILED", {
            registeredAddress: "Địa chỉ không được để trống.",
            "bankAccount.bankName": "Ngân hàng không được để trống.",
            invoiceEmail: "Email hoá đơn không đúng định dạng.",
          });
        },
      },
    });
    renderCard("?legalProfile=edit");
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
    expect(await within(dialog).findByText("Địa chỉ không được để trống.")).toBeInTheDocument();
    expect(within(dialog).getByText("Ngân hàng không được để trống.")).toBeInTheDocument();
    expect(within(dialog).getByText("Email hoá đơn không đúng định dạng.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Ngân hàng")).toHaveAttribute("aria-invalid", "true");
  });

  it("BE-8: a field the form does not have is said in the general line, beside the marked fields", async () => {
    mockApi("SALES_STAFF", {
      get: { [PATH]: () => profile },
      put: {
        [PATH]: () => {
          throw apiError(400, "VALIDATION_FAILED", {
            registeredAddress: "Địa chỉ không được để trống.",
            taxCode: "Mã số thuế không hợp lệ.",
          });
        },
      },
    });
    renderCard("?legalProfile=edit");
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
    expect(await within(dialog).findByText("Địa chỉ không được để trống.")).toBeInTheDocument();
    expect(within(dialog).getByText("Mã số thuế không hợp lệ.")).toBeInTheDocument();
  });

  it("BE-8: only fields the form does not have → their messages, not 'check the fields'", async () => {
    mockApi("SALES_STAFF", {
      get: { [PATH]: () => profile },
      put: {
        [PATH]: () => {
          throw apiError(400, "VALIDATION_FAILED", { taxCode: "Mã số thuế không hợp lệ." });
        },
      },
    });
    renderCard("?legalProfile=edit");
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
    expect(await within(dialog).findByText("Mã số thuế không hợp lệ.")).toBeInTheDocument();
    expect(within(dialog).queryByText(/kiểm tra lại các ô/)).not.toBeInTheDocument();
  });

  it("409 OPTIMISTIC_LOCK → đã tải lại: câu 'đã tải lại' và GET được gọi lại", async () => {
    const api = mockApi("SALES_STAFF", {
      get: { [PATH]: () => profile },
      put: {
        [PATH]: () => {
          throw apiError(409, "OPTIMISTIC_LOCK");
        },
      },
    });
    renderCard("?legalProfile=edit");
    const dialog = await screen.findByRole("dialog");
    const gets = () => api.get.mock.calls.filter(([url]) => url === PATH).length;
    expect(gets()).toBe(1);
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
    expect(
      await within(dialog).findByText("Thông tin pháp lý vừa được người khác sửa, đã tải lại."),
    ).toBeInTheDocument();
    await waitFor(() => expect(gets()).toBe(2));
    expect(api.put).toHaveBeenCalledWith(PATH, expect.objectContaining({ version: 3 }));
  });

  it("after a 409 the stale form cannot overwrite the newer profile: retry waits for the reload", async () => {
    let current = { ...profile };
    const api = mockApi("SALES_STAFF", {
      get: { [PATH]: () => current },
      put: {
        [PATH]: (_params, body) => {
          if ((body as { version: number }).version !== current.version)
            throw apiError(409, "OPTIMISTIC_LOCK");
          return current;
        },
      },
    });
    renderCard("?legalProfile=edit");
    const dialog = await screen.findByRole("dialog");
    const address = within(dialog).getByLabelText(/Địa chỉ đăng ký kinh doanh/);
    await userEvent.clear(address);
    await userEvent.type(address, "Địa chỉ cũ của tôi");
    // Someone else saves first: version 4 with a different address.
    current = { ...profile, version: 4, registeredAddress: "Địa chỉ mới của người khác" };
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
    expect(await within(dialog).findByText(/Người khác vừa lưu/)).toBeInTheDocument();
    // The save is blocked: the old values must not go out under the new version.
    expect(within(dialog).getByRole("button", { name: "Lưu" })).toBeDisabled();
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put).toHaveBeenLastCalledWith(PATH, expect.objectContaining({ version: 3 }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Tải lại theo bản mới" }));
    expect(within(dialog).getByLabelText(/Địa chỉ đăng ký kinh doanh/)).toHaveValue(
      "Địa chỉ mới của người khác",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
    expect(api.put).toHaveBeenLastCalledWith(
      PATH,
      expect.objectContaining({ version: 4, registeredAddress: "Địa chỉ mới của người khác" }),
    );
  });
});
