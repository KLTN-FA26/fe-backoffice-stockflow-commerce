import { OrderDetailWithLoadEstimate } from "@/components/backoffice/OrderDetailWithLoadEstimate";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  return <OrderDetailWithLoadEstimate params={params} />;
}
