import { CanonicalSkuDetail } from "@/features/product/components/CanonicalSkuDetail";

export default async function CanonicalSkuDetailPage({
  params,
}: {
  params: Promise<{ id: string; variantId: string }>;
}) {
  const { id: productId, variantId } = await params;
  return <CanonicalSkuDetail productId={productId} variantId={variantId} />;
}
