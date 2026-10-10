"use client";

import { ZodError } from "zod";

import { ApiError } from "@/lib/api/error";

import { Button } from "@/components/ui/button";

import { CanonicalVariantIdentityError } from "../variant-api";
import { CANONICAL_VARIANT_TEXT as text } from "../variant-constants";

export function CanonicalVariantFeedback({
  error,
  retry,
  fetching,
}: {
  error: unknown;
  retry: () => void;
  fetching: boolean;
}) {
  const message =
    error instanceof CanonicalVariantIdentityError
      ? text.mismatch
      : error instanceof ZodError
        ? text.malformed
        : error instanceof ApiError && error.status === 403
          ? text.denied
          : text.failed;
  return (
    <div className="space-y-2">
      <p role="alert" className="text-danger">
        {message}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={retry} disabled={fetching}>
        {text.retry}
      </Button>
    </div>
  );
}
