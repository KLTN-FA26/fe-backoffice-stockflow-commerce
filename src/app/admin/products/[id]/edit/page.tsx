import { ProductCreate } from "@/features/product/components/ProductCreate";

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductCreate productId={id} />;
}
