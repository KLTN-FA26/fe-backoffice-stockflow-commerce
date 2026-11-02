import { PortalSampleDetail } from "@/features/sample-request";

export default async function PortalSampleDetailPage({
  params,
}: PageProps<"/portal/samples/[id]">) {
  const { id } = await params;
  return <PortalSampleDetail id={id} />;
}
