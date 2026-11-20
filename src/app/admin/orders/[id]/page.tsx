import { OrderDetailWithLoadEstimate } from "@/components/backoffice/OrderDetailWithLoadEstimate";
import { RelatedConversationLink } from "@/components/backoffice/RelatedConversationLink";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  return (
    <>
      <RelatedConversationLink target={{ kind: "ORDER", id }} />
      <OrderDetailWithLoadEstimate params={params} />
    </>
  );
}
