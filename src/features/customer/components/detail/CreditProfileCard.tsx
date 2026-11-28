"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { CREDIT_REQUEST_PERMISSIONS, CREDIT_REQUEST_ROUTES } from "@/constants/credit-request";
import { useCan } from "@/lib/auth/components/Can";
import { formatMoney } from "@/lib/format/money";
import { useCreditProfile } from "@/features/customer/queries";
import { DetailPanel, Fact, FactGrid } from "@/components/shared/DetailPanel";
import { Notice } from "@/components/shared/Notice";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import { CreditPositionFacts } from "./CreditPositionFacts";
import { CreditProfileDialog } from "./CreditProfileDialog";

import type { CreditProfile } from "@/features/customer/types";

/** Neo của thẻ — đơn bị giữ vì công nợ dẫn tới `?creditProfile=edit#credit-profile`. */
const CREDIT_PROFILE_ANCHOR = "credit-profile";
const MUTED = "text-ink-tertiary font-normal";

/** Hạn mức và kỳ hạn đã cấp (chưa cấp → nói rõ, không để ô trống). */
function ProfileFacts({ data }: { data: CreditProfile }) {
  return (
    <>
      <Fact label="Hạn mức công nợ">
        {data.creditLimit != null ? (
          <span className="tabular-nums">{formatMoney(data.creditLimit, data.currency)}</span>
        ) : (
          <span className={MUTED}>Chưa cấp</span>
        )}
      </Fact>
      <Fact label="Kỳ hạn công nợ">
        {data.creditTermDays != null ? (
          <span className="tabular-nums">{data.creditTermDays} ngày</span>
        ) : (
          <span className={MUTED}>—</span>
        )}
      </Fact>
      {/* #286: ai duyệt hạn mức — BE kèm tên; vắng thì không hiện */}
      {data.approvedByName && <Fact label="Người duyệt">{data.approvedByName}</Fact>}
    </>
  );
}

/**
 * Hạn mức & kỳ hạn công nợ (docs 18 §2). Cấp / sửa chỉ cho người duyệt công nợ (`customer-credit-profiles:APPROVE`,
 * BR-02; quyết định B1: Sales không cấp CREDIT; AUTH-6: Kế toán). Hộp thoại mở theo URL `?creditProfile=edit`
 * (state-persistence): nút ở đây và lối tắt từ đơn bị giữ vì công nợ cùng một đường.
 */
export function CreditProfileCard({
  customerId,
  canRead,
  canApprove,
}: {
  customerId: string;
  canRead: boolean;
  canApprove: boolean;
}) {
  // Sửa cần bản hiện tại (`expectedVersion`) — BE GET cần READ, nên nút sửa chỉ hiện khi đã đọc được hồ sơ.
  // UI-only, Backend phải re-check (PUT cần APPROVE).
  const profile = useCreditProfile(customerId, canRead);
  const [mode, setMode] = useQueryState("creditProfile", parseAsStringLiteral(["edit"] as const));
  // Chỉ nhận đường dẫn trong back-office (không mở chuyển hướng ra ngoài).
  const [returnParam] = useQueryState("creditReturnTo", parseAsString);
  const returnTo = returnParam && /^\/admin\/[^/]/.test(returnParam) ? returnParam : null;
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.location.hash === `#${CREDIT_PROFILE_ANCHOR}`) anchor.current?.scrollIntoView();
  }, []);

  // A2 (BE PR #490): Sale không sửa hạn mức trực tiếp mà gửi đề nghị thay khách cho Kế toán duyệt. Form tạo nằm ở
  // trang đề nghị (`?create=<customerId>`) — không import feature khác. UI-only, Backend re-check (CREATE).
  const canRequest = useCan(CREDIT_REQUEST_PERMISSIONS.create);
  const data = profile.data;
  const request = canRequest ? (
    <Button asChild variant="outline" size="sm">
      <Link href={CREDIT_REQUEST_ROUTES.createFor(customerId)}>Đề nghị cấp hạn mức</Link>
    </Button>
  ) : null;
  const editButton =
    canApprove && data ? (
      <Button type="button" variant="outline" size="sm" onClick={() => void setMode("edit")}>
        {data.configured ? "Sửa hạn mức" : "Cấp hạn mức công nợ"}
      </Button>
    ) : null;
  const edit =
    request || editButton ? (
      <>
        {request}
        {editButton}
      </>
    ) : undefined;

  return (
    <div id={CREDIT_PROFILE_ANCHOR} ref={anchor} className="scroll-mt-20">
      {/* DetailPanel (backoffice-erp-ui B13): nút ở thanh tiêu đề, xuống dòng khi hẹp — không tràn sang cột bên. */}
      <DetailPanel
        title="Hạn mức & kỳ hạn công nợ"
        description="Dư nợ và quá hạn tính tại lúc mở trang."
        actions={edit && <div className="flex flex-wrap justify-end gap-2">{edit}</div>}
      >
        {returnTo && (
          <Notice tone="info" className="mb-3">
            Bạn đến từ đơn bị giữ vì công nợ.{" "}
            <Link href={returnTo} className="text-accent-text font-medium hover:underline">
              Quay lại
            </Link>
          </Notice>
        )}
        {!canRead && (
          <p className="text-ink-tertiary text-[0.8125rem]">
            Bạn chưa có quyền xem hạn mức công nợ.
          </p>
        )}
        {canRead && profile.isPending && <Skeleton className="h-16" />}
        {canRead && profile.isError && (
          <p role="alert" className="text-danger text-[0.8125rem]">
            Không tải được hạn mức công nợ.{" "}
            <button type="button" className="underline" onClick={() => void profile.refetch()}>
              Thử lại
            </button>
          </p>
        )}
        {data && (
          <div className="space-y-4">
            <FactGrid columns={3}>
              <ProfileFacts data={data} />
              <CreditPositionFacts customerId={customerId} />
            </FactGrid>
            {(data.note || !data.configured) && (
              <p className="text-ink-secondary text-[0.8125rem]">
                {data.note ?? "Chưa cấu hình hạn mức công nợ"}
              </p>
            )}
          </div>
        )}
      </DetailPanel>
      <CreditProfileDialog
        customerId={customerId}
        profile={data}
        open={canApprove && mode === "edit"}
        onOpenChange={(open) => void setMode(open ? "edit" : null)}
      />
    </div>
  );
}
