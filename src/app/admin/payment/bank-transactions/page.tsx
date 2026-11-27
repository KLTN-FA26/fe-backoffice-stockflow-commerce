import { Suspense } from "react";

import { BankTransactionList } from "@/features/bank-transaction";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Giao dịch ngân hàng SePay — quyền VIEW_PAGE do `BankTransactionList` kiểm. */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <BankTransactionList />
    </Suspense>
  );
}
