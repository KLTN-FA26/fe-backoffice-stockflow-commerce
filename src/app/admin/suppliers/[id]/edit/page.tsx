import { EditSupplierPage } from "@/features/supplier/components/EditSupplierPage";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <EditSupplierPage params={params} />;
}
