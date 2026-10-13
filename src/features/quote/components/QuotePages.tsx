"use client";

import { useSearchParams } from "next/navigation";

import { ADMIN_ROUTES, QUOTE_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useQuote } from "@/features/quote/queries";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { QUOTE_COPY } from "./copy";
import { QuoteForm } from "./QuoteForm";

function CreateContent() {
  const params = useSearchParams();
  return <QuoteForm initialCustomerId={params.get("customerId") ?? undefined} />;
}

export function QuoteCreate() {
  return (
    <PermissionBoundary
      permissions={[QUOTE_PERMISSIONS.viewPage, QUOTE_PERMISSIONS.create]}
      variant="detail"
    >
      <CreateContent />
    </PermissionBoundary>
  );
}

function EditContent({ id }: { id: string }) {
  const canRead = useCan(QUOTE_PERMISSIONS.read);
  const query = useQuote(id, { enabled: canRead });
  const back = { href: ADMIN_ROUTES.quotes.detail(id), label: "Về báo giá" };
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={QUOTE_COPY}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.isPending) return <PageSkeleton variant="form" />;
  // Chỉ báo giá nháp được sửa (BE PUT chỉ nhận DRAFT).
  if (query.data.status !== "DRAFT")
    return (
      <LoadErrorState
        error={null}
        kind="forbidden"
        copy={{ ...QUOTE_COPY, forbiddenDescription: "Chỉ báo giá nháp mới sửa được nội dung." }}
        back={back}
      />
    );
  return <QuoteForm quote={query.data} />;
}

export function QuoteEdit({ id }: { id: string }) {
  return (
    <PermissionBoundary
      permissions={[QUOTE_PERMISSIONS.viewPage, QUOTE_PERMISSIONS.update]}
      variant="detail"
    >
      <EditContent id={id} />
    </PermissionBoundary>
  );
}
