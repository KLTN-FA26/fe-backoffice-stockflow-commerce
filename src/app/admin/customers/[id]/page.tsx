import { CustomerDetail } from "@/features/customer";

export default async function CustomerDetailPage({ params }: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  return <CustomerDetail id={id} />;
}
