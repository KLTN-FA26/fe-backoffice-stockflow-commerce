"use client";

import Link from "next/link";
import { parseAsInteger, useQueryState } from "nuqs";

import { ADMIN_ROUTES, PAGE_SIZE } from "@/constants";
import { useCan } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMock } from "@/providers/app-providers";

import {
  CANONICAL_VARIANT_PAGE_PARAM,
  CANONICAL_VARIANT_READ_PERMISSION,
  CANONICAL_VARIANT_TEXT as text,
} from "../variant-constants";
import { useCanonicalVariants } from "../variant-queries";
import { canonicalUuidSchema } from "../variant-schemas";
import { CanonicalVariantFeedback } from "./CanonicalVariantFeedback";

export function CanonicalVariantsSection({ productId }: { productId: string }) {
  const [urlPage, setPage] = useQueryState(
    CANONICAL_VARIANT_PAGE_PARAM,
    parseAsInteger.withDefault(0),
  );
  const page = Math.max(0, urlPage);
  const canRead = useCan(CANONICAL_VARIANT_READ_PERMISSION);
  const isMock = useIsMock();
  const valid = canonicalUuidSchema.safeParse(productId).success;
  const query = useCanonicalVariants(productId, page, PAGE_SIZE.md, canRead && !isMock);
  const acceptedPage = query.data?.page ?? page;
  return (
    <section
      aria-label={text.listTitle}
      className="border-border-default bg-bg-surface min-w-0 space-y-3 rounded-[var(--r-sm)] border p-[var(--card-pad)]"
    >
      <h2 className="text-ink-primary text-sm font-semibold">{text.listTitle}</h2>
      <p className="text-ink-secondary text-sm">{text.description}</p>
      {isMock || !valid ? (
        <p role="status">{text.mockUnavailable}</p>
      ) : !canRead ? (
        <p role="alert">{text.denied}</p>
      ) : query.isError ? (
        <CanonicalVariantFeedback
          error={query.error}
          retry={() => void query.refetch()}
          fetching={query.isFetching}
        />
      ) : query.fetchStatus === "paused" ? (
        <p role="status">{text.paused}</p>
      ) : !query.data ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <>
          {query.isFetching && <progress className="w-full" aria-label="Đang tải lại biến thể" />}
          {query.data.items.length === 0 ? (
            <p>{text.empty}</p>
          ) : (
            <Table>
              <TableCaption>
                {query.data.totalElements} biến thể · trang {query.data.page + 1}/
                {query.data.totalPages}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{text.sku}</TableHead>
                  <TableHead>{text.name}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((variant) => (
                  <TableRow key={variant.identity.variantId}>
                    <TableCell className="break-all">
                      <Link
                        className="text-accent underline"
                        href={ADMIN_ROUTES.products.canonicalSkuDetail(
                          variant.identity.productId,
                          variant.identity.variantId,
                        )}
                      >
                        {variant.identity.sku}
                      </Link>
                    </TableCell>
                    <TableCell className="break-all">{variant.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!query.data.hasPrevious || query.isFetching}
              onClick={() => void setPage(acceptedPage - 1)}
            >
              {text.previous}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!query.data.hasNext || query.isFetching}
              onClick={() => void setPage(acceptedPage + 1)}
            >
              {text.next}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
