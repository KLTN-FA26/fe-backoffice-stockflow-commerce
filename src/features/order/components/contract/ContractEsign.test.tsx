import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SALES_CONTRACT_PERMISSIONS } from "@/constants";
import {
  CONTRACT_ESIGN_LABELS as L,
  CONTRACT_ESIGN_PERMISSIONS as P,
} from "@/constants/contract-esign";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { renderWithProviders } from "@/test/render";

import { contractDraft } from "../../__fixtures__/contract";
import { contractEsignActions } from "../../sales-contract-esign-rules";
import { toContractForm } from "../../sales-contract-form";
import { salesContractDtoSchema } from "../../sales-contract-schemas";

import { ContractEsignActions } from "./ContractEsignActions";
import { ContractInspectionBadges } from "./ContractSignaturePanel";
import { ContractTermsEditor } from "./ContractTermsEditor";
import { ContractTermsSummary } from "./ContractTermsSummary";

import type { ContractFormOutput, ContractFormValues } from "../../sales-contract-form";

const draft = salesContractDtoSchema.parse({
  ...contractDraft,
  termsReview: "NONE",
  standardTerms: { penaltyPercent: 8, quantityTolerancePercent: 5, warrantyMonths: 6 },
});
afterEach(() => vi.restoreAllMocks());

function Editor() {
  const form = useForm<ContractFormValues, unknown, ContractFormOutput>({
    defaultValues: toContractForm(draft, []),
  });
  return <ContractTermsEditor form={form} standardTerms={draft.standardTerms} />;
}

describe("Contract terms and signing controls", () => {
  it("compares numeric edits to configured defaults including zero", async () => {
    renderWithProviders(<Editor />);
    const input = screen.getByLabelText(L.penaltyPercent);
    await userEvent.type(input, "8");
    expect(screen.queryByText(L.nonstandard)).not.toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, "0");
    expect(screen.getByText(L.nonstandard)).toBeInTheDocument();
    await userEvent.clear(input);
    expect(screen.queryByText(L.nonstandard)).not.toBeInTheDocument();
  });
  it("shows effective defaults while preserving a zero override", () => {
    renderWithProviders(<ContractTermsSummary contract={{ ...draft, penaltyPercent: 0 }} />);
    for (const value of ["0", "5", "6"]) expect(screen.getByText(value)).toBeInTheDocument();
    expect(screen.queryByText(L.default)).not.toBeInTheDocument();
  });
  it.each(["UNREADABLE", "FUTURE_KIND", undefined])(
    "rejects unreadable and unknown inspections (%s)",
    (kind) => {
      renderWithProviders(
        <ContractInspectionBadges inspection={{ kind, valid: true, matchesSentDocument: true }} />,
      );
      expect(screen.getByText("Không đọc được chữ ký số")).toBeInTheDocument();
      expect(screen.queryByText(L.valid)).not.toBeInTheDocument();
      expect(screen.queryByText(L.matches)).not.toBeInTheDocument();
    },
  );
  it("shows the counter and marks special terms and shows the configured numeric defaults", async () => {
    renderWithProviders(<Editor />);
    await userEvent.type(screen.getByLabelText(L.specialTerms), "Riêng");
    expect(screen.getByText("5 / 4000")).toBeInTheDocument();
    expect(screen.getByText(L.nonstandard)).toBeInTheDocument();
    for (const value of ["8", "5", "6"])
      expect(screen.getByPlaceholderText(value)).toBeInTheDocument();
    expect(screen.getByLabelText(L.sellerSignerName)).toHaveAttribute("maxLength", "300");
  });
  it("gates independent approval and signature permissions for three permission sets", () => {
    const pending = { ...draft, termsReview: "PENDING" as const };
    expect(
      contractEsignActions(pending, (code) => code === SALES_CONTRACT_PERMISSIONS.read),
    ).toEqual([]);
    expect(
      contractEsignActions(pending, (code) => code === SALES_CONTRACT_PERMISSIONS.update),
    ).toEqual(["withdraw"]);
    expect(contractEsignActions(pending, (code) => code === P.terms)).toEqual([
      "approve",
      "reject",
    ]);
    expect(
      contractEsignActions({ ...draft, status: "CUSTOMER_SIGNED" }, (code) => code === P.signature),
    ).toEqual(["companySign", "upload"]);
    for (const status of ["SIGNED", "COMPLETED", "LIQUIDATED", "CANCELLED", "UNKNOWN"] as const)
      expect(contractEsignActions({ ...draft, status }, () => true)).toEqual([]);
  });
  it("requires a note before rejecting and sends it with the displayed version", async () => {
    const request = vi
      .spyOn(api, "request")
      .mockResolvedValue({ data: { ...draft, termsReview: "REJECTED" } });
    renderWithProviders(
      <ContractEsignActions
        contract={{ ...draft, termsReview: "PENDING" }}
        can={(code) => code === P.terms}
        ownerBlocked={null}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: L.reject }));
    const confirm = screen.getAllByRole("button", { name: L.reject }).at(-1);
    if (!confirm) throw new Error("Missing confirmation button");
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Lý do từ chối/), "Cần sửa điều khoản");
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: `/orders/${draft.orderId}/contract/terms-review/rejection`,
          data: { version: draft.version, note: "Cần sửa điều khoản" },
        }),
      ),
    );
  });
  it("hides an unsupported write action without changing the contract", async () => {
    vi.spyOn(api, "request").mockRejectedValue(new ApiError(405, "HTTP", "English message"));
    renderWithProviders(
      <ContractEsignActions
        contract={{ ...draft, specialTerms: "Điều khoản riêng" }}
        can={() => true}
        ownerBlocked={null}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: L.review }));
    const confirm = screen.getAllByRole("button", { name: L.review }).at(-1);
    if (!confirm) throw new Error("Missing confirmation button");
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: L.review })).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("English message")).not.toBeInTheDocument();
  });
  it("keeps company signing available when the sales-owner write gate blocks staff actions", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { testCertificate: true, subject: draft.seller.name },
    });
    renderWithProviders(
      <ContractEsignActions
        contract={{
          ...draft,
          status: "CUSTOMER_SIGNED",
          sellerSigner: { name: "Người ký", title: "Giám đốc" },
        }}
        can={(code) => code === P.signature}
        ownerBlocked="Khách thuộc Sale khác"
      />,
    );
    const button = screen.getByRole("button", { name: L.companySign });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(screen.getByLabelText(L.sellerSignerName)).toHaveValue("Người ký");
    expect(await screen.findByText(L.testWarning)).toBeInTheDocument();
    expect(screen.getByText(L.fourEyes)).toBeInTheDocument();
  });
  it("shows inspection limitations alongside valid signature evidence", () => {
    renderWithProviders(
      <ContractInspectionBadges
        inspection={{
          kind: "DIGITAL",
          valid: true,
          matchesSentDocument: true,
          chainChecked: false,
        }}
      />,
    );
    expect(screen.getByText(L.valid)).toBeInTheDocument();
    expect(screen.getByText(L.matches)).toBeInTheDocument();
    expect(screen.getByText(L.chain)).toBeInTheDocument();
  });
});
