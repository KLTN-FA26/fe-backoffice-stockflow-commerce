"use client";

import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { useCan } from "@/lib/auth";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { useIsMock } from "@/providers/app-providers";

import {
  CANONICAL_VARIANT_READ_PERMISSION,
  CANONICAL_VARIANT_TEXT as text,
} from "../variant-constants";
import { useCanonicalVariant } from "../variant-queries";
import { canonicalVariantRouteSchema } from "../variant-schemas";
import { CanonicalVariantFeedback } from "./CanonicalVariantFeedback";
import { InventoryControlSection } from "./InventoryControlSection";

import type { CanonicalVariant } from "../variant-schemas";

/** Data loader for the additive route. Never invokes legacy useSku or a list resolver. */
export function CanonicalSkuDetail({
  productId,
  variantId,
}: {
  productId: string;
  variantId: string;
}) {
  const canRead = useCan(CANONICAL_VARIANT_READ_PERMISSION);
  const isMock = useIsMock();
  const valid = canonicalVariantRouteSchema.safeParse({ productId, variantId }).success;
  const query = useCanonicalVariant(productId, variantId, canRead && !isMock);
  if (!valid) return <p role="alert">{text.invalid}</p>;
  if (isMock) return <p role="status">{text.mockUnavailable}</p>;
  if (!canRead) return <p role="alert">{text.denied}</p>;
  if (query.isError && !query.data)
    return (
      <CanonicalVariantFeedback
        error={query.error}
        retry={() => void query.refetch()}
        fetching={query.isFetching}
      />
    );
  if (query.fetchStatus === "paused" && !query.data) return <p role="status">{text.paused}</p>;
  if (!query.data) return <PageSkeleton variant="detail" />;
  return (
    <div className="min-w-0 space-y-4">
      {query.isError && (
        <CanonicalVariantFeedback
          error={query.error}
          retry={() => void query.refetch()}
          fetching={query.isFetching}
        />
      )}
      {query.fetchStatus === "paused" && <p role="status">{text.paused}</p>}
      <CanonicalSkuPresentation variant={query.data} refreshing={query.isFetching} />
    </div>
  );
}

/** Only confirmed canonical data, with the validated identity available to future features. */
export function CanonicalSkuPresentation({
  variant,
  refreshing,
}: {
  variant: CanonicalVariant;
  refreshing: boolean;
}) {
  const { identity } = variant;
  return (
    <div className="min-w-0 space-y-4">
      <PageHeader title={text.detailTitle} subtitle={identity.sku} />
      {refreshing && <progress className="w-full" aria-label="Đang tải lại biến thể" />}
      <Link
        className="text-accent underline"
        href={ADMIN_ROUTES.products.detail(identity.productId)}
      >
        Về sản phẩm
      </Link>
      <section
        className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-[var(--card-pad)]"
        aria-label={text.detailTitle}
      >
        <dl className="space-y-2 text-sm">
          {[
            [text.productId, identity.productId],
            [text.variantId, identity.variantId],
            [text.sku, identity.sku],
            [text.name, variant.name],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-ink-tertiary">{label}</dt>
              <dd className="text-ink-primary break-all">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <InventoryControlSection identity={identity} />
    </div>
  );
}
