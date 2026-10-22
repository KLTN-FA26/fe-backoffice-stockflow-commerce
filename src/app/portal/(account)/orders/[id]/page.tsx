import { PortalOrderDetail } from "@/features/customer-order";

export default async function PortalOrderDetailPage({ params }: PageProps<"/portal/orders/[id]">) {
  const { id } = await params;
  return <PortalOrderDetail id={id} />;
}
