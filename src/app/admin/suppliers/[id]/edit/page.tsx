import { EditSupplierPage } from "@/features/supplier/components/EditSupplierPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditSupplierPage id={id} />;
}
