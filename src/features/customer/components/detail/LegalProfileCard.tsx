"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { useLegalProfile } from "@/features/customer/queries";
import { DetailPanel, Fact, FactGrid } from "@/components/shared/DetailPanel";
import { Notice } from "@/components/shared/Notice";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import { LegalProfileDialog } from "./LegalProfileDialog";

import type { Customer, LegalProfile } from "@/features/customer/types";

const MONO = "font-[family-name:var(--font-mono)] tabular-nums";
/** Neo của thẻ — trang đơn dẫn tới `?legalProfile=edit#legal-profile`. */
const LEGAL_PROFILE_ANCHOR = "legal-profile";

const same = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toLocaleLowerCase("vi") === b.trim().toLocaleLowerCase("vi");

/**
 * Dòng của hồ sơ pháp lý. Tên công ty / mã số thuế trùng tên và MST của khách (đã ở đầu trang và khung hồ sơ) thì không
 * lặp lại (UI/UX bo-30); khác thì hiện, vì hợp đồng và hoá đơn in theo bản pháp lý.
 */
function rowsOf(profile: LegalProfile, customer?: Pick<Customer, "fullName" | "taxCode">) {
  const bank = profile.bankAccount;
  return [
    ...(same(profile.companyName, customer?.fullName)
      ? []
      : [{ label: "Tên công ty", value: profile.companyName }]),
    ...(profile.taxCode && same(profile.taxCode, customer?.taxCode)
      ? []
      : [
          {
            label: "Mã số thuế",
            value: profile.taxCode ? <span className={MONO}>{profile.taxCode}</span> : "Chưa có",
          },
        ]),
    { label: "Địa chỉ đăng ký kinh doanh", value: profile.registeredAddress },
    { label: "Người đại diện", value: profile.representativeName },
    { label: "Chức vụ", value: profile.representativeTitle },
    {
      label: "Email nhận hoá đơn",
      value: profile.invoiceEmail ? (
        <span className="break-all">{profile.invoiceEmail}</span>
      ) : (
        "Dùng email liên hệ"
      ),
    },
    {
      label: "Tài khoản ngân hàng",
      value: bank ? (
        <span>
          <span className={MONO}>{bank.accountNumber}</span> · {bank.bankName} ·{" "}
          {bank.accountHolder}
        </span>
      ) : (
        "Chưa có"
      ),
    },
  ];
}

/**
 * "Thông tin pháp lý" của khách (BE `customer-legal-profiles`): cần trước khi lập hợp đồng. Hộp thoại nhập / sửa mở theo
 * URL `?legalProfile=edit` (state-persistence): nút ở đây và link từ trang đơn cùng một đường.
 */
export function LegalProfileCard({
  customerId,
  customer,
  canRead,
  canUpdate,
}: {
  customerId: string;
  /** Tên và MST đang hiện ở đầu trang — dòng pháp lý trùng thì bỏ. */
  customer?: Pick<Customer, "fullName" | "taxCode">;
  canRead: boolean;
  canUpdate: boolean;
}) {
  const profile = useLegalProfile(customerId, canRead);
  const [mode, setMode] = useQueryState("legalProfile", parseAsStringLiteral(["edit"] as const));
  // BO-UX-30: đến từ hợp đồng của đơn → link quay lại. Chỉ nhận đường dẫn trong back-office (không mở chuyển hướng ra ngoài).
  const [returnParam] = useQueryState("returnTo", parseAsString);
  const returnTo = returnParam && /^\/admin\/[^/]/.test(returnParam) ? returnParam : null;
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.location.hash === `#${LEGAL_PROFILE_ANCHOR}`) anchor.current?.scrollIntoView();
  }, []);

  const data = profile.data;
  const edit = canUpdate ? (
    <Button type="button" variant="outline" size="sm" onClick={() => void setMode("edit")}>
      {data ? "Sửa" : "Nhập thông tin pháp lý"}
    </Button>
  ) : null;

  return (
    <div id={LEGAL_PROFILE_ANCHOR} ref={anchor} className="scroll-mt-20">
      <DetailPanel
        title="Thông tin pháp lý"
        description="In trên hợp đồng và hoá đơn."
        actions={data ? edit : undefined}
      >
        {returnTo && (
          <Notice tone={data ? "positive" : "info"} className="mb-3">
            {data
              ? "Đã có thông tin pháp lý — có thể lập hợp đồng. "
              : "Bạn đến từ hợp đồng của đơn. "}
            <Link href={returnTo} className="text-accent-text font-medium hover:underline">
              Quay lại hợp đồng
            </Link>
          </Notice>
        )}
        {!canRead && (
          <p className="text-ink-tertiary text-[0.8125rem]">
            Bạn chưa có quyền xem thông tin pháp lý.
          </p>
        )}
        {canRead && profile.isPending && <Skeleton className="h-24" />}
        {canRead && profile.isError && (
          <p role="alert" className="text-danger text-[0.8125rem]">
            Không tải được thông tin pháp lý.{" "}
            <button type="button" className="underline" onClick={() => void profile.refetch()}>
              Thử lại
            </button>
          </p>
        )}
        {canRead && profile.isSuccess && !data && (
          <div className="space-y-3">
            <p className="text-ink-secondary text-[0.8125rem]">
              Chưa có thông tin pháp lý — cần trước khi lập hợp đồng.
            </p>
            {edit}
          </div>
        )}
        {data && (
          <FactGrid columns={3}>
            {rowsOf(data, customer).map((row) => (
              <Fact key={row.label} label={row.label}>
                {row.value}
              </Fact>
            ))}
          </FactGrid>
        )}
      </DetailPanel>
      <LegalProfileDialog
        customerId={customerId}
        profile={data ?? null}
        open={canUpdate && profile.isSuccess && mode === "edit"}
        onOpenChange={(open) => void setMode(open ? "edit" : null)}
      />
    </div>
  );
}
