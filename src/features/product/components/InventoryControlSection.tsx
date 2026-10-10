"use client";

import { ZodError } from "zod";

import { ApiError } from "@/lib/api/error";
import { useCan } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMock } from "@/providers/app-providers";

import { InventoryControlIdentityError } from "../inventory-control/api";
import {
  INVENTORY_CONTROL_TEXT as text,
  INVENTORY_CONTROL_UPDATE_PERMISSION,
} from "../inventory-control/constants";
import { useInventoryControl } from "../inventory-control/queries";
import { CANONICAL_VARIANT_READ_PERMISSION } from "../variant-constants";
import { canonicalVariantRouteSchema } from "../variant-schemas";
import { InventoryControlWorkspace } from "./InventoryControlWorkspace";

import type { CanonicalVariantIdentity } from "../variant-schemas";

export function InventoryControlSection({ identity }: { identity: CanonicalVariantIdentity }) {
  const canRead = useCan(CANONICAL_VARIANT_READ_PERMISSION);
  const canEdit = useCan(INVENTORY_CONTROL_UPDATE_PERMISSION);
  const isMock = useIsMock();
  const query = useInventoryControl(identity.productId, identity.variantId, canRead && !isMock);
  const valid = canonicalVariantRouteSchema.safeParse(identity).success;
  let content;
  if (!valid) content = <p role="alert">{text.invalid}</p>;
  else if (isMock) content = <p role="status">{text.mockUnavailable}</p>;
  else if (!canRead) content = <p role="alert">{text.denied}</p>;
  else if (query.isError && !query.data) {
    const message =
      query.error instanceof ZodError
        ? text.malformed
        : query.error instanceof InventoryControlIdentityError
          ? text.mismatch
          : query.error instanceof ApiError && query.error.status === 403
            ? text.denied
            : text.failed;
    content = (
      <div className="space-y-2">
        <p role="alert" className="text-danger">
          {message}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {text.retry}
        </Button>
      </div>
    );
  } else if (query.fetchStatus === "paused" && !query.data)
    content = <p role="status">{text.paused}</p>;
  else if (!query.data)
    content = (
      <div role="status" aria-label={text.loading}>
        <Skeleton className="h-32 w-full" />
      </div>
    );
  else
    content = (
      <>
        {query.isFetching && <progress className="w-full" aria-label={text.refreshing} />}
        {query.fetchStatus === "paused" && <p role="status">{text.paused}</p>}
        {query.isError && <p role="alert">{text.failed}</p>}
        <InventoryControlWorkspace
          key={`${identity.productId}/${identity.variantId}`}
          value={query.data}
          revision={query.dataUpdatedAt}
          canEdit={canEdit}
          reload={async () => {
            const result = await query.refetch({ throwOnError: true });
            if (!result.data) throw new Error(text.failed);
            return result.data;
          }}
        />
      </>
    );
  return (
    <section
      aria-label={text.title}
      className="border-border-default bg-bg-surface min-w-0 space-y-4 rounded-[var(--r-sm)] border p-[var(--card-pad)]"
    >
      <h2 className="text-ink-primary text-base font-semibold">{text.title}</h2>
      {content}
    </section>
  );
}
