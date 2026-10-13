import { PortalQuoteDetail } from "@/features/quote";

export default async function PortalQuoteDetailPage({ params }: PageProps<"/portal/quotes/[id]">) {
  const { id } = await params;
  return <PortalQuoteDetail id={id} />;
}
