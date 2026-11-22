"use client";

import { useEffect, useRef } from "react";
import { Scale } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { useLegalProfile } from "@/features/customer/queries";
import { DETAIL_ACTION_CLASS, DetailSection, InfoRow } from "@/components/shared/DetailSection";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import { LegalProfileDialog } from "./LegalProfileDialog";

import type { LegalProfile } from "@/features/customer/types";

const MONO = "font-[family-name:var(--font-mono)] tabular-nums";
/** Neo của thẻ — trang đơn dẫn tới `?legalProfile=edit#legal-profile`. */
const LEGAL_PROFILE_ANCHOR = "legal-profile";

function rowsOf(profile: LegalProfile) {
  const bank = profile.bankAccount;
  return [
    { label: "Tên công ty", value: profile.companyName },
    {
      label: "Mã số thuế",
      value: profile.taxCode ? <span className={MONO}>{profile.taxCode}</span> : "Chưa có",
    },
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
  canRead,
  canUpdate,
}: {
  customerId: string;
  canRead: boolean;
  canUpdate: boolean;
}) {
  const profile = useLegalProfile(customerId, canRead);
  const [mode, setMode] = useQueryState("legalProfile", parseAsStringLiteral(["edit"] as const));
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.location.hash === `#${LEGAL_PROFILE_ANCHOR}`) anchor.current?.scrollIntoView();
  }, []);

  const data = profile.data;
  const edit = canUpdate ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={DETAIL_ACTION_CLASS.outline}
      onClick={() => void setMode("edit")}
    >
      {data ? "Sửa" : "Nhập thông tin pháp lý"}
    </Button>
  ) : null;

  return (
    <div id={LEGAL_PROFILE_ANCHOR} ref={anchor} className="scroll-mt-20">
      <DetailSection title="Thông tin pháp lý" icon={Scale} actions={data ? edit : undefined}>
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
          <div className="divide-y divide-(--table-line)">
            {rowsOf(data).map((row) => (
              <InfoRow key={row.label} label={row.label}>
                {row.value}
              </InfoRow>
            ))}
          </div>
        )}
      </DetailSection>
      <LegalProfileDialog
        customerId={customerId}
        profile={data ?? null}
        open={canUpdate && profile.isSuccess && mode === "edit"}
        onOpenChange={(open) => void setMode(open ? "edit" : null)}
      />
    </div>
  );
}
