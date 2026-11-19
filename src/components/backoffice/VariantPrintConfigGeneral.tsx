import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { PRINT_CONFIG_PAGE_LABELS } from "@/constants/labels-print-config";
import { StatusDot } from "@/components/shared/StatusDot";

import type { Product, Variant } from "@/features/product";

const TEXT = PRINT_CONFIG_PAGE_LABELS.general;

/**
 * Who the page is about, at the head of the page band: the variant's SKU and status, its name, and its product. The page
 * has no title, so the variant's name is here; the product's name links back to the product (the breadcrumb does too).
 */
export function VariantPrintConfigGeneral({
  product,
  variant,
}: {
  product: Product;
  variant: Variant;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="sr-only">{`${TEXT.sku}: `}</span>
        <span className="text-accent font-[family-name:var(--font-mono)] text-[0.9375rem] font-semibold">
          {variant.sku}
        </span>
        <span className="sr-only">{`${TEXT.variantStatus}: `}</span>
        <StatusDot domain="sku" status={variant.status} size="sm" />
      </p>
      <p className="text-ink-primary text-[0.8125rem] font-medium">
        <span className="sr-only">{`${TEXT.variantName}: `}</span>
        {variant.name}
      </p>
      <p className="text-ink-secondary text-xs">
        {`${TEXT.product}: `}
        <Link
          href={ADMIN_ROUTES.products.detail(product.productId)}
          className="text-accent focus-visible:ring-ring rounded-sm underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          {product.name}
        </Link>
      </p>
    </div>
  );
}
