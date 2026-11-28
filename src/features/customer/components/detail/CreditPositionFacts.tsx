"use client";

import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { useCreditPosition } from "@/features/customer/queries";
import { Fact } from "@/components/shared/DetailPanel";
import { Skeleton } from "@/components/shared/Skeleton";

const MONEY = "tabular-nums";

/**
 * Dư nợ, còn dùng được, quá hạn của khách (BE `GET /orders/credit-position/{customerId}`, cùng quyền đọc hạn mức) — ba ô
 * nối tiếp hạn mức và kỳ hạn trong lưới thông số. Số liệu tính tại lúc mở trang (15 BR-10), không lưu.
 */
export function CreditPositionFacts({ customerId }: { customerId: string }) {
  const position = useCreditPosition(customerId);
  if (position.isPending)
    return (
      <div role="status" aria-label="Đang tải dư nợ" className="space-y-1 sm:col-span-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  if (position.isError)
    return (
      <div role="alert" className="text-danger text-[0.8125rem] sm:col-span-2">
        Không tải được dư nợ của khách.{" "}
        <button type="button" className="underline" onClick={() => void position.refetch()}>
          Thử lại
        </button>
      </div>
    );
  const p = position.data;
  return (
    <>
      <Fact label="Dư nợ hiện tại">
        <span className={MONEY}>{formatMoney(p.exposure, p.currency)}</span>
      </Fact>
      <Fact label="Còn dùng được">
        {p.availableCredit != null ? (
          <span className={MONEY}>{formatMoney(p.availableCredit, p.currency)}</span>
        ) : (
          <span className="text-ink-tertiary font-normal">Không bán trả sau</span>
        )}
      </Fact>
      <Fact label="Quá hạn">
        {p.hasOverdue ? (
          <span className="text-danger">
            <span className={MONEY}>{formatMoney(p.overdueAmount ?? 0, p.currency)}</span>
            {p.oldestOverdueDueDate && (
              <span className="block text-xs font-normal">
                Cũ nhất từ {formatDate(p.oldestOverdueDueDate)}
              </span>
            )}
          </span>
        ) : (
          <span className="text-ink-tertiary font-normal">Không có</span>
        )}
      </Fact>
    </>
  );
}
