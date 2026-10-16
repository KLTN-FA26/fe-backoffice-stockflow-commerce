import { OrderDetail } from "@/features/order";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  return <OrderDetail params={params} />;
}
